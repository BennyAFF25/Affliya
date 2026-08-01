import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";
import { assertAffiliateOfferApproved, type QueryClient } from "../../../../../utils/approvals/enforcement";
import { requireBusinessCampaignLaunchEntitlement, isSubscriptionRequiredError, buildSubscriptionRequiredResponse } from "../../../../../utils/businessSubscriptionGate";
import { trackBusinessSubscriptionAnalytics } from "../../../../../utils/businessSubscriptionAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const adIdeaId = String(body?.adIdeaId || body?.id || "").trim();
    const status = String(body?.status || "").trim().toLowerCase();
    const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason : null;

    if (!adIdeaId || !["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ success: false, error: "INVALID_REQUEST", message: "Valid adIdeaId and status are required." }, { status: 400 });
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user?.email) {
      return NextResponse.json({ success: false, error: "UNAUTHENTICATED", message: "Sign in as the business before updating this ad idea." }, { status: 401 });
    }

    const admin = createServerSupabaseClient();
    const { data: idea, error: lookupError } = await admin
      .from("ad_ideas")
      .select("id,business_email,offer_id,affiliate_email,status")
      .eq("id", adIdeaId)
      .maybeSingle();

    if (lookupError) throw new Error(`Failed to load ad idea: ${lookupError.message}`);
    if (!idea || idea.business_email !== user.email) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED", message: "Only the offer business can update this ad idea." }, { status: 403 });
    }

    let approvedEntitlement = null;
    if (status === "approved") {
      const affiliateApproval = await assertAffiliateOfferApproved(admin as unknown as QueryClient, {
        offerId: idea.offer_id,
        affiliateEmail: idea.affiliate_email,
      });
      if (affiliateApproval.ok === false) {
        return NextResponse.json({ success: false, error: affiliateApproval.error, message: affiliateApproval.message }, { status: affiliateApproval.status });
      }

      const gate = await requireBusinessCampaignLaunchEntitlement({
        supabase: admin,
        businessEmail: idea.business_email,
        returnTo: "/business/my-business/ad-ideas",
        intendedAction: "approve_ad_idea",
        campaignId: idea.id,
        submissionId: idea.id,
        attribution: {
          source: "ad_idea_status_route",
          offerId: idea.offer_id,
          affiliateEmail: idea.affiliate_email,
          campaignType: "paid_meta",
        },
      });
      if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
      approvedEntitlement = gate.entitlement;
    }

    const updateData: Record<string, unknown> = { status };
    if (status === "rejected" && rejectionReason) updateData.rejection_reason = rejectionReason;

    const { data: updated, error: updateError } = await admin
      .from("ad_ideas")
      .update(updateData)
      .eq("id", adIdeaId)
      .eq("business_email", user.email)
      .select("id,status")
      .single();

    if (updateError) {
      if (isSubscriptionRequiredError(updateError)) {
        return NextResponse.json(
          buildSubscriptionRequiredResponse({
            entitlement: null,
            businessId: null,
            returnTo: "/business/my-business/ad-ideas",
            intendedAction: "approve_ad_idea",
            campaignId: adIdeaId,
            submissionId: adIdeaId,
            attribution: { source: "ad_idea_status_db_backstop" },
          }),
          { status: 402 },
        );
      }
      throw new Error(`Failed to update ad idea: ${updateError.message}`);
    }

    if (status === "approved" && approvedEntitlement?.hasActiveSubscription && !approvedEntitlement.isGrandfathered) {
      await trackBusinessSubscriptionAnalytics({
        supabase: admin,
        eventType: "campaign_approved_after_subscription",
        businessId: approvedEntitlement.businessId,
        businessEmail: idea.business_email,
        campaignId: idea.id,
        intendedAction: "approve_ad_idea",
        submissionId: idea.id,
        returnTo: "/business/my-business/ad-ideas",
        attribution: {
          source: "ad_idea_status_route",
          offerId: idea.offer_id,
          affiliateEmail: idea.affiliate_email,
        },
      });
    }

    return NextResponse.json({ success: true, adIdea: updated });
  } catch (err: unknown) {
    console.error("[business/ad-ideas/update-status]", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Failed to update ad idea." }, { status: 500 });
  }
}
