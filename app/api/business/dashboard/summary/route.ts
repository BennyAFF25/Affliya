import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One authoritative, business-scoped snapshot for dashboard counts.
 * User-bound checks happen before privileged database reads.
 * This endpoint does not create campaigns, debit wallets or mutate Meta.
 */
export async function GET() {
  try {
    const userClient = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    const admin = createServerSupabaseClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "business") {
      return NextResponse.json({ error: "BUSINESS_REQUIRED" }, { status: 403 });
    }
    const email = user.email.trim().toLowerCase();
    const [ads, organic, proposals, requests, settlementRows] = await Promise.all([
      admin.from("live_ads")
        .select("id,offer_id,affiliate_email,business_email,status,created_at,spend,spend_transferred,campaign_type")
        .ilike("business_email", email),
      admin.from("live_campaigns")
        .select("id,offer_id,affiliate_email,business_email,status,created_at,platform,type")
        .ilike("business_email", email),
      admin.from("ad_ideas")
        .select("id", { count: "exact", head: true })
        .ilike("business_email", email).eq("status", "pending"),
      admin.from("affiliate_requests")
        .select("id,status,created_at")
        .ilike("business_email", email),
      admin.from("ad_spend_settlements")
        .select("amount,status,stripe_transfer_id")
        .ilike("business_email", email),
    ]);
    const errors = [ads.error, organic.error, proposals.error, requests.error].filter(Boolean);
    if (errors.length) {
      console.error("[business/dashboard/summary] failed", errors);
      return NextResponse.json({ error: "DASHBOARD_COUNTS_UNAVAILABLE" }, { status: 503 });
    }
    const active = (status: unknown) =>
      ["active", "live"].includes(String(status || "").toLowerCase());

    // Fetch public-facing labels only for this business's own campaigns.
    const allRows = [...(ads.data || []), ...(organic.data || [])];
    const offerIds = [...new Set(allRows.map((row) => row.offer_id).filter(Boolean))];
    const affiliateEmails = [...new Set(allRows.map((row) => String(row.affiliate_email || "").toLowerCase()).filter(Boolean))];
    const [offerLabels, publicAffiliates] = await Promise.all([
      offerIds.length
        ? admin.from("offers").select("id,title").ilike("business_email", email).in("id", offerIds)
        : Promise.resolve({ data: [], error: null }),
      affiliateEmails.length
        ? admin.from("profiles").select("email,username").in("email", affiliateEmails)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (offerLabels.error || publicAffiliates.error) {
      console.warn("[business/dashboard/summary] label lookup incomplete");
    }
    const titles = new Map((offerLabels.data || []).map((row) => [row.id, row.title]));
    const handles = new Map((publicAffiliates.data || []).map((row) => [
      String(row.email || "").toLowerCase(), String(row.username || "").trim(),
    ]));
    const campaigns = [
      ...(ads.data || []).filter((row) => active(row.status))
        .map((row) => ({ ...row, __source: "paid", campaign_type: row.campaign_type || "paid" })),
      ...(organic.data || []).filter((row) => active(row.status))
        .map((row) => ({ ...row, __source: "organic", campaign_type: row.type || "organic", spend: null })),
    ].map((row) => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      __source: row.__source,
      campaign_type: row.campaign_type,
      spend: row.__source === "paid" ? Number(row.spend || 0) : null,
      offerTitle: titles.get(row.offer_id) || "Affiliate campaign",
      affiliateHandle: handles.get(String(row.affiliate_email || "").toLowerCase()) || "Affiliate",
    })).sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""));

    const requestRows = requests.data || [];
    const daily = new Map<string, { name: string; requested: number; approved: number }>();
    for (const request of requestRows) {
      if (!request.created_at) continue;
      const date = String(request.created_at).slice(0, 10);
      if (!daily.has(date)) daily.set(date, { name: date, requested: 0, approved: 0 });
      const current = daily.get(date)!;
      current.requested++;
      if (request.status === "approved") current.approved++;
    }
    // Meta Insights sync stores cumulative spend in live_ads. This is NOT
    // calendar-MTD, and spend_transferred is a ledger watermark, not proof
    // of a completed Stripe Connect transfer.
    const round = (amount: number) => Math.round(amount * 100) / 100;
    const paidRows = ads.data || [];
    const spendReported = round(paidRows.reduce((sum, row) => sum + Number(row.spend || 0), 0));
    const unaccounted = round(paidRows.reduce((sum, row) =>
      sum + Math.max(0, Number(row.spend || 0) - Number(row.spend_transferred || 0)), 0));
    const finance = settlementRows.error ? null : {
      reportedMetaSpend: spendReported,
      awaitingWalletSettlement: unaccounted,
      queuedForTransfer: round((settlementRows.data || [])
        .filter((row) => row.status !== "transfer_succeeded" || !row.stripe_transfer_id)
        .reduce((sum, row) => sum + Number(row.amount || 0), 0)),
      transferredToBusiness: round((settlementRows.data || [])
        .filter((row) => row.status === "transfer_succeeded" && !!row.stripe_transfer_id)
        .reduce((sum, row) => sum + Number(row.amount || 0), 0)),
      // Snapshot observation time only: Meta last-sync timestamp is not stored.
      observedAt: new Date().toISOString(),
    };
    if (settlementRows.error) console.error("[business/dashboard/summary] finance unavailable", settlementRows.error);

    return NextResponse.json({
      success: true,
      campaigns,
      finance,
      affiliateSeries: [...daily.values()].sort((a, b) => a.name.localeCompare(b.name)),
      activeCampaignCount: campaigns.length,
      pendingAdProposals: proposals.count ?? 0,
      approvedAffiliates: requestRows.filter((row) => row.status === "approved").length,
      pendingAffiliateRequests: requestRows.filter((row) => row.status === "pending").length,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[business/dashboard/summary]", error);
    return NextResponse.json({ error: "DASHBOARD_COUNTS_UNAVAILABLE" }, { status: 500 });
  }
}
