type QueryResponse = {
  data: Record<string, unknown>[] | Record<string, unknown> | null;
  error: { message?: string | null } | null;
};

type QueryBuilder = PromiseLike<QueryResponse> & {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: string) => QueryBuilder;
  maybeSingle: () => Promise<QueryResponse>;
};

type QueryClient = {
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
