
import { NextResponse } from 'next/server';
import { createStripeClient } from '@/../utils/stripe';

// POST /api/stripe/create-setup-intent
// Body: { customerId: string }
// Returns: { clientSecret: string }
//
// Use this clientSecret with Stripe.js to render a Payment Element and save a card
// to the given Customer for future off-session charges.
export async function POST(req: Request) {
  try {
    const { customerId } = await req.json();
    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "customerId"' }, { status: 400 });
    }

    const stripe = createStripeClient();

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // so you can charge later without user present
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Stripe create-setup-intent error]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 500 });
  }
}
