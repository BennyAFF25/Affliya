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
      .select("*")
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

    const [{ data: offer, error: offerError }, { data: affiliateProfile, error: affiliateProfileError }] = await Promise.all([
      admin
      .from("offers")
      .select("id,title,website,business_email,currency")
      .eq("id", idea.offer_id)
      .eq("business_email", user.email)
      .maybeSingle(),
      admin
        .from("profiles")
        .select("username")
        .eq("email", idea.affiliate_email)
        .limit(1)
        .maybeSingle(),
    ]);

    if (offerError) {
      throw new Error(`Failed to load offer: ${offerError.message}`);
    }

    if (affiliateProfileError) {
      console.warn("[business/ad-ideas/review] affiliate username lookup failed", affiliateProfileError);
    }

    const username = String(affiliateProfile?.username || "").trim().replace(/^@+/, "");
    const affiliateUsername = username ? `@${username}` : "Nettmark affiliate";

    return NextResponse.json({
      success: true,
      proposal: {
        id: idea.id,
        offer_id: idea.offer_id,
        affiliate_username: affiliateUsername,
        status: idea.status,
        created_at: idea.created_at,
        business_viewed_at: idea.business_viewed_at || null,
        headline: idea.headline || null,
        advantage_audience: Boolean(idea.advantage_audience),
        campaign_name: idea.campaign_name || null,
        audience: idea.audience || null,
        location: idea.location || null,
        objective: idea.objective || null,
        caption: idea.caption || null,
        file_url: idea.file_url || null,
        media_type: idea.media_type || null,
        call_to_action: idea.call_to_action || null,
        cta: idea.cta || null,
        currency: idea.currency || offer?.currency || null,
        budget_amount: idea.budget_amount ?? null,
        budget_type: idea.budget_type || null,
        daily_budget: idea.daily_budget ?? null,
        age_range: idea.age_range || null,
        gender: idea.gender || null,
        interests: idea.interests || null,
        placements_type: idea.placements_type || null,
        manual_placements: idea.manual_placements || null,
        conversion_event: idea.conversion_event || null,
        performance_goal: idea.performance_goal || null,
        start_time: idea.start_time || null,
        end_time: idea.end_time || null,
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
