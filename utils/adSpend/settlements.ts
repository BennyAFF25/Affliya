import crypto from "crypto";
import { buildNettmarkStripeMetadata, createStripeClient, getPlatformBalanceSnapshot } from "@/../utils/stripe";
import { getWalletBalanceSnapshot } from "@/../utils/wallet/balance";

const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY || "");

const DEFAULT_SETTLEMENT_THRESHOLD = 25;
const DEFAULT_WALLET_BUFFER = 10;
const DEFAULT_BATCH_MAX_ROWS = 50;

type JsonRecord = Record<string, unknown>;

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

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return "code" in error && error.code === "23505";
}

async function resolveBusinessTransferDestination(supabase: SupabaseLike, businessId: string | null, businessEmail: string) {
  let query = supabase.from("business_profiles").select("id, stripe_account_id").limit(1);
  query = businessId ? query.eq("id", businessId) : query.eq("business_email", businessEmail);
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`business profile lookup failed: ${error.message}`);
  }
  return (data?.stripe_account_id as string | undefined) || null;
}

export async function getTransferReadiness(destinationAcct: string) {
  try {
    const account = await stripe.accounts.retrieve(destinationAcct);
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

async function findExistingSettlementByKey(supabase: SupabaseLike, settlementKey: string) {
  const { data, error } = await supabase
    .from("ad_spend_settlements")
    .select("id, status, amount, live_ad_id, affiliate_email, business_email, offer_id, spend, transferred_before, transferred_after, unpaid_before, unpaid_after")
    .eq("settlement_key", settlementKey)
    .maybeSingle();

  if (error) {
    throw new Error(`existing settlement lookup failed: ${error.message}`);
  }

  return data;
}

export async function settleAdSpendLedger(params: {
  supabase: SupabaseLike;
  liveAdId: string;
  chunkAmount?: number | null;
}): Promise<AdSpendSettlementLedgerResult> {
  const { supabase, liveAdId } = params;
  const requestedChunk = params.chunkAmount == null ? null : roundMoney(Math.max(0, params.chunkAmount));

  const { data: liveAd, error: liveAdError } = await supabase
    .from("live_ads")
    .select("id, affiliate_email, affiliate_user_id, business_email, business_id, offer_id, spend, spend_transferred")
    .eq("id", liveAdId)
    .maybeSingle();

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

  const walletSnapshot = await getWalletBalanceSnapshot(supabase as never, affiliateEmail);
  const availableBalanceBefore = roundMoney(walletSnapshot.availableBalance);

  if (availableBalanceBefore <= 0) {
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
      message: "Affiliate wallet cannot cover current unpaid spend. Campaign should be paused and topped up.",
    };
  }

  const chargedAmount = roundMoney(
    Math.min(
      unpaidBefore,
      requestedChunk != null && requestedChunk > 0 ? requestedChunk : unpaidBefore,
      availableBalanceBefore,
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
      message: "No wallet capacity available for settlement.",
    };
  }

  const transferredAfter = roundMoney(transferredBefore + chargedAmount);
  const unpaidAfter = roundMoney(Math.max(0, spend - transferredAfter));
  const settlementKey = buildAdSpendSettlementKey(liveAdId, transferredAfter);

  const existingSettlement = await findExistingSettlementByKey(supabase, settlementKey);
  if (existingSettlement) {
    return {
      success: true,
      liveAdId,
      affiliateEmail,
      businessEmail,
      offerId,
      settlementId: existingSettlement.id,
      settlementKey,
      spend,
      transferredBefore,
      transferredAfter: Number(existingSettlement.transferred_after ?? transferredAfter),
      unpaidBefore,
      unpaidAfter: Number(existingSettlement.unpaid_after ?? unpaidAfter),
      chargedAmount: Number(existingSettlement.amount ?? chargedAmount),
      availableBalanceBefore,
      transferStatus: existingSettlement.status === "transfer_succeeded" ? "not_required" : "transfer_pending",
      message: "Settlement already recorded (idempotent).",
    };
  }

  const { data: updatedRows, error: claimErr } = await supabase
    .from("live_ads")
    .update({ spend_transferred: transferredAfter })
    .eq("id", liveAdId)
    .eq("spend_transferred", transferredBefore)
    .select("id");

  if (claimErr) {
    throw new Error(`live_ads claim update failed: ${claimErr.message}`);
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { data: latest, error: latestErr } = await supabase
      .from("live_ads")
      .select("spend, spend_transferred")
      .eq("id", liveAdId)
      .maybeSingle();

    if (latestErr) {
      throw new Error(`live_ads refetch failed after claim miss: ${latestErr.message}`);
    }

    const latestSpend = roundMoney(Number(latest?.spend ?? spend));
    const latestTransferred = roundMoney(Number(latest?.spend_transferred ?? transferredBefore));
    return {
      success: true,
      liveAdId,
      affiliateEmail,
      businessEmail,
      offerId,
      settlementKey,
      spend: latestSpend,
      transferredBefore,
      transferredAfter: latestTransferred,
      unpaidBefore,
      unpaidAfter: roundMoney(Math.max(0, latestSpend - latestTransferred)),
      chargedAmount: 0,
      availableBalanceBefore,
      transferStatus: "not_required",
      message: "Settlement already processed by another worker.",
    };
  }

  const walletDeductionPayload = {
    affiliate_email: affiliateEmail,
    business_email: businessEmail,
    offer_id: offerId,
    ad_id: liveAdId,
    amount: chargedAmount,
    description: "Meta ad spend settlement",
    settlement_key: settlementKey,
    business_id: typeof liveAd.business_id === "string" ? liveAd.business_id : null,
    affiliate_user_id: typeof liveAd.affiliate_user_id === "string" ? liveAd.affiliate_user_id : null,
  };

  const { error: deductionErr } = await supabase
    .from("wallet_deductions")
    .insert(walletDeductionPayload);

  if (deductionErr && !isUniqueViolation(deductionErr)) {
    await supabase.from("live_ads").update({ spend_transferred: transferredBefore }).eq("id", liveAdId).eq("spend_transferred", transferredAfter);
    throw new Error(`wallet_deductions insert failed: ${deductionErr.message}`);
  }

  const settlementPayload = {
    settlement_key: settlementKey,
    live_ad_id: liveAdId,
    affiliate_email: affiliateEmail,
    business_email: businessEmail,
    offer_id: offerId,
    business_id: typeof liveAd.business_id === "string" ? liveAd.business_id : null,
    affiliate_user_id: typeof liveAd.affiliate_user_id === "string" ? liveAd.affiliate_user_id : null,
    amount: chargedAmount,
    spend,
    transferred_before: transferredBefore,
    transferred_after: transferredAfter,
    unpaid_before: unpaidBefore,
    unpaid_after: unpaidAfter,
    status: chargedAmount > 0 ? "pending_funds" : "transfer_succeeded",
    next_retry_at: new Date().toISOString(),
    metadata: { source: "app/api/ad-spend/settle/route.ts" },
  } satisfies JsonRecord;

  const { data: insertedSettlement, error: settlementErr } = await supabase
    .from("ad_spend_settlements")
    .insert(settlementPayload)
    .select("id")
    .maybeSingle();

  if (settlementErr && !isUniqueViolation(settlementErr)) {
    throw new Error(`ad_spend_settlements insert failed: ${settlementErr.message}`);
  }

  const settlementRow = settlementErr ? await findExistingSettlementByKey(supabase, settlementKey) : insertedSettlement;

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
      totalDeductions: roundMoney(walletSnapshot.totalDeductions + chargedAmount),
      availableBalanceBefore,
      availableBalanceAfter: roundMoney(availableBalanceBefore - chargedAmount),
    },
    availableBalanceBefore,
    transferStatus: chargedAmount > 0 ? "transfer_pending" : "not_required",
    message: chargedAmount > 0 ? "Ad spend settlement ledger applied; Stripe transfer queued separately." : "No charge amount required.",
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
  await supabase
    .from("ad_spend_settlements")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
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
  const { data: existingRows } = await supabase
    .from("ad_spend_settlements")
    .select("id, transfer_retry_count")
    .in("id", ids);

  const rows = (Array.isArray(existingRows) ? existingRows : []) as TransferRetryRow[];
  await Promise.all(
    rows.map(async (row) => {
      const retryCount = Number(row.transfer_retry_count ?? 0) + 1;
      const nextRetryAt = new Date(Date.now() + computeRetryDelayMs(retryCount)).toISOString();
      await supabase
        .from("ad_spend_settlements")
        .update({
          status: "transfer_failed",
          transfer_retry_count: retryCount,
          next_retry_at: nextRetryAt,
          transfer_error_message: errorMessage,
          transfer_batch_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
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
  const balanceSnapshot = await getPlatformBalanceSnapshot(stripe, "aud");
  let remainingAvailable = roundMoney(balanceSnapshot.available);

  const { data: pendingRows, error: pendingErr } = await supabase
    .from("ad_spend_settlements")
    .select("id, settlement_key, live_ad_id, affiliate_email, business_email, offer_id, business_id, affiliate_user_id, amount, status, transfer_retry_count, next_retry_at, transfer_error_message, stripe_transfer_id, created_at")
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

    await updateSettlementStatuses(supabase, readyRows.map((row) => row.id), {
      status: "transfer_ready",
      transfer_error_message: null,
      next_retry_at: nowIso,
    });

    const ids = readyRows.map((row) => String(row.id));
    const batchKey = crypto.createHash("sha256").update(ids.slice().sort().join(",")).digest("hex").slice(0, 24);

    const { data: claimedRows, error: claimErr } = await supabase
      .from("ad_spend_settlements")
      .update({
        status: "transfer_processing",
        transfer_batch_id: batchKey,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .in("status", ["ledger_applied", "pending_funds", "transfer_ready", "transfer_failed"])
      .select("id, business_email, business_id, amount, settlement_key, live_ad_id, offer_id, affiliate_email");

    if (claimErr) {
      throw new Error(`failed to claim ad spend transfer batch: ${claimErr.message}`);
    }

    const claimList = Array.isArray(claimedRows) ? claimedRows : [];
    if (!claimList.length) continue;

    processedSettlementCount += claimList.length;

    try {
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
        { idempotencyKey: `ad_spend_transfer_batch:${batchKey}:${Math.round(readyAmount * 100)}` },
      );

      const settlementIds = claimList.map((row) => row.id);
      const now = new Date().toISOString();
      await Promise.all(
        settlementIds.map(async (id: string) => {
          await supabase
            .from("ad_spend_settlements")
            .update({
              status: "transfer_succeeded",
              stripe_transfer_id: transfer.id,
              transfer_error_message: null,
              transfer_retry_count: 0,
              next_retry_at: null,
              updated_at: now,
            })
            .eq("id", id);
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
      await markTransferFailure(supabase, claimList.map((row) => row.id), errorMessage);
      batches.push({ businessEmail, businessId, settlementCount: claimList.length, deferredSettlementCount: deferredRows.length, amount: readyAmount, batchKey, status: "failed", settlementStatus: "transfer_failed", error: errorMessage, platformAvailableBefore: remainingAvailable, platformAvailableAfter: remainingAvailable });
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
