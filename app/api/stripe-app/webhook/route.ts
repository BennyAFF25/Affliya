import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Stripe revenue account
const stripe = new Stripe(process.env.STRIPE_APP_SECRET!, {
  // Match the Stripe SDK literal union type
  apiVersion: "2025-08-27.basil",
});

// Supabase service role (webhooks bypass RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Helper
function toISO(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function getCurrentPeriodEnd(sub?: Stripe.Subscription | null): string | null {
  if (!sub) return null;
  const anySub = sub as any;
  return toISO(anySub.current_period_end ?? null);
}

async function buffer(req: Request) {
  const arr = await req.arrayBuffer();
  return Buffer.from(arr);
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await buffer(req);
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_APP_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[stripe-app webhook] signature error", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    // -------------------------------
    // checkout.session.completed
    // -------------------------------
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const email =
        session.customer_details?.email ||
        session.metadata?.email ||
        null;

      const customerId =
        typeof session.customer === "string" ? session.customer : null;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : null;

      if (!email) {
        console.warn("[stripe-app] checkout completed without email");
        return NextResponse.json({ received: true });
      }

      let subscription: Stripe.Subscription | null = null;
      if (subscriptionId) {
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        } catch {}
      }

      await supabase.from("profiles").upsert(
        {
          email,
          revenue_stripe_customer_id: customerId,
          revenue_stripe_subscription_id: subscriptionId,
          revenue_subscription_status: subscription?.status ?? null,
          revenue_current_period_end: getCurrentPeriodEnd(subscription),
        },
        { onConflict: "email" }
      );

      return NextResponse.json({ received: true });
    }

    // -------------------------------
    // customer.subscription.created / updated
    // -------------------------------
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId =
        typeof sub.customer === "string" ? sub.customer : null;

      await supabase.from("profiles").upsert(
        {
          revenue_stripe_customer_id: customerId,
          revenue_stripe_subscription_id: sub.id,
          revenue_subscription_status: sub.status,
          revenue_current_period_end: getCurrentPeriodEnd(sub),
        },
        { onConflict: "revenue_stripe_customer_id" }
      );

      return NextResponse.json({ received: true });
    }

    // -------------------------------
    // customer.subscription.deleted
    // -------------------------------
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      const customerId =
        typeof sub.customer === "string" ? sub.customer : null;

      if (customerId) {
        await supabase
          .from("profiles")
          .update({
            revenue_subscription_status: "canceled",
            revenue_current_period_end: null,
          })
          .eq("revenue_stripe_customer_id", customerId);
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[stripe-app webhook] handler error", err.message);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 400 });
  }
}