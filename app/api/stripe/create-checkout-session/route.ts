import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { buildNettmarkStripeMetadata, createStripeClient } from '@/../utils/stripe';

const stripe = createStripeClient();

const allowedCurrencies = ['usd', 'aud', 'eur', 'gbp', 'cad', 'nzd'];

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000';

export async function POST(req: Request) {
  const { amount, currency } = await req.json();
  const selectedCurrency = (typeof currency === 'string' && allowedCurrencies.includes(currency.toLowerCase()))
    ? currency.toLowerCase()
    : 'usd';

  console.log('[💰 Checkout Amount]', amount);
  console.log('[💱 Currency]', selectedCurrency);

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log('[👤 Authenticated Email]', user?.email);

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: selectedCurrency,
            product_data: {
              name: 'Affliya Wallet Top-Up',
            },
            unit_amount: amount, // already in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/affiliate/wallet?topup=success`,
      cancel_url: `${baseUrl}/affiliate/wallet?topup=cancelled`,
      metadata: buildNettmarkStripeMetadata('wallet_topup', {
        affiliate_email: user.email,
        type: 'wallet_topup',
      }),
      payment_intent_data: {
        metadata: buildNettmarkStripeMetadata('wallet_topup', {
          affiliate_email: user.email,
          type: 'wallet_topup',
        }),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error('[❌ Stripe Error]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe error' },
      { status: 500 },
    );
  }
}
