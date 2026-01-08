import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user_id = body.user_id as string | undefined;
    const email = body.email as string | undefined;

    if (!user_id || !email) {
      return NextResponse.json(
        { error: "Missing user_id or email" },
        { status: 400 }
      );
    }

    const origin =
      req.headers.get("origin") || "https://www.nettmark.com";

    // 1) Load existing profile row
    const { data: profile, error: profileErr } = await supabase
      .from("affiliate_profiles")
      .select("user_id, email, stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json(
        { error: "Failed reading affiliate_profiles", details: profileErr },
        { status: 500 }
      );
    }

    // 2) Reuse account if it exists, else create a new Express individual
    let accountId = profile?.stripe_account_id || null;
    let reusedExisting = !!accountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          url: "https://www.nettmark.com",
          product_description:
            "Affiliate earnings payouts via the Nettmark platform.",
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
          { onConflict: "user_id" }
        );

      if (upsertErr) {
        return NextResponse.json(
          { error: "Failed updating affiliate_profiles", details: upsertErr },
          { status: 500 }
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}