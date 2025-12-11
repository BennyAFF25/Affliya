import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import supabase from '@/../utils/supabase/server-client';

// We still initialise Stripe in case we later expand this route to
// optionally create a transfer, but for now this route is purely
// an internal ledger update for ad spend.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[💸 Transfer Ad Spend Request]', body);

    const {
      affiliate_email,
      business_email, // kept for logging / future use
      offer_id,
      live_ad_id,
      amount,
      description = 'Ad spend deduction',
    } = body;

    if (!affiliate_email || !offer_id || !live_ad_id || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields (affiliate_email, offer_id, live_ad_id, amount).' },
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

    // 1) Look up affiliate wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('email', affiliate_email)
      .single();

    if (walletError || !wallet) {
      console.error('[❌ Wallet Lookup Error]', walletError);
      return NextResponse.json(
        { error: 'Wallet not found for affiliate.' },
        { status: 404 }
      );
    }

    if (Number(wallet.balance) < parsedAmount) {
      return NextResponse.json(
        { error: 'Insufficient wallet balance for ad spend.' },
        { status: 400 }
      );
    }

    // 2) Insert a record in wallet_deductions (ad spend)
    const { error: deductionError } = await supabase.from('wallet_deductions').insert({
      affiliate_email,
      business_email: business_email || null,
      offer_id,
      amount: parsedAmount,
      description,
      // created_at has default in schema; we send explicit timestamp just to be safe
      created_at: new Date().toISOString(),
    });

    if (deductionError) {
      console.error('[❌ Deduction Insert Error]', deductionError);
      return NextResponse.json(
        { error: 'Failed to record wallet deduction.' },
        { status: 500 }
      );
    }

    // 3) Decrement wallet balance
    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({ balance: Number(wallet.balance) - parsedAmount })
      .eq('email', affiliate_email);

    if (walletUpdateError) {
      console.error('[❌ Wallet Update Error]', walletUpdateError);
      return NextResponse.json(
        { error: 'Failed to update wallet balance after deduction.' },
        { status: 500 }
      );
    }

    // 4) Increment spend on the live ad so UI + settlement logic
    //    can see how much has been burned on this ad.
    const { data: liveAd, error: liveAdError } = await supabase
      .from('live_ads')
      .select('id, spend')
      .eq('id', live_ad_id)
      .single();

    if (liveAdError || !liveAd) {
      console.error('[❌ live_ads Lookup Error]', liveAdError);
      return NextResponse.json(
        { error: 'Live ad not found for spend update.' },
        { status: 404 }
      );
    }

    const currentSpend = Number(liveAd.spend) || 0;

    const { error: liveAdUpdateError } = await supabase
      .from('live_ads')
      .update({ spend: currentSpend + parsedAmount })
      .eq('id', live_ad_id);

    if (liveAdUpdateError) {
      console.error('[❌ live_ads Update Error]', liveAdUpdateError);
      return NextResponse.json(
        { error: 'Failed to update ad spend on live ad.' },
        { status: 500 }
      );
    }

    // 5) Transfer funds to business Stripe account via Connect
    const { data: businessProfile, error: businessLookupError } = await supabase
      .from('business_profiles')
      .select('stripe_account_id')
      .eq('business_email', business_email)
      .single();

    if (businessLookupError || !businessProfile?.stripe_account_id) {
      console.error('[⚠️ No Stripe account found for business]', businessLookupError);
      return NextResponse.json(
        { error: 'No connected Stripe account for business.' },
        { status: 404 }
      );
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(parsedAmount * 100), // Stripe uses cents
        currency: 'aud',
        destination: businessProfile.stripe_account_id,
        description: `Ad spend transfer for ${live_ad_id}`,
        metadata: {
          affiliate_email,
          business_email,
          offer_id,
          live_ad_id,
          reason: description,
        },
      });

      console.log('[✅ Stripe Transfer Created]', transfer.id, transfer.amount, transfer.destination);

      // Optionally, record in wallets for bookkeeping
      await supabase.from('wallets').upsert({
        email: affiliate_email,
        last_transaction_id: transfer.id,
        last_transaction_status: transfer.status,
        last_topup_amount: parsedAmount,
        balance: Number(wallet.balance) - parsedAmount,
      }, { onConflict: 'email' });

    } catch (transferError: any) {
      console.error('[❌ Stripe Transfer Error]', transferError);
      return NextResponse.json(
        { error: 'Failed to create Stripe transfer.', details: transferError.message },
        { status: 500 }
      );
    }

    // No Stripe transfer is created here – funds are already in Nettmark
    // from the original top-up. A separate "settle ad spend" flow will
    // move cumulative spend to the business account using Stripe Connect.

    return NextResponse.json({
      success: true,
      affiliate_email,
      live_ad_id,
      offer_id,
      amount: parsedAmount,
    });
  } catch (err) {
    console.error('[❌ Transfer Ad Spend Error]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}