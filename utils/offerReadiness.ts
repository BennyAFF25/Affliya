import type { SupabaseClient } from "@supabase/supabase-js";
import { assertOfferTrackingReady, type QueryClient } from "./approvals/enforcement";

import { computeOfferMetaReady, type OfferMetaRow, type MetaConnectionRow, type OfferMetaReadiness } from "./offerMetaReadiness";

export type OfferPaidReadiness = OfferMetaReadiness & {
  offerId: string;
  businessEmail: string | null;
  trackingReady: boolean;
  trackingReason: string | null;
};

function compact(value?: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

export async function resolveOfferPaidReadiness(params: {
  supabase: SupabaseClient;
  offerId: string;
}): Promise<OfferPaidReadiness> {
  const offerId = params.offerId.trim();
  if (!offerId) throw new Error("resolveOfferPaidReadiness requires offerId");

  const { data: offerData, error: offerError } = await params.supabase
    .from("offers")
    .select("id,business_email,meta_page_id,meta_ad_account_id,meta_pixel_id,site_host")
    .eq("id", offerId)
    .maybeSingle();

  if (offerError) throw new Error(`Failed to load offer readiness: ${offerError.message}`);
  if (!offerData) throw new Error("Offer not found");

  const offer = offerData as OfferMetaRow;
  const businessEmail = compact(offer.business_email);

  let trackingReady = Boolean(compact(offer.site_host) || compact(offer.meta_pixel_id));
  let trackingReason: string | null = trackingReady ? null : "not_verified";

  if (!trackingReady) {
    try {
      const tracking = await assertOfferTrackingReady(params.supabase as unknown as QueryClient, offerId);
      trackingReady = tracking.ok;
      trackingReason = tracking.ok ? null : tracking.error;
    } catch (error) {
      trackingReady = false;
      trackingReason = error instanceof Error ? error.message : "tracking_check_failed";
    }
  }

  let meta = computeOfferMetaReady(offer);
  if (!meta.metaReady && businessEmail) {
    const { data, error } = await params.supabase
      .from("meta_connections")
      .select("page_id,page_name,ad_account_id,ad_account_name,pixel_id,pixel_name")
      .eq("business_email", businessEmail);
    if (error) throw new Error(`Failed to load Meta connections: ${error.message}`);
    meta = computeOfferMetaReady(offer, (data || []) as MetaConnectionRow[]);
  }
  return { offerId, businessEmail, trackingReady, trackingReason, ...meta };
}
