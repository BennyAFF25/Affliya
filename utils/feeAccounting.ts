const DEFAULT_NETTMARK_FEE_BPS = 220;
const DEFAULT_STRIPE_FEE_BPS = 175;
const DEFAULT_STRIPE_FIXED_FEE = 0.3;

function getConfiguredFeeBps(env: BusinessFeeEnvironment = process.env) {
  const raw = (env.NETTMARK_TRANSACTION_FEE_BPS || "").trim();
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

function getConfiguredStripeFeeBps() {
  const raw = (process.env.STRIPE_TOPUP_FEE_BPS || "").trim();
  if (!raw) {
    return DEFAULT_STRIPE_FEE_BPS;
  }

  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed);
  }

  return DEFAULT_STRIPE_FEE_BPS;
}

function getConfiguredStripeFixedFee() {
  const raw = (process.env.STRIPE_TOPUP_FIXED_FEE || "").trim();
  if (!raw) {
    return DEFAULT_STRIPE_FIXED_FEE;
  }

  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return roundCurrency(parsed);
  }

  return DEFAULT_STRIPE_FIXED_FEE;
}

export function getStripeTopupFeeConfig() {
  return {
    stripeFeeBps: getConfiguredStripeFeeBps(),
    stripeFixedFeeAmount: getConfiguredStripeFixedFee(),
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateChargeOnTopFee(principalAmount: number, feeBps = getConfiguredFeeBps()) {
  const safePrincipal = roundCurrency(Math.max(0, Number(principalAmount) || 0));
  const feeAmount = roundCurrency((safePrincipal * feeBps) / 10000);
  const grossAmount = roundCurrency(safePrincipal + feeAmount);

  return {
    principalAmount: safePrincipal,
    feeBps,
    feeAmount,
    grossAmount,
  };
}

export type BusinessFeeEnvironment = {
  [key: string]: string | undefined;
  NETTMARK_TRANSACTION_FEE_BPS?: string;
  SHOPIFY_BILLED_PLATFORM_FEE_ENABLED?: string;
};

export function resolveBusinessFeeBps(
  billingProvider: string | null | undefined,
  env: BusinessFeeEnvironment = process.env,
) {
  return billingProvider === "shopify" && env.SHOPIFY_BILLED_PLATFORM_FEE_ENABLED !== "true"
    ? 0 : getConfiguredFeeBps(env);
}

export function calculateBusinessPayoutCharge(
  principalAmount: number,
  { billingProvider }: { billingProvider?: string | null },
  env: BusinessFeeEnvironment = process.env,
) {
  return calculateChargeOnTopFee(principalAmount, resolveBusinessFeeBps(billingProvider, env));
}

/** Stripe's actual amount wins over current provider/flag and stale bookkeeping on retries. */
export function resolveRecordedPayoutCharge(principal: number, gross: number, fee: number) {
  if (![principal, gross, fee].every(Number.isFinite) || principal <= 0 || fee < 0 ||
      toStripeAmount(principal + fee) !== toStripeAmount(gross)) {
    throw new Error("payout_charge_amount_conflict");
  }
  return { principalAmount: principal, grossAmount: gross, feeAmount: fee, feeBps: principal ? Math.round(fee / principal * 10000) : 0 };
}

export function calculateWalletTopupCharge(principalAmount: number) {
  const feeBreakdown = calculateChargeOnTopFee(principalAmount);
  const { stripeFeeBps, stripeFixedFeeAmount } = getStripeTopupFeeConfig();

  const passthroughBaseAmount = feeBreakdown.grossAmount;
  const percentageRate = stripeFeeBps / 10000;

  const estimatedTotalCharge =
    percentageRate >= 1
      ? passthroughBaseAmount
      : roundCurrency((passthroughBaseAmount + stripeFixedFeeAmount) / (1 - percentageRate));

  const estimatedStripeFeeAmount = roundCurrency(estimatedTotalCharge - passthroughBaseAmount);

  return {
    ...feeBreakdown,
    passthroughBaseAmount,
    stripeFeeBps,
    stripeFixedFeeAmount,
    estimatedStripeFeeAmount,
    totalChargeAmount: estimatedTotalCharge,
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
