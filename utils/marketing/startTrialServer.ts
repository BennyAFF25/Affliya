import Stripe from "stripe";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  BUSINESS_GROWTH_TRIAL_DAYS, createBusinessSubscriptionStripeClient,
  getBusinessSubscriptionPriceId,
} from "../businessSubscriptions";
import { NETTMARK_META_PIXEL_ID } from "./metaConfig";
import { buildStartTrial, retryDelaySeconds, sanitizeMatching, sendStartTrial, StartTrialPayload } from "./startTrial";

type Delivery = {
  business_id: string; payload: StartTrialPayload; lease_token: string; attempts: number;
};
export function productionCapiEnabled() {
  return process.env.VERCEL_ENV === "production" && Boolean(process.env.META_CAPI_ACCESS_TOKEN);
}
function reportingError(operation: string) {
  console.warn("[meta-start-trial] reporting operation failed", { operation });
}
export async function recordConfirmedGrowthTrial(params: {
  supabase: SupabaseClient; event: Stripe.Event; subscription?: Stripe.Subscription;
}) {
  if (!productionCapiEnabled()) return;
  try {
    const { supabase, event } = params;
    if (!event.livemode || !["customer.subscription.created", "checkout.session.completed"].includes(event.type)) return;
    const subscription = params.subscription ||
      (event.type === "customer.subscription.created" ? event.data.object as Stripe.Subscription : null);
    if (!subscription) return;
    const businessId = subscription.metadata.business_id;
    const userId = subscription.metadata.user_id;
    if (!businessId || !userId) return;
    const { data: entitlement, error } = await supabase.from("business_entitlements")
      .select("business_email,stripe_subscription_id,is_grandfathered")
      .eq("business_id", businessId).maybeSingle();
    if (error) throw error;
    // A signed Stripe event alone is insufficient: Nettmark must have confirmed this subscription.
    if (!entitlement || entitlement.is_grandfathered || entitlement.stripe_subscription_id !== subscription.id) return;
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("id,email,role").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "business" ||
        profile.email?.trim().toLowerCase() !== entitlement.business_email?.trim().toLowerCase()) return;
    const { data: matchingEvent, error: matchingError } = await supabase.from("business_subscription_gate_events")
      .select("id,attribution")
      .eq("event_type", "subscription_checkout_started").eq("business_id", businessId)
      .eq("metadata->>userId", userId)
      .eq("metadata->>stripeCustomerId", typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id)
      .lte("created_at", new Date((subscription.created + 60) * 1000).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (matchingError) throw matchingError;
    const matching = matchingEvent?.attribution?.meta_capi_matching;
    const payload = buildStartTrial({
      subscription, eventLivemode: event.livemode, businessId, userId,
      email: entitlement.business_email, priceId: getBusinessSubscriptionPriceId(),
      trialDays: BUSINESS_GROWTH_TRIAL_DAYS,
      matching: sanitizeMatching(matching && typeof matching === "object" ? matching : {}),
    });
    if (!payload) return;
    const { error: insertError } = await supabase.from("meta_start_trial_delivery").upsert({
      business_id: businessId, stripe_subscription_id: subscription.id,
      stripe_event_id: event.id, event_id: payload.event_id, event_time: payload.event_time, payload,
    }, { onConflict: "business_id", ignoreDuplicates: true });
    if (insertError) throw insertError;
    // The delivery record now owns the temporary matching snapshot.
    if (matchingEvent?.id && matchingEvent.attribution) {
      const attribution = { ...matchingEvent.attribution };
      delete attribution.meta_capi_matching;
      const { error: cleanupError } = await supabase.from("business_subscription_gate_events")
        .update({ attribution }).eq("id", matchingEvent.id);
      if (cleanupError) reportingError("matching_cleanup");
    }
  } catch { reportingError("record"); }
}
export async function deliverPendingGrowthTrials(supabase: SupabaseClient, businessId?: string) {
  if (!productionCapiEnabled()) return { sent: 0, failed: 0, disabled: true };
  let sent = 0, failed = 0;
  const { data, error } = await supabase.rpc("claim_meta_start_trial_delivery", { p_business_id: businessId || null });
  if (error) { reportingError("claim"); return { sent, failed: 1, disabled: false }; }
  await Promise.all((data as Delivery[] || []).map(async row => {
    const result = await sendStartTrial({
      payload: row.payload, token: process.env.META_CAPI_ACCESS_TOKEN!,
      pixelId: NETTMARK_META_PIXEL_ID,
    });
    const { error: updateError } = await supabase.from("meta_start_trial_delivery").update({
      status: result.ok ? "sent" : "pending",
      ...(result.ok ? { payload: { event_name: row.payload.event_name, event_id: row.payload.event_id, event_time: row.payload.event_time } } : {}),
      sent_at: result.ok ? new Date().toISOString() : null,
      next_attempt_at: new Date(Date.now() + retryDelaySeconds(row.attempts) * 1000).toISOString(),
      lease_token: null, lease_until: null, last_error: result.error,
    }).eq("business_id", row.business_id).eq("status", "sending").eq("lease_token", row.lease_token);
    if (updateError) { reportingError("acknowledge"); failed++; }
    else if (result.ok) sent++;
    else failed++;
  }));
  return { sent, failed, disabled: false };
}
// Recover a reporting failure or crash independently; never replay billing or change entitlements.
export async function reconcileGrowthTrialReporting(supabase: SupabaseClient) {
  if (!productionCapiEnabled()) return;
  const { data, error } = await supabase.from("business_subscription_stripe_events")
    .select("stripe_event_id,business_id")
    .eq("event_type", "customer.subscription.created")
    .eq("metadata->>livemode", "true")
    .gte("received_at", new Date(Date.now() - 6 * 86400_000).toISOString())
    .order("received_at", { ascending: false }).limit(500);
  if (error) { reportingError("reconcile_read"); return; }
  const businesses = [...new Set((data || []).map(row => row.business_id).filter(Boolean))];
  if (!businesses.length) return;
  const { data: deliveries, error: deliveryError } = await supabase.from("meta_start_trial_delivery")
    .select("business_id").in("business_id", businesses);
  if (deliveryError) { reportingError("reconcile_delivery"); return; }
  const recorded = new Set((deliveries || []).map(row => row.business_id));
  const missing = (data || []).filter(row => row.business_id && !recorded.has(row.business_id)).slice(0, 20);
  const stripe = createBusinessSubscriptionStripeClient();
  for (const row of missing) {
    try {
      const event = await stripe.events.retrieve(row.stripe_event_id);
      await recordConfirmedGrowthTrial({ supabase, event });
    } catch { reportingError("reconcile_event"); }
  }
}
