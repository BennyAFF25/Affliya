import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});

/**
 * Build a clean absolute base URL for Stripe redirect URLs.
 * - Works in Vercel + local
 * - Trims hidden whitespace/newlines
 */
function getBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();

  // Vercel provides VERCEL_URL without protocol (e.g. "nettmark.com")
  const vercel = (process.env.VERCEL_URL || "").trim();
  const fromVercel = vercel ? `https://${vercel}` : "";

  const fallbackLocal = "http://localhost:3000";

  const base = explicit || fromVercel || fallbackLocal;

  // Validate hard so we fail with a clear error, not Stripe's vague one
  try {
    new URL(base);
  } catch {
    throw new Error(
      `Invalid BASE URL. Got "${base}". Check NEXT_PUBLIC_BASE_URL / VERCEL_URL env vars (hidden whitespace/newlines cause this).`
    );
  }

  return base;
}

function absUrl(pathname: string) {
  const base = getBaseUrl();
  return new URL(pathname, base).toString();
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = (body?.email || "").toString().trim();
    const currency = (body?.currency || "aud").toString().toLowerCase().trim();

    // amount can come in as number (e.g. 10) or string (e.g. "10")
    const amountRaw = body?.amount;
    const amountNumber = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Stripe expects "unit_amount" in the smallest currency unit (cents)
    const unitAmount = Math.round(amountNumber * 100);

    // ✅ These are the lines that were breaking for you before
    const successUrl = absUrl(`/affiliate/wallet?topup=success`);
    const cancelUrl = absUrl(`/affiliate/wallet?topup=cancel`);

    // Optional: log sanitized values (doesn't expose secrets)
    console.log("[stripe/create-topup-session]", {
      baseUrl: getBaseUrl(),
      successUrl,
      cancelUrl,
      email,
      currency,
      unitAmount,
      mode: process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live" : "test",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: "Nettmark Wallet Top-Up" },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // If you rely on metadata in webhooks:
      metadata: {
        email,
        purpose: "wallet_topup",
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("[❌ create-topup-session]", {
      message: err?.message,
      stack: err?.stack,
    });

    return NextResponse.json(
      { error: err?.message || "Create topup session failed" },
      { status: 500 }
    );
  }
}