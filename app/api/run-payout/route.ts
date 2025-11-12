import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-08-27.basil',
});

// Service role Supabase client (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  try {
    const { payout_id } = await req.json();

    if (!payout_id) {
      return NextResponse.json({ error: 'payout_id_required' }, { status: 400 });
    }

    // 1) Load payout
    const { data: payout, error: payoutErr } = await supabase
      .from('wallet_payouts')
      .select('*')
      .eq('id', payout_id)
      .maybeSingle();

    if (payoutErr || !payout) {
      return NextResponse.json({ error: 'payout_not_found' }, { status: 404 });
    }

    if (payout.status === 'completed') {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    const amount = Number(payout.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    }

    // 2) Load business + affiliate Stripe data
    const { data: business, error: bizErr } = await supabase
      .from('business_profiles')
      .select('stripe_customer_id')
      .eq('business_email', payout.business_email)
      .maybeSingle();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'business_not_found' }, { status: 400 });
    }

    const { data: affiliate, error: affErr } = await supabase
      .from('affiliate_profiles')
      .select('stripe_account_id')
      .eq('email', payout.affiliate_email)
      .maybeSingle();

    if (affErr || !affiliate) {
      return NextResponse.json({ error: 'affiliate_not_found' }, { status: 400 });
    }

    const customerId = business.stripe_customer_id;
    const affiliateAccountId = affiliate.stripe_account_id;

    if (!customerId) {
      return NextResponse.json({ error: 'missing_business_customer_id' }, { status: 400 });
    }
    if (!affiliateAccountId) {
      return NextResponse.json({ error: 'missing_affiliate_stripe_account' }, { status: 400 });
    }

    const amountInCents = Math.round(amount * 100);

    // 3) Charge the business (on Nettmark platform)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'aud',
      customer: customerId,
      confirm: true,
      off_session: true,
      automatic_payment_methods: { enabled: true },
      metadata: {
        wallet_payout_id: payout.id,
        role: 'nettmark_business_charge',
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        {
          error: 'payment_not_succeeded',
          status: paymentIntent.status,
        },
        { status: 402 }
      );
    }

    // 4) Transfer to affiliate connected account
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: 'aud',
      destination: affiliateAccountId,
      metadata: {
        wallet_payout_id: payout.id,
        role: 'nettmark_affiliate_payout',
      },
    });

    // 5) Mark payout as completed
    const { error: updateErr } = await supabase
      .from('wallet_payouts')
      .update({
        status: 'completed',
        stripe_transfer_id: transfer.id,
      })
      .eq('id', payout.id);

    if (updateErr) {
      // money moved but DB not updated — log it
      console.error('Failed to update wallet_payouts after transfer', updateErr);
    }

    return NextResponse.json({
      ok: true,
      payout_id,
      charged: amount,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_transfer_id: transfer.id,
    });
  } catch (err: any) {
    console.error('[RUN_PAYOUT_ERROR]', err);
    return NextResponse.json(
      { error: 'internal_error', message: err?.message || 'unknown' },
      { status: 500 }
    );
  }
}