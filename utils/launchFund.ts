import { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_LAUNCH_FUND_AMOUNT = 10;
export const DEFAULT_LAUNCH_FUND_CURRENCY = "aud";
export const DEFAULT_LAUNCH_FUND_EXPIRY_DAYS = 14;
export const LAUNCH_FUND_EXPIRY_DAYS_ENV = "LAUNCH_FUND_EXPIRY_DAYS";
export const LAUNCH_FUND_INTERNAL_KEY_ENV = "INTERNAL_LAUNCH_FUND_KEY";

type JsonRecord = Record<string, unknown>;

type SupabaseLike = Pick<SupabaseClient, "from" | "rpc"> | any;

export type LaunchFundAllocation = {
  id: string;
  affiliate_id: string;
  affiliate_email: string;
  amount: number;
  currency: string;
  status: "allocated" | "reserved" | "redeemed" | "expired" | "cancelled";
  allocated_for_offer_id?: string | null;
  allocated_for_campaign_id?: string | null;
  reason?: string | null;
  source?: string | null;
  allocated_by?: string | null;
  allocated_at: string;
  expires_at: string;
  redeemed_at?: string | null;
  cancelled_at?: string | null;
  metadata?: JsonRecord | null;
};

export type LaunchFundSpendSplit = {
  allocationId: string | null;
  promotionalAmount: number;
  cashAmount: number;
  totalCoveredAmount: number;
  promoAvailableBefore: number;
};

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function getLaunchFundExpiryDays() {
  const raw = Number(process.env[LAUNCH_FUND_EXPIRY_DAYS_ENV] || DEFAULT_LAUNCH_FUND_EXPIRY_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LAUNCH_FUND_EXPIRY_DAYS;
  return Math.min(Math.floor(raw), 365);
}

export function getLaunchFundExpiryDate(days = getLaunchFundExpiryDays()) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isTrustedLaunchFundRequest(req: Request) {
  const expected = process.env[LAUNCH_FUND_INTERNAL_KEY_ENV] || process.env.INTERNAL_MARKETING_KEY || "";
  if (!expected) return false;
  const provided = req.headers.get("x-internal-key") || req.headers.get("x-launch-fund-key") || "";
  return provided === expected;
}

export async function trackLaunchFundEvent(params: {
  supabase: SupabaseLike;
  eventType:
    | "launch_fund_allocated"
    | "launch_fund_viewed"
    | "launch_fund_campaign_started"
    | "launch_fund_redeemed"
    | "launch_fund_expired"
    | "launch_fund_cancelled"
    | "launch_fund_campaign_went_live";
  allocationId?: string | null;
  affiliateId?: string | null;
  affiliateEmail?: string | null;
  offerId?: string | null;
  liveAdId?: string | null;
  metadata?: JsonRecord;
}) {
  await params.supabase.from("affiliate_launch_fund_events").insert({
    allocation_id: params.allocationId || null,
    affiliate_id: params.affiliateId || null,
    affiliate_email: params.affiliateEmail || null,
    offer_id: params.offerId || null,
    live_ad_id: params.liveAdId || null,
    event_type: params.eventType,
    metadata: params.metadata || {},
  });
}

export async function expireLaunchFundAllocations(supabase: SupabaseLike) {
  try {
    await supabase.rpc("expire_affiliate_launch_fund_allocations");
  } catch {
    // The migration may not be applied in previews; callers should not fail reads because expiry best-effort failed.
  }
}

async function getOfferEligibility(params: { supabase: SupabaseLike; offerId: string }) {
  const { data: offer, error } = await params.supabase
    .from("offers")
    .select("id,status,business_email")
    .eq("id", params.offerId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load offer for Launch Fund eligibility: ${error.message}`);
  if (!offer?.id) return { ok: false, reason: "offer_not_found" };

  const status = String((offer as any).status || "active").toLowerCase();
  if (!["active", "approved", "live", "published"].includes(status)) {
    return { ok: false, reason: "offer_not_active", offer };
  }

  return { ok: true, offer };
}

async function getAffiliateApproval(params: { supabase: SupabaseLike; affiliateEmail: string; offerId?: string | null }) {
  if (!params.offerId) return { ok: true, reason: "general_allocation_no_offer_check" };

  const { data, error } = await params.supabase
    .from("affiliate_requests")
    .select("id,status,affiliate_email,offer_id")
    .eq("affiliate_email", params.affiliateEmail)
    .eq("offer_id", params.offerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load affiliate approval for Launch Fund eligibility: ${error.message}`);
  const status = String((data as any)?.status || "").toLowerCase();
  if (!["approved", "active", "accepted"].includes(status)) return { ok: false, reason: "affiliate_not_approved" };
  return { ok: true };
}

export async function allocateLaunchFund(params: {
  supabase: SupabaseLike;
  affiliateEmail: string;
  affiliateId?: string | null;
  offerId?: string | null;
  amount?: number | null;
  currency?: string | null;
  reason: string;
  source?: string | null;
  allocatedBy: string;
  expiresAt?: string | null;
  allowDuplicate?: boolean;
}) {
  const affiliateEmail = String(params.affiliateEmail || "").trim().toLowerCase();
  if (!affiliateEmail) throw new Error("affiliateEmail is required");
  const offerId = params.offerId || null;
  const amount = roundMoney(params.amount ?? DEFAULT_LAUNCH_FUND_AMOUNT);
  const currency = String(params.currency || DEFAULT_LAUNCH_FUND_CURRENCY).toLowerCase();
  if (amount !== DEFAULT_LAUNCH_FUND_AMOUNT && !params.allowDuplicate) {
    // Operators can still deliberately override by passing allowDuplicate for non-standard grants.
    throw new Error("Initial Launch Fund allocation must be exactly AU$10 unless deliberately overridden.");
  }

  if (offerId) {
    const offerEligibility = await getOfferEligibility({ supabase: params.supabase, offerId });
    if (!offerEligibility.ok) return { allocated: false, reason: offerEligibility.reason };
  }

  const affiliateApproval = await getAffiliateApproval({ supabase: params.supabase, affiliateEmail, offerId });
  if (!affiliateApproval.ok) return { allocated: false, reason: affiliateApproval.reason };

  if (!params.allowDuplicate) {
    let existingQuery = params.supabase
      .from("affiliate_launch_fund_allocations")
      .select("id,status")
      .eq("affiliate_email", affiliateEmail)
      .neq("status", "cancelled")
      .limit(1);

    if (offerId) existingQuery = existingQuery.eq("allocated_for_offer_id", offerId);
    else existingQuery = existingQuery.is("allocated_for_offer_id", null);

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw new Error(`Failed to check duplicate Launch Fund allocation: ${existingError.message}`);
    if (existing?.id) return { allocated: false, reason: "duplicate_allocation_prevented", allocationId: existing.id };
  }

  const { data, error } = await params.supabase
    .from("affiliate_launch_fund_allocations")
    .insert({
      affiliate_id: params.affiliateId || affiliateEmail,
      affiliate_email: affiliateEmail,
      amount,
      currency,
      status: "allocated",
      allocated_for_offer_id: offerId,
      allocated_for_campaign_id: null,
      reason: params.reason,
      source: params.source || "initial_launch_fund",
      allocated_by: params.allocatedBy,
      allocated_at: new Date().toISOString(),
      expires_at: params.expiresAt || getLaunchFundExpiryDate(),
      metadata: { controlled: true, nonWithdrawable: true, nonTransferable: true },
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { allocated: false, reason: "duplicate_allocation_prevented" };
    throw new Error(`Failed to allocate Launch Fund: ${error.message}`);
  }

  await params.supabase.from("affiliate_launch_fund_transactions").insert({
    allocation_id: data.id,
    affiliate_id: data.affiliate_id,
    affiliate_email: data.affiliate_email,
    offer_id: data.allocated_for_offer_id,
    transaction_type: "allocated",
    amount: data.amount,
    currency: data.currency,
    status: "succeeded",
    source: data.source,
    created_by: data.allocated_by,
    metadata: { reason: data.reason },
  });

  await trackLaunchFundEvent({
    supabase: params.supabase,
    eventType: "launch_fund_allocated",
    allocationId: data.id,
    affiliateId: data.affiliate_id,
    affiliateEmail: data.affiliate_email,
    offerId: data.allocated_for_offer_id,
    metadata: { source: data.source, allocatedBy: data.allocated_by, amount: data.amount, currency: data.currency },
  });

  return { allocated: true, allocation: data as LaunchFundAllocation };
}

export async function cancelLaunchFundAllocation(params: {
  supabase: SupabaseLike;
  allocationId: string;
  cancelledBy: string;
  reason: string;
}) {
  const { data, error } = await params.supabase
    .from("affiliate_launch_fund_allocations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      metadata: { cancelledBy: params.cancelledBy, cancelReason: params.reason },
    })
    .eq("id", params.allocationId)
    .in("status", ["allocated", "reserved"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Failed to cancel Launch Fund allocation: ${error.message}`);
  if (!data?.id) return { cancelled: false, reason: "allocation_not_found_or_not_cancellable" };

  await params.supabase.from("affiliate_launch_fund_transactions").insert({
    allocation_id: data.id,
    affiliate_id: data.affiliate_id,
    affiliate_email: data.affiliate_email,
    offer_id: data.allocated_for_offer_id,
    live_ad_id: data.allocated_for_campaign_id,
    transaction_type: "cancelled",
    amount: 0,
    currency: data.currency,
    status: "succeeded",
    source: "internal_operator",
    created_by: params.cancelledBy,
    metadata: { reason: params.reason },
  });

  await trackLaunchFundEvent({
    supabase: params.supabase,
    eventType: "launch_fund_cancelled",
    allocationId: data.id,
    affiliateId: data.affiliate_id,
    affiliateEmail: data.affiliate_email,
    offerId: data.allocated_for_offer_id,
    liveAdId: data.allocated_for_campaign_id,
    metadata: { cancelledBy: params.cancelledBy, reason: params.reason },
  });

  return { cancelled: true, allocation: data };
}

export async function getActiveLaunchFundAllocation(params: {
  supabase: SupabaseLike;
  affiliateEmail: string;
  offerId?: string | null;
}) {
  await expireLaunchFundAllocations(params.supabase);
  const affiliateEmail = String(params.affiliateEmail || "").trim().toLowerCase();
  if (!affiliateEmail) return null;

  let query = params.supabase
    .from("affiliate_launch_fund_allocations")
    .select("*")
    .eq("affiliate_email", affiliateEmail)
    .in("status", ["allocated", "reserved"])
    .gt("expires_at", new Date().toISOString())
    .order("allocated_at", { ascending: true })
    .limit(1);

  if (params.offerId) query = query.eq("allocated_for_offer_id", params.offerId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to load Launch Fund allocation: ${error.message}`);
  return (data || null) as LaunchFundAllocation | null;
}

export async function trackLaunchFundViewed(params: { supabase: SupabaseLike; allocation: LaunchFundAllocation; offerId?: string | null }) {
  await trackLaunchFundEvent({
    supabase: params.supabase,
    eventType: "launch_fund_viewed",
    allocationId: params.allocation.id,
    affiliateId: params.allocation.affiliate_id,
    affiliateEmail: params.allocation.affiliate_email,
    offerId: params.offerId || params.allocation.allocated_for_offer_id || null,
    metadata: { source: "affiliate_offer_promote_page" },
  });
}

export async function markLaunchFundCampaignWentLive(params: {
  supabase: SupabaseLike;
  affiliateEmail: string;
  offerId: string;
  liveAdId: string;
}) {
  const allocation = await getActiveLaunchFundAllocation({
    supabase: params.supabase,
    affiliateEmail: params.affiliateEmail,
    offerId: params.offerId,
  });
  if (!allocation) return { marked: false, reason: "no_active_allocation" };

  await params.supabase
    .from("affiliate_launch_fund_allocations")
    .update({ status: "reserved", allocated_for_campaign_id: params.liveAdId })
    .eq("id", allocation.id)
    .in("status", ["allocated", "reserved"]);

  await params.supabase.from("affiliate_launch_fund_transactions").insert({
    allocation_id: allocation.id,
    affiliate_id: allocation.affiliate_id,
    affiliate_email: allocation.affiliate_email,
    offer_id: params.offerId,
    live_ad_id: params.liveAdId,
    transaction_type: "campaign_went_live",
    amount: 0,
    currency: allocation.currency,
    status: "succeeded",
    source: "meta_upload_route",
    metadata: { note: "Allocation reserved when paid campaign went live; redemption waits for committed spend settlement." },
  });

  await trackLaunchFundEvent({
    supabase: params.supabase,
    eventType: "launch_fund_campaign_went_live",
    allocationId: allocation.id,
    affiliateId: allocation.affiliate_id,
    affiliateEmail: allocation.affiliate_email,
    offerId: params.offerId,
    liveAdId: params.liveAdId,
    metadata: { source: "meta_upload_route" },
  });

  return { marked: true, allocationId: allocation.id };
}

export async function computeLaunchFundSpendSplit(params: {
  supabase: SupabaseLike;
  affiliateEmail: string;
  offerId: string;
  liveAdId: string;
  requestedAmount: number;
  cashAvailable: number;
}) : Promise<LaunchFundSpendSplit> {
  const requested = roundMoney(params.requestedAmount);
  const cashAvailable = roundMoney(params.cashAvailable);
  const allocation = await getActiveLaunchFundAllocation({
    supabase: params.supabase,
    affiliateEmail: params.affiliateEmail,
    offerId: params.offerId,
  });

  const promoAvailable = allocation ? roundMoney(Number(allocation.amount || 0)) : 0;
  const promotionalAmount = roundMoney(Math.min(requested, promoAvailable));
  const remainingAfterPromo = roundMoney(Math.max(0, requested - promotionalAmount));
  const cashAmount = roundMoney(Math.min(remainingAfterPromo, cashAvailable));

  return {
    allocationId: allocation?.id || null,
    promotionalAmount,
    cashAmount,
    totalCoveredAmount: roundMoney(promotionalAmount + cashAmount),
    promoAvailableBefore: promoAvailable,
  };
}

export async function redeemLaunchFundForSettlement(params: {
  supabase: SupabaseLike;
  allocationId: string | null;
  affiliateEmail: string;
  offerId: string;
  liveAdId: string;
  amount: number;
  settlementKey: string;
}) {
  const amount = roundMoney(params.amount);
  if (!params.allocationId || amount <= 0) return { redeemed: false, reason: "no_promotional_amount" };

  const { data, error } = await params.supabase
    .from("affiliate_launch_fund_allocations")
    .update({
      status: "redeemed",
      allocated_for_campaign_id: params.liveAdId,
      redeemed_at: new Date().toISOString(),
    })
    .eq("id", params.allocationId)
    .in("status", ["allocated", "reserved"])
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Failed to redeem Launch Fund allocation: ${error.message}`);
  if (!data?.id) return { redeemed: false, reason: "allocation_not_redeemable" };

  const tx = await params.supabase.from("affiliate_launch_fund_transactions").insert({
    allocation_id: data.id,
    affiliate_id: data.affiliate_id,
    affiliate_email: data.affiliate_email,
    offer_id: params.offerId,
    live_ad_id: params.liveAdId,
    transaction_type: "redeemed",
    amount,
    currency: data.currency,
    status: "succeeded",
    settlement_key: params.settlementKey,
    source: "ad_spend_settlement",
    metadata: { nonWithdrawable: true, committedSpend: true },
  });

  if (tx.error && tx.error.code !== "23505") {
    throw new Error(`Failed to record Launch Fund redemption transaction: ${tx.error.message}`);
  }

  await trackLaunchFundEvent({
    supabase: params.supabase,
    eventType: "launch_fund_redeemed",
    allocationId: data.id,
    affiliateId: data.affiliate_id,
    affiliateEmail: data.affiliate_email,
    offerId: params.offerId,
    liveAdId: params.liveAdId,
    metadata: { amount, settlementKey: params.settlementKey },
  });

  return { redeemed: true, allocation: data };
}
