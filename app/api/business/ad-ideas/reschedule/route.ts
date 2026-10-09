import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";
import { validatePaidCampaignTiming } from "../../../../../utils/paidCampaignLaunchReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A business may move the dates of its pending proposal without altering
// the affiliate's budget, creative, or targeting. A partially-created Meta
// campaign must be recovered first; launched ads must never be rescheduled here.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const adIdeaId = String(body?.adIdeaId || "").trim();
    const startRaw = String(body?.startTime || "").trim();
    const endRaw = String(body?.endTime || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(adIdeaId) || !startRaw || !endRaw) {
      return NextResponse.json({
        success: false, error: "INVALID_REQUEST",
        message: "A proposal ID and both schedule dates are required.",
      }, { status: 400 });
    }

    const client = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const admin = createServerSupabaseClient();
    const { data: proposal, error: proposalError } = await admin
      .from("ad_ideas")
      .select("id,status,business_email,meta_campaign_id")
      .eq("id", adIdeaId)
      .maybeSingle();
    if (proposalError) throw new Error(proposalError.message);
    if (!proposal || proposal.business_email !== user.email) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }
    if (proposal.status !== "pending" || proposal.meta_campaign_id) {
      return NextResponse.json({
        success: false, error: "CAMPAIGN_NOT_RESCHEDULABLE",
        message: "Resolve the partial Meta campaign first. Only pending, unlaunched proposals can be rescheduled.",
      }, { status: 409 });
    }

    const { data: live, error: liveError } = await admin
      .from("live_ads").select("id").eq("ad_idea_id", adIdeaId).limit(1).maybeSingle();
    if (liveError) throw new Error(liveError.message);
    if (live?.id) {
      return NextResponse.json({ success: false, error: "CAMPAIGN_ALREADY_LIVE" }, { status: 409 });
    }

    const startMs = Date.parse(startRaw);
    const endMs = Date.parse(endRaw);
    const nowMs = Date.now();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return NextResponse.json({ success: false, error: "INVALID_DATES", message: "Enter valid campaign dates." }, { status: 400 });
    }
    const startTime = new Date(startMs).toISOString();
    const endTime = new Date(endMs).toISOString();
    const timing = validatePaidCampaignTiming({ start_time: startTime, end_time: endTime }, nowMs + 60_000);
    if (!timing.ok) {
      return NextResponse.json({
        success: false, error: timing.error, message: timing.message,
      }, { status: 409 });
    }

    const { data: updated, error: updateError } = await admin
      .from("ad_ideas")
      .update({ start_time: startTime, end_time: endTime })
      .eq("id", adIdeaId)
      .eq("business_email", user.email)
      .eq("status", "pending")
      .is("meta_campaign_id", null)
      .select("id,start_time,end_time")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) {
      return NextResponse.json({
        success: false, error: "SCHEDULE_CONFLICT",
        message: "The campaign state changed. Refresh and check it before trying again.",
      }, { status: 409 });
    }
    return NextResponse.json({ success: true, proposal: updated });
  } catch (error) {
    console.error("[business/ad-ideas/reschedule]", error);
    return NextResponse.json({
      success: false, error: "INTERNAL_ERROR",
      message: "Could not update campaign schedule.",
    }, { status: 500 });
  }
}
