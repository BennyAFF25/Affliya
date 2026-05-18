const DEFAULT_NETTMARK_FEE_BPS = 220;

function getConfiguredFeeBps() {
  const raw = (process.env.NETTMARK_TRANSACTION_FEE_BPS || "").trim();
  if (!raw) {
    return DEFAULT_NETTMARK_FEE_BPS;
  }

  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed);
  }
  return DEFAULT_NETTMARK_FEE_BPS;
}

export function getNettmarkTransactionFeeBps() {
  return getConfiguredFeeBps();
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateChargeOnTopFee(principalAmount: number) {
  const safePrincipal = roundCurrency(Math.max(0, Number(principalAmount) || 0));
  const feeBps = getConfiguredFeeBps();
  const feeAmount = roundCurrency((safePrincipal * feeBps) / 10000);
  const grossAmount = roundCurrency(safePrincipal + feeAmount);

  return {
    principalAmount: safePrincipal,
    feeBps,
    feeAmount,
    grossAmount,
  };
}

export function toStripeAmount(amount: number) {
  return Math.round((Number(amount) || 0) * 100);
}

export type PlatformFeeLedgerStatus = "accrued" | "withdrawable" | "paid_out";

export type PlatformFeeLedgerRecord = {
  sourceType: "wallet_topup" | "wallet_payout";
  sourceId: string;
  feeCategory: "nettmark_transaction_fee";
  amount: number;
  currency?: string;
  principalAmount?: number | null;
  grossAmount?: number | null;
  stripeFeeAmount?: number | null;
  stripeObjectId?: string | null;
  status?: PlatformFeeLedgerStatus;
  metadata?: Record<string, unknown> | null;
};

export async function recordPlatformFeeLedger(
  supabase: {
    from: (table: string) => {
      upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error?: { message?: string | null } | null }>;
    };
  },
  record: PlatformFeeLedgerRecord,
) {
  const { error } = await supabase.from("platform_fee_ledger").upsert(
    {
      source_type: record.sourceType,
      source_id: record.sourceId,
      fee_category: record.feeCategory,
      amount: roundCurrency(record.amount),
      currency: (record.currency || "aud").toLowerCase(),
      principal_amount: record.principalAmount ?? null,
      gross_amount: record.grossAmount ?? null,
      stripe_fee_amount: record.stripeFeeAmount ?? null,
      stripe_object_id: record.stripeObjectId ?? null,
      status: record.status || "accrued",
      metadata: record.metadata ?? {},
      accrued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "source_type,source_id,fee_category",
    },
  );

  if (error) {
    throw new Error(`platform_fee_ledger upsert failed: ${error.message || error}`);
  }
}
