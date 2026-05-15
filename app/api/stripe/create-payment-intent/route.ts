import { NextRequest, NextResponse } from 'next/server';
import { buildNettmarkStripeMetadata, createStripeClient } from '@/../utils/stripe';

const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: NextRequest) {
  let amount;
  let email;

  try {
    ({ amount, email } = await req.json());
    amount = Math.round(Number(amount)); // Ensure it's an integer in smallest currency unit (e.g., cents)

    if (!amount || !email) {
      return NextResponse.json({ error: 'Missing amount or email' }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      receipt_email: email,
      metadata: buildNettmarkStripeMetadata('wallet_topup', {
        purpose: 'wallet_topup',
        affiliate_email: email,
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
