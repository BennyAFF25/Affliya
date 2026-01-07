import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

// Stripe (revenue account) secret key
const rawSecret =
  process.env.STRIPE_APP_SECRET ?? process.env.STRIPE_SECRET_KEY ?? "";
const secret = rawSecret.trim();

if (!secret) {
  throw new Error("Missing STRIPE_APP_SECRET (or STRIPE_SECRET_KEY)");
}

const stripe = new Stripe(secret, {
  apiVersion: "2024-08-01",
});

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

// Supabase admin (service role) for reading customer id regardless of RLS
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const accountType = body?.accountType; // "business" | "affiliate"

    if (accountType !== "business" && accountType !== "affiliate") {
      return NextResponse.json(
        { error: "Invalid accountType. Expected 'business' or 'affiliate'." },
        { status: 400 }
      );
    }

    // Get logged-in user from cookies session
    const supabase = createRouteHandlerClient({ cookies });
    const { data: authData, error: authErr } = await supabase.auth.getUser();

    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = authData.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // Find stripe_customer_id in your DB (adjust tables/columns if needed)
    const admin = supabaseAdmin();

    let stripeCustomerId: string | null = null;

    // 1) Try profiles table (most common)
    {
      const { data } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("email", userEmail)
        .maybeSingle();

      stripeCustomerId = (data as any)?.stripe_customer_id ?? null;
    }

    // 2) Fallback: business_profiles if you store business info separately
    if (!stripeCustomerId && accountType === "business") {
      const { data } = await admin
        .from("business_profiles")
        .select("stripe_customer_id")
        .eq("email", userEmail)
        .maybeSingle();

      stripeCustomerId = (data as any)?.stripe_customer_id ?? null;
    }

    // 3) Fallback: user_settings (some builds store billing there)
    if (!stripeCustomerId) {
      const { data } = await admin
        .from("user_settings")
        .select("stripe_customer_id")
        .eq("email", userEmail)
        .maybeSingle();

      stripeCustomerId = (data as any)?.stripe_customer_id ?? null;
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No stripe_customer_id found for this user. Complete checkout first (and ensure webhook saves customer id).",
        },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/${accountType}/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[stripe-app] portal error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create portal session." },
      { status: 500 }
    );
  }
}