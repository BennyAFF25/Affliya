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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");
  const email = searchParams.get("email");

  if (!user_id && !email) {
    return NextResponse.json(
      { error: "Provide user_id or email as query param" },
      { status: 400 }
    );
  }

  // 1) Get profile
  const query = supabase
    .from("affiliate_profiles")
    .select("user_id, email, stripe_account_id, stripe_onboarding_complete")
    .limit(1);

  const { data: profile, error } = user_id
    ? await query.eq("user_id", user_id).maybeSingle()
    : await query.eq("email", email!).maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed reading affiliate_profiles", details: error },
      { status: 500 }
    );
  }

  if (!profile?.stripe_account_id) {
    return NextResponse.json({
      hasAccount: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      stripeAccountId: null,
    });
  }

  // 2) Pull truth from Stripe
  const acct = await stripe.accounts.retrieve(profile.stripe_account_id);

  const onboardingComplete =
    !!acct.details_submitted && !!acct.payouts_enabled;

  // 3) Write back to DB if changed
  if (profile.stripe_onboarding_complete !== onboardingComplete) {
    await supabase
      .from("affiliate_profiles")
      .update({ stripe_onboarding_complete: onboardingComplete })
      .eq("user_id", profile.user_id);
  }

  return NextResponse.json({
    hasAccount: true,
    stripeAccountId: profile.stripe_account_id,
    onboardingComplete,
    payoutsEnabled: acct.payouts_enabled,
    chargesEnabled: acct.charges_enabled,
    detailsSubmitted: acct.details_submitted,
  });
}