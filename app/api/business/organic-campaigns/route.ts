import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  assertAffiliateOfferApproved,
  assertOfferTrackingReady,
  type QueryClient,
} from "@/../utils/approvals/enforcement";

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
      return NextResponse.json(
        {
          success: false,
          error: "INSERT_FAILED",
          message: "Failed to create the organic campaign.",
        },
        { status: 500 },
      );
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
