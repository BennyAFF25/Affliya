import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

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
  } catch (err: any) {
    console.error('[❌ Stripe Webhook Signature Error]', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      const paymentIntentId = session.payment_intent as string;
      const paymentIntentRes = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['charges.data.balance_transaction'],
      });

      const paymentIntent = paymentIntentRes as Stripe.PaymentIntent;

      const charge = (paymentIntent as any).charges.data[0];
      const balanceTxId = charge.balance_transaction;

      const balanceTx = await stripe.balanceTransactions.retrieve(balanceTxId);

      const email = session.customer_email!;
      const gross_amount = +(balanceTx.amount / 100).toFixed(2);
      const fees = +(balanceTx.fee / 100).toFixed(2);
      const net_amount = +(balanceTx.net / 100).toFixed(2);

      if (process.env.NODE_ENV === 'development') {
        console.log('[🧮 Stripe Webhook Amounts]', {
          gross_amount,
          fees,
          net_amount,
        });
      }

      const stripe_id = session.id;

      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error } = await supabase.from('wallet_topups').insert({
        affiliate_email: email,
        amount_gross: gross_amount,
        stripe_fees: fees,
        amount_net: net_amount,
        stripe_id,
        status: 'succeeded',
      });

      if (!error) {
        const { data: existingWallet, error: fetchError } = await supabase
          .from('wallets')
          .select('balance')
          .eq('email', email)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('[❌ Supabase Wallet Fetch Error]', fetchError.message);
        }

        const currentBalance = existingWallet?.balance || 0;
        const newBalance = currentBalance + net_amount;

        const { error: upsertError } = await supabase.from('wallets').upsert({
          email,
          last_transaction_id: stripe_id,
          last_transaction_status: 'succeeded',
          last_topup_amount: gross_amount,
          last_fee_amount: fees,
          last_net_amount: net_amount,
          balance: newBalance,
        }, { onConflict: 'email' });

        if (upsertError) {
          console.error('[❌ Supabase Wallet Upsert Error]', upsertError.message);
        } else {
          console.log('[✅ Wallet Balance Updated]');
        }
      }

      if (error) {
        console.error('[❌ Supabase Insert Error]', error.message);
      } else {
        console.log('[✅ Wallet Top-up Recorded]');
      }
    } catch (err: any) {
      console.error('[❌ Webhook Handling Error]', err.message);
    }
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
  } catch (err: any) {
    console.error('[❌ Stripe Session Fetch Error]', err.message);
    return new NextResponse(`Stripe Session Fetch Error: ${err.message}`, { status: 400 });
  }
}