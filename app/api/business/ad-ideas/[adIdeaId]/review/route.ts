import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "@/../utils/businessSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ adIdeaId: string }> },
) {
  try {
    const { adIdeaId } = await params;
    const proposalId = String(adIdeaId || "").trim();
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (authError || !user?.email) {
      return NextResponse.json(
        { success: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const admin = createServerSupabaseClient();
    const { data: idea, error: ideaError } = await admin
      .from("ad_ideas")
      .select("id,offer_id,affiliate_email,business_email,status,created_at,campaign_name,audience,location,objective,caption,file_url,media_type,call_to_action,cta,budget_amount,budget_type,daily_budget,age_range,gender,interests,placements_type,manual_placements,conversion_event,performance_goal,start_time,end_time")
      .eq("id", proposalId)
      .eq("business_email", user.email)
      .maybeSingle();

    if (ideaError) {
      throw new Error(`Failed to load proposal: ${ideaError.message}`);
    }
    if (!idea) {
      return NextResponse.json(
        { success: false, error: "PROPOSAL_NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: offer, error: offerError } = await admin
      .from("offers")
      .select("id,title,website,business_email")
      .eq("id", idea.offer_id)
      .eq("business_email", user.email)
      .maybeSingle();

    if (offerError) {
      throw new Error(`Failed to load offer: ${offerError.message}`);
    }

    return NextResponse.json({
      success: true,
      proposal: {
        ...idea,
        offer_title: offer?.title || "Untitled offer",
        offer_website: offer?.website || null,
      },
    });
  } catch (error) {
    console.error("[business/ad-ideas/review]", error);
    return NextResponse.json(
      {
        success: false,
        error: "PROPOSAL_REVIEW_FAILED",
        message: error instanceof Error ? error.message : "Could not load this campaign proposal.",
      },
      { status: 500 },
    );
  }
}
