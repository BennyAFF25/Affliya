import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import {
  assertAffiliateOfferApproved,
  ensureAffiliateOfferParticipation,
  normalizeOfferParticipationMode,
} from "@/../utils/approvals/enforcement";
import { buildTrackingUrl } from "@/../utils/tracking/buildTrackingUrl";

export async function POST(req: Request, context: { params: Promise<{ offerId: string }> }) {
  try {
    const { offerId } = await context.params;
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
    const platform = String(body?.platform || "Social").trim() || "Social";

    if (!businessCreativeId) {
      return NextResponse.json({ ok: false, error: "Missing businessCreativeId" }, { status: 400 });
    }

    const { data: offer, error: offerError } = await (supabaseAdmin as any)
      .from("offers")
      .select("id, title, business_email, participation_mode, status")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) {
      throw new Error(offerError.message || "Failed to load offer.");
    }

    if (!offer?.id || !offer?.business_email) {
      return NextResponse.json({ ok: false, error: "Offer not found" }, { status: 404 });
    }

    const offerStatus = String(offer.status || "active").toLowerCase();
    if (!["active", "approved", "live", "published"].includes(offerStatus)) {
      return NextResponse.json({ ok: false, error: "offer_not_active", message: "This offer is not currently available." }, { status: 409 });
    }

    const participationMode = normalizeOfferParticipationMode(offer.participation_mode);

    if (participationMode === "open") {
      const participation = await ensureAffiliateOfferParticipation(supabaseAdmin as any, {
        offerId,
        affiliateEmail: user.email,
        businessEmail: offer.business_email,
        participationMode,
      });

      if (!participation.ok) {
        return NextResponse.json(
          { ok: false, error: participation.error, message: participation.message },
          { status: participation.status },
        );
      }
    }

    const approval = await assertAffiliateOfferApproved(supabaseAdmin as any, {
      offerId,
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
      return NextResponse.json({ ok: false, error: "Creative is not pre-approved for organic promotion" }, { status: 400 });
    }

    const { error: affiliateProfileError } = await (supabaseAdmin as any)
      .from("affiliate_profiles")
      .upsert(
        {
          user_id: user.id,
          email: user.email,
        },
        { onConflict: "user_id" },
      );

    if (affiliateProfileError) {
      throw new Error(affiliateProfileError.message || "Failed to prepare affiliate profile.");
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
        platform,
        image_url: imageUrl,
        video_url: videoUrl,
        business_creative_id: asset.id,
        status: "approved",
      })
      .select("id")
      .single();

    if (organicPostError) {
      throw new Error(organicPostError.message || "Failed to create approved organic post.");
    }

    const { data: liveCampaign, error: liveCampaignError } = await (supabaseAdmin as any)
      .from("live_campaigns")
      .insert({
        type: "organic",
        offer_id: offer.id,
        affiliate_user_id: user.id,
        business_email: offer.business_email,
        affiliate_email: user.email,
        media_url: mediaUrl,
        caption,
        platform,
        created_from: "affiliate_preapproved_organic",
        status: "live",
      })
      .select("id")
      .single();

    if (liveCampaignError || !liveCampaign?.id) {
      throw new Error(liveCampaignError?.message || "Failed to create live organic campaign.");
    }

    const trackingLink = buildTrackingUrl({
      campaignId: liveCampaign.id,
      affiliateId: user.email,
    });

    const { error: eventError } = await (supabaseAdmin as any).from("product_events").insert([
      {
        event_type: "affiliate_preapproved_organic_started",
        actor_email: user.email,
        actor_role: "affiliate",
        offer_id: offer.id,
        business_creative_id: asset.id,
        promotion_type: "organic",
        meta: {
          campaignId: liveCampaign.id,
          organicPostId: organicPost?.id || null,
          trackingLink,
          platform,
          source: "preapproved_brand_content",
        },
      },
      {
        event_type: "affiliate_tracking_link_created",
        actor_email: user.email,
        actor_role: "affiliate",
        offer_id: offer.id,
        business_creative_id: asset.id,
        promotion_type: "organic",
        meta: {
          campaignId: liveCampaign.id,
          trackingLink,
          source: "preapproved_brand_content",
        },
      },
    ]);

    if (eventError) {
      console.warn("[affiliate/offers/ready-organic-promotion] product events failed", eventError);
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
    console.error("[affiliate/offers/ready-organic-promotion][POST] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}
