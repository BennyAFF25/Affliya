import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { buildStripeMetadata, createStripeClient } from "@/../utils/stripe";

export const runtime = "nodejs";

const stripe = createStripeClient((process.env.STRIPE_SECRET_KEY || "").trim());

function getBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();
  const vercel = (process.env.VERCEL_URL || "").trim();
  const fromVercel = vercel ? `https://${vercel}` : "";
  const fallbackLocal = "http://localhost:3000";
  const base = explicit || fromVercel || fallbackLocal;

  try {
    return new URL(base).origin;
  } catch {
    throw new Error(
      `Invalid BASE URL. Got "${base}". Fix NEXT_PUBLIC_BASE_URL / VERCEL_URL.`
    );
  }
}

function getPublicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nettmark.com").trim().replace(/\/+$/, "");
}

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  { auth: { persistSession: false } },
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user_id = body.user_id as string | undefined;
    const email = body.email as string | undefined;

    if (!user_id || !email) {
      return NextResponse.json(
        { error: "Missing user_id or email" },
        { status: 400 },
      );
    }

    const origin = getBaseUrl();
    const publicSiteUrl = getPublicSiteUrl();

    // 1) Load existing profile row
    const { data: profile, error: profileErr } = await supabase
      .from("affiliate_profiles")
      .select("user_id, email, stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json(
        { error: "Failed reading affiliate_profiles", details: profileErr },
        { status: 500 },
      );
    }

    // 2) Reuse account if it exists, else create a new Express individual
    let accountId = profile?.stripe_account_id || null;
    const reusedExisting = !!accountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email,
        business_type: "individual",
        metadata: buildStripeMetadata({
          role: "affiliate",
          source: "nettmark",
        }),
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          // Stripe still labels this section as "business details" for individual accounts.
          // Use a public site URL here; localhost often gets rejected by Stripe validation.
          url: `${publicSiteUrl}/affiliate/wallet`,
          product_description:
            "Affiliate creator payouts via Nettmark performance campaigns.",
          mcc: "7311",
        },
      });

      accountId = account.id;

      // 3) Write the Stripe account ID to DB immediately (THIS is the missing link)
      const { error: upsertErr } = await supabase
        .from("affiliate_profiles")
        .upsert(
          {
            user_id,
            email,
            stripe_account_id: accountId,
            stripe_onboarding_complete: false,
          },
          { onConflict: "user_id" },
        );

      if (upsertErr) {
        return NextResponse.json(
          { error: "Failed updating affiliate_profiles", details: upsertErr },
          { status: 500 },
        );
      }
    }

    // 4) Create onboarding link
    const refreshUrl = `${origin}/affiliate/wallet?onboarding=refresh`;
    const returnUrl = `${origin}/affiliate/wallet?onboarding=return`;

    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: link.url,
      account: accountId,
      reusedExisting,
      refreshUrl,
      returnUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stripeErr = err as Stripe.errors.StripeError | undefined;

    console.error("[❌ affiliate/create-account]", {
      message,
      type: stripeErr?.type,
      code: stripeErr?.code,
      param: stripeErr?.param,
      decline_code: stripeErr?.decline_code,
      raw: stripeErr?.raw,
    });

    return NextResponse.json(
      {
        error: message,
        type: stripeErr?.type || null,
        code: stripeErr?.code || null,
        param: stripeErr?.param || null,
      },
      { status: 500 },
    );
  }
}
