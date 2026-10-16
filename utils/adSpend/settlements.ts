import { settlementQuote, settlementAud, fundedOriginal } from './settlementFx';
import { isDefinitiveStripeFailure } from '../stripeOperationFailure';
import { guardPaidCurrency } from "../currency/paidCurrencyGuard";
import crypto from "crypto";
import { buildNettmarkStripeMetadata, createStripeClient, getPlatformBalanceSnapshot } from "../stripe";
import { getActivationSubsidyRemaining, type ActivationSubsidyRow } from "../activationSubsidies";
import { getWalletBalanceSnapshot } from "../wallet/balance";

// Initialize only when a Stripe operation runs, never during Next.js build/page collection.
// Missing or invalid runtime credentials continue to fail closed in createStripeClient.
function getStripe() {
  return createStripeClient(process.env.STRIPE_SECRET_KEY || "");
}

const DEFAULT_SETTLEMENT_THRESHOLD = 25;
const DEFAULT_WALLET_BUFFER = 10;
const DEFAULT_BATCH_MAX_ROWS = 50;

// Owner campaigns must never be charged by settlement, even with a stranded override.
export const PROTECTED_META_CAMPAIGN_IDS = ['120251784604850679'] as const;

function envIds(name: string): string[] {
  return (process.env[name] || '').split(',').map(id => id.trim()).filter(Boolean);
}

export function settlementExclusionReason(ad: {
  id: string; meta_campaign_id?: string | null; billing_state?: string | null;
}, path: string, stranded = false): string | null {
  const excluded = new Set<string>([...PROTECTED_META_CAMPAIGN_IDS, ...envIds('SETTLEMENT_EXCLUDED_META_CAMPAIGN_IDS')]);
  const reason = ad.meta_campaign_id && excluded.has(ad.meta_campaign_id)
    ? 'PROTECTED_META_CAMPAIGN'
    : stranded && ad.billing_state === 'TERMINATED_BY_BUSINESS' && !envIds('SETTLEMENT_STRANDED_ALLOW_IDS').includes(ad.id)
      ? 'BUSINESS_TERMINATED_MANUAL_REVIEW' : null;
  if (reason) console.warn('[ad-spend] settlement skipped', {
    event: 'SETTLEMENT_SKIPPED', reason, path, liveAdId: ad.id,
    metaCampaignId: ad.meta_campaign_id ?? null, billingState: ad.billing_state ?? null,
    manualReview: reason === 'BUSINESS_TERMINATED_MANUAL_REVIEW',
  });
  return reason;
}

type QueryResult = Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;

type QueryBuilder = QueryResult & {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  maybeSingle: () => QueryResult;
  single: () => QueryResult;
  update: (values: Record<string, unknown>) => QueryBuilder;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  lte: (column: string, value: unknown) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
};

type SupabaseLike = {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

type TransferRetryRow = {
  id: string;
  transfer_retry_count: number | null;
};

type SubsidyClaim = ActivationSubsidyRow & {
  consumed_amount: number | string | null;
  subsidy_amount: number | string | null;
};

type LiveAdSettlementRow = {
  id: string;
  meta_campaign_id: string | null;
  affiliate_email: string | null;
  affiliate_user_id: string | null;
  business_email: string | null;
  business_id: string | null;
  offer_id: string | null;
  spend: number | string | null;
  spend_transferred: number | string | null;
};

export type AdSpendSettlementRow = {
  id: string;
  settlement_key: string;
  live_ad_id: string;
  affiliate_email: string;
  business_email: string;
  offer_id: string | null;
  business_id: string | null;
  affiliate_user_id: string | null;
  amount: number;
  currency?: string | null;
  original_currency?: string | null;
  original_amount?: number | null;
  fx_rate?: number | null;
  fx_source?: string | null;
  fx_rate_date?: string | null;
  status: string;
  transfer_retry_count?: number | null;
  next_retry_at?: string | null;
  transfer_error_message?: string | null;
  stripe_transfer_id?: string | null;
  created_at?: string | null;
};

export type AdSpendSettlementStatus =
  | "ledger_applied"
  | "pending_funds"
  | "transfer_ready"
  | "transfer_processing"
  | "transfer_blocked"
  | "transfer_failed"
  | "transfer_succeeded";

export type AdSpendSettlementConfig = {
  thresholdAmount: number;
  walletBuffer: number;
  batchMaxRows: number;
};

export type AdSpendSettlementLedgerResult = {
  success: boolean;
  skipped?: string;
  error?: string;
  liveAdId: string;
  affiliateEmail?: string;
  businessEmail?: string;
  offerId?: string;
  settlementId?: string | null;
  settlementKey?: string | null;
  spend: number;
  transferredBefore: number;
  transferredAfter: number;
  unpaidBefore: number;
  unpaidAfter: number;
  chargedAmount: number;
  wallet?: {
    totalTopups?: number;
    totalDeductions?: number;
    availableBalanceBefore?: number;
    availableBalanceAfter?: number;
  };
  availableBalanceBefore?: number;
  transferStatus?: "not_required" | "transfer_pending";
  message?: string;
  note?: string;
};

export type AdSpendTransferBatchResult = {
  businessEmail: string;
  businessId: string | null;
  settlementCount: number;
  amount: number;
  batchKey: string;
  status: "succeeded" | "failed" | "skipped";
  settlementStatus?: AdSpendSettlementStatus;
  stripeTransferId?: string | null;
  error?: string | null;
  deferredSettlementCount?: number;
  platformAvailableBefore?: number;
  platformAvailableAfter?: number;
};

export type SettlementFundingState = {
  status: AdSpendSettlementStatus;
  ready: boolean;
  blocked: boolean;
  message: string;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function envMoney(name: string, fallback: number) {
  const raw = process.env[name];
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) && n >= 0 ? roundMoney(n) : fallback;
}

function envInt(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function getAdSpendSettlementConfig(): AdSpendSettlementConfig {
  return {
    thresholdAmount: envMoney("AD_SPEND_SETTLEMENT_THRESHOLD_AUD", DEFAULT_SETTLEMENT_THRESHOLD),
    walletBuffer: envMoney("AD_SPEND_WALLET_BUFFER_AUD", DEFAULT_WALLET_BUFFER),
    batchMaxRows: envInt("AD_SPEND_TRANSFER_BATCH_MAX_ROWS", DEFAULT_BATCH_MAX_ROWS),
  };
}

export function buildAdSpendSettlementKey(liveAdId: string, transferredAfter: number) {
  return `${liveAdId}:${roundMoney(transferredAfter)}`;
}

async function resolveBusinessTransferDestination(supabase: SupabaseLike, businessId: string | null, businessEmail: string) {
  let query = supabase.from("business_profiles").select("id, stripe_account_id").limit(1);
  query = businessId ? query.eq("id", businessId) : query.eq("business_email", businessEmail);
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`business profile lookup failed: ${error.message}`);
  }
  const row = (data as { stripe_account_id?: string | null } | null) ?? null;
  return row?.stripe_account_id || null;
}

export async function getTransferReadiness(destinationAcct: string) {
  try {
    const account = await getStripe().accounts.retrieve(destinationAcct);
    const transfersCapability =
      typeof account === "object" && "capabilities" in account
        ? account.capabilities?.transfers
        : undefined;

    const transfersReady =
      transfersCapability === "active" || account.payouts_enabled === true;

    return {
      ok: transfersReady,
      accountId: destinationAcct,
      transfersCapability: transfersCapability || "unknown",
      payoutsEnabled: !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      accountId: destinationAcct,
      transfersCapability: "unknown",
      payoutsEnabled: false,
      detailsSubmitted: false,
      error: err instanceof Error ? err.message : "Failed to read Stripe account",
    };
  }
}

export function getSettlementFundingState(params: {
  hasDestination: boolean;
  readinessOk: boolean;
  hasAvailableFunds: boolean;
}) : SettlementFundingState {
  if (!params.hasDestination) {
    return {
      status: "transfer_blocked",
      ready: false,
      blocked: true,
      message: "Business Stripe account missing; transfer blocked until onboarding is complete.",
    };
  }

  if (!params.readinessOk) {
    return {
      status: "transfer_blocked",
      ready: false,
      blocked: true,
      message: "Business Stripe account is not ready to receive transfers.",
    };
  }

  if (!params.hasAvailableFunds) {
    return {
      status: "pending_funds",
      ready: false,
      blocked: false,
      message: "Waiting for Stripe available balance before transferring ad spend.",
    };
  }

  return {
    status: "transfer_ready",
    ready: true,
    blocked: false,
    message: "Settlement is funded and ready for transfer.",
  };
}

async function findReservedActivationSubsidy(supabase: SupabaseLike, params: {
  offerId: string;
  businessEmail: string;
  affiliateEmail: string;
}) {
  const { data, error } = await supabase
    .from("business_activation_subsidies")
    .select("id, business_email, offer_id, status, subsidy_amount, consumed_amount, reserved_for_affiliate_email, consumed_by_affiliate_email, live_ad_id")
    .eq("offer_id", params.offerId)
    .eq("business_email", params.businessEmail)
    .eq("reserved_for_affiliate_email", params.affiliateEmail)
    .in("status", ["reserved", "partially_consumed"])
    .maybeSingle();

  if (error) {
    throw new Error(`activation subsidy lookup failed: ${error.message}`);
  }

  return (data as SubsidyClaim | null) ?? null;
}

/** Shared funding basis for settlement and pause checks, including reserved starter spend. */
export async function getAdSpendFundingSnapshot(supabase: SupabaseLike, params: {
  offerId: string; businessEmail: string; affiliateEmail: string;
}) {
  const wallet = await getWalletBalanceSnapshot(supabase as never, params.affiliateEmail);
  const subsidy = params.offerId ? await findReservedActivationSubsidy(supabase, params) : null;
  return { ...wallet, availableBalance: roundMoney(wallet.availableBalance + getActivationSubsidyRemaining(subsidy)) };
}

export async function settleAdSpendLedger(params: {
  supabase: SupabaseLike;
  liveAdId: string;
  chunkAmount?: number | null;
  force?: boolean;
}): Promise<AdSpendSettlementLedgerResult> {
  const { supabase, liveAdId } = params;
  const requestedChunk = params.force || params.chunkAmount == null ? null : roundMoney(Math.max(0, params.chunkAmount));

  const { data: liveAdData, error: liveAdError } = await supabase
    .from("live_ads")
    .select("id, meta_campaign_id, affiliate_email, affiliate_user_id, business_email, business_id, offer_id, spend, spend_transferred")
    .eq("id", liveAdId)
    .maybeSingle();

  const liveAd = (liveAdData as LiveAdSettlementRow | null) ?? null;

  if (liveAdError || !liveAd) {
    return {
      success: false,
      error: "LIVE_AD_NOT_FOUND",
      liveAdId,
      spend: 0,
      transferredBefore: 0,
      transferredAfter: 0,
      unpaidBefore: 0,
      unpaidAfter: 0,
      chargedAmount: 0,
      message: liveAdError?.message || "Live ad not found",
    };
  }

  const affiliateEmail = String(liveAd.affiliate_email || "");
  const businessEmail = String(liveAd.business_email || "");
  const offerId = typeof liveAd.offer_id === "string" ? liveAd.offer_id : "";
  const spend = roundMoney(Number(liveAd.spend ?? 0));
  const transferredBefore = roundMoney(Number(liveAd.spend_transferred ?? 0));
  const unpaidBefore = roundMoney(Math.max(0, spend - transferredBefore));

  const exclusion = settlementExclusionReason(liveAd, params.force ? 'force_settlement' : 'threshold_settlement');
  if (exclusion) return {
    success: true, skipped: exclusion, liveAdId, spend, transferredBefore,
    transferredAfter: transferredBefore, unpaidBefore, unpaidAfter: unpaidBefore,
    chargedAmount: 0, transferStatus: 'not_required', message: exclusion,
  };

  if (!affiliateEmail || !businessEmail || !offerId) {
    return {
      success: false,
      error: "MISSING_REQUIRED_FIELDS_ON_LIVE_AD",
      liveAdId,
      affiliateEmail,
      businessEmail,
      offerId,
      spend,
      transferredBefore,
      transferredAfter: transferredBefore,
      unpaidBefore,
      unpaidAfter: unpaidBefore,
      chargedAmount: 0,
      message: "Live ad is missing affiliate_email, business_email, or offer_id.",
    };
  }

  if (unpaidBefore <= 0) {
    return {
      success: true,
      liveAdId,
      affiliateEmail,
      businessEmail,
      offerId,
      spend,
      transferredBefore,
      transferredAfter: transferredBefore,
      unpaidBefore,
      unpaidAfter: 0,
      chargedAmount: 0,
      transferStatus: "not_required",
      message: "No unpaid spend remaining for this ad.",
    };
  }

  const quote = await settlementQuote(supabase, liveAdId);
  if (!quote) {
    return { success: true, error: "FX_SETTLEMENT_DEFERRED", liveAdId, spend,
      transferredBefore, transferredAfter: transferredBefore, unpaidBefore, unpaidAfter: unpaidBefore,
      chargedAmount: 0, message: "Currency or fresh FX unavailable; retry next run." };
  }
  const { currency, fx } = quote;
  const walletSnapshot = await getWalletBalanceSnapshot(supabase as never, affiliateEmail);
  const availableBalanceBefore = roundMoney(walletSnapshot.availableBalance);
  const reservedSubsidy = await findReservedActivationSubsidy(supabase, {
    offerId,
    businessEmail,
    affiliateEmail,
  });
  const subsidyRemaining = roundMoney(getActivationSubsidyRemaining(reservedSubsidy));
  const effectiveFundingBefore = roundMoney(availableBalanceBefore + subsidyRemaining);

  if (effectiveFundingBefore <= 0) {
    return {
      success: false,
      error: "INSUFFICIENT_WALLET_BALANCE",
      liveAdId,
      affiliateEmail,
      businessEmail,
      offerId,
      spend,
      transferredBefore,
      transferredAfter: transferredBefore,
      unpaidBefore,
      unpaidAfter: unpaidBefore,
      chargedAmount: 0,
      availableBalanceBefore,
      message: "Affiliate wallet and starter spend cannot cover current unpaid spend. Campaign should be paused and topped up.",
    };
  }

  const originalAmount = fx ? fundedOriginal(
    Math.min(unpaidBefore, requestedChunk != null && requestedChunk > 0 ? requestedChunk : unpaidBefore),
    fx.rate, effectiveFundingBefore,
  ) : null;
  const chargedAmount = fx ? settlementAud(originalAmount!, fx.rate) : roundMoney(
    Math.min(
      unpaidBefore,
      requestedChunk != null && requestedChunk > 0 ? requestedChunk : unpaidBefore,
      effectiveFundingBefore,
    ),
  );

  if (chargedAmount <= 0) {
    return {
      success: false,
      error: "INSUFFICIENT_WALLET_BALANCE",
      liveAdId,
      affiliateEmail,
      businessEmail,
      offerId,
      spend,
      transferredBefore,
      transferredAfter: transferredBefore,
      unpaidBefore,
      unpaidAfter: unpaidBefore,
      chargedAmount: 0,
      availableBalanceBefore,
      message: "No wallet or starter spend capacity available for settlement.",
    };
  }

  const subsidyAppliedAmount = roundMoney(Math.min(chargedAmount, subsidyRemaining));
  const walletChargeAmount = roundMoney(Math.max(0, chargedAmount - subsidyAppliedAmount));

  const transferredAfter = roundMoney(transferredBefore + (originalAmount ?? chargedAmount));
  const unpaidAfter = roundMoney(Math.max(0, spend - transferredAfter));
  const settlementKey = buildAdSpendSettlementKey(liveAdId, transferredAfter);

  const { data: atomic, error: atomicError } = await supabase.rpc("settle_live_ad_spend", {
    p_live_ad_id: liveAdId, p_expected_previous: transferredBefore,
    p_original_amount: originalAmount ?? chargedAmount, p_amount_aud: chargedAmount,
    p_wallet_amount_aud: walletChargeAmount, p_subsidy_id: reservedSubsidy?.id ?? null,
    p_subsidy_amount_aud: subsidyAppliedAmount, p_original_currency: currency.campaignCurrency,
    p_fx_rate: fx?.rate ?? null, p_fx_source: fx?.source ?? null, p_fx_rate_date: fx?.rate_date ?? null,
  });
  if (atomicError) throw new Error(`Atomic settlement failed: ${atomicError.message}`);
  const applied = atomic as { id?: string; applied: boolean; transferred_after: number };
  if (!applied || typeof applied.applied !== "boolean" || !Number.isFinite(Number(applied.transferred_after))) {
    throw new Error("Atomic settlement returned an invalid result");
  }
  if (!applied?.applied) return {
    success: true, liveAdId, spend, transferredBefore,
    transferredAfter: Number(applied?.transferred_after ?? transferredBefore), unpaidBefore,
    unpaidAfter: roundMoney(Math.max(0, spend - Number(applied?.transferred_after ?? transferredBefore))),
    chargedAmount: 0, transferStatus: "not_required", message: "Settlement already advanced; no charge applied.",
  };
  const settlementRow = applied;

  return {
    success: true,
    liveAdId,
    affiliateEmail,
    businessEmail,
    offerId,
    settlementId: (settlementRow as { id?: string } | null)?.id || null,
    settlementKey,
    spend,
    transferredBefore,
    transferredAfter,
    unpaidBefore,
    unpaidAfter,
    chargedAmount,
    wallet: {
      totalTopups: walletSnapshot.totalTopupsNetAvailable,
      totalDeductions: roundMoney(walletSnapshot.totalDeductions + walletChargeAmount),
      availableBalanceBefore,
      availableBalanceAfter: roundMoney(availableBalanceBefore - walletChargeAmount),
    },
    availableBalanceBefore,
    transferStatus: chargedAmount > 0 ? "transfer_pending" : "not_required",
    message:
      subsidyAppliedAmount > 0
        ? `Ad spend settlement ledger applied with $${subsidyAppliedAmount.toFixed(2)} starter spend; Stripe transfer queued separately.`
        : chargedAmount > 0
          ? "Ad spend settlement ledger applied; Stripe transfer queued separately."
          : "No charge amount required.",
  };
}

function computeRetryDelayMs(retryCount: number) {
  const minutes = Math.min(60, Math.max(5, Math.pow(2, retryCount) * 5));
  return minutes * 60 * 1000;
}

async function updateSettlementStatuses(
  supabase: SupabaseLike,
  ids: string[],
  values: Record<string, unknown>,
) {
  if (!ids.length) return;
  const { error } = await supabase
    .from("ad_spend_settlements")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .in("status", ["ledger_applied", "pending_funds", "transfer_ready", "transfer_failed", "transfer_blocked"]);
  if (error) throw new Error(`Settlement status update failed: ${error.message}`);
}

async function markPendingFunds(supabase: SupabaseLike, ids: string[], message: string) {
  await updateSettlementStatuses(supabase, ids, {
    status: "pending_funds",
    transfer_error_message: message,
    next_retry_at: new Date().toISOString(),
    transfer_batch_id: null,
  });
}

async function markTransferBlocked(supabase: SupabaseLike, ids: string[], message: string) {
  await updateSettlementStatuses(supabase, ids, {
    status: "transfer_blocked",
    transfer_error_message: message,
    next_retry_at: new Date().toISOString(),
    transfer_batch_id: null,
  });
}

async function markTransferFailure(supabase: SupabaseLike, ids: string[], errorMessage: string) {
  const { data: existingRows, error: readError } = await supabase
    .from("ad_spend_settlements")
    .select("id, transfer_retry_count")
    .in("id", ids);

  if (readError) throw new Error(`Transfer retry lookup failed: ${readError.message}`);
  const rows = (Array.isArray(existingRows) ? existingRows : []) as TransferRetryRow[];
  await Promise.all(
    rows.map(async (row) => {
      const retryCount = Number(row.transfer_retry_count ?? 0) + 1;
      const nextRetryAt = new Date(Date.now() + computeRetryDelayMs(retryCount)).toISOString();
      const { error } = await supabase
        .from("ad_spend_settlements")
        .update({
          status: "transfer_failed",
          transfer_retry_count: retryCount,
          next_retry_at: nextRetryAt,
          transfer_error_message: errorMessage,
          transfer_batch_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "transfer_processing");
      if (error) throw new Error(`Transfer release failed: ${error.message}`);
    }),
  );
}

export async function processAdSpendTransferBatches(params: {
  supabase: SupabaseLike;
  limitBusinesses?: number;
}): Promise<{
  success: boolean;
  batches: AdSpendTransferBatchResult[];
  processedSettlementCount: number;
  platformBalance: {
    availableAud: number;
    pendingAud: number;
    remainingAvailableAud: number;
  };
}> {
  const { supabase } = params;
  const config = getAdSpendSettlementConfig();
  const limitBusinesses = Math.max(1, params.limitBusinesses ?? 10);
  const nowIso = new Date().toISOString();
  const balanceSnapshot = await getPlatformBalanceSnapshot(getStripe(), "aud");
  let remainingAvailable = roundMoney(balanceSnapshot.available);

  const { data: pendingRows, error: pendingErr } = await supabase
    .from("ad_spend_settlements")
    .select("id, settlement_key, live_ad_id, affiliate_email, business_email, offer_id, business_id, affiliate_user_id, amount, currency, original_amount, original_currency, fx_rate, fx_source, fx_rate_date, status, transfer_retry_count, next_retry_at, transfer_error_message, stripe_transfer_id, created_at")
    .in("status", ["ledger_applied", "pending_funds", "transfer_ready", "transfer_failed", "transfer_blocked"])
    .lte("next_retry_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limitBusinesses * config.batchMaxRows);

  if (pendingErr) {
    throw new Error(`pending ad_spend_settlements lookup failed: ${pendingErr.message}`);
  }

  const rows = (Array.isArray(pendingRows) ? pendingRows : []) as AdSpendSettlementRow[];
  if (!rows.length) {
    return {
      success: true,
      batches: [],
      processedSettlementCount: 0,
      platformBalance: {
        availableAud: balanceSnapshot.available,
        pendingAud: balanceSnapshot.pending,
        remainingAvailableAud: remainingAvailable,
      },
    };
  }

  const groups = new Map<string, AdSpendSettlementRow[]>();
  for (const row of rows) {
    const { data: ad, error: adError } = await supabase.from('live_ads')
      .select('id, meta_campaign_id').eq('id', row.live_ad_id).maybeSingle();
    if (adError || !ad) throw new Error('Settlement campaign exclusion lookup failed');
    if (settlementExclusionReason(ad as { id: string; meta_campaign_id: string | null }, 'transfer_batch')) continue;
    const currency = await guardPaidCurrency({ supabase, liveAdId: row.live_ad_id, settlementOnly: true });
    if (!currency.allowed || (currency.campaignCurrency !== "AUD" &&
      !(row.currency === "AUD" && row.original_currency === currency.campaignCurrency &&
        Number(row.original_amount) > 0 && Number(row.fx_rate) > 0 && row.fx_source && row.fx_rate_date &&
        settlementAud(Number(row.original_amount), Number(row.fx_rate)) === Number(row.amount)))) {
      console.warn("[ad-spend] reimbursement skipped: PAID_CURRENCY_BLOCKED", { settlementId: row.id, reason: currency.reason });
      await markTransferBlocked(supabase, [row.id], `${currency.message} (${currency.reason})`);
      continue;
    }
    const key = `${row.business_id || ""}::${row.business_email || ""}`;
    const group = groups.get(key) || [];
    if (group.length < config.batchMaxRows) group.push(row);
    groups.set(key, group);
  }

  const selectedGroups = Array.from(groups.values()).slice(0, limitBusinesses);
  const batches: AdSpendTransferBatchResult[] = [];
  let processedSettlementCount = 0;

  for (const group of selectedGroups) {
    const businessEmail = String(group[0]?.business_email || "");
    const businessId = typeof group[0]?.business_id === "string" ? group[0].business_id : null;
    let destinationAcct: string | null;
    try {
      destinationAcct = await resolveBusinessTransferDestination(supabase, businessId, businessEmail);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await markTransferBlocked(supabase, group.map((row) => row.id), errorMessage);
      batches.push({ businessEmail, businessId, settlementCount: group.length, amount: roundMoney(group.reduce((sum, row) => sum + Number(row.amount || 0), 0)), batchKey: "blocked", status: "skipped", settlementStatus: "transfer_blocked", error: errorMessage, platformAvailableBefore: remainingAvailable, platformAvailableAfter: remainingAvailable });
      continue;
    }

    const readiness = destinationAcct ? await getTransferReadiness(destinationAcct) : { ok: false };
    const groupTotal = roundMoney(group.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    const fundingState = getSettlementFundingState({
      hasDestination: !!destinationAcct,
      readinessOk: !!readiness.ok,
      hasAvailableFunds: remainingAvailable > 0,
    });

    if (fundingState.blocked) {
      await markTransferBlocked(supabase, group.map((row) => row.id), fundingState.message);
      batches.push({ businessEmail, businessId, settlementCount: group.length, amount: groupTotal, batchKey: "blocked", status: "skipped", settlementStatus: fundingState.status, error: fundingState.message, platformAvailableBefore: remainingAvailable, platformAvailableAfter: remainingAvailable });
      continue;
    }

    if (!remainingAvailable) {
      await markPendingFunds(supabase, group.map((row) => row.id), fundingState.message);
      batches.push({ businessEmail, businessId, settlementCount: 0, deferredSettlementCount: group.length, amount: 0, batchKey: "pending_funds", status: "skipped", settlementStatus: "pending_funds", error: fundingState.message, platformAvailableBefore: remainingAvailable, platformAvailableAfter: remainingAvailable });
      continue;
    }

    const readyRows: AdSpendSettlementRow[] = [];
    const deferredRows: AdSpendSettlementRow[] = [];
    let readyAmount = 0;

    for (const row of group) {
      const rowAmount = roundMoney(Number(row.amount || 0));
      if (rowAmount <= 0) continue;
      if (roundMoney(readyAmount + rowAmount) <= remainingAvailable) {
        readyRows.push(row);
        readyAmount = roundMoney(readyAmount + rowAmount);
      } else {
        deferredRows.push(row);
      }
    }

    if (!readyRows.length) {
      await markPendingFunds(supabase, group.map((row) => row.id), fundingState.message);
      batches.push({ businessEmail, businessId, settlementCount: 0, deferredSettlementCount: group.length, amount: 0, batchKey: "pending_funds", status: "skipped", settlementStatus: "pending_funds", error: fundingState.message, platformAvailableBefore: remainingAvailable, platformAvailableAfter: remainingAvailable });
      continue;
    }

    if (deferredRows.length) {
      await markPendingFunds(supabase, deferredRows.map((row) => row.id), fundingState.message);
    }

    const ids = readyRows.map((row) => String(row.id));
    // Persist this unique operation identity with the claim. Never reuse a batch
    // identity for a different claimed subset or automatically retry processing rows.
    const batchKey = crypto.randomUUID();

    const { data: claimedRows, error: claimErr } = await supabase
      .from("ad_spend_settlements")
      .update({
        status: "transfer_processing",
        transfer_batch_id: batchKey,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .in("status", ["ledger_applied", "pending_funds", "transfer_ready", "transfer_failed", "transfer_blocked"])
      .select("id, business_email, business_id, amount, settlement_key, live_ad_id, offer_id, affiliate_email");

    if (claimErr) {
      throw new Error(`failed to claim ad spend transfer batch: ${claimErr.message}`);
    }

    const claimList = Array.isArray(claimedRows) ? claimedRows : [];
    if (!claimList.length) continue;

    readyAmount = roundMoney(claimList.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    processedSettlementCount += claimList.length;
    let stripeAccepted = false;
    let stripeSubmitted = false;

    try {
      const stripe = getStripe();
      stripeSubmitted = true;
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(readyAmount * 100),
          currency: "aud",
          destination: destinationAcct!,
          transfer_group: `ad_spend_batch:${batchKey}`,
          metadata: buildNettmarkStripeMetadata("ad_spend_settlement", {
            stripe_role: "nettmark_business_ad_spend_batch",
            business_email: businessEmail,
            business_id: businessId || "",
            settlement_count: claimList.length,
            transfer_batch_id: batchKey,
            settlement_key_first: claimList[0]?.settlement_key || "",
            settlement_key_last: claimList[claimList.length - 1]?.settlement_key || "",
          }),
        },
        { idempotencyKey: `ad_spend_transfer_batch:${batchKey}` },
      );

      stripeAccepted = true;
      const settlementIds = claimList.map((row) => row.id);
      const now = new Date().toISOString();
      await Promise.all(
        settlementIds.map(async (id: string) => {
          const { error } = await supabase
            .from("ad_spend_settlements")
            .update({
              status: "transfer_succeeded",
              stripe_transfer_id: transfer.id,
              transfer_error_message: null,
              transfer_retry_count: 0,
              next_retry_at: null,
              updated_at: now,
            })
            .eq("id", id)
            .eq("transfer_batch_id", batchKey);
          if (error) {
            console.error('Accepted transfer persistence failed; keep processing for reconciliation', { batchKey, stripeTransferId: transfer.id, id, error });
            throw new Error(`Accepted transfer ${transfer.id} requires reconciliation: ${error.message}`);
          }
        }),
      );

      batches.push({
        businessEmail,
        businessId,
        settlementCount: claimList.length,
        deferredSettlementCount: deferredRows.length,
        amount: readyAmount,
        batchKey,
        status: "succeeded",
        settlementStatus: "transfer_succeeded",
        stripeTransferId: transfer.id,
        platformAvailableBefore: remainingAvailable,
        platformAvailableAfter: roundMoney(remainingAvailable - readyAmount),
      });
      remainingAvailable = roundMoney(Math.max(0, remainingAvailable - readyAmount));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Stripe transfer failed";
      const canRelease = !stripeAccepted && (!stripeSubmitted || isDefinitiveStripeFailure(err));
      if (canRelease) {
        try { await markTransferFailure(supabase, claimList.map((row) => row.id), errorMessage); }
        catch (releaseError) { console.error('Transfer claim release failed; reconcile batch', batchKey, releaseError); }
      } else {
        // Timeout/5xx or post-transfer database failure: never enqueue again.
        console.error('Transfer batch requires reconciliation; claims retained', { batchKey, errorMessage });
      }
      const availableBefore = remainingAvailable;
      if (!canRelease) remainingAvailable = roundMoney(Math.max(0, remainingAvailable - readyAmount));
      batches.push({ businessEmail, businessId, settlementCount: claimList.length, deferredSettlementCount: deferredRows.length, amount: readyAmount, batchKey, status: "failed", settlementStatus: canRelease ? "transfer_failed" : "transfer_processing", error: errorMessage, platformAvailableBefore: availableBefore, platformAvailableAfter: remainingAvailable });
    }
  }

  return {
    success: true,
    batches,
    processedSettlementCount,
    platformBalance: {
      availableAud: balanceSnapshot.available,
      pendingAud: balanceSnapshot.pending,
      remainingAvailableAud: remainingAvailable,
    },
  };
}

/** Flush stored spend after delivery stops; failures must never undo a Meta pause. */
export async function settleStoppedAdSpend(params: {
  supabase: SupabaseLike; liveAdId: string; status: string; adIdeaId?: string | null;
}): Promise<AdSpendSettlementLedgerResult> {
  try {
    const result = await settleAdSpendLedger({ supabase: params.supabase, liveAdId: params.liveAdId, force: true });
    if (result.skipped) return result;
    if (!result.success || result.unpaidAfter > 0 || result.error) {
      console.warn('[ad-spend] stopped settlement deferred', { liveAdId: params.liveAdId, status: params.status,
        error: result.error, unpaidAfter: result.unpaidAfter });
    } else if (params.status.toLowerCase() !== 'paused' && params.adIdeaId) {
      const { error } = await params.supabase.rpc('release_launch_hold', {
        p_reference_type: 'ad_ideas', p_reference_id: params.adIdeaId,
      });
      if (error) throw new Error(`Final hold release failed: ${error.message}`);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[ad-spend] stopped settlement failed', { liveAdId: params.liveAdId, status: params.status, error: message });
    return { success: false, error: message, liveAdId: params.liveAdId, spend: 0,
      transferredBefore: 0, transferredAfter: 0, unpaidBefore: 0, unpaidAfter: 0, chargedAmount: 0 };
  }
}
