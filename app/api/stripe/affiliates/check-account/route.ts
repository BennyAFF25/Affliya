import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripeSecret = (process.env.STRIPE_SECRET_KEY || "").trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function isOnboardingComplete(acct: Stripe.Account) {
  // Simple + reliable: Stripe says details submitted + payouts enabled + charges enabled
  // (you can relax charges_enabled if affiliates never take payments directly)
  return Boolean(acct.details_submitted && acct.payouts_enabled);
}

export async function GET(req: Request) {
  try {
    if (!stripeSecret) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json({ error: "Missing Supabase env keys" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const email = searchParams.get("email");

    if (!userId && !email) {
      return NextResponse.json(
        { error: "Provide user_id or email as query param" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const q = supabase
      .from("affiliate_profiles")
      .select("user_id,email,stripe_account_id,stripe_onboarding_complete");

    const { data: ap, error } = userId
      ? await q.eq("user_id", userId).maybeSingle()
      : await q.eq("email", email!).maybeSingle();

    if (error) {
      console.error("[affiliates/check-account] read error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!ap?.stripe_account_id) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        accountId: null,
      });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-08-27.basil" as any });
    const acct = await stripe.accounts.retrieve(ap.stripe_account_id);

    const onboardingComplete = isOnboardingComplete(acct as Stripe.Account);

    // Persist flag if needed
    if (onboardingComplete && !ap.stripe_onboarding_complete) {
      const { error: upErr } = await supabase
        .from("affiliate_profiles")
        .update({ stripe_onboarding_complete: true })
        .eq("user_id", ap.user_id);

      if (upErr) {
        console.error("[affiliates/check-account] update onboarding flag error", upErr);
      }
    }

    return NextResponse.json({
      hasAccount: true,
      accountId: ap.stripe_account_id,
      onboardingComplete,
      payoutsEnabled: Boolean((acct as Stripe.Account).payouts_enabled),
      detailsSubmitted: Boolean((acct as Stripe.Account).details_submitted),
    });
  } catch (err: any) {
    console.error("[affiliates/check-account] error", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}