import { computeOfferMetaReady, type OfferMetaRow, type MetaConnectionRow } from "../../../../utils/offerMetaReadiness";
import { NextResponse } from "next/server";
import supabaseAdmin from "@/../utils/supabase/server-client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawOfferIds = (url.searchParams.get("offerIds") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 100);

    if (!rawOfferIds.length) {
      return NextResponse.json({ ok: true, readiness: {} });
    }

    const { data: offers, error: offerError } = await (supabaseAdmin as any)
      .from("offers")
      .select("id, business_email, meta_page_id, meta_ad_account_id")
      .in("id", rawOfferIds);
    if (offerError) throw new Error(offerError.message || "Failed to load offers");

    const offerRows = (offers || []) as Array<OfferMetaRow & { id: string; business_email: string | null }>;
    const businessEmails = Array.from(new Set(offerRows.map((offer) => offer.business_email).filter((email): email is string => Boolean(email))));

    const { data: connections, error: connectionError } = businessEmails.length
      ? await supabaseAdmin.from("meta_connections").select("business_email,page_id,ad_account_id").in("business_email", businessEmails)
      : { data: [], error: null };
    if (connectionError) throw new Error("Failed to load Meta readiness");
    const connectionsByBusiness = new Map<string, MetaConnectionRow[]>();
    for (const connection of connections || []) {
      const rows = connectionsByBusiness.get(connection.business_email) || [];
      rows.push(connection);
      connectionsByBusiness.set(connection.business_email, rows);
    }

    const { data: assets, error: assetError } = await (supabaseAdmin as any)
      .from("business_creatives")
      .select("id, business_email, offer_id, allow_organic, allow_paid, is_active, archived_at")
      .in("business_email", businessEmails)
      .eq("is_active", true)
      .is("archived_at", null);

    if (assetError) throw new Error(assetError.message || "Failed to load assets");

    const readiness = Object.fromEntries(offerRows.map((offer) => [offer.id, {
      total: 0, organic: 0, paid: 0,
      metaReady: computeOfferMetaReady(offer, connectionsByBusiness.get(offer.business_email || "") || []).metaReady,
    }]));
    const offerBusinessMap = new Map(offerRows.map((offer) => [offer.id, offer.business_email]));

    for (const asset of (assets || []) as any[]) {
      for (const offerId of rawOfferIds) {
        const offerBusinessEmail = offerBusinessMap.get(offerId);
        if (!offerBusinessEmail || asset.business_email !== offerBusinessEmail) continue;
        if (asset.offer_id && asset.offer_id !== offerId) continue;
        readiness[offerId].total += 1;
        if (asset.allow_organic) readiness[offerId].organic += 1;
        if (asset.allow_paid) readiness[offerId].paid += 1;
      }
    }

    return NextResponse.json({ ok: true, readiness });
  } catch (error: any) {
    console.error("[offers/content-readiness] error", error);
    return NextResponse.json({ ok: false, error: error?.message || "Unexpected error" }, { status: 500 });
  }
}

