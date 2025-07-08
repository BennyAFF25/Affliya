import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-05-28.basil'
});

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
      metadata: {
        purpose: 'wallet_topup',
        email: email
      },
    });

    return NextResponse.json({ client_secret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('[❌ Create Payment Intent Error]', error);
    console.error('Payload received:', {
      amount: typeof amount !== 'undefined' ? amount : 'undefined',
      email: typeof email !== 'undefined' ? email : 'undefined'
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}