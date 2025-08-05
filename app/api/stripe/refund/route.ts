// app/api/stripe/refund/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import supabase from '@/../utils/supabase/server-client'; // ✅ corrected default import
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: Request) {
  const { email, refundAmount } = await req.json();

  console.log('[🧪 Refund Payload]', { email, refundAmount });

  if (!email || refundAmount === undefined) {
    console.error('[❌ Refund API Error] Missing parameters', { email, refundAmount });
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Get all top-ups and filter refundable ones manually
  const { data: topups, error } = await supabase
    .from('wallet_topups')
    .select('*')
    .eq('affiliate_email', email)
    .order('created_at', { ascending: false });

  if (error || !topups) {
    return NextResponse.json({ error: 'Failed to fetch top-ups' }, { status: 500 });
  }

  const topup = topups.find(t => Number(t.amount_refunded || 0) < Number(t.amount_net));

  if (!topup) {
    return NextResponse.json({ error: 'No refundable top-up found' }, { status: 404 });
  }

  const remaining = Number(topup.amount_net) - Number(topup.amount_refunded || 0);

  if (refundAmount > remaining) {
    return NextResponse.json(
      { error: `Refund amount ($${refundAmount}) exceeds remaining refund balance ($${remaining})` },
      { status: 400 }
    );
  }

  try {
    let refund;

    if (topup.stripe_id.startsWith('ch_')) {
      // Refund using charge ID
      refund = await stripe.refunds.create({
        amount: Math.round(refundAmount * 100),
        charge: topup.stripe_id,
      });
    } else if (topup.stripe_id.startsWith('pi_')) {
      // Refund using charge retrieved from the payment intent
      const charges = await stripe.charges.list({
        payment_intent: topup.stripe_id,
        limit: 1,
      });

      const chargeId = charges.data[0]?.id;

      if (!chargeId) {
        throw new Error('No charge found for the given Payment Intent.');
      }

      refund = await stripe.refunds.create({
        amount: Math.round(refundAmount * 100),
        charge: chargeId,
      });
    } else {
      throw new Error('Invalid stripe_id format. Must be a charge or payment intent ID.');
    }

    // Update the topup row with new refund info
    const { error: updateError } = await supabase
      .from('wallet_topups')
      .update({
        amount_refunded: (Number(topup.amount_refunded) || 0) + refundAmount,
        status: 'refunded',
      })
      .eq('id', topup.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, refund });
  } catch (err: any) {
    console.error('[❌ Refund Error]', err);
    return NextResponse.json({ error: err.message || 'Refund failed' }, { status: 500 });
  }
}