export type MarketingEventPayload = {
  eventType: "page_view" | "create_account_start" | "business_demo_cta_click" | "account_created";
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
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort only
  }
}
