import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  createBusinessSubscriptionStripeClient,
  createServerSupabaseClient,
  getStripeCustomerIdFromSubscription,
  syncBusinessEntitlementFromStripeSubscription,
} from "../../../../utils/businessSubscriptions";
import { trackBusinessSubscriptionAnalytics } from "../../../../utils/businessSubscriptionAnalytics";
import {
  createCreatorCommissionFromPaidInvoice,
  reverseCreatorCommissionByInvoiceId,
} from "../../../../utils/creatorReferrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StripeObjectRef = string | { id?: string | null } | null | undefined;

type StripeWebhookObject = {
  id?: string | null;
  object?: string | null;
  customer?: StripeObjectRef;
  subscription?: StripeObjectRef;
  metadata?: Stripe.Metadata | null;
  parent?: {
    subscription_details?: {
      subscription?: StripeObjectRef;
    } | null;
  } | null;
};

async function buffer(req: Request) {
  const arr = await req.arrayBuffer();
  return Buffer.from(arr);
}

function getRefId(ref: StripeObjectRef) {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id || null;
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const invoiceObject = invoice as Stripe.Invoice & StripeWebhookObject;
  return getRefId(invoiceObject.subscription) || getRefId(invoiceObject.parent?.subscription_details?.subscription);
}

function getCustomerIdFromObject(object: StripeWebhookObject) {
  return getRefId(object.customer);
}

function safeErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message.slice(0, 500);
  return "Unknown business subscription webhook error";
}

async function markEvent(params: {
  stripeEventId: string;
  status: "processed" | "failed" | "ignored";
  errorMessage?: string | null;
  businessId?: string | null;
  userId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("business_subscription_stripe_events")
    .update({
      processing_status: params.status,
      error_message: params.errorMessage || null,
      processed_at: new Date().toISOString(),
      business_id: params.businessId || null,
      user_id: params.userId || null,
      stripe_customer_id: params.stripeCustomerId || null,
      stripe_subscription_id: params.stripeSubscriptionId || null,
      metadata: params.metadata || {},
    })
    .eq("stripe_event_id", params.stripeEventId);
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_BUSINESS_SUBSCRIPTION_WEBHOOK_SECRET || process.env.STRIPE_APP_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook signature or secret" }, { status: 400 });
  }

  const stripe = createBusinessSubscriptionStripeClient();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(await buffer(req), signature, webhookSecret);
  } catch (err: unknown) {
    console.error("[business-subscription/webhook] signature error", safeErrorMessage(err));
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const eventObject = event.data.object as StripeWebhookObject;
  const metadata = eventObject?.metadata || {};
  const initialCustomerId = getCustomerIdFromObject(eventObject);
  const initialSubscriptionId =
    eventObject.object === "subscription" ? eventObject.id || null : getRefId(eventObject.subscription);

  const insertEvent = await supabase.from("business_subscription_stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_customer_id: initialCustomerId,
    stripe_subscription_id: initialSubscriptionId,
    business_id: metadata.business_id || null,
    user_id: metadata.user_id || null,
    processing_status: "processing",
    metadata: {
      livemode: event.livemode,
      apiVersion: event.api_version || null,
    },
  });

  if (insertEvent.error) {
    if (insertEvent.error.code === "23505") {
      return NextResponse.json({ received: true, replay: true });
    }

    console.error("[business-subscription/webhook] failed to record event", insertEvent.error);
    return NextResponse.json({ error: "Failed to record webhook event" }, { status: 500 });
  }

  try {
    let subscription: Stripe.Subscription | null = null;
    let ignoredReason: string | null = null;

    if (event.type === "invoice.voided") {
      const invoice = event.data.object as Stripe.Invoice;
      await reverseCreatorCommissionByInvoiceId({
        supabase,
        stripeInvoiceId: invoice.id || null,
        reason: "stripe_invoice_voided",
      });
      await markEvent({
        stripeEventId: event.id,
        status: "processed",
        stripeCustomerId: initialCustomerId,
        stripeSubscriptionId: getSubscriptionIdFromInvoice(invoice),
        metadata: { eventType: event.type, creatorCommissionReversal: true },
      });
      return NextResponse.json({ received: true });
    }

    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const charge = event.data.object as Stripe.Charge & { invoice?: StripeObjectRef };
      await reverseCreatorCommissionByInvoiceId({
        supabase,
        stripeInvoiceId: getRefId(charge.invoice),
        reason: event.type === "charge.refunded" ? "stripe_charge_refunded" : "stripe_charge_disputed",
      });
      await markEvent({
        stripeEventId: event.id,
        status: "processed",
        stripeCustomerId: getRefId(charge.customer as StripeObjectRef),
        metadata: { eventType: event.type, creatorCommissionReversal: true },
      });
      return NextResponse.json({ received: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
      if (subscriptionId) {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      } else {
        ignoredReason = "checkout session had no subscription id";
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      subscription = event.data.object as Stripe.Subscription;
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getSubscriptionIdFromInvoice(invoice);
      if (subscriptionId) {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      } else {
        ignoredReason = "invoice had no subscription id";
      }
    } else {
      ignoredReason = "unhandled event type";
    }

    if (!subscription) {
      await markEvent({
        stripeEventId: event.id,
        status: "ignored",
        errorMessage: ignoredReason,
        stripeCustomerId: initialCustomerId,
        stripeSubscriptionId: initialSubscriptionId,
        metadata: { reason: ignoredReason, eventType: event.type },
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    const syncResult = await syncBusinessEntitlementFromStripeSubscription({
      supabase,
      subscription,
      fallbackBusinessId: metadata.business_id || subscription.metadata?.business_id || null,
      fallbackUserId: metadata.user_id || subscription.metadata?.user_id || null,
      sourceEventType: event.type,
    });

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      await createCreatorCommissionFromPaidInvoice({
        supabase,
        invoice,
        subscription,
      });
    }

    if (["subscription_active", "subscription_trialing"].includes(syncResult.billingStatus)) {
      await trackBusinessSubscriptionAnalytics({
        supabase,
        eventType: "subscription_activated",
        businessId: syncResult.businessId,
        businessEmail: syncResult.businessEmail,
        campaignId: subscription.metadata?.campaignId || subscription.metadata?.submissionId || null,
        intendedAction: subscription.metadata?.intendedAction || null,
        submissionId: subscription.metadata?.submissionId || null,
        returnTo: subscription.metadata?.returnTo || null,
        attribution: {
          stripeEventId: event.id,
          stripeEventType: event.type,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: syncResult.stripeCustomerId || getStripeCustomerIdFromSubscription(subscription),
        },
        metadata: {
          source: "stripe_webhook",
          billingStatus: syncResult.billingStatus,
        },
      });
    }

    await markEvent({
      stripeEventId: event.id,
      status: "processed",
      businessId: syncResult.businessId,
      userId: metadata.user_id || subscription.metadata?.user_id || null,
      stripeCustomerId: syncResult.stripeCustomerId || getStripeCustomerIdFromSubscription(subscription),
      stripeSubscriptionId: syncResult.stripeSubscriptionId || subscription.id,
      metadata: {
        eventType: event.type,
        billingStatus: syncResult.billingStatus,
        subscriptionRequired: syncResult.subscriptionRequired,
      },
    });

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const errorMessage = safeErrorMessage(err);
    console.error("[business-subscription/webhook] handler error", {
      eventId: event.id,
      eventType: event.type,
      errorMessage,
    });

    await markEvent({
      stripeEventId: event.id,
      status: "failed",
      errorMessage,
      businessId: metadata.business_id || null,
      userId: metadata.user_id || null,
      stripeCustomerId: initialCustomerId,
      stripeSubscriptionId: initialSubscriptionId,
      metadata: { eventType: event.type },
    });

    await supabase.from("business_entitlement_events").insert({
      business_id: metadata.business_id || null,
      business_email: metadata.business_email || "unknown",
      event_type: "business_subscription_webhook_failed",
      billing_status: null,
      metadata: {
        source: "stripe_webhook",
        stripeEventId: event.id,
        stripeEventType: event.type,
        errorMessage,
      },
    });

    return NextResponse.json({ received: true, error: "Webhook processing failed" }, { status: 200 });
  }
}
