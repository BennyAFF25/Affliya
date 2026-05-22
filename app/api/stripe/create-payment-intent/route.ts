import { NextRequest, NextResponse } from 'next/server';
import { calculateWalletTopupCharge, toStripeAmount } from '@/../utils/feeAccounting';
import { buildNettmarkStripeMetadata, createStripeClient } from '@/../utils/stripe';

const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: NextRequest) {
  let amount;
  let email;

  try {
    ({ amount, email } = await req.json());
    const principalAmount = Number(amount);

    if (!principalAmount || !email) {
      return NextResponse.json({ error: 'Missing amount or email' }, { status: 400 });
    }

    const feeBreakdown = calculateWalletTopupCharge(principalAmount);
    amount = toStripeAmount(feeBreakdown.totalChargeAmount);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      receipt_email: email,
      metadata: buildNettmarkStripeMetadata('wallet_topup', {
        purpose: 'wallet_topup',
        affiliate_email: email,
        topup_amount: feeBreakdown.principalAmount,
        gross_charge_amount: feeBreakdown.totalChargeAmount,
        stripe_fee_passthrough_amount: feeBreakdown.estimatedStripeFeeAmount,
        nettmark_fee_amount: feeBreakdown.feeAmount,
        fee_bps: feeBreakdown.feeBps,
      }),
    });

    return NextResponse.json({ client_secret: paymentIntent.client_secret });
  } catch (error: unknown) {
    console.error('[❌ Create Payment Intent Error]', error);
    console.error('Payload received:', {
      amount: typeof amount !== 'undefined' ? amount : 'undefined',
      email: typeof email !== 'undefined' ? email : 'undefined'
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stripe error' },
      { status: 500 },
    );
  }
}
