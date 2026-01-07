import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Ensure this route runs on Node (Buffer is used for raw body signature verification)
export const runtime = "nodejs";

// NOTE: In the App Router, body parsing is not enabled by default.
// This export is harmless, but not required.
export const config = { api: { bodyParser: false } };

// Use the App Revenue account secret for subscriptions webhook verification
const stripeApp = new Stripe(process.env.STRIPE_APP_SECRET as string, {
  apiVersion: "2024-06-20",
});

// Admin client (service role) for server-side updates from webhooks
// NEVER expose this key client-side.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

async function buffer(req: Request) {
  const arr = await req.arrayBuffer();
  return Buffer.from(arr);
}

function toPeriodEndTs(periodEnd: number | null | undefined) {
  if (!periodEnd) return null;
  // Stripe gives seconds
  return new Date(periodEnd * 1000).toISOString();
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") || "";
  const buf = await buffer(req);

  let event: Stripe.Event;
  try {
    event = stripeApp.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_APP_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(
      "[❌ stripe-app webhook signature error]",
      err?.message || err
    );
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin;

  try {
    // 1) BEST place to map subscription/customer -> user (via metadata/client_reference_id/email)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      const status = session.status || null; // complete | open | expired

      const userId =
        (session.metadata && (session.metadata as any).user_id) ||
        session.client_reference_id ||
        null;

      const email =
        (session.customer_details && session.customer_details.email) ||
        (session.metadata && (session.metadata as any).email) ||
        null;

      console.info("[stripe-app] checkout.session.completed", {
        userId,
        email,
        customerId: customerId ? "set" : null,
        subscriptionId: subscriptionId ? "set" : null,
        status,
      });

      // If we can't map to a user, we can't store anything.
      if (!userId && !email) {
        console.warn(
          "[stripe-app] checkout.session.completed: missing user mapping (no user_id/client_reference_id/email)"
        );
        return NextResponse.json({ received: true });
      }

      // Fetch subscription to capture period end + status
      let sub: Stripe.Subscription | null = null;
      if (subscriptionId) {
        try {
          sub = await stripeApp.subscriptions.retrieve(subscriptionId);
        } catch (e: any) {
          console.warn(
            "[stripe-app] could not retrieve subscription for period end",
            e?.message || e
          );
        }
      }

      const revenue_subscription_status = sub?.status || null;
      const revenue_current_period_end = toPeriodEndTs(
        sub?.current_period_end
      );

      const updatePayload: Record<string, any> = {
        revenue_stripe_customer_id: customerId,
        revenue_stripe_subscription_id: subscriptionId,
        revenue_subscription_status,
        revenue_current_period_end,
      };

      // Update by user id first (preferred), else by email
      const q = userId
        ? supabase.from("profiles").update(updatePayload).eq("id", userId)
        : supabase.from("profiles").update(updatePayload).eq("email", email);

      const { error } = await q;
      if (error) {
        console.error("[❌ stripe-app] DB update failed (checkout)", error);
      } else {
        console.info("[✅ stripe-app] saved revenue subscription mapping");
      }

      return NextResponse.json({ received: true });
    }

    // 2) Keep subscription status in sync (fallback / ongoing updates)
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const status = sub.status; // trialing | active | past_due | canceled | unpaid
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      const subscriptionId = sub.id;
      const periodEnd = toPeriodEndTs(sub.current_period_end);

      console.info("[stripe-app] customer.subscription.*", {
        customerId: customerId ? "set" : null,
        subscriptionId,
        status,
      });

      // Prefer matching by stored revenue subscription id, then customer id
      let updateQuery = supabase
        .from("profiles")
        .update({
          revenue_subscription_status: status,
          revenue_current_period_end: periodEnd,
          revenue_stripe_subscription_id: subscriptionId,
          // keep customer id synced if present
          ...(customerId ? { revenue_stripe_customer_id: customerId } : {}),
        })
        .eq("revenue_stripe_subscription_id", subscriptionId);

      let { error } = await updateQuery;

      // If no row matched by subscription id (or column empty), try matching by customer id
      if (error && customerId) {
        console.warn(
          "[stripe-app] update by revenue_stripe_subscription_id failed; trying customer id",
          error
        );
        const res2 = await supabase
          .from("profiles")
          .update({
            revenue_subscription_status: status,
            revenue_current_period_end: periodEnd,
            revenue_stripe_subscription_id: subscriptionId,
            revenue_stripe_customer_id: customerId,
          })
          .eq("revenue_stripe_customer_id", customerId);
        error = res2.error;
      }

      if (error) {
        console.error("[❌ stripe-app] DB update failed (subscription)", error);
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      const subscriptionId = sub.id;

      console.info("[stripe-app] customer.subscription.deleted", {
        customerId: customerId ? "set" : null,
        subscriptionId,
      });

      // Prefer matching by subscription id, then customer id
      let { error } = await supabase
        .from("profiles")
        .update({
          revenue_subscription_status: "canceled",
          revenue_current_period_end: null,
        })
        .eq("revenue_stripe_subscription_id", subscriptionId);

      if (error && customerId) {
        const res2 = await supabase
          .from("profiles")
          .update({
            revenue_subscription_status: "canceled",
            revenue_current_period_end: null,
          })
          .eq("revenue_stripe_customer_id", customerId);
        error = res2.error;
      }

      if (error) {
        console.error("[❌ stripe-app] DB update failed (deleted)", error);
      }

      return NextResponse.json({ received: true });
    }

    // Ignore other events
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[❌ stripe-app webhook handler error]", err?.message || err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}