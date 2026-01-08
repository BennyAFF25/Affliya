// app/api/stripe/affiliates/check-account/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    const email = searchParams.get("email");

    if (!user_id && !email) {
      return NextResponse.json(
        { error: "Provide user_id or email as query param" },
        { status: 400 }
      );
    }

    // Prefer user_id since it’s the PK
    let q = supabase.from("affiliate_profiles").select("user_id,email,stripe_account_id,stripe_onboarding_complete").limit(1);

    if (user_id) q = q.eq("user_id", user_id);
    else q = q.eq("email", email as string);

    const { data: ap, error: apErr } = await q.maybeSingle();
    if (apErr) {
      console.error("[affiliates/check-account] ❌ affiliate_profiles select error", apErr);
      return NextResponse.json({ error: "DB read failed", details: apErr }, { status: 500 });
    }

    if (!ap?.stripe_account_id) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        accountId: null,
      });
    }

    const acct = await stripe.accounts.retrieve(ap.stripe_account_id);

    const onboardingComplete = !!acct.charges_enabled && !!acct.payouts_enabled;

    // Write completion status back to DB if changed
    if (onboardingComplete && !ap.stripe_onboarding_complete) {
      const { error: updErr } = await supabase
        .from("affiliate_profiles")
        .update({ stripe_onboarding_complete: true })
        .eq("user_id", ap.user_id);

      if (updErr) {
        console.error("[affiliates/check-account] ❌ update onboarding flag failed", updErr);
        return NextResponse.json({ error: "DB update failed", details: updErr }, { status: 500 });
      }

      console.log("[affiliates/check-account] ✅ onboarding marked complete", {
        user_id: ap.user_id,
        stripe_account_id: ap.stripe_account_id,
      });
    }

    return NextResponse.json({
      hasAccount: true,
      onboardingComplete,
      accountId: ap.stripe_account_id,
    });
  } catch (e: any) {
    console.error("[affiliates/check-account] ❌ unexpected", e?.message || e);
    return NextResponse.json({ error: "Server error", details: e?.message }, { status: 500 });
  }
}