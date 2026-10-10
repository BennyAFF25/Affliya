import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "@/../utils/businessSubscriptions";
import {
  validateLaunchProposal, buildSavedMetaCreative, buildSavedMetaTargeting,
} from "@/../utils/meta/campaignConfiguration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated, business-only, no-write, no-Meta-call proof of the exact saved
 * campaign's creative and targeting mapping. Never expose Meta credentials.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ adIdeaId: string }> },
) {
  try {
    const { adIdeaId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(adIdeaId)) {
      return NextResponse.json({ error: "INVALID_PROPOSAL_ID" }, { status: 400 });
    }
    const userClient = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    const admin = createServerSupabaseClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "business") {
      return NextResponse.json({ error: "BUSINESS_ONLY" }, { status: 403 });
    }
    const { data: idea, error: ideaError } = await admin.from("ad_ideas")
      .select("*").eq("id", adIdeaId).ilike("business_email", user.email).maybeSingle();
    if (ideaError) throw ideaError;
    if (!idea) return NextResponse.json({ error: "PROPOSAL_NOT_FOUND" }, { status: 404 });
    const { data: offer, error: offerError } = await admin.from("offers")
      .select("id,currency").eq("id", idea.offer_id).ilike("business_email", user.email).maybeSingle();
    if (offerError) throw offerError;
    if (!offer) return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404 });

    const check = validateLaunchProposal(idea, { currency: String(offer.currency || "") });
    const creative = buildSavedMetaCreative(idea);
    // Intent validation can reject legacy free-text interests; do not throw.
    const targeting = check.ok ? buildSavedMetaTargeting(idea) : null;
    return NextResponse.json({
      proposalId: idea.id,
      status: idea.status,
      configurationValid: check.ok,
      errors: check.errors,
      simulatedMetaPayload: check.ok ? {
        campaign: {
          name: idea.campaign_name,
          objective: idea.objective,
          budgetAmountMinor: idea.budget_amount,
          budgetType: idea.budget_type,
          currency: idea.currency || offer.currency,
          startTime: idea.start_time,
          endTime: idea.end_time,
        },
        adset: { targeting },
        adCreative: {
          mediaType: idea.media_type,
          fileUrl: idea.file_url,
          link_data: {
            name: creative.headline,
            message: creative.caption,
            call_to_action: { type: creative.ctaType },
            destinationSource: "ad_ideas.tracking_link",
            displayUrl: creative.displayLink,
            usesSavedTrackingUrl: Boolean(creative.destinationLink && creative.destinationLink === idea.tracking_link),
          },
        },
      } : null,
      disclaimer: "Read-only simulation of stored fields. No Meta calls, database writes, approvals, or spend. Meta API acceptance not guaranteed.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[business/ad-ideas/launch-preview]", error);
    return NextResponse.json({ error: "PREVIEW_FAILED" }, { status: 500 });
  }
}
