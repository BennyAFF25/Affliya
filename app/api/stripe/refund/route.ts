import Stripe from 'stripe';
import supabase from '@/../utils/supabase/server-client';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: Request) {

  try {
    const body = await req.json();
    const { email, amount } = body;

    if (!email || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Missing email or amount.' },
        { status: 400 }
      );
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount value.' },
        { status: 400 }
      );
    }

    // Sum all top-ups
    const { data: topups, error: topupError } = await supabase
      .from('wallet_topups')
      .select('*')
      .eq('affiliate_email', email)
      .eq('status', 'succeeded');

    if (topupError || !topups) {
      return NextResponse.json(
        { error: 'Failed to fetch top-ups' },
        { status: 500 }
      );
    }

    const totalTopups = topups.reduce((sum, t) => sum + (t.amount_net ?? 0), 0);

    // Sum all refunds
    const { data: refunds, error: refundError } = await supabase
      .from('wallet_refunds')
      .select('*')
      .eq('affiliate_email', email);

    if (refundError || !refunds) {
      return NextResponse.json(
        { error: 'Failed to fetch refunds' },
        { status: 500 }
      );
    }

    const totalRefunds = refunds.reduce((sum, r) => sum + (r.amount ?? 0), 0);

    const available = totalTopups - totalRefunds;

    if (parsedAmount > available) {
      return NextResponse.json(
        { error: `Refund amount exceeds available balance (${available.toFixed(2)}).` },
        { status: 400 }
      );
    }

    // Find the most recent top-up for refund reference (for now)
    const mostRecentTopup = topups[0];
    if (!mostRecentTopup) {
      return NextResponse.json(
        { error: 'No successful top-up to refund.' },
        { status: 400 }
      );
    }

    // Create Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: mostRecentTopup.stripe_id,
      amount: Math.round(parsedAmount * 100),
    });

    // Insert refund record
    const { error: insertError } = await supabase.from('wallet_refunds').insert({
      affiliate_email: email,
      amount: parsedAmount,
      stripe_refund_id: refund.id,
      status: refund.status,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      return NextResponse.json(
        { error: 'Refund created but failed to record.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, refund });
  } catch (err) {
    console.error('[❌ Refund Error]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}