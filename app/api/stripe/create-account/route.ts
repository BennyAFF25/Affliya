// Business Stripe Connect onboarding endpoint
// File: app/api/stripe/create-account/route.ts

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

    // Lock this endpoint to business onboarding only
    const role = (body?.role || "business").toString().trim().toLowerCase();
    if (role !== "business") {
      return NextResponse.json(
        { error: "This endpoint is restricted to business onboarding." },
        { status: 403 }
      );
    }

    // Accept email from multiple keys to avoid frontend mismatches
    const email = (
      body?.email ||
      body?.businessEmail ||
      body?.userEmail ||
      ""
    )
      .toString()
      .trim();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // If the business already has a connected account, allow re-generating the onboarding link
    const existingAccountId = (body?.stripe_account_id || body?.accountId || "")
      .toString()
      .trim();

    // 1) Create (or reuse) Express account (live/test depends on STRIPE_SECRET_KEY)
    const account = existingAccountId
      ? await stripe.accounts.retrieve(existingAccountId)
      : await stripe.accounts.create({
          type: "express",
          email,
          capabilities: {
            transfers: { requested: true },
          },
          metadata: {
            email,
            role: "business",
            platform: "nettmark",
          },
        });

    const accountId = (account as any)?.id;
    if (!accountId) {
      return NextResponse.json(
        { error: "Unable to resolve Stripe account ID" },
        { status: 500 }
      );
    }

    // 2) Build absolute URLs safely
    // NOTE: change these paths if your app uses different onboarding routes
    const refreshUrl = absUrl("/business/my-business?onboarding=refresh");
    const returnUrl = absUrl("/business/my-business?onboarding=return");

    console.log("[stripe/business-create-account]", {
      mode: process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live" : "test",
      baseUrl: getBaseUrl(),
      refreshUrl,
      returnUrl,
      account: accountId,
      email,
    });

    // 3) Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json(
      {
        stripe_account_id: accountId,
        url: accountLink.url,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[❌ business/create-account]", {
      message: err?.message,
      stack: err?.stack,
    });

    return NextResponse.json(
      { error: err?.message || "Create account failed" },
      { status: 500 }
    );
  }
}
