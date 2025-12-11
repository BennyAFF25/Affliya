// app/api/stripe/businesses/create-account/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });

    // 1) Check if we already saved an account id
    const { data: biz, error: qErr } = await supabase
      .from('business_profiles')
      .select('id, business_email, stripe_account_id')
      .eq('business_email', user.email)
      .single();
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

    let acctId = biz?.stripe_account_id as string | null;

    // 2) Create Express account if missing
    if (!acctId) {
      const acct = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        email: user.email,
        capabilities: { transfers: { requested: true } }, // for reimbursements via transfers
        business_type: 'individual', // adjust if you collect company info
      });
      acctId = acct.id;

      const { error: upErr } = await supabase
        .from('business_profiles')
        .update({ stripe_account_id: acctId, stripe_onboarding_complete: false })
        .eq('business_email', user.email);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // 3) Create onboarding link
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const link = await stripe.accountLinks.create({
      account: acctId,
      refresh_url: `${base}/business/my-business`,
      return_url: `${base}/business/my-business`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: link.url }, { status: 200 });
  } catch (err: any) {
    console.error('[create-account error]', err);
    return NextResponse.json({ error: err?.message || 'Stripe error' }, { status: 500 });
  }
}