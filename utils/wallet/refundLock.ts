type NumericLike = number | string | null | undefined;

type LiveAdLike = {
  id?: string | null;
  status?: string | null;
  billing_state?: string | null;
  spend?: NumericLike;
  spend_transferred?: NumericLike;
};

export type RefundLockState = {
  hasActiveMetaAds: boolean;
  hasUnpaidAdSpend: boolean;
  activeAdCount: number;
  unpaidAdCount: number;
  totalUnpaidSpend: number;
  locked: boolean;
  reasonCode: 'ACTIVE_META_AD_LOCK' | 'UNPAID_AD_SPEND_LOCK' | null;
  message: string | null;
};

function toMoney(value: NumericLike) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isActiveLike(status?: string | null, billingState?: string | null) {
  const s = String(status || '').toLowerCase();
  const b = String(billingState || '').toLowerCase();
  return s === 'active' || s === 'live' || b === 'active' || b === 'live';
}

export function calculateRefundLockState(liveAds: LiveAdLike[] | null | undefined): RefundLockState {
  const rows = liveAds ?? [];

  let activeAdCount = 0;
  let unpaidAdCount = 0;
  let totalUnpaidSpend = 0;

  for (const row of rows) {
    if (isActiveLike(row.status, row.billing_state)) {
      activeAdCount += 1;
    }

    const unpaid = Math.max(0, toMoney(row.spend) - toMoney(row.spend_transferred));
    if (unpaid > 0) {
      unpaidAdCount += 1;
      totalUnpaidSpend += unpaid;
    }
  }

  totalUnpaidSpend = Math.round(totalUnpaidSpend * 100) / 100;

  if (activeAdCount > 0) {
    return {
      hasActiveMetaAds: true,
      hasUnpaidAdSpend: unpaidAdCount > 0,
      activeAdCount,
      unpaidAdCount,
      totalUnpaidSpend,
      locked: true,
      reasonCode: 'ACTIVE_META_AD_LOCK',
      message: 'Refunds are locked while you have active Meta ads.',
    };
  }

  if (unpaidAdCount > 0) {
    return {
      hasActiveMetaAds: false,
      hasUnpaidAdSpend: true,
      activeAdCount,
      unpaidAdCount,
      totalUnpaidSpend,
      locked: true,
      reasonCode: 'UNPAID_AD_SPEND_LOCK',
      message: 'Refunds are locked while unpaid ad spend remains unsettled.',
    };
  }

  return {
    hasActiveMetaAds: false,
    hasUnpaidAdSpend: false,
    activeAdCount: 0,
    unpaidAdCount: 0,
    totalUnpaidSpend: 0,
    locked: false,
    reasonCode: null,
    message: null,
  };
}

type RefundLockQueryResponse = {
  data: Record<string, unknown>[] | null;
  error: { message?: string | null } | null;
};

type RefundLockQueryBuilder = PromiseLike<RefundLockQueryResponse> & {
  select: (columns: string) => RefundLockQueryBuilder;
  eq: (column: string, value: string) => RefundLockQueryBuilder;
};

type RefundLockQueryClient = {
  from: (table: string) => RefundLockQueryBuilder;
};

export async function getRefundLockState(
  supabase: RefundLockQueryClient,
  affiliateEmail: string,
): Promise<RefundLockState> {
  const { data, error } = await supabase
    .from('live_ads')
    .select('id, status, billing_state, spend, spend_transferred')
    .eq('affiliate_email', affiliateEmail);

  if (error) {
    throw new Error(`Failed to fetch live ads for refund lock: ${error.message || error}`);
  }

  return calculateRefundLockState(data as LiveAdLike[]);
}
