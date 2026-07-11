type QueryResponse = {
  data: Record<string, unknown>[] | Record<string, unknown> | null;
  error: { message?: string | null } | null;
};

type QueryBuilder = PromiseLike<QueryResponse> & {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: string | boolean | null) => QueryBuilder;
  is: (column: string, value: null) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  maybeSingle: () => Promise<QueryResponse>;
};

export type QueryClient = {
  from: (table: string) => QueryBuilder;
};

export type ApprovalEnforcementResult = {
  ok: true;
} | {
  ok: false;
  status: number;
  error: string;
  message: string;
};

export const TRACKING_NOT_READY_MESSAGE =
  'Tracking is not connected for this offer yet. Ask the business to open Setup tracking, install the Nettmark pixel, and run the test before launching campaigns.';

export async function assertOfferTrackingReady(
  supabase: QueryClient,
  offerId: string,
): Promise<ApprovalEnforcementResult> {
  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('id, business_email')
    .eq('id', offerId)
    .maybeSingle();

  if (offerError) {
    throw new Error(`Failed to verify offer tracking readiness: ${offerError.message || offerError}`);
  }

  const offerRow = offer as { business_email?: string | null } | null;
  if (!offerRow) {
    return {
      ok: false,
      status: 404,
      error: 'OFFER_NOT_FOUND',
      message: 'Offer not found.',
    };
  }

  const { data: offerProgress, error: offerProgressError } = await supabase
    .from('business_onboarding_progress')
    .select('tracking_connected')
    .eq('offer_id', offerId)
    .eq('tracking_connected', true)
    .limit(1)
    .maybeSingle();

  if (offerProgressError) {
    throw new Error(`Failed to verify offer tracking status: ${offerProgressError.message || offerProgressError}`);
  }

  if ((offerProgress as { tracking_connected?: boolean } | null)?.tracking_connected) {
    return { ok: true };
  }

  if (offerRow.business_email) {
    const { data: businessProgress, error: businessProgressError } = await supabase
      .from('business_onboarding_progress')
      .select('tracking_connected')
      .eq('business_email', offerRow.business_email)
      .is('offer_id', null)
      .eq('tracking_connected', true)
      .limit(1)
      .maybeSingle();

    if (businessProgressError) {
      throw new Error(`Failed to verify business tracking status: ${businessProgressError.message || businessProgressError}`);
    }

    if ((businessProgress as { tracking_connected?: boolean } | null)?.tracking_connected) {
      return { ok: true };
    }
  }

  const { data: testPixel, error: testPixelError } = await supabase
    .from('campaign_tracking_events')
    .select('id')
    .eq('offer_id', offerId)
    .eq('event_type', 'test_pixel')
    .limit(1)
    .maybeSingle();

  if (testPixelError) {
    throw new Error(`Failed to verify tracking test event: ${testPixelError.message || testPixelError}`);
  }

  if (testPixel) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 409,
    error: 'OFFER_TRACKING_NOT_READY',
    message: TRACKING_NOT_READY_MESSAGE,
  };
}

export async function assertAffiliateOfferApproved(
  supabase: QueryClient,
  params: {
    offerId: string;
    affiliateEmail: string;
  },
): Promise<ApprovalEnforcementResult> {
  const { data, error } = await supabase
    .from('affiliate_requests')
    .select('id, status')
    .eq('offer_id', params.offerId)
    .eq('affiliate_email', params.affiliateEmail)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify affiliate approval: ${error.message || error}`);
  }

  const row = data as { status?: string | null } | null;
  const status = String(row?.status || '').toLowerCase();

  if (status !== 'approved') {
    return {
      ok: false,
      status: 403,
      error: 'AFFILIATE_OFFER_NOT_APPROVED',
      message: 'Affiliate is not approved for this offer. Conversion and launch money paths are blocked.',
    };
  }

  return { ok: true };
}

export async function assertAdIdeaLaunchApproved(
  supabase: QueryClient,
  params: {
    adIdeaId: string;
    offerId: string;
    affiliateEmail: string;
  },
): Promise<ApprovalEnforcementResult> {
  const affiliateApproval = await assertAffiliateOfferApproved(supabase, {
    offerId: params.offerId,
    affiliateEmail: params.affiliateEmail,
  });

  if (!affiliateApproval.ok) {
    return affiliateApproval;
  }

  const { data, error } = await supabase
    .from('ad_ideas')
    .select('id, status, offer_id, affiliate_email')
    .eq('id', params.adIdeaId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify ad idea approval: ${error.message || error}`);
  }

  const row = data as {
    status?: string | null;
    offer_id?: string | null;
    affiliate_email?: string | null;
  } | null;

  if (!row) {
    return {
      ok: false,
      status: 404,
      error: 'AD_IDEA_NOT_FOUND',
      message: 'Ad idea not found.',
    };
  }

  if (row.offer_id !== params.offerId || row.affiliate_email !== params.affiliateEmail) {
    return {
      ok: false,
      status: 409,
      error: 'AD_IDEA_APPROVAL_CONTEXT_MISMATCH',
      message: 'Ad idea approval context does not match the requested offer/affiliate pair.',
    };
  }

  if (String(row.status || '').toLowerCase() !== 'approved') {
    return {
      ok: false,
      status: 403,
      error: 'AD_IDEA_NOT_APPROVED',
      message: 'Ad idea is not approved for launch.',
    };
  }

  return { ok: true };
}
