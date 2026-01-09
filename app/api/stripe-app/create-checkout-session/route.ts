import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

// Ensure Node runtime (Stripe + Buffer usage in adjacent routes; keeps behavior consistent on Vercel)
export const runtime = "nodejs";

// Choose the correct Stripe secret key (Revenue account preferred), trim to avoid hidden whitespace
const rawSecret = process.env.STRIPE_APP_SECRET ?? process.env.STRIPE_SECRET_KEY ?? "";
const secret = rawSecret.trim();

if (!secret) {
  throw new Error("Missing STRIPE_APP_SECRET (or STRIPE_SECRET_KEY)");
}

// Safe log of which key is being used (prefix/suffix only)
try {
  // eslint-disable-next-line no-console
  console.log("[stripe-app] using key:", `${secret.slice(0, 10)}...${secret.slice(-6)}`);
} catch {}

const stripe = new Stripe(secret, {
  // Keep TS + Stripe versions aligned across the repo
  apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
});

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const candidate = (explicit || "http://localhost:3000").replace(/\/+$/, "");

  try {
    return new URL(candidate).origin;
  } catch {
    // If someone set `www.domain.com` without scheme, fix it
    if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(candidate)) {
      try {
        return new URL(`https://${candidate}`).origin;
      } catch {}
    }
    return "http://localhost:3000";
  }
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const accountType = (body?.accountType || "").toString().trim().toLowerCase();
    const userId = body?.userId;
    const email = body?.email;

    // Resolve the authenticated user (preferred) so webhook can upsert revenue IDs reliably
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    const resolvedUserId = user?.id || userId;
    const resolvedEmail = user?.email || email;

    if (!resolvedUserId || !resolvedEmail) {
      // If the client is not logged in, or we can't resolve user identity, we can't map the subscription
      // back to a Nettmark profile reliably.
      return NextResponse.json(
        { error: "Missing authenticated user (userId/email) for checkout." },
        { status: 401 }
      );
    }

    if (userErr) {
      // eslint-disable-next-line no-console
      console.warn("[stripe-app] supabase getUser warning:", userErr);
    }

    // Validate accountType
    if (accountType !== "business" && accountType !== "affiliate") {
      return NextResponse.json(
        { error: "Invalid accountType. Expected 'business' or 'affiliate'." },
        { status: 400 }
      );
    }

    // Ensure a profiles row exists BEFORE we start Stripe checkout.
    // This prevents the revenue webhook from having nowhere to write customer/subscription IDs.
    // Uses service-role if available; otherwise we just proceed (webhook will still work if row exists).
    try {
      const admin = supabaseAdmin();
      if (admin) {
        const { error: upsertErr } = await admin
          .from("profiles")
          .upsert(
            {
              id: resolvedUserId,
              email: resolvedEmail,
              role: accountType,
            },
            { onConflict: "id" }
          );

        if (upsertErr) {
          // eslint-disable-next-line no-console
          console.warn("[stripe-app] profiles upsert warning:", upsertErr);
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          "[stripe-app] supabase admin client unavailable (missing SUPABASE_SERVICE_ROLE_KEY). Skipping profiles upsert."
        );
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn("[stripe-app] profiles upsert exception:", e?.message || e);
    }

    // Resolve price id from env (prefer non-public vars; fall back to NEXT_PUBLIC_ if needed)
    const priceId =
      accountType === "business"
        ? process.env.STRIPE_PRICE_BUSINESS ||
          process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS
        : process.env.STRIPE_PRICE_AFFILIATE ||
          process.env.NEXT_PUBLIC_STRIPE_PRICE_AFFILIATE;

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing price ID for ${accountType} plan.` },
        { status: 500 }
      );
    }

    // Resolve base URL for redirects
    const baseUrl = getBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],

      // Attach Nettmark user identity so stripe-app webhook can persist
      // revenue_stripe_customer_id / revenue_stripe_subscription_id on `public.profiles`.
      client_reference_id: resolvedUserId,
      customer_email: resolvedEmail,
      metadata: {
        user_id: resolvedUserId,
        email: resolvedEmail,
        role: accountType,
        source: "stripe-app",
      },

      subscription_data: {
        trial_period_days: 50, // 50-day free trial
        metadata: {
          user_id: resolvedUserId,
          email: resolvedEmail,
          role: accountType,
          source: "stripe-app",
        },
      },

      success_url: `${baseUrl}/stripe-redirect?role=${accountType}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?type=${accountType}`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[stripe-app] checkout error:", err);
    const message = err?.message || "Failed to create Stripe Checkout Session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}