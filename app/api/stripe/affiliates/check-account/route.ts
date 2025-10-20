import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// ...existing imports
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

    const { data: ap } = await supabase
      .from('affiliate_profiles')
      .select('stripe_account_id, stripe_onboarding_complete, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!ap?.stripe_account_id) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        payoutsEnabled: false,
        requirementsDue: [],
        disabledReason: null,
      });
    }

    const acct = await stripe.accounts.retrieve(ap.stripe_account_id);

    const requirementsDue = acct.requirements?.currently_due ?? [];
    const disabledReason = acct.requirements?.disabled_reason ?? null;
    const complete = !!acct.details_submitted && requirementsDue.length === 0;
    const payoutsEnabled = !!acct.payouts_enabled;

    if (complete !== ap.stripe_onboarding_complete) {
      await supabase.from('affiliate_profiles')
        .update({ stripe_onboarding_complete: complete })
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      hasAccount: true,
      onboardingComplete: complete,
      payoutsEnabled,
      requirementsDue,
      disabledReason,
      accountId: ap.stripe_account_id,
    });
  } catch (e: any) {
    console.error('[affiliates/check-account]', e);
    return NextResponse.json({ error: e.message || 'Stripe error' }, { status: 500 });
  }
}