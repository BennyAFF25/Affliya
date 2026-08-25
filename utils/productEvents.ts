export async function logProductEvent(payload: {
  eventType:
    | "content_library_asset_uploaded"
    | "content_library_asset_updated"
    | "affiliate_brand_content_viewed"
    | "affiliate_brand_content_selected"
    | "promotion_started"
    | "paid_promotion_submitted"
    | "organic_promotion_submitted";
  actorRole: "business" | "affiliate";
  offerId?: string | null;
  businessCreativeId?: string | null;
  promotionType?: "paid" | "organic" | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await fetch("/api/product-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort only
  }
}

