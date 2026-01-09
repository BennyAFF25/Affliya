// app/api/stripe-app/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_APP_SECRET!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function getRawBody(req: Request) {
  const buf = await req.arrayBuffer();
  return Buffer.from(buf);
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  let event: Stripe.Event;

  try {
    const body = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_APP_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ----------------------------
  // CHECKOUT COMPLETED (PRIMARY)
  // ----------------------------
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId =
      session.client_reference_id ||
      session.metadata?.user_id ||
      null;

    const email =
      session.customer_details?.email ||
      session.metadata?.email ||
      null;

    if (!userId && !email) {
      return NextResponse.json({ received: true });
    }

    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : null;

    let periodEnd: string | null = null;
    let status: string | null = null;

    if (subscriptionId) {
      const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as any;
      status = sub.status ?? null;
      periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;
    }

    await supabase
      .from("profiles")
      .update({
        revenue_stripe_customer_id: customerId,
        revenue_stripe_subscription_id: subscriptionId,
        revenue_subscription_status: status,
        revenue_current_period_end: periodEnd,
      })
      .or(
        userId ? `id.eq.${userId}` : `email.eq.${email}`
      );

    return NextResponse.json({ received: true });
  }

  // ----------------------------
  // SUBSCRIPTION UPDATES
  // ----------------------------
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as any;

    await supabase
      .from("profiles")
      .update({
        revenue_subscription_status: sub.status ?? null,
        revenue_current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        revenue_stripe_subscription_id: sub.id,
        revenue_stripe_customer_id:
          typeof sub.customer === "string" ? sub.customer : null,
      })
      .eq("revenue_stripe_customer_id", sub.customer);

    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}