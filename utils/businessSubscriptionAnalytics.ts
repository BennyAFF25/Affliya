import { SupabaseClient } from "@supabase/supabase-js";

export const BUSINESS_SUBSCRIPTION_ANALYTICS_EVENTS = [
  "campaign_received_by_business",
  "campaign_review_opened",
  "subscription_gate_viewed",
  "subscription_checkout_started",
  "subscription_checkout_cancelled",
  "subscription_activated",
  "campaign_approved_after_subscription",
  "subscription_gate_dismissed",
] as const;

export type BusinessSubscriptionAnalyticsEvent = typeof BUSINESS_SUBSCRIPTION_ANALYTICS_EVENTS[number];

export function isBusinessSubscriptionAnalyticsEvent(value: string): value is BusinessSubscriptionAnalyticsEvent {
  return (BUSINESS_SUBSCRIPTION_ANALYTICS_EVENTS as readonly string[]).includes(value);
}

export async function trackBusinessSubscriptionAnalytics(params: {
  supabase: SupabaseClient;
  eventType: BusinessSubscriptionAnalyticsEvent;
  businessId?: string | null;
  businessEmail?: string | null;
  campaignId?: string | null;
  intendedAction?: string | null;
  submissionId?: string | null;
  returnTo?: string | null;
  attribution?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const { error } = await params.supabase.from("business_subscription_gate_events").insert({
      event_type: params.eventType,
      business_id: params.businessId || null,
      business_email: params.businessEmail || null,
      campaign_id: params.campaignId || params.submissionId || null,
      intended_action: params.intendedAction || null,
      submission_id: params.submissionId || null,
      return_to: params.returnTo || null,
      attribution: params.attribution || {},
      metadata: params.metadata || {},
    });

    if (error) {
      console.warn("[business-subscription analytics] insert failed", {
        eventType: params.eventType,
        message: error.message,
      });
    }
  } catch (err) {
    console.warn("[business-subscription analytics] unexpected", err);
  }
}
