import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createStripeClient } from '@/../utils/stripe';

const stripe = createStripeClient();

function getErrorMessage(err: unknown) {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown Stripe error';
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')!;
  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error('[❌ Stripe Webhook Signature Error]', message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  console.log('[ℹ️ /api/stripe-session POST received event]', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.warn('[⚠️ /api/stripe-session POST is deprecated; wallet top-up crediting belongs to /api/stripe/webhook]', {
      sessionId: session.id,
      action: session.metadata?.nettmark_action || session.metadata?.purpose,
    });
  }

  return new NextResponse('ok', { status: 200 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return new NextResponse(JSON.stringify({ error: 'Missing session_id' }), { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return new NextResponse(JSON.stringify(session), { status: 200 });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error('[❌ Stripe Session Fetch Error]', message);
    return new NextResponse(`Stripe Session Fetch Error: ${message}`, { status: 400 });
  }
}
