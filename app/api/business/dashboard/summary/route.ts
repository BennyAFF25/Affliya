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
    const [ads, organic, proposals, requests] = await Promise.all([
      admin.from("live_ads")
        .select("id,offer_id,affiliate_email,business_email,status,created_at,spend,campaign_type")
        .ilike("business_email", email),
      admin.from("live_campaigns")
        .select("id,offer_id,affiliate_email,business_email,status,created_at,platform,type")
        .ilike("business_email", email),
      admin.from("ad_ideas")
        .select("id", { count: "exact", head: true })
        .ilike("business_email", email).eq("status", "pending"),
      admin.from("affiliate_requests")
        .select("id,status")
        .ilike("business_email", email),
    ]);
    const errors = [ads.error, organic.error, proposals.error, requests.error].filter(Boolean);
    if (errors.length) {
      console.error("[business/dashboard/summary] failed", errors);
      return NextResponse.json({ error: "DASHBOARD_COUNTS_UNAVAILABLE" }, { status: 503 });
    }
    const active = (status: unknown) => ["active", "live"].includes(String(status || "").toLowerCase());
    const campaigns = [
      ...(ads.data || []).filter((row) => active(row.status)).map((row) => ({ ...row, __source: "paid", campaign_type: row.campaign_type || "paid" })),
      ...(organic.data || []).filter((row) => active(row.status)).map((row) => ({ ...row, __source: "organic", campaign_type: row.type || "organic" })),
    ];
    const requestRows = requests.data || [];
    return NextResponse.json({
      success: true,
      campaigns,
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
