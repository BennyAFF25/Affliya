import Stripe from 'stripe';
import supabase from '@/../utils/supabase/server-client';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});
export async function POST(req: Request) {

  try {
    const body = await req.json();
    console.log('[💸 Transfer Request]', body);

    const { affiliate_email, business_email, offer_id, amount, currency = 'usd', description } = body;

    if (!affiliate_email || !business_email || !offer_id || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
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

    // ✅ Lookup business Stripe account ID
    const { data: businessProfile, error: businessError } = await supabase
      .from('business_profiles')
      .select('stripe_account_id')
      .eq('email', business_email)
      .single();

    if (businessError || !businessProfile?.stripe_account_id) {
      console.error('[❌ Business Stripe ID Lookup Error]', businessError);
      return NextResponse.json(
        { error: 'Business Stripe account not found.' },
        { status: 404 }
      );
    }

    // ✅ Create transfer
    const transfer = await stripe.transfers.create({
      amount: Math.round(parsedAmount * 100), // cents
      currency: currency,
      destination: businessProfile.stripe_account_id,
      description: description || `Ad spend for offer ${offer_id}`,
    });

    console.log('[✅ Transfer Created]', transfer.id);

    // ✅ Record deduction in wallet_deductions
    const { error: insertError } = await supabase.from('wallet_deductions').insert({
      affiliate_email,
      business_email,
      offer_id,
      amount: parsedAmount,
      description: description || 'Ad spend transfer',
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[❌ Deduction Insert Error]', insertError);
      return NextResponse.json(
        { error: 'Transfer created but failed to record deduction.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, transfer_id: transfer.id });
  } catch (err) {
    console.error('[❌ Transfer Error]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}