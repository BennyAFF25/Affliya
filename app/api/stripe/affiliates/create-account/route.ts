import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Get or create affiliate profile
    const { data: ap } = await supabase
      .from('affiliate_profiles')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let accountId = ap?.stripe_account_id;

    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: 'express',
        business_type: 'individual',
        country: 'AU', // TODO: make dynamic from user settings if needed
        email: user.email ?? undefined,
        capabilities: { transfers: { requested: true } },
        // Prefill so Stripe doesn't require a website and keeps flow lightweight
        business_profile: {
          product_description:
            'Individual creator/affiliate promoting brands; earns commissions and payouts.',
          // Do NOT set business_profile.url — leaving it undefined avoids the website step
          mcc: '7311', // Advertising services (optional but helps classification)
        },
      });
      accountId = acct.id;

      await supabase.from('affiliate_profiles').upsert({
        user_id: user.id,
        email: user.email,
        stripe_account_id: accountId,
      });
    }

    // Ensure an existing/reused account is classified as an individual creator without requiring a website.
    await stripe.accounts.update(accountId!, {
      business_profile: {
        product_description:
          'Individual creator/affiliate promoting brands; earns commissions and payouts.',
        // Intentionally do not set business_profile.url to avoid website requirement
        mcc: '7311', // Advertising services
      },
    });

    const link = await stripe.accountLinks.create({
      account: accountId!,
      type: 'account_onboarding',
      refresh_url: `${base}/affiliate/settings`,
      return_url: `${base}/affiliate/settings`,
      collect: 'eventually_due', // minimize upfront data collection; bank + basic KYC
    });

    return NextResponse.json({ url: link.url, accountId }, { status: 200 });
  } catch (e: any) {
    console.error('[affiliates/create-account]', e);
    return NextResponse.json({ error: e.message || 'Stripe error' }, { status: 500 });
  }
}