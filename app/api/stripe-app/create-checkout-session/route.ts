import { NextResponse } from "next/server";
import Stripe from "stripe";

// Choose the correct Stripe secret key (Revenue account preferred), trim to avoid hidden whitespace
const rawSecret =
  process.env.STRIPE_APP_SECRET ??
  process.env.STRIPE_SECRET_KEY ??
  "";
const secret = rawSecret.trim();

if (!secret) {
  throw new Error("Missing STRIPE_APP_SECRET (or STRIPE_SECRET_KEY)");
}

// Safe log of which key is being used (prefix/suffix only)
try {
  // eslint-disable-next-line no-console
  console.log(
    "[stripe-app] using key:",
    `${secret.slice(0, 10)}...${secret.slice(-6)}`
  );
} catch {}

const stripe = new Stripe(secret);

export async function POST(req: Request) {
  try {
    const { accountType } = await req.json();

    // Validate accountType
    if (accountType !== "business" && accountType !== "affiliate") {
      return NextResponse.json(
        { error: "Invalid accountType. Expected 'business' or 'affiliate'." },
        { status: 400 }
      );
    }

    // Resolve price id from env (prefer non-public vars; fall back to NEXT_PUBLIC_ if needed)
    const priceId =
      accountType === "business"
        ? (process.env.STRIPE_PRICE_BUSINESS ||
            process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS)
        : (process.env.STRIPE_PRICE_AFFILIATE ||
            process.env.NEXT_PUBLIC_STRIPE_PRICE_AFFILIATE);

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing price ID for ${accountType} plan.` },
        { status: 500 }
      );
    }

    // Resolve base URL for redirects
    const baseUrl =
      (process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://localhost:3000").replace(/\/+$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 50, // 50-day free trial
      },
      success_url: `${baseUrl}/stripe-redirect?role=${accountType}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?type=${accountType}`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[stripe-app] checkout error:", err);
    const message =
      err?.message || "Failed to create Stripe Checkout Session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}