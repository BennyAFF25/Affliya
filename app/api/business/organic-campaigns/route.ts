import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  assertAffiliateOfferApproved,
  assertOfferTrackingReady,
  type QueryClient,
} from "@/../utils/approvals/enforcement";
import { requireBusinessCampaignLaunchEntitlement, isSubscriptionRequiredError, buildSubscriptionRequiredResponse } from "@/../utils/businessSubscriptionGate";
import { trackBusinessSubscriptionAnalytics } from "@/../utils/businessSubscriptionAnalytics";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

type OrganicCampaignRequest = {
  offerId?: string;
  businessEmail?: string;
  affiliateEmail?: string;
  mediaUrl?: string | null;
  caption?: string | null;
  platform?: string | null;
  submissionId?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as OrganicCampaignRequest | null;
    const offerId = body?.offerId;
    const affiliateEmail = body?.affiliateEmail;
    const businessEmail = body?.businessEmail;

    if (!offerId || !affiliateEmail || !businessEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_REQUIRED_FIELDS",
          message: "Missing offer, affiliate, or business context for organic campaign launch.",
        },
        { status: 400 },
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHENTICATED",
          message: "Sign in as the offer business before launching this campaign.",
        },
        { status: 401 },
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const userEmail = authData?.user?.email;

    if (authError || !userEmail || userEmail !== businessEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Only the offer business can launch this organic campaign.",
        },
        { status: 403 },
      );
    }

    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("business_email")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) {
      console.error("[organic-campaigns] offer lookup failed", offerError);
      return NextResponse.json(
        {
          success: false,
          error: "OFFER_LOOKUP_FAILED",
          message: "Failed to verify the offer business before launch.",
        },
        { status: 500 },
      );
    }

    if (!offer || offer.business_email !== businessEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "OFFER_BUSINESS_MISMATCH",
          message: "Only the offer business can launch this organic campaign.",
        },
        { status: 403 },
      );
    }

    const trackingReady = await assertOfferTrackingReady(
      supabase as unknown as QueryClient,
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

    const affiliateApproval = await assertAffiliateOfferApproved(
      supabase as unknown as QueryClient,
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
      supabase: supabase as never,
      businessEmail,
      returnTo: "/business/my-business/post-ideas",
      intendedAction: "approve_organic_post",
      campaignId: body?.submissionId || null,
      submissionId: body?.submissionId || null,
      attribution: {
        source: "organic_campaigns_route",
        offerId,
        affiliateEmail,
        platform: body?.platform || null,
      },
    });
    if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

    const { data: insertedCampaign, error: insertError } = await supabase
      .from("live_campaigns")
      .insert([
        {
          type: "organic",
          offer_id: offerId,
          business_email: businessEmail,
          affiliate_email: affiliateEmail,
          media_url: body?.mediaUrl || null,
          caption: body?.caption || null,
          platform: body?.platform || null,
          created_from: "post-ideas",
          status: "live",
        },
      ])
      .select("id")
      .single();

    if (insertError) {
      console.error("[organic-campaigns] insert failed", insertError);
      if (isSubscriptionRequiredError(insertError)) {
        return NextResponse.json(
          buildSubscriptionRequiredResponse({
            entitlement: null,
            returnTo: "/business/my-business/post-ideas",
            intendedAction: "approve_organic_post",
            campaignId: body?.submissionId || null,
            submissionId: body?.submissionId || null,
            attribution: { source: "organic_campaigns_db_backstop" },
          }),
          { status: 402 },
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "INSERT_FAILED",
          message: "Failed to create the organic campaign.",
        },
        { status: 500 },
      );
    }

    if (gate.entitlement?.hasActiveSubscription && !gate.entitlement.isGrandfathered) {
      await trackBusinessSubscriptionAnalytics({
        supabase: supabase as never,
        eventType: "campaign_approved_after_subscription",
        businessId: gate.entitlement.businessId,
        businessEmail,
        campaignId: insertedCampaign?.id || body?.submissionId || null,
        intendedAction: "approve_organic_post",
        submissionId: body?.submissionId || null,
        returnTo: "/business/my-business/post-ideas",
        attribution: {
          source: "organic_campaigns_route",
          offerId,
          affiliateEmail,
          platform: body?.platform || null,
        },
      });
    }

    return NextResponse.json({ success: true, campaignId: insertedCampaign?.id });
  } catch (error) {
    console.error("[organic-campaigns] unexpected error", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Failed to create the organic campaign.",
      },
      { status: 500 },
    );
  }
}
