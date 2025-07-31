// app/api/stripe/create-topup-session/route.ts
import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: Request) {
  try {
    const { email, amount, currency } = await req.json();

    if (!email || amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Missing email or amount' }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 });
    }

    const currencyToUse = currency?.toLowerCase() || 'usd';

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_BASE_URL : 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: currencyToUse,
            product_data: {
              name: 'Affliya Wallet Top-Up',
            },
            unit_amount: Math.round(parsedAmount * 100), // Convert dollars to cents safely
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/affiliate/wallet?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/affiliate/wallet?status=cancel`,
      metadata: { email, amount: parsedAmount.toString(), currency: currencyToUse },
      payment_intent_data: {
        metadata: {
          email,
          amount: parsedAmount.toString(),
          currency: currencyToUse,
        },
      },
    });

    console.log('[✅ Stripe Session Created]', { email, parsedAmount, currency: currencyToUse, sessionUrl: session.url });
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('[❌ Stripe Session Error]', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      raw: err.raw,
      param: err.param,
      code: err.code,
      url: req.url,
      payload: 'Unable to log email, amount, or currency due to scope',
    });
    return NextResponse.json({ error: 'Stripe session failed' }, { status: 500 });
  }
}