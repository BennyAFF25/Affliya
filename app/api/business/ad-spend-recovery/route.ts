import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { settleAdSpendLedger } from "../../../../utils/adSpend/settlements";
import { writeMoneyFlowAudit, tryWriteMoneyFlowAudit } from "../../../../utils/moneyFlowAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE = "app/api/business/ad-spend-recovery/route.ts";
const META_API_VERSION = "v21.0";
const GRACE_MS = 2 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function cents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || Math.abs(Math.round(n * 100) - n * 100) > 0.000001) return null;
  return Math.round(n * 100);
}

type Ad = {
  id: string;
  business_id: string | null;
  business_email: string | null;
  affiliate_email: string | null;
  affiliate_user_id: string | null;
  offer_id: string | null;
  ad_idea_id: string | null;
  meta_ad_id: string | null;
  meta_campaign_id: string | null;
  status: string | null;
  billing_state: string | null;
  billing_paused_at: string | null;
  terminated_by_business_at: string | null;
  spend: number | null;
  spend_transferred: number | null;
};

async function contextFor(liveAdId: string) {
  const userClient = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user?.email || !user.id) {
    return { error: response({ eligible: false, error: "UNAUTHENTICATED" }, 401) };
  }
  const admin = createServerSupabaseClient();
  const { data: ad, error: adError } = await admin
    .from("live_ads")
    .select("id,business_id,business_email,affiliate_email,affiliate_user_id,offer_id,ad_idea_id,meta_ad_id,meta_campaign_id,status,billing_state,billing_paused_at,terminated_by_business_at,spend,spend_transferred")
    .eq("id", liveAdId)
    .maybeSingle();
  if (adError) return { error: response({ eligible: false, error: "CAMPAIGN_LOOKUP_FAILED" }, 503) };
  if (!ad || !ad.business_id || String(ad.business_email || "").toLowerCase() !== user.email.toLowerCase()) {
    return { error: response({ eligible: false, error: "CAMPAIGN_NOT_FOUND" }, 404) };
  }
  const { data: business, error: businessError } = await admin
    .from("business_profiles")
    .select("id")
    .eq("id", ad.business_id)
    .eq("business_email", ad.business_email)
    .maybeSingle();
  if (businessError || !business) return { error: response({ eligible: false, error: "BUSINESS_NOT_VERIFIED" }, 403) };
  return { admin, ad: ad as Ad, actorId: user.id };
}

function eligibility(ad: Ad) {
  const ended = ["stopped", "paused", "archived"].includes(String(ad.status || "").toLowerCase())
    || ["TERMINATED_BY_BUSINESS", "PAUSED", "ARCHIVED"].includes(String(ad.billing_state || ""));
  const pausedAt = ad.terminated_by_business_at || ad.billing_paused_at;
  const pausedLongEnough = !!pausedAt && Number.isFinite(Date.parse(pausedAt))
    && Date.now() - Date.parse(pausedAt) >= GRACE_MS;
  const spendCents = cents(ad.spend);
  const transferredCents = cents(ad.spend_transferred ?? 0);
  const dueCents = spendCents !== null && transferredCents !== null
    ? spendCents - transferredCents
    : 0;
  return {
    eligible: !!ended && !!pausedLongEnough && !!ad.meta_ad_id && !!ad.meta_campaign_id
      && !!ad.ad_idea_id && !!ad.offer_id && !!ad.affiliate_email
      && spendCents !== null && transferredCents !== null && dueCents > 0,
    estimatedOutstanding: Math.max(0, dueCents) / 100,
  };
}

async function alreadyClaimed(admin: any, liveAdId: string) {
  const { data, error } = await admin
    .from("manual_ad_spend_recoveries")
    .select("status")
    .eq("live_ad_id", liveAdId)
    .maybeSingle();
  if (error) throw new Error("RECOVERY_LEDGER_UNAVAILABLE");
  return data?.status || null;
}

// All external figures are obtained server-side from the business's Meta account.
// Stored spend (which legacy browser RLS could once edit) is NEVER trusted for a debit.
async function verifiedMetaSpend(admin: any, ad: Ad) {
  const { data: connections, error } = await admin
    .from("meta_connections")
    .select("access_token,ad_account_id,ad_account_currency,created_at")
    .eq("business_email", ad.business_email)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !connections?.length) throw new Error("META_CONNECTION_UNAVAILABLE");
  const candidates = connections.filter((row: any) => !!row.access_token && !!row.ad_account_id);
  if (!candidates.length) throw new Error("META_CONNECTION_UNAVAILABLE");

  const graphWithToken = async (token: string, objectId: string, params: Record<string, string>) => {
    const url = new URL("https://graph.facebook.com/" + META_API_VERSION + "/" + objectId);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload || payload.error) throw new Error("META_VERIFICATION_FAILED");
    return payload;
  };

  // A business can connect several pages/ad accounts. Discover the real ad
  // account from Meta first, rather than blindly choosing the newest row.
  // Try no more than three distinct tokens; never log or put them in URLs.
  const tokenCandidates = [...new Set(candidates.map((row: any) => String(row.access_token)))].slice(0, 3);
  let selectedToken: string | null = null;
  let metaAd: any = null;
  for (const candidate of tokenCandidates) {
    try {
      metaAd = await graphWithToken(candidate, String(ad.meta_ad_id), {
        fields: "id,account_id,campaign_id,effective_status",
      });
      selectedToken = candidate;
      break;
    } catch {
      // A prior connection can be expired; move to the next authorised token.
    }
  }
  if (!metaAd || !selectedToken) throw new Error("META_VERIFICATION_FAILED");
  const connection = candidates.find((row: any) =>
    String(row.ad_account_id) === "act_" + String(metaAd.account_id)
    && String(row.ad_account_currency || "").toUpperCase() === "AUD"
    && String(row.access_token) === selectedToken
  );
  if (!connection) throw new Error("META_OBJECT_MISMATCH");
  const graph = (objectId: string, params: Record<string, string>) =>
    graphWithToken(selectedToken!, objectId, params);

  if (String(metaAd.id) !== String(ad.meta_ad_id) ||
    String(metaAd.campaign_id) !== String(ad.meta_campaign_id)) {
    throw new Error("META_OBJECT_MISMATCH");
  }
  if (!["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "ARCHIVED"].includes(String(metaAd.effective_status))) {
    throw new Error("META_AD_NOT_PAUSED");
  }
  const adAccount = await graph(String(connection.ad_account_id), { fields: "currency" });
  if (adAccount.currency !== "AUD") throw new Error("META_CURRENCY_MISMATCH");

  const insights = await graph(String(ad.meta_ad_id) + "/insights", {
    fields: "spend",
    date_preset: "maximum",
  });
  // No insight row means no proof of spend; fail closed.
  if (!Array.isArray(insights.data) || insights.data.length !== 1) {
    throw new Error("META_SPEND_NOT_VERIFIED");
  }
  const spendCents = cents(insights.data[0]?.spend);
  if (spendCents === null) throw new Error("META_SPEND_NOT_VERIFIED");
  return spendCents / 100;
}

export async function GET(req: Request) {
  const liveAdId = new URL(req.url).searchParams.get("liveAdId") || "";
  if (!UUID.test(liveAdId)) return response({ eligible: false }, 400);

  const context = await contextFor(liveAdId);
  if (context.error) return context.error;
  const { admin, ad } = context;
  if (!admin || !ad) return response({ eligible: false }, 503);

  const state = eligibility(ad);
  if (!state.eligible) return response({ eligible: false });
  try {
    const existing = await alreadyClaimed(admin, liveAdId);
    return response(existing ? { eligible: false } : state);
  } catch {
    // Missing migration or an inaccessible ledger must hide the action.
    return response({ eligible: false });
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) {
    return response({ success: false, error: "INVALID_ORIGIN" }, 403);
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" ||
    Object.keys(body).length !== 1 || !UUID.test(body.liveAdId)) {
    return response({ success: false, error: "INVALID_REQUEST" }, 400);
  }
  const liveAdId = body.liveAdId as string;
  const context = await contextFor(liveAdId);
  if (context.error) return context.error;
  const { admin, ad, actorId } = context;
  if (!admin || !ad || !actorId) return response({ success: false, error: "RECOVERY_UNAVAILABLE" }, 503);
  if (!eligibility(ad).eligible) return response({ success: false, error: "NOT_ELIGIBLE" }, 409);

  const auditBase = {
    sourceRoute: SOURCE,
    entityType: "live_ad",
    entityId: liveAdId,
    liveAdId,
    businessId: ad.business_id,
    businessEmail: ad.business_email,
    affiliateEmail: ad.affiliate_email,
    affiliateUserId: ad.affiliate_user_id,
    offerId: ad.offer_id,
  };

  // Do not let a forged live_ads record charge another affiliate: tie it to
  // an approved campaign proposal and the saved Meta campaign ID.
  const { data: idea, error: ideaError } = await admin.from("ad_ideas")
    .select("id,status,business_email,affiliate_email,offer_id,meta_campaign_id")
    .eq("id", ad.ad_idea_id!)
    .maybeSingle();
  if (ideaError || !idea || idea.status !== "approved" ||
    idea.business_email !== ad.business_email ||
    idea.affiliate_email !== ad.affiliate_email ||
    idea.offer_id !== ad.offer_id || idea.meta_campaign_id !== ad.meta_campaign_id) {
    return response({ success: false, error: "PROPOSAL_INTEGRITY_FAILED" }, 409);
  }

  let metaSpend: number;
  try {
    metaSpend = await verifiedMetaSpend(admin, ad);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "META_VERIFICATION_FAILED";
    await tryWriteMoneyFlowAudit(admin as never, {
      ...auditBase, eventType: "manual_spend_recovery_rejected", severity: "warning",
      reasonCode: reason, message: "Meta could not authoritatively verify paused ad spend.",
      metadata: { requestedBy: actorId },
    });
    return response({ success: false, error: reason }, 409);
  }

  const verifiedCents = cents(metaSpend)!;
  const paidCents = cents(ad.spend_transferred ?? 0);
  if (paidCents === null || verifiedCents <= paidCents) {
    return response({ success: false, error: "NO_VERIFIED_UNPAID_SPEND" }, 409);
  }

  // A single permanent claim per ad prevents double-clicks, parallel workers
  // and repeated browser requests from triggering more ledger mutations.
  // A failed or ambiguous claim is reviewed by staff, never retried blindly.
  const { error: claimError } = await admin.from("manual_ad_spend_recoveries").insert({
    live_ad_id: liveAdId,
    business_id: ad.business_id,
    requested_by: actorId,
    verified_meta_spend: metaSpend,
    transferred_before: Number(ad.spend_transferred ?? 0),
    status: "claimed",
    metadata: { metaAdId: ad.meta_ad_id, metaCampaignId: ad.meta_campaign_id },
  });
  if (claimError) return response({
    success: false,
    error: claimError.code === "23505" ? "RECOVERY_ALREADY_REQUESTED" : "RECOVERY_LEDGER_UNAVAILABLE",
  }, claimError.code === "23505" ? 409 : 503);

  const finish = async (status: "completed" | "partial" | "failed",
    chargedAmount: number, settlementId: string | null, errorCode: string | null) => {
    const { error: updateError } = await admin.from("manual_ad_spend_recoveries")
      .update({ status, charged_amount: chargedAmount, settlement_id: settlementId,
        error_code: errorCode, completed_at: new Date().toISOString() })
      .eq("live_ad_id", liveAdId).eq("status", "claimed");
    if (updateError) console.error("[manual-spend-recovery] Recovery claim finalization failed", {
      liveAdId, code: updateError.code,
    });
  };

  try {
    // Require an audit event *before* initiating any financial mutation.
    await writeMoneyFlowAudit(admin as never, {
      ...auditBase, eventType: "manual_spend_recovery_requested", severity: "info",
      reasonCode: "BUSINESS_REQUEST_VERIFIED",
      message: "Business requested once-only recovery of Meta-verified unpaid spend.",
      metadata: { requestedBy: actorId, verifiedMetaSpend: metaSpend,
        transferredBefore: Number(ad.spend_transferred ?? 0) },
    });

    // Compare-and-set blocks stale reads and server-side status changes. Client
    // modifications to financial/ownership columns are denied by the migration.
    const { data: saved, error: saveError } = await admin.from("live_ads")
      .update({ spend: metaSpend })
      .eq("id", liveAdId)
      .eq("status", ad.status)
      .eq("spend", ad.spend)
      .eq("spend_transferred", ad.spend_transferred ?? 0)
      .select("id")
      .maybeSingle();
    if (saveError || !saved) throw new Error("CAMPAIGN_CHANGED_REVIEW_REQUIRED");

    const settlement = await settleAdSpendLedger({
      supabase: admin as never,
      liveAdId,
    });
    const chargedAmount = Number(settlement.chargedAmount || 0);
    const complete = settlement.success && Number(settlement.unpaidAfter) <= 0;
    const status = !settlement.success ? "failed" : complete ? "completed" : "partial";
    const reason = settlement.success ? (complete ? null : "PARTIAL_FUNDING") : settlement.error || "SETTLEMENT_FAILED";

    await finish(status, chargedAmount, settlement.settlementId || null, reason);
    await tryWriteMoneyFlowAudit(admin as never, {
      ...auditBase,
      eventType: settlement.success ? "manual_spend_recovery_processed" : "manual_spend_recovery_failed",
      severity: settlement.success ? "info" : "warning",
      reasonCode: reason || "SETTLEMENT_LEDGER_APPLIED",
      message: "Manual recovery completed its single settlement attempt.",
      metadata: { requestedBy: actorId, verifiedMetaSpend: metaSpend,
        chargedAmount, unpaidAfter: settlement.unpaidAfter, settlementId: settlement.settlementId || null },
    });

    if (!settlement.success) {
      return response({ success: false, error: reason, recoveryRecorded: true }, 409);
    }
    return response({
      success: true,
      recoveredAmount: chargedAmount,
      unpaidAfter: settlement.unpaidAfter,
      transferPending: chargedAmount > 0,
      requiresSupport: !complete,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "RECOVERY_FAILED";
    await finish("failed", 0, null, reason);
    await tryWriteMoneyFlowAudit(admin as never, {
      ...auditBase, eventType: "manual_spend_recovery_failed", severity: "error",
      reasonCode: reason, message: "Manual recovery failed; one-shot claim retained for review.",
      metadata: { requestedBy: actorId, verifiedMetaSpend: metaSpend },
    });
    return response({ success: false, error: "RECOVERY_REVIEW_REQUIRED", recoveryRecorded: true }, 503);
  }
}
