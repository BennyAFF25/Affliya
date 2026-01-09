import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const config = { api: { bodyParser: false } };

const stripeApp = new Stripe(process.env.STRIPE_APP_SECRET as string, {
  // Keep this aligned with your installed stripe types (prevents TS literal mismatch)
  apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
});

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
  return new Date(periodEnd * 1000).toISOString(); // Stripe seconds -> ms
}

async function resolveProfileId(input: { userId?: string | null; email?: string | null }) {
  const userId = (input.userId || "").trim() || null;
  const email = (input.email || "").trim().toLowerCase() || null;

  if (userId) return userId;
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("[❌ stripe-app] resolveProfileId select error", error);
    return null;
  }

  return data?.id ?? null;
}

async function updateProfilesById(profileId: string, updatePayload: Record<string, any>) {
  // Use select to know whether any row was actually updated.
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("id", profileId)
    .select("id");

  if (error) return { ok: false, updated: 0, error };
  return { ok: true, updated: (data?.length || 0), error: null };
}

async function updateProfilesByRevenueSubId(subscriptionId: string, updatePayload: Record<string, any>) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("revenue_stripe_subscription_id", subscriptionId)
    .select("id");

  if (error) return { ok: false, updated: 0, error };
  return { ok: true, updated: (data?.length || 0), error: null };
}

async function updateProfilesByRevenueCustomerId(customerId: string, updatePayload: Record<string, any>) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("revenue_stripe_customer_id", customerId)
    .select("id");

  if (error) return { ok: false, updated: 0, error };
  return { ok: true, updated: (data?.length || 0), error: null };
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
    console.error("[❌ stripe-app webhook signature error]", err?.message || err);
    return NextResponse.json(
      { error: `Webhook Error: ${err?.message || "signature failed"}` },
      { status: 400 }
    );
  }

  try {
    // ✅ 1) Main mapping point: checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      const metaUserId =
        (session.metadata && (session.metadata as any).user_id) ||
        session.client_reference_id ||
        null;

      const email =
        (session.customer_details && session.customer_details.email) ||
        (session.metadata && (session.metadata as any).email) ||
        null;

      console.info("[stripe-app] checkout.session.completed", {
        userId: metaUserId || null,
        email: email || null,
        customerId: customerId ? "set" : null,
        subscriptionId: subscriptionId ? "set" : null,
        sessionStatus: session.status || null,
      });

      let profileId = await resolveProfileId({ userId: metaUserId, email });

      if (!profileId) {
        if (!metaUserId || !email) {
          console.warn("[stripe-app] checkout.session.completed: cannot create profile (missing userId/email)");
          return NextResponse.json({ received: true });
        }

        console.warn("[stripe-app] profiles row missing — creating placeholder profile", {
          userId: metaUserId,
          email,
        });

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: metaUserId,
            email,
            role: (session.metadata as any)?.role || null,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("[❌ stripe-app] failed to insert profiles row", insertErr);
          return NextResponse.json({ received: true });
        }

        profileId = inserted.id;
      }

      // Pull subscription to store status + current_period_end
      let sub: Stripe.Subscription | null = null;
      if (subscriptionId) {
        try {
          sub = await stripeApp.subscriptions.retrieve(subscriptionId);
        } catch (e: any) {
          console.warn("[stripe-app] could not retrieve subscription", e?.message || e);
        }
      }

      const updatePayload: Record<string, any> = {
        revenue_stripe_customer_id: customerId,
        revenue_stripe_subscription_id: subscriptionId,
        revenue_subscription_status: sub?.status || null,
        revenue_current_period_end: toPeriodEndTs((sub as any)?.current_period_end),
      };

      const res = await updateProfilesById(profileId, updatePayload);
      if (!res.ok) {
        console.error("[❌ stripe-app] DB update failed (checkout)", res.error);
      } else if (res.updated === 0) {
        console.warn("[stripe-app] checkout: 0 rows updated (profiles row missing?)", { profileId });
      } else {
        console.info("[✅ stripe-app] saved revenue subscription mapping", { profileId });
      }

      return NextResponse.json({ received: true });
    }

    // ✅ 2) Subscription status sync: created/updated
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const status = sub.status; // trialing | active | past_due | canceled | unpaid
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      const subscriptionId = sub.id;
      const periodEnd = toPeriodEndTs((sub as any).current_period_end);

      const updatePayload: Record<string, any> = {
        revenue_subscription_status: status,
        revenue_current_period_end: periodEnd,
        revenue_stripe_subscription_id: subscriptionId,
        ...(customerId ? { revenue_stripe_customer_id: customerId } : {}),
      };

      console.info("[stripe-app] customer.subscription.*", {
        subscriptionId,
        customerId: customerId ? "set" : null,
        status,
      });

      // Try match by subscription id first
      const res1 = await updateProfilesByRevenueSubId(subscriptionId, updatePayload);

      if (!res1.ok) {
        console.error("[❌ stripe-app] DB update failed (subscription by sub id)", res1.error);
        return NextResponse.json({ received: true });
      }

      // If 0 rows updated, try customer id
      if (res1.updated === 0 && customerId) {
        const res2 = await updateProfilesByRevenueCustomerId(customerId, updatePayload);
        if (!res2.ok) {
          console.error("[❌ stripe-app] DB update failed (subscription by customer id)", res2.error);
        } else if (res2.updated === 0) {
          console.warn("[stripe-app] subscription: 0 rows updated by sub id AND customer id", {
            subscriptionId,
            customerId,
          });
        }
      }

      return NextResponse.json({ received: true });
    }

    // ✅ 3) Subscription deleted
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      const subscriptionId = sub.id;

      const updatePayload: Record<string, any> = {
        revenue_subscription_status: "canceled",
        revenue_current_period_end: null,
      };

      console.info("[stripe-app] customer.subscription.deleted", {
        subscriptionId,
        customerId: customerId ? "set" : null,
      });

      const res1 = await updateProfilesByRevenueSubId(subscriptionId, updatePayload);

      if (!res1.ok) {
        console.error("[❌ stripe-app] DB update failed (deleted by sub id)", res1.error);
        return NextResponse.json({ received: true });
      }

      if (res1.updated === 0 && customerId) {
        const res2 = await updateProfilesByRevenueCustomerId(customerId, updatePayload);
        if (!res2.ok) {
          console.error("[❌ stripe-app] DB update failed (deleted by customer id)", res2.error);
        } else if (res2.updated === 0) {
          console.warn("[stripe-app] deleted: 0 rows updated by sub id AND customer id", {
            subscriptionId,
            customerId,
          });
        }
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[❌ stripe-app webhook handler error]", err?.message || err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}