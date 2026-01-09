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
  apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
});

function getBaseUrl() {
  const explicit = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ""
  ).trim();

  const vercel = (process.env.VERCEL_URL || "").trim();
  const fromVercel = vercel ? `https://${vercel}` : "";

  const fallbackLocal = "http://localhost:3000";
  const base = explicit || fromVercel || fallbackLocal;

  // Normalize + validate
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new Error(
      `Invalid base URL: "${base}". Check NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL / VERCEL_URL.`
    );
  }

  return u.origin;
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

    // Get logged-in user from cookies session or fallback to request body
    const supabase = createRouteHandlerClient({ cookies });
    const { data: authData } = await supabase.auth.getUser();

    const bodyUserId = body?.userId || body?.user_id || null;
    const bodyEmail = body?.email || null;

    const resolvedUser = authData?.user || null;
    const userId = resolvedUser?.id || bodyUserId;
    const userEmail = resolvedUser?.email || bodyEmail;

    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: "Unable to resolve user (no session or email provided)." },
        { status: 400 }
      );
    }

    // Find revenue Stripe customer id in profiles (preferred for subscriptions)
    const admin = supabaseAdmin();

    const query = userId
      ? admin.from("profiles").select("revenue_stripe_customer_id, stripe_customer_id").eq("id", userId)
      : admin.from("profiles").select("revenue_stripe_customer_id, stripe_customer_id").eq("email", userEmail);

    const { data: profile, error: profErr } = await query.maybeSingle();

    if (profErr) {
      console.error("[stripe-app] profiles lookup error", profErr);
    }

    // Prefer revenue customer id (subscriptions). Fallback to legacy stripe_customer_id if present.
    const revenueCustomerId = (profile as any)?.revenue_stripe_customer_id ?? null;
    const legacyCustomerId = (profile as any)?.stripe_customer_id ?? null;

    const stripeCustomerId: string | null = revenueCustomerId || legacyCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No revenue_stripe_customer_id found for this user. Complete checkout (subscription) first and ensure stripe-app webhook writes to profiles.",
        },
        { status: 400 }
      );
    }

    if (!revenueCustomerId && legacyCustomerId) {
      console.warn(
        "[stripe-app] Using legacy profiles.stripe_customer_id (revenue_stripe_customer_id is missing). Consider backfilling revenue fields via webhook.",
        { email: userEmail }
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