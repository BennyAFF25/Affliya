import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-05-28.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')!;
  const rawBody = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('[❌ Stripe Webhook Signature Error]', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const paymentIntentId = session.payment_intent as string;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['charges.data.balance_transaction'],
    });

    const charge = (paymentIntent as any).charges.data[0];
    const balanceTxId = charge.balance_transaction;

    const balanceTx = await stripe.balanceTransactions.retrieve(balanceTxId);

    const email = session.customer_email!;
    const gross_amount = +(balanceTx.amount / 100).toFixed(2);
    const fees = +(balanceTx.fee / 100).toFixed(2);
    const net_amount = +(balanceTx.net / 100).toFixed(2);

    const stripe_id = session.id;

    const { error } = await supabase.from('wallet_topups').insert({
      affiliate_email: email,
      amount_gross: gross_amount,
      stripe_fees: fees,
      amount_net: net_amount,
      stripe_id,
      status: 'succeeded',
    });

    if (error) {
      console.error('[❌ Supabase Insert Error]', error.message);
    } else {
      console.log('[✅ Wallet Top-up Recorded]');
    }
  }

  return new NextResponse('ok', { status: 200 });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export const dynamic = "force-dynamic";
