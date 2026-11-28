import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allowedBillingNotificationKinds, billingNotificationIntents, billingNotificationsEnabled,
  refundNotificationIntent, type BillingNotificationIntent,
} from "./billingNotifications";

const refId = (ref: unknown): string | null =>
  typeof ref === "string" ? ref : ref && typeof ref === "object" && "id" in ref && typeof (ref as { id?: unknown }).id === "string" ? (ref as { id: string }).id : null;

/**
 * Resolve the business subscription behind a refunded charge. API 2025-08-27.basil
 * no longer exposes charge.invoice, so go through the invoice payments for the
 * charge's PaymentIntent. Wallet top-ups and affiliate payments have no
 * subscription invoice and return null (no email).
 */
export async function subscriptionIdForCharge(stripe: Stripe, charge: Stripe.Charge) {
  const legacyInvoice = refId((charge as Stripe.Charge & { invoice?: unknown }).invoice);
  let invoiceId = legacyInvoice;
  const paymentIntent = refId(charge.payment_intent);
  if (!invoiceId && paymentIntent) {
    const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntent }, limit: 1 });
    invoiceId = refId(payments.data[0]?.invoice);
  }
  if (!invoiceId) return null;
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const typed = invoice as Stripe.Invoice & { subscription?: unknown };
  return refId(typed.subscription) || refId(invoice.parent?.subscription_details?.subscription) || null;
}

async function insertIntents(admin: SupabaseClient, params: {
  businessId: string; recipient: string; intents: BillingNotificationIntent[];
}) {
  const allowed = allowedBillingNotificationKinds();
  const rows = params.intents.filter(intent => allowed.has(intent.kind)).map(intent => ({
    business_id: params.businessId,
    kind: intent.kind,
    stripe_object_id: intent.stripeObjectId,
    stripe_subscription_id: intent.stripeSubscriptionId,
    recipient_email: params.recipient,
    payload: intent.payload,
    status: "pending",
  }));
  if (!rows.length) return 0;
  // unique(stripe_object_id, kind): replays and duplicate deliveries are ignored.
  const { error } = await admin.from("business_billing_notifications")
    .upsert(rows, { onConflict: "stripe_object_id,kind", ignoreDuplicates: true });
  if (error) throw new Error(`enqueue failed: ${error.code || "unknown"}`);
  return rows.length;
}

/**
 * Enqueue billing emails for a webhook event. Never sends inline and never
 * throws: a ledger problem must not change the webhook's 200 response.
 */
export async function enqueueBillingNotifications(params: {
  admin: SupabaseClient;
  stripe: Stripe;
  event: Stripe.Event;
  subscription?: Stripe.Subscription | null;
}) {
  if (!billingNotificationsEnabled()) return { enqueued: 0, reason: "disabled" };
  try {
    let subscriptionId = params.subscription?.id || null;
    let intents: BillingNotificationIntent[] = [];
    if (params.event.type === "charge.refunded") {
      const charge = params.event.data.object as Stripe.Charge;
      subscriptionId = await subscriptionIdForCharge(params.stripe, charge);
      if (!subscriptionId) return { enqueued: 0, reason: "not_a_business_subscription_charge" };
      const intent = refundNotificationIntent(params.event, subscriptionId);
      intents = intent ? [intent] : [];
    } else {
      intents = billingNotificationIntents(params.event, params.subscription || null);
    }
    if (!intents.length || !subscriptionId) return { enqueued: 0, reason: "no_notification" };

    // Business subscriptions only: the subscription must be the one recorded on the entitlement
    // (or carry Nettmark business-subscription metadata and a business id).
    const metadata = params.subscription?.metadata || {};
    let query = params.admin.from("business_entitlements")
      .select("business_id,business_email,is_grandfathered,stripe_subscription_id").limit(1);
    query = metadata.nettmark_action === "business_subscription" && metadata.business_id
      ? query.eq("business_id", metadata.business_id)
      : query.eq("stripe_subscription_id", subscriptionId);
    const { data: entitlement, error } = await query.maybeSingle();
    if (error) throw new Error("entitlement lookup failed");
    if (!entitlement?.business_id || entitlement.is_grandfathered) return { enqueued: 0, reason: "not_eligible" };
    if (entitlement.stripe_subscription_id && entitlement.stripe_subscription_id !== subscriptionId &&
        metadata.nettmark_action !== "business_subscription") return { enqueued: 0, reason: "subscription_mismatch" };
    const recipient = String(entitlement.business_email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return { enqueued: 0, reason: "no_recipient" };

    const enqueued = await insertIntents(params.admin, { businessId: String(entitlement.business_id), recipient, intents });
    return { enqueued, reason: null };
  } catch (error) {
    console.warn("[billing-notifications] enqueue failed; webhook continues", {
      eventId: params.event.id, eventType: params.event.type, reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return { enqueued: 0, reason: "error" };
  }
}
