import { NextResponse } from 'next/server';
import { tryWriteMoneyFlowAudit } from '@/../utils/moneyFlowAudit';
import supabase from '@/../utils/supabase/server-client';
import { buildNettmarkStripeMetadata, createStripeClient } from '@/../utils/stripe';
import { getWalletBalanceSnapshot } from '@/../utils/wallet/balance';
import { getRefundLockState } from '@/../utils/wallet/refundLock';
import { syncAffiliateWalletCache } from '@/../utils/wallet/syncAffiliateWalletCache';

const stripe = createStripeClient();

type WalletTopupRow = {
  id: string;
  amount_net: number | string | null;
  credited_amount?: number | string | null;
  amount_refunded: number | string | null;
  stripe_id: string;
};

function getCreditedTopupAmount(topup: WalletTopupRow) {
  const credited = Number(topup.credited_amount || 0);
  if (Number.isFinite(credited) && credited > 0) return credited;
  const legacy = Number(topup.amount_net || 0);
  return Number.isFinite(legacy) ? legacy : 0;
}

function isRpcMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? error.code : null;
  return code === 'PGRST202';
}

async function createStripeRefund(
  topup: WalletTopupRow,
  refundAmount: number,
  email: string,
) {
  const metadata = buildNettmarkStripeMetadata('wallet_refund', {
    affiliate_email: email,
    source_topup_id: topup.id,
    wallet_topup_stripe_id: topup.stripe_id,
    refund_amount: refundAmount,
  });

  if (topup.stripe_id.startsWith('ch_')) {
    const refund = await stripe.refunds.create({
      amount: Math.round(refundAmount * 100),
      charge: topup.stripe_id,
      metadata,
    });

    return {
      refund,
      stripeChargeId: topup.stripe_id,
    };
  }

  if (topup.stripe_id.startsWith('pi_')) {
    const charges = await stripe.charges.list({
      payment_intent: topup.stripe_id,
      limit: 1,
    });

    const chargeId = charges.data[0]?.id;

    if (!chargeId) {
      throw new Error('No charge found for the given Payment Intent.');
    }

    const refund = await stripe.refunds.create({
      amount: Math.round(refundAmount * 100),
      charge: chargeId,
      metadata: {
        ...metadata,
        stripe_charge_id: chargeId,
      },
    });

    return {
      refund,
      stripeChargeId: chargeId,
    };
  }

  if (topup.stripe_id.startsWith('cs_')) {
    const session = await stripe.checkout.sessions.retrieve(topup.stripe_id);
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntentId) {
      throw new Error('No payment intent found for the given Checkout Session.');
    }

    const charges = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });

    const chargeId = charges.data[0]?.id;

    if (!chargeId) {
      throw new Error('No charge found for the given Checkout Session.');
    }

    const refund = await stripe.refunds.create({
      amount: Math.round(refundAmount * 100),
      charge: chargeId,
      metadata: {
        ...metadata,
        stripe_charge_id: chargeId,
        checkout_session_id: topup.stripe_id,
        payment_intent_id: paymentIntentId,
      },
    });

    return {
      refund,
      stripeChargeId: chargeId,
    };
  }

  throw new Error('Invalid stripe_id format. Must be a charge, payment intent, or checkout session ID.');
}

async function recordWalletRefund(params: {
  email: string;
  topup: WalletTopupRow;
  refundAmount: number;
  stripeRefundId: string;
  stripeChargeId: string;
  stripeStatus: string | null;
}) {
  const rpcPayload = {
    p_affiliate_email: params.email,
    p_source_topup_id: params.topup.id,
    p_stripe_refund_id: params.stripeRefundId,
    p_stripe_charge_id: params.stripeChargeId,
    p_amount: params.refundAmount,
    p_status: params.stripeStatus || 'succeeded',
  };

  const { data, error } = await supabase.rpc('record_wallet_refund', rpcPayload);

  if (error && !isRpcMissing(error)) {
    throw error;
  }

  if (!error) {
    return data;
  }

  const { error: insertError } = await supabase.from('wallet_refunds').insert({
    affiliate_email: params.email,
    source_topup_id: params.topup.id,
    stripe_refund_id: params.stripeRefundId,
    stripe_charge_id: params.stripeChargeId,
    amount: params.refundAmount,
    status: params.stripeStatus || 'succeeded',
  });

  if (insertError) {
    throw insertError;
  }

  const refundedAfter = (Number(params.topup.amount_refunded) || 0) + params.refundAmount;

  const { error: updateError } = await supabase
    .from('wallet_topups')
    .update({
      amount_refunded: refundedAfter,
      refunded_at: new Date().toISOString(),
      status:
        refundedAfter >= getCreditedTopupAmount(params.topup)
          ? 'refunded'
          : 'succeeded',
    })
    .eq('id', params.topup.id);

  if (updateError) {
    throw updateError;
  }

  return {
    success: true,
    fallback: true,
    stripeRefundId: params.stripeRefundId,
    sourceTopupId: params.topup.id,
  };
}

export async function POST(req: Request) {
  const { email, refundAmount, stripe_charge_id } = await req.json();

  console.log('[🧪 Refund Payload]', { email, refundAmount, stripe_charge_id });

  if (!email || refundAmount === undefined) {
    console.error('[❌ Refund API Error] Missing parameters', { email, refundAmount, stripe_charge_id });
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const normalizedRefundAmount = Number(refundAmount);

  if (!Number.isFinite(normalizedRefundAmount) || normalizedRefundAmount <= 0) {
    return NextResponse.json({ error: 'Refund amount must be greater than 0' }, { status: 400 });
  }

  let refundLockState;
  try {
    refundLockState = await getRefundLockState(supabase, email);
  } catch (lockErr: unknown) {
    console.error('[❌ Refund lock lookup error]', lockErr);
    return NextResponse.json(
      {
        error:
          lockErr instanceof Error
            ? lockErr.message
            : 'Failed to evaluate refund lock state',
      },
      { status: 500 }
    );
  }

  if (refundLockState.locked) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: 'wallet_refund_blocked',
      severity: 'warning',
      sourceRoute: 'app/api/stripe/refund/route.ts',
      entityType: 'affiliate_wallet',
      entityId: email,
      affiliateEmail: email,
      reasonCode: refundLockState.reasonCode,
      message: refundLockState.message,
      metadata: {
        refundAmount: normalizedRefundAmount,
        stripe_charge_id: stripe_charge_id || null,
        lock: refundLockState,
      },
    });
    return NextResponse.json(
      {
        error: refundLockState.reasonCode,
        message: refundLockState.message,
        lock: refundLockState,
      },
      { status: 409 }
    );
  }

  let topupQuery = supabase
    .from('wallet_topups')
    .select('id, amount_net, credited_amount, amount_refunded, stripe_id')
    .eq('affiliate_email', email)
    .order('created_at', { ascending: false });

  if (stripe_charge_id) {
    topupQuery = topupQuery.eq('stripe_id', stripe_charge_id);
  }

  const { data: topups, error } = await topupQuery;

  if (error || !topups) {
    return NextResponse.json({ error: 'Failed to fetch top-ups' }, { status: 500 });
  }

  const topup = (topups as WalletTopupRow[]).find(
    (t) => Number(t.amount_refunded || 0) < getCreditedTopupAmount(t),
  );

  if (!topup) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: 'wallet_refund_blocked',
      severity: 'warning',
      sourceRoute: 'app/api/stripe/refund/route.ts',
      entityType: 'affiliate_wallet',
      entityId: email,
      affiliateEmail: email,
      reasonCode: 'NO_REFUNDABLE_TOPUP',
      message: stripe_charge_id
        ? 'Selected wallet top-up is not refundable.'
        : 'No refundable wallet top-up was found.',
      metadata: {
        refundAmount: normalizedRefundAmount,
        stripe_charge_id: stripe_charge_id || null,
      },
    });
    return NextResponse.json(
      {
        error: stripe_charge_id
          ? 'Selected top-up is not refundable'
          : 'No refundable top-up found',
      },
      { status: 404 }
    );
  }

  const remaining = getCreditedTopupAmount(topup) - Number(topup.amount_refunded || 0);

  let walletSnapshot;
  try {
    walletSnapshot = await getWalletBalanceSnapshot(supabase, email);
  } catch (snapshotErr: unknown) {
    console.error('[❌ Refund wallet snapshot error]', snapshotErr);
    return NextResponse.json(
      {
        error:
          snapshotErr instanceof Error
            ? snapshotErr.message
            : 'Failed to read canonical wallet balance',
      },
      { status: 500 }
    );
  }

  if (normalizedRefundAmount > walletSnapshot.refundableBalance) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: 'wallet_refund_blocked',
      severity: 'warning',
      sourceRoute: 'app/api/stripe/refund/route.ts',
      entityType: 'affiliate_wallet',
      entityId: email,
      affiliateEmail: email,
      walletTopupId: topup.id,
      reasonCode: 'REFUNDABLE_BALANCE_EXCEEDED',
      message: 'Requested refund exceeds canonical refundable balance.',
      metadata: {
        refundAmount: normalizedRefundAmount,
        refundableBalance: walletSnapshot.refundableBalance,
      },
    });
    return NextResponse.json(
      {
        error: `Refund amount ($${normalizedRefundAmount}) exceeds canonical refundable balance ($${walletSnapshot.refundableBalance})`,
      },
      { status: 400 }
    );
  }

  if (normalizedRefundAmount > remaining) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: 'wallet_refund_blocked',
      severity: 'warning',
      sourceRoute: 'app/api/stripe/refund/route.ts',
      entityType: 'wallet_topup',
      entityId: topup.id,
      affiliateEmail: email,
      walletTopupId: topup.id,
      reasonCode: 'TOPUP_REMAINING_BALANCE_EXCEEDED',
      message: 'Requested refund exceeds the remaining refundable balance on the selected top-up.',
      metadata: {
        refundAmount: normalizedRefundAmount,
        remaining,
      },
    });
    return NextResponse.json(
      {
        error: `Refund amount ($${normalizedRefundAmount}) exceeds remaining refund balance on the selected top-up ($${remaining})`,
      },
      { status: 400 }
    );
  }

  try {
    const { refund, stripeChargeId } = await createStripeRefund(
      topup,
      normalizedRefundAmount,
      email,
    );

    const ledgerResult = await recordWalletRefund({
      email,
      topup,
      refundAmount: normalizedRefundAmount,
      stripeRefundId: refund.id,
      stripeChargeId,
      stripeStatus: refund.status || null,
    });

    try {
      await syncAffiliateWalletCache(supabase as never, email);
    } catch (syncErr: unknown) {
      console.error('[❌ Refund wallet cache sync error]', syncErr);
    }

    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: 'wallet_refund_succeeded',
      severity: 'info',
      sourceRoute: 'app/api/stripe/refund/route.ts',
      entityType: 'wallet_topup',
      entityId: topup.id,
      affiliateEmail: email,
      walletTopupId: topup.id,
      walletRefundId: refund.id,
      reasonCode: 'WALLET_REFUND_COMPLETED',
      message: 'Wallet top-up refund completed successfully.',
      metadata: {
        refundAmount: normalizedRefundAmount,
        stripeRefundId: refund.id,
        stripeChargeId,
        ledgerResult,
      },
    });

    return NextResponse.json({ success: true, refund, ledger: ledgerResult });
  } catch (err: unknown) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: 'wallet_refund_failed',
      severity: 'error',
      sourceRoute: 'app/api/stripe/refund/route.ts',
      entityType: 'affiliate_wallet',
      entityId: email,
      affiliateEmail: email,
      reasonCode: 'WALLET_REFUND_FAILED',
      message: err instanceof Error ? err.message : 'Refund failed',
      metadata: {
        refundAmount: normalizedRefundAmount,
        stripe_charge_id: stripe_charge_id || null,
      },
    });
    console.error('[❌ Refund Error]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refund failed' },
      { status: 500 }
    );
  }
}
