import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const config = { api: { bodyParser: false } };

const stripeApp = new Stripe(process.env.STRIPE_APP_SECRET as string, {
  apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the Stripe customer ID from profiles only
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("revenue_stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[❌ stripe-app] error fetching revenue_stripe_customer_id", error);
    return NextResponse.json({ error: "Could not fetch customer ID" }, { status: 500 });
  }

  const stripeCustomerId = (data as any)?.revenue_stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer ID found" }, { status: 400 });
  }

  try {
    const returnUrl = process.env.STRIPE_APP_BILLING_PORTAL_RETURN_URL || "/";

    const session = await stripeApp.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[❌ stripe-app] error creating billing portal session", err);
    return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 });
  }
}