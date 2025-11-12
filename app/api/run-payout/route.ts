// app/api/run-payout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Cast to any to satisfy Stripe's TS types if they lag behind
  apiVersion: '2024-06-20' as any,
});

// Service role Supabase client (bypasses RLS for backend jobs)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  try {
    const { payout_id } = await req.json();

    if (!payout_id) {
      return NextResponse.json(
        { error: 'payout_id_required' },
        { status: 400 }
      );
    }

    // 1) Load payout row
    const { data: payout, error: payoutErr } = await supabase
      .from('wallet_payouts')
      .select('*')
      .eq('id', payout_id)
      .maybeSingle();

    if (payoutErr || !payout) {
      console.error('[RUN_PAYOUT] payout_not_found', payoutErr);
      return NextResponse.json(
        { error: 'payout_not_found' },
        { status: 404 }
      );
    }

    if (payout.status === 'completed') {
      return NextResponse.json({
        ok: true,
        alreadyCompleted: true,
        payout_id,
      });
    }

    const amount = Number(payout.amount);
    if (!amount || isNaN(amount)) {
      return NextResponse.json(
        { error: 'invalid_amount' },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(amount * 100);
    if (amountInCents < 50) {
      // Stripe minimum charge (AUD 0.50)
      return NextResponse.json(
        {
          error: 'amount_below_minimum',
          message: 'Payout amount must be at least $0.50 AUD',
        },
        { status: 400 }
      );
    }

    // 2) Load business + affiliate Stripe config
    const { data: business, error: bizErr } = await supabase
      .from('business_profiles')
      .select('stripe_customer_id')
      .eq('business_email', payout.business_email)
      .maybeSingle();

    if (bizErr || !business) {
      console.error('[RUN_PAYOUT] business_not_found', bizErr);
      return NextResponse.json(
        { error: 'business_not_found' },
        { status: 400 }
      );
    }

    const { data: affiliate, error: affErr } = await supabase
      .from('affiliate_profiles')
      .select('stripe_account_id')
      .eq('email', payout.affiliate_email)
      .maybeSingle();

    if (affErr || !affiliate) {
      console.error('[RUN_PAYOUT] affiliate_not_found', affErr);
      return NextResponse.json(
        { error: 'affiliate_not_found' },
        { status: 400 }
      );
    }

    const customerId = business.stripe_customer_id;
    const affiliateAccountId = affiliate.stripe_account_id;

    if (!customerId) {
      return NextResponse.json(
        { error: 'missing_business_customer_id' },
        { status: 400 }
      );
    }

    if (!affiliateAccountId) {
      return NextResponse.json(
        { error: 'missing_affiliate_stripe_account' },
        { status: 400 }
      );
    }

    // 3) Get a saved card for this customer
    const pmList = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 1,
    });

    if (!pmList.data.length) {
      return NextResponse.json(
        {
          error: 'no_payment_method_on_customer',
          message:
            'Customer has no saved payment method. Add a card before running payouts.',
        },
        { status: 400 }
      );
    }

    const paymentMethodId = pmList.data[0].id;

    // 4) Charge the business using saved card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'aud',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      metadata: {
        wallet_payout_id: payout.id,
        role: 'nettmark_business_charge',
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      console.error(
        '[RUN_PAYOUT] payment_not_succeeded',
        paymentIntent.id,
        paymentIntent.status
      );
      return NextResponse.json(
        {
          error: 'payment_not_succeeded',
          status: paymentIntent.status,
        },
        { status: 402 }
      );
    }

    // 5) Transfer to affiliate connected account
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: 'aud',
      destination: affiliateAccountId,
      metadata: {
        wallet_payout_id: payout.id,
        role: 'nettmark_affiliate_payout',
      },
    });

    // 6) Mark payout as completed
    const { error: updateErr } = await supabase
      .from('wallet_payouts')
      .update({
        status: 'completed',
        stripe_transfer_id: transfer.id,
      })
      .eq('id', payout.id);

    if (updateErr) {
      console.error(
        '[RUN_PAYOUT] Failed to update wallet_payouts after transfer',
        updateErr
      );
      // We still return ok because money has moved; this is a bookkeeping issue.
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
      {
        error: 'internal_error',
        message: err?.message || 'unknown',
      },
      { status: 500 }
    );
  }
}