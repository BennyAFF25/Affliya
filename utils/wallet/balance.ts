type NumericLike = number | string | null | undefined;

type WalletTopupLike = {
  amount_net?: NumericLike;
  amount_refunded?: NumericLike;
  status?: string | null;
};

type WalletDeductionLike = {
  amount?: NumericLike;
};

type WalletRefundLike = {
  amount?: NumericLike;
};

export type WalletBalanceSnapshot = {
  totalTopupsCredited: number;
  totalTopupsNetAvailable: number;
  totalTopupRefunded: number;
  totalDeductions: number;
  totalRefundLedger: number;
  availableBalance: number;
  refundableBalance: number;
  lockedBalance: number;
};

function toMoney(value: NumericLike) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isCountableTopup(row: WalletTopupLike) {
  const status = String(row.status || '').toLowerCase();
  if (!status) return true;
  return status === 'succeeded' || status === 'refunded';
}

function sumTopupsCredited(topups: WalletTopupLike[]) {
  return topups.reduce(
    (sum, row) => sum + (isCountableTopup(row) ? Math.max(0, toMoney(row.amount_net)) : 0),
    0,
  );
}

function sumTopupNetAvailable(topups: WalletTopupLike[]) {
  return topups.reduce((sum, row) => {
    if (!isCountableTopup(row)) return sum;
    const net = toMoney(row.amount_net);
    const refunded = toMoney(row.amount_refunded);
    return sum + Math.max(0, net - refunded);
  }, 0);
}

function sumTopupRefunded(topups: WalletTopupLike[]) {
  return topups.reduce(
    (sum, row) => sum + (isCountableTopup(row) ? Math.max(0, toMoney(row.amount_refunded)) : 0),
    0,
  );
}

function sumAmounts<T extends { amount?: NumericLike }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + toMoney(row.amount), 0);
}

export function calculateWalletBalance(params: {
  topups?: WalletTopupLike[] | null;
  deductions?: WalletDeductionLike[] | null;
  refunds?: WalletRefundLike[] | null;
}): WalletBalanceSnapshot {
  const topups = params.topups ?? [];
  const deductions = params.deductions ?? [];
  const refunds = params.refunds ?? [];

  // Canonical LR-001 rule:
  // available/refundable wallet balance is derived from succeeded top-ups net of
  // embedded top-up refund usage, then reduced by wallet_deductions.
  // wallet_refunds is treated as audit history for now and is not subtracted again,
  // because current refund flow already mutates wallet_topups.amount_refunded.
  const totalTopupsCredited = Math.round(sumTopupsCredited(topups) * 100) / 100;
  const totalTopupsNetAvailable = Math.round(sumTopupNetAvailable(topups) * 100) / 100;
  const totalTopupRefunded = Math.round(sumTopupRefunded(topups) * 100) / 100;
  const totalDeductions = Math.round(sumAmounts(deductions) * 100) / 100;
  const totalRefundLedger = Math.round(sumAmounts(refunds) * 100) / 100;
  const availableBalance = Math.max(
    0,
    Math.round((totalTopupsNetAvailable - totalDeductions) * 100) / 100,
  );

  return {
    totalTopupsCredited,
    totalTopupsNetAvailable,
    totalTopupRefunded,
    totalDeductions,
    totalRefundLedger,
    availableBalance,
    refundableBalance: availableBalance,
    lockedBalance: 0,
  };
}

type WalletQueryResponse = {
  data: Record<string, unknown>[] | null;
  error: { message?: string | null } | null;
};

type WalletQueryBuilder = PromiseLike<WalletQueryResponse> & {
  select: (columns: string) => WalletQueryBuilder;
  eq: (column: string, value: string) => WalletQueryBuilder;
};

type WalletQueryClient = {
  from: (table: string) => WalletQueryBuilder;
};

export async function getWalletBalanceSnapshot(
  supabase: WalletQueryClient,
  email: string,
): Promise<WalletBalanceSnapshot> {
  const [{ data: topups, error: topupError }, { data: deductions, error: deductionError }, { data: refunds, error: refundError }] = await Promise.all([
    supabase
      .from("wallet_topups")
      .select("amount_net, amount_refunded, status")
      .eq("affiliate_email", email),
    supabase
      .from("wallet_deductions")
      .select("amount")
      .eq("affiliate_email", email),
    supabase
      .from("wallet_refunds")
      .select("amount")
      .eq("affiliate_email", email)
      .eq("status", "succeeded"),
  ]);

  if (topupError) {
    throw new Error(`Failed to fetch wallet topups: ${topupError.message || topupError}`);
  }

  if (deductionError) {
    throw new Error(
      `Failed to fetch wallet deductions: ${deductionError.message || deductionError}`,
    );
  }

  if (refundError) {
    throw new Error(`Failed to fetch wallet refunds: ${refundError.message || refundError}`);
  }

  return calculateWalletBalance({
    topups: topups ?? [],
    deductions: deductions ?? [],
    refunds: refunds ?? [],
  });
}
