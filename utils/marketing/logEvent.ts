import { getMarketingVisitorId } from "./visitor";
import { extractAttributionFromSearchParams } from "./attribution";

export type MarketingEventPayload = {
  eventType: "page_view" | "create_account_start" | "business_demo_cta_click";
  pagePath: string;
  audience?: string | null;
  meta?: Record<string, unknown>;
};

export async function logMarketingEvent(payload: MarketingEventPayload) {
  try {
    await fetch("/api/marketing-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ ...payload, meta: {
        ...payload.meta, visitor_id: getMarketingVisitorId(),
        landing_referrer: typeof document !== "undefined" ? document.referrer : null,
        landing_attribution: typeof window !== "undefined"
          ? extractAttributionFromSearchParams(new URLSearchParams(window.location.search)) : {},
      } }),
    });
  } catch {
    // best-effort only
  }
}
