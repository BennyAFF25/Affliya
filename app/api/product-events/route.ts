import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";

const ALLOWED_EVENT_TYPES = new Set([
  "content_library_asset_uploaded",
  "content_library_asset_updated",
  "affiliate_brand_content_viewed",
  "affiliate_brand_content_selected",
  "promotion_started",
  "paid_promotion_submitted",
  "organic_promotion_submitted",
]);

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const eventType = String(body?.eventType || "").trim();

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ ok: false, error: "Invalid event type" }, { status: 400 });
    }

    const offerId = body?.offerId ? String(body.offerId).trim() : null;
    const businessCreativeId = body?.businessCreativeId
      ? String(body.businessCreativeId).trim()
      : null;
    const promotionType = body?.promotionType ? String(body.promotionType).trim() : null;
    const actorRole = body?.actorRole ? String(body.actorRole).trim() : null;
    const meta = body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : {};

    const { error } = await (supabaseAdmin as any).from("product_events").insert({
      event_type: eventType,
      actor_email: user.email,
      actor_role: actorRole,
      offer_id: offerId,
      business_creative_id: businessCreativeId,
      promotion_type: promotionType,
      meta,
    });

    if (error) {
      console.error("[product-events] insert error", error);
      return NextResponse.json({ ok: false, error: "Failed to log event" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[product-events] unexpected error", error);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}

