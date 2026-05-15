type QueryResponse = {
  data: Record<string, unknown>[] | Record<string, unknown> | null;
  error: { message?: string | null } | null;
};

type QueryBuilder = PromiseLike<QueryResponse> & {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: string) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  maybeSingle: () => Promise<QueryResponse>;
};

type QueryClient = {
  from: (table: string) => QueryBuilder;
};

export type RuntimeCampaignResolution = {
  campaignId: string;
  offerId: string;
  affiliateEmail: string | null;
  businessEmail: string | null;
  status: string | null;
  sourceTable: 'live_campaigns' | 'live_ads';
};

export function isUuid(value: unknown) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function resolveRuntimeCampaign(
  supabase: QueryClient,
  params: {
    campaignId: string | null;
    affiliateEmail?: string | null;
  },
): Promise<RuntimeCampaignResolution | null> {
  if (!params.campaignId) return null;

  if (isUuid(params.campaignId)) {
    const { data: liveCampaign, error: liveCampaignError } = await supabase
      .from('live_campaigns')
      .select('id, offer_id, affiliate_email, business_email, status')
      .eq('id', params.campaignId)
      .maybeSingle();

    if (liveCampaignError) {
      throw new Error(`Failed to resolve live_campaigns identity: ${liveCampaignError.message || liveCampaignError}`);
    }

    const organic = liveCampaign as {
      id?: string;
      offer_id?: string;
      affiliate_email?: string | null;
      business_email?: string | null;
      status?: string | null;
    } | null;

    if (organic?.id && organic.offer_id) {
      return {
        campaignId: organic.id,
        offerId: organic.offer_id,
        affiliateEmail: organic.affiliate_email ?? null,
        businessEmail: organic.business_email ?? null,
        status: organic.status ?? null,
        sourceTable: 'live_campaigns',
      };
    }

    const { data: liveAd, error: liveAdError } = await supabase
      .from('live_ads')
      .select('id, offer_id, affiliate_email, business_email, status')
      .eq('id', params.campaignId)
      .maybeSingle();

    if (liveAdError) {
      throw new Error(`Failed to resolve live_ads identity: ${liveAdError.message || liveAdError}`);
    }

    const paid = liveAd as {
      id?: string;
      offer_id?: string;
      affiliate_email?: string | null;
      business_email?: string | null;
      status?: string | null;
    } | null;

    if (paid?.id && paid.offer_id) {
      return {
        campaignId: paid.id,
        offerId: paid.offer_id,
        affiliateEmail: paid.affiliate_email ?? null,
        businessEmail: paid.business_email ?? null,
        status: paid.status ?? null,
        sourceTable: 'live_ads',
      };
    }
  }

  const { data: metaCampaign, error: metaCampaignError } = await supabase
    .from('live_ads')
    .select('id, offer_id, affiliate_email, business_email, status')
    .eq('meta_campaign_id', params.campaignId)
    .maybeSingle();

  if (metaCampaignError) {
    throw new Error(`Failed to resolve meta campaign identity: ${metaCampaignError.message || metaCampaignError}`);
  }

  const metaPaid = metaCampaign as {
    id?: string;
    offer_id?: string;
    affiliate_email?: string | null;
    business_email?: string | null;
    status?: string | null;
  } | null;

  if (metaPaid?.id && metaPaid.offer_id) {
    if (params.affiliateEmail && metaPaid.affiliate_email && metaPaid.affiliate_email !== params.affiliateEmail) {
      return null;
    }

    return {
      campaignId: metaPaid.id,
      offerId: metaPaid.offer_id,
      affiliateEmail: metaPaid.affiliate_email ?? null,
      businessEmail: metaPaid.business_email ?? null,
      status: metaPaid.status ?? null,
      sourceTable: 'live_ads',
    };
  }

  return null;
}
