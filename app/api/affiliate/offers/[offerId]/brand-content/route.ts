import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import {
  assertAffiliateOfferApproved,
  ensureAffiliateOfferParticipation,
  normalizeOfferParticipationMode,
} from "@/../utils/approvals/enforcement";

export async function GET(req: Request, context: { params: Promise<{ offerId: string }> }) {
  try {
    const { offerId } = await context.params;
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const mode = (new URL(req.url).searchParams.get("mode") || "paid").toLowerCase();
    if (!["paid", "organic"].includes(mode)) {
      return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });
    }

    let { data: offer, error: offerError } = await (supabaseAdmin as any)
      .from("offers")
      .select("id, business_email, title, participation_mode")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError?.message?.toLowerCase().includes("participation_mode")) {
      ({ data: offer, error: offerError } = await (supabaseAdmin as any)
        .from("offers")
        .select("id, business_email, title")
        .eq("id", offerId)
        .maybeSingle());
    }

    if (offerError || !offer?.business_email) {
      return NextResponse.json({ ok: false, error: "Offer not found." }, { status: 404 });
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

    const access = await assertAffiliateOfferApproved(supabaseAdmin as any, {
      offerId,
      affiliateEmail: user.email,
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error, message: access.message }, { status: access.status });
    }

    let query = (supabaseAdmin as any)
      .from("business_creatives")
      .select("*")
      .eq("business_email", offer.business_email)
      .eq("is_active", true)
      .is("archived_at", null)
      .or(`offer_id.eq.${offerId},offer_id.is.null`)
      .order("updated_at", { ascending: false });

    query = mode === "paid" ? query.eq("allow_paid", true) : query.eq("allow_organic", true);

    const { data: assets, error: assetsError } = await query;
    if (assetsError) throw new Error(assetsError.message || "Failed to load brand content");

    const filteredAssets = (assets || []).filter((asset: any) => {
      if (mode !== "paid") return true;
      if (String(asset.media_type || "").toLowerCase() !== "video") return true;
      return !!asset.thumbnail_url;
    });

    await (supabaseAdmin as any).from("product_events").insert({
      event_type: "affiliate_brand_content_viewed",
      actor_email: user.email,
      actor_role: "affiliate",
      offer_id: offerId,
      promotion_type: mode,
      meta: { assetCount: filteredAssets.length },
    });

    return NextResponse.json({ ok: true, assets: filteredAssets, offerTitle: offer.title || null });
  } catch (error: unknown) {
    console.error("[affiliate/brand-content][GET] error", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
