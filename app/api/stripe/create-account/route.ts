// Paste this entire file into:
// app/api/affiliates/create-account/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});

function getBaseUrl() {
  // Explicit base (recommended)
  const explicit = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();

  // Vercel provides VERCEL_URL without protocol
  const vercel = (process.env.VERCEL_URL || "").trim();
  const fromVercel = vercel ? `https://${vercel}` : "";

  const fallbackLocal = "http://localhost:3000";
  const base = explicit || fromVercel || fallbackLocal;

  // Validate + normalize
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new Error(
      `Invalid BASE URL. Got "${base}". Fix NEXT_PUBLIC_BASE_URL / VERCEL_URL (watch for hidden whitespace/newlines).`
    );
  }

  return u.origin; // ensures no trailing path/junk
}

function absUrl(pathname: string) {
  return new URL(pathname, getBaseUrl()).toString();
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

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // 1) Create Express account (live/test depends on STRIPE_SECRET_KEY)
    const account = await stripe.accounts.create({
      type: "express",
      email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        email,
        platform: "nettmark",
      },
    });

    // 2) Build absolute URLs safely
    // NOTE: change these paths if your app uses different onboarding routes
    const refreshUrl = absUrl("/affiliate/settings?onboarding=refresh");
    const returnUrl = absUrl("/affiliate/settings?onboarding=return");

    console.log("[stripe/affiliates-create-account]", {
      mode: process.env.STRIPE_SECRET_KEY.startsWith("sk_live_")
        ? "live"
        : "test",
      baseUrl: getBaseUrl(),
      refreshUrl,
      returnUrl,
      account: account.id,
      email,
    });

    // 3) Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json(
      {
        stripe_account_id: account.id,
        url: accountLink.url,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[❌ affiliates/create-account]", {
      message: err?.message,
      stack: err?.stack,
    });

    return NextResponse.json(
      { error: err?.message || "Create account failed" },
      { status: 500 }
    );
  }
}
