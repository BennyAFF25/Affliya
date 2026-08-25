/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import { assertAffiliateOfferApproved } from "@/../utils/approvals/enforcement";
import { buildTrackingUrl } from "@/../utils/tracking/buildTrackingUrl";
import {
  ensureNettmarkPartnerProgrammeAccess,
  getNettmarkPartnerProgrammeOffer,
} from "@/../utils/offers/firstPartyOffer";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email || !user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const businessCreativeId = String(body?.businessCreativeId || "").trim();
    if (!businessCreativeId) {
      return NextResponse.json({ ok: false, error: "Missing businessCreativeId" }, { status: 400 });
    }

    const offer = await getNettmarkPartnerProgrammeOffer<any>(
      supabaseAdmin as any,
      "id, title, business_email",
    );

    if (!offer?.id || !offer?.business_email) {
      return NextResponse.json({ ok: false, error: "Partner programme offer not found" }, { status: 404 });
    }

    await ensureNettmarkPartnerProgrammeAccess({
      supabase: supabaseAdmin as any,
      offerId: offer.id,
      affiliateEmail: user.email,
      businessEmail: offer.business_email,
    });

    const approval = await assertAffiliateOfferApproved(supabaseAdmin as any, {
      offerId: offer.id,
      affiliateEmail: user.email,
    });

    if (!approval.ok) {
      return NextResponse.json({ ok: false, error: approval.error, message: approval.message }, { status: approval.status });
    }

    const { data: asset, error: assetError } = await (supabaseAdmin as any)
      .from("business_creatives")
      .select("id, business_email, offer_id, title, caption, media_url, media_type, thumbnail_url, allow_organic, organic_preapproved, is_active, archived_at")
      .eq("id", businessCreativeId)
      .maybeSingle();

    if (assetError) {
      throw new Error(assetError.message || "Failed to load creative.");
    }

    if (!asset?.id) {
      return NextResponse.json({ ok: false, error: "Creative not found" }, { status: 404 });
    }

    if (asset.business_email !== offer.business_email) {
      return NextResponse.json({ ok: false, error: "Creative ownership mismatch" }, { status: 409 });
    }

    if (asset.offer_id && asset.offer_id !== offer.id) {
      return NextResponse.json({ ok: false, error: "Creative does not belong to this offer" }, { status: 409 });
    }

    if (!asset.is_active || asset.archived_at) {
      return NextResponse.json({ ok: false, error: "Creative is no longer active" }, { status: 400 });
    }

    if (!asset.allow_organic || !asset.organic_preapproved) {
      return NextResponse.json({ ok: false, error: "Creative is not pre-approved for organic onboarding" }, { status: 400 });
    }

    const mediaUrl = String(asset.media_url || "").trim();
    if (!mediaUrl) {
      return NextResponse.json({ ok: false, error: "Creative is missing media" }, { status: 400 });
    }

    const caption = String(asset.caption || "").trim();
    const imageUrl = String(asset.media_type || "").toLowerCase() === "video" ? null : mediaUrl;
    const videoUrl = String(asset.media_type || "").toLowerCase() === "video" ? mediaUrl : null;

    const { data: organicPost, error: organicPostError } = await (supabaseAdmin as any)
      .from("organic_posts")
      .insert({
        offer_id: offer.id,
        user_id: user.id,
        affiliate_email: user.email,
        business_email: offer.business_email,
        caption,
        platform: "Onboarding",
        image_url: imageUrl,
        video_url: videoUrl,
        business_creative_id: asset.id,
        status: "approved",
      })
      .select("id")
      .single();

    if (organicPostError) {
      throw new Error(organicPostError.message || "Failed to create onboarding organic post.");
    }

    const { data: liveCampaign, error: liveCampaignError } = await (supabaseAdmin as any)
      .from("live_campaigns")
      .insert({
        type: "organic",
        offer_id: offer.id,
        business_email: offer.business_email,
        affiliate_email: user.email,
        media_url: mediaUrl,
        caption,
        platform: "Onboarding",
        created_from: "onboarding_fast_path",
        status: "live",
      })
      .select("id")
      .single();

    if (liveCampaignError || !liveCampaign?.id) {
      throw new Error(liveCampaignError?.message || "Failed to create live onboarding campaign.");
    }

    const trackingLink = buildTrackingUrl({
      campaignId: liveCampaign.id,
      affiliateId: user.email,
    });

    const { error: profileError } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    if (profileError) {
      console.warn("[onboarding/ready-first-promotion] onboarding profile update failed", profileError);
    }

    const { error: eventError } = await (supabaseAdmin as any).from("product_events").insert([
      {
        event_type: "first_tracking_link_created",
        actor_email: user.email,
        actor_role: "affiliate",
        offer_id: offer.id,
        business_creative_id: asset.id,
        promotion_type: "organic",
        meta: {
          campaignId: liveCampaign.id,
          trackingLink,
          source: "affiliate_onboarding",
        },
      },
      {
        event_type: "first_promotion_ready",
        actor_email: user.email,
        actor_role: "affiliate",
        offer_id: offer.id,
        business_creative_id: asset.id,
        promotion_type: "organic",
        meta: {
          campaignId: liveCampaign.id,
          organicPostId: organicPost?.id || null,
          source: "affiliate_onboarding",
        },
      },
      {
        event_type: "onboarding_completed",
        actor_email: user.email,
        actor_role: "affiliate",
        offer_id: offer.id,
        business_creative_id: asset.id,
        promotion_type: "organic",
        meta: {
          campaignId: liveCampaign.id,
          source: "affiliate_onboarding",
        },
      },
    ]);

    if (eventError) {
      console.warn("[onboarding/ready-first-promotion] product events failed", eventError);
    }

    return NextResponse.json({
      ok: true,
      offer: {
        id: offer.id,
        title: offer.title,
      },
      campaign: {
        id: liveCampaign.id,
        trackingLink,
      },
      creative: {
        id: asset.id,
        title: asset.title,
        caption,
        mediaUrl,
        mediaType: asset.media_type,
        thumbnailUrl: asset.thumbnail_url,
      },
    });
  } catch (error: any) {
    console.error("[onboarding/ready-first-promotion][POST] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}
