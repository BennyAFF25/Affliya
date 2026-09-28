import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../utils/businessSubscriptions";
import {
  assertAffiliateOfferApproved,
  assertOfferTrackingReady,
  type QueryClient,
} from "../../../../../utils/approvals/enforcement";
import { requireBusinessCampaignLaunchEntitlement } from "../../../../../utils/businessSubscriptionGate";
import { assertBusinessPaymentReadyForCommission } from "../../../../../utils/businessPaymentReadiness";
import { resolveOfferPaidReadiness } from "../../../../../utils/offerReadiness";
import {
  getAffiliateCampaignFundingReadiness,
  getExistingPaidCampaignLaunch,
  validatePaidCampaignTiming,
} from "../../../../../utils/paidCampaignLaunchReadiness";
import { POST as uploadCampaignToMeta } from "../../../meta/callback/upload-video/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(
  error: string,
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { success: false, error, message, ...extra },
    { status },
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const adIdeaId = String(body?.adIdeaId || body?.id || "").trim();

    if (!adIdeaId) {
      return jsonError("INVALID_REQUEST", "adIdeaId is required.", 400);
    }

    const userSupabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    const user = authData?.user || null;

    if (authError || !user?.email) {
      return jsonError(
        "UNAUTHENTICATED",
        "Sign in as the business before launching this campaign.",
        401,
      );
    }

    const admin = createServerSupabaseClient();

    // Always reload the proposal from the server. Browser readiness and posted
    // campaign fields are not authoritative at launch time.
    const { data: idea, error: ideaError } = await admin
      .from("ad_ideas")
      .select("*")
      .eq("id", adIdeaId)
      .maybeSingle();

    if (ideaError) {
      throw new Error(`Failed to load ad idea: ${ideaError.message}`);
    }

    if (!idea || idea.business_email !== user.email) {
      return jsonError(
        "UNAUTHORIZED",
        "Only the offer business can launch this campaign.",
        403,
      );
    }

    if (String(idea.status || "").toLowerCase() === "rejected") {
      return jsonError(
        "CAMPAIGN_REJECTED",
        "This proposal has been rejected and cannot be launched.",
        409,
      );
    }

    const existingLive = await getExistingPaidCampaignLaunch({
      supabase: admin,
      adIdeaId,
    });

    if (existingLive?.id) {
      return NextResponse.json({
        success: true,
        alreadyLive: true,
        liveAdId: existingLive.id,
        campaignId: existingLive.meta_campaign_id || idea.meta_campaign_id || null,
        metaAdId: existingLive.meta_ad_id || null,
      });
    }

    // meta_campaign_id is written immediately after Meta campaign creation. If
    // it exists without a live_ads row, a prior attempt reached Meta only
    // partially. Refuse a blind retry so we cannot duplicate Meta resources.
    if (idea.meta_campaign_id) {
      return jsonError(
        "CAMPAIGN_PARTIAL_META_STATE",
        "A previous launch created part of this campaign in Meta but did not finish. The proposal has been preserved and will not be duplicated automatically.",
        409,
        { metaCampaignId: idea.meta_campaign_id },
      );
    }

    const offerId = String(idea.offer_id || "").trim();
    const affiliateEmail = String(idea.affiliate_email || "").trim().toLowerCase();
    if (!offerId || !affiliateEmail) {
      return jsonError(
        "INVALID_PROPOSAL",
        "This proposal is missing its offer or affiliate identity.",
        400,
      );
    }

    const { data: offer, error: offerError } = await admin
      .from("offers")
      .select("id,business_email,participation_mode,website,meta_page_id,meta_ad_account_id,meta_pixel_id,title")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) throw new Error(`Failed to load offer: ${offerError.message}`);
    if (!offer?.id || offer.business_email !== user.email || offer.business_email !== idea.business_email) {
      return jsonError(
        "OFFER_NOT_AVAILABLE",
        "The offer attached to this proposal is no longer available to this business.",
        409,
      );
    }

    const affiliateApproval = await assertAffiliateOfferApproved(
      admin as unknown as QueryClient,
      { offerId, affiliateEmail },
    );
    if (!affiliateApproval.ok) {
      return NextResponse.json(
        {
          success: false,
          error: affiliateApproval.error,
          message: affiliateApproval.message,
        },
        { status: affiliateApproval.status },
      );
    }

    const gate = await requireBusinessCampaignLaunchEntitlement({
      supabase: admin,
      businessEmail: user.email,
      returnTo: "/business/my-business/ad-ideas",
      intendedAction: "launch_paid_meta_ad",
      campaignId: adIdeaId,
      submissionId: adIdeaId,
      attribution: {
        source: "ad_idea_launch_route",
        offerId,
        affiliateEmail,
        campaignType: "paid_meta",
      },
    });
    if (!gate.ok) {
      return NextResponse.json(gate.body, { status: gate.status });
    }

    const paymentReady = await assertBusinessPaymentReadyForCommission({
      supabase: admin as never,
      businessEmail: user.email,
    });
    if (!paymentReady.ok) {
      return NextResponse.json(
        {
          success: false,
          error: paymentReady.error,
          message: paymentReady.message,
          reason: paymentReady.reason,
          action: "connect_business_billing",
        },
        { status: paymentReady.status },
      );
    }

    const trackingReady = await assertOfferTrackingReady(
      admin as unknown as QueryClient,
      offerId,
    );
    if (!trackingReady.ok) {
      return NextResponse.json(
        {
          success: false,
          error: trackingReady.error,
          message: trackingReady.message,
        },
        { status: trackingReady.status },
      );
    }

    const paidReadiness = await resolveOfferPaidReadiness({
      supabase: admin as never,
      offerId,
    });

    if (!paidReadiness.resolvedMeta.pageId) {
      return jsonError(
        "META_PAGE_REQUIRED",
        "Connect/select a Facebook Page for this offer before launch.",
        409,
      );
    }

    if (!paidReadiness.resolvedMeta.adAccountId) {
      return jsonError(
        "META_AD_ACCOUNT_REQUIRED",
        "Connect/select a Meta Ad Account for this offer before launch.",
        409,
      );
    }

    const isSalesObjective = String(idea.objective || "").trim() === "OUTCOME_SALES";
    if (isSalesObjective && !paidReadiness.resolvedMeta.pixelId) {
      return jsonError(
        "SALES_PIXEL_REQUIRED",
        "Sales campaigns require a Meta Pixel/dataset selected on this offer before launch.",
        409,
      );
    }

    const timing = validatePaidCampaignTiming(idea);
    if (!timing.ok) {
      return jsonError(timing.error, timing.message, 409, { reason: timing.reason });
    }

    const funding = await getAffiliateCampaignFundingReadiness({
      supabase: admin,
      affiliateEmail,
      offerId,
      adIdea: idea,
    });

    if (!funding.ready) {
      return jsonError(
        "AFFILIATE_CAMPAIGN_FUNDING_REQUIRED",
        `Affiliate campaign funding is short by $${funding.deficit.toFixed(2)}.`,
        409,
        {
          funding: {
            ready: false,
            requiredAmount: funding.requiredAmount,
            deficit: funding.deficit,
          },
          action: "affiliate_top_up_wallet",
        },
      );
    }

    // Known blockers have passed. The legacy Meta route currently requires an
    // approved proposal, so transition immediately before the launch call. On
    // any failed launch we return it to pending; a partial Meta campaign ID is
    // preserved so a retry cannot blindly duplicate resources.
    const { data: claimedProposal, error: approveError } = await admin
      .from("ad_ideas")
      .update({ status: "approved" })
      .eq("id", adIdeaId)
      .eq("business_email", user.email)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (approveError) {
      throw new Error(`Failed to prepare proposal for launch: ${approveError.message}`);
    }
    if (!claimedProposal?.id) {
      const existingAfterClaim = await getExistingPaidCampaignLaunch({
        supabase: admin,
        adIdeaId,
      });
      if (existingAfterClaim?.id) {
        return NextResponse.json({
          success: true,
          alreadyLive: true,
          liveAdId: existingAfterClaim.id,
          campaignId: existingAfterClaim.meta_campaign_id || null,
          metaAdId: existingAfterClaim.meta_ad_id || null,
        });
      }
      return jsonError(
        "CAMPAIGN_LAUNCH_IN_PROGRESS",
        "This campaign is already being launched or is no longer pending. Refresh before trying again.",
        409,
      );
    }

    const internalRequest = new Request(
      new URL("/api/meta/callback/upload-video", req.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.get("cookie")
            ? { cookie: req.headers.get("cookie") as string }
            : {}),
        },
        body: JSON.stringify({
          adIdeaId,
          offerId,
          affiliate_email: affiliateEmail,
        }),
      },
    );

    const launchResponse = await uploadCampaignToMeta(internalRequest);
    const launchJson = await launchResponse.json().catch(() => null);

    if (!launchResponse.ok || !launchJson?.success || !launchJson?.liveAdId) {
      await admin
        .from("ad_ideas")
        .update({ status: "pending" })
        .eq("id", adIdeaId)
        .eq("business_email", user.email);

      return NextResponse.json(
        {
          success: false,
          error: launchJson?.error || "META_LAUNCH_FAILED",
          message:
            launchJson?.message ||
            "The campaign did not fully launch. The proposal is still available and was not marked live.",
          meta: launchJson?.meta || null,
          recoverable: true,
        },
        { status: launchResponse.status >= 400 ? launchResponse.status : 409 },
      );
    }

    return NextResponse.json({
      ...launchJson,
      success: true,
      approved: true,
      funding: {
        ready: true,
        requiredAmount: funding.requiredAmount,
      },
    });
  } catch (error) {
    console.error("[business/ad-ideas/launch]", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Could not launch campaign.",
      },
      { status: 500 },
    );
  }
}
