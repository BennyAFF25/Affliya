import { getMarketingVisitorId } from "./marketing/visitor";
import { trackRedditConversion } from "./marketing/redditConversions";

function trackRedditProductConversion(payload: {
  eventType: string;
  actorRole: "business" | "affiliate";
  offerId?: string | null;
}) {
  if (
    payload.actorRole === "business" &&
    payload.eventType === "offer_published" &&
    payload.offerId
  ) {
    trackRedditConversion({
      eventName: "CreateOffer",
      conversionId: `offer_${payload.offerId}`,
    });
  }
}

export async function logProductEvent(payload: {
  eventType:
    | "content_library_asset_uploaded"
    | "content_library_asset_updated"
    | "affiliate_brand_content_viewed"
    | "affiliate_brand_content_selected"
    | "promotion_started"
    | "paid_promotion_submitted"
    | "organic_promotion_submitted"
    | "onboarding_started"
    | "promotion_preference_selected"
    | "nettmark_partner_offer_activated"
    | "first_creative_viewed"
    | "first_creative_selected"
    | "first_tracking_link_created"
    | "first_promotion_ready"
    | "onboarding_completed"
    | "business_signup_completed"
    | "business_dashboard_viewed"
    | "offer_create_viewed"
    | "offer_create_step"
    | "offer_publish_clicked"
    | "offer_publish_failed"
    | "offer_published"
    | "plan_choice_viewed"
    | "plan_free_clicked"
    | "plan_growth_clicked"
    | "plan_growth_checkout_started"
    | "plan_growth_activated"
    | "dashboard_action_clicked"
    | "meta_connect_clicked"
    | "tracking_setup_clicked"
    | "affiliate_requests_viewed"
    | "content_review_clicked";
  actorRole: "business" | "affiliate";
  offerId?: string | null;
  businessCreativeId?: string | null;
  promotionType?: "paid" | "organic" | null;
  meta?: Record<string, unknown>;
}) {
  trackRedditProductConversion(payload);

  const trackedPayload = { ...payload, meta: { ...payload.meta, visitor_id: getMarketingVisitorId() } };
  const attempts = payload.actorRole === "business" ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch("/api/product-events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        keepalive: true, body: JSON.stringify(trackedPayload),
      });
      if (response.ok) return true;
      if (response.status !== 401 && response.status < 500) {
        console.warn("[product-events] event rejected", { eventType: payload.eventType, status: response.status });
        return false;
      }
    } catch { /* Best effort; retry a transient business session/transport failure. */ }
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  console.warn("[product-events] event unavailable", { eventType: payload.eventType });
  return false;
}
