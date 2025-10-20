

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    // Get business profile for this user
    const { data: biz, error: qErr } = await supabase
      .from('business_profiles')
      .select('id, stripe_account_id, stripe_onboarding_complete')
      .eq('business_email', user.email)
      .single();

    if (qErr || !biz) {
      return NextResponse.json({ error: qErr?.message || 'Business profile not found' }, { status: 404 });
    }

    if (!biz.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account linked' }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });

    const account = await stripe.accounts.retrieve(biz.stripe_account_id);

    let onboardingComplete = false;
    if (
      account.details_submitted &&
      account.requirements?.currently_due?.length === 0
    ) {
      onboardingComplete = true;

      // Update DB if not already set
      if (!biz.stripe_onboarding_complete) {
        await supabase
          .from('business_profiles')
          .update({ stripe_onboarding_complete: true })
          .eq('id', biz.id);
      }
    }

    return NextResponse.json(
      {
        accountId: account.id,
        onboardingComplete,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[check-account error]', err);
    return NextResponse.json({ error: err?.message || 'Stripe error' }, { status: 500 });
  }
}