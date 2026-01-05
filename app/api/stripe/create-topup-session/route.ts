// app/api/stripe/create-topup-session/route.ts
import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // Use Stripe SDK default unless explicitly overridden.
  apiVersion: (process.env.STRIPE_API_VERSION as any) || '2024-06-20',
});

export async function POST(req: Request) {
  try {
    const { email, amount, currency } = await req.json();

    // Debug (non-blocking): confirm which Stripe account the platform key belongs to
    try {
      const me = await stripe.accounts.retrieve();
      console.log('[Stripe Platform Account for topups]', me.id, (me as any).email);
    } catch (e) {
      console.warn('[stripe] Unable to retrieve platform account (non-blocking)');
    }

    if (!email || amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Missing email or amount' }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 });
    }

    const currencyToUse = (currency?.toLowerCase() || 'aud');

    const envBase = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

    const baseUrl = (envBase && envBase.startsWith('http'))
      ? envBase
      : (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000');

    if (!baseUrl.startsWith('http')) {
      throw new Error('Invalid base URL for Stripe redirects');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: currencyToUse,
            product_data: {
              name: 'Nettmark Wallet Top-Up',
            },
            unit_amount: Math.round(parsedAmount * 100), // Convert dollars to cents safely
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/affiliate/wallet?status=success&session_id={CHECKOUT_SESSION_ID}`,
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
      payload: 'Create topup session failed (inputs may be missing/invalid)',
    });
    return NextResponse.json({ error: 'Stripe session failed' }, { status: 500 });
  }
}