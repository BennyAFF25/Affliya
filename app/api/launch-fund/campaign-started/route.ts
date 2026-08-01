import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { getActiveLaunchFundAllocation, trackLaunchFundEvent } from "../../../../utils/launchFund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData } = await userSupabase.auth.getUser();
    const user = authData?.user || null;
    if (!user?.email) return NextResponse.json({ tracked: false }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const offerId = String(body?.offerId || body?.offer_id || "").trim();
    const campaignId = String(body?.campaignId || body?.campaign_id || body?.adIdeaId || body?.ad_idea_id || "").trim();
    if (!offerId) return NextResponse.json({ tracked: false, error: "offerId is required" }, { status: 400 });

    const supabase = createServerSupabaseClient();
    const allocation = await getActiveLaunchFundAllocation({
      supabase: supabase as never,
      affiliateEmail: user.email,
      offerId,
    });

    if (!allocation) return NextResponse.json({ tracked: false, reason: "no_active_allocation" });

    await trackLaunchFundEvent({
      supabase: supabase as never,
      eventType: "launch_fund_campaign_started",
      allocationId: allocation.id,
      affiliateId: allocation.affiliate_id,
      affiliateEmail: allocation.affiliate_email,
      offerId,
      metadata: { campaignId: campaignId || null, source: "affiliate_paid_campaign_submit" },
    });

    return NextResponse.json({ tracked: true, allocationId: allocation.id });
  } catch (err: unknown) {
    console.error("[launch-fund/campaign-started]", err);
    return NextResponse.json(
      { tracked: false, error: err instanceof Error ? err.message : "Failed to track Launch Fund campaign start" },
      { status: 500 },
    );
  }
}
