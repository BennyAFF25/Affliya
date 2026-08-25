/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/../utils/supabase/server-client";
import {
  buildPartnerProgrammeSummary,
  ensureNettmarkPartnerProgrammeAccess,
  getNettmarkPartnerProgrammeOffer,
} from "@/../utils/offers/firstPartyOffer";

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const offer = await getNettmarkPartnerProgrammeOffer<any>(
      supabaseAdmin as any,
      "id, system_key, title, description, logo_url, business_email, website, price, currency, commission_value, recurring_monthly_commission_value, recurring_term_months, payout_cycles, payout_mode, payout_interval, type",
    );

    if (!offer?.id) {
      return NextResponse.json({ ok: false, error: "Partner programme offer not found" }, { status: 404 });
    }

    const { data: assets, error: assetError } = await (supabaseAdmin as any)
      .from("business_creatives")
      .select("id, business_email, offer_id, title, caption, media_url, media_type, thumbnail_url, allow_organic, allow_paid, organic_preapproved, paid_preapproved, is_active, archived_at, created_at, updated_at, file_path, thumbnail_path, source_filename")
      .eq("business_email", offer.business_email)
      .eq("is_active", true)
      .is("archived_at", null)
      .eq("allow_organic", true)
      .or(`offer_id.eq.${offer.id},offer_id.is.null`)
      .order("updated_at", { ascending: false });

    if (assetError) {
      throw new Error(assetError.message || "Failed to load partner programme creatives.");
    }

    const sortedAssets = [...(assets || [])].sort((a: any, b: any) => {
      const preapprovedDelta = Number(Boolean(b.organic_preapproved)) - Number(Boolean(a.organic_preapproved));
      if (preapprovedDelta !== 0) return preapprovedDelta;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });

    return NextResponse.json({
      ok: true,
      offer: {
        ...offer,
        ...buildPartnerProgrammeSummary(offer),
      },
      assets: sortedAssets,
    });
  } catch (error: any) {
    console.error("[onboarding/partner-programme][GET] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const offer = await getNettmarkPartnerProgrammeOffer<any>(
      supabaseAdmin as any,
      "id, system_key, title, business_email, price, currency, commission_value, recurring_monthly_commission_value, recurring_term_months, payout_cycles, payout_mode, payout_interval, type",
    );

    if (!offer?.id) {
      return NextResponse.json({ ok: false, error: "Partner programme offer not found" }, { status: 404 });
    }

    await ensureNettmarkPartnerProgrammeAccess({
      supabase: supabaseAdmin as any,
      offerId: offer.id,
      affiliateEmail: user.email,
      businessEmail: offer.business_email,
    });

    const { error: eventError } = await (supabaseAdmin as any).from("product_events").insert({
      event_type: "nettmark_partner_offer_activated",
      actor_email: user.email,
      actor_role: "affiliate",
      offer_id: offer.id,
      promotion_type: "organic",
      meta: {
        entrypoint: "affiliate_onboarding",
      },
    });

    if (eventError) {
      console.warn("[onboarding/partner-programme][POST] product event failed", eventError);
    }

    return NextResponse.json({
      ok: true,
      offer: {
        ...offer,
        ...buildPartnerProgrammeSummary(offer),
      },
    });
  } catch (error: any) {
    console.error("[onboarding/partner-programme][POST] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}
