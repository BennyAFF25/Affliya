import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordPlatformFeeLedger } from "@/../utils/feeAccounting";
import { createStripeClient } from "@/../utils/stripe";
import { syncAffiliateWalletCache } from "@/../utils/wallet/syncAffiliateWalletCache";

export const runtime = "nodejs";

const stripe = createStripeClient((process.env.STRIPE_SECRET_KEY || "").trim());
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function creditWalletTopup(params: {
  email: string;
  checkoutSessionId: string;
  grossAmount: number;
  fees: number;
  creditedAmount: number;
  nettmarkFeeAmount: number;
  platformAcctId: string;
}) {
  const {
    email,
    checkoutSessionId,
    grossAmount,
    fees,
    creditedAmount,
    nettmarkFeeAmount,
    platformAcctId,
  } = params;

  const rpc = await supabase.rpc("credit_wallet_topup", {
    p_affiliate_email: email,
    p_checkout_session_id: checkoutSessionId,
    p_amount_gross: grossAmount,
    p_stripe_fees: fees,
    p_amount_net: creditedAmount,
    p_platform_acct_id: platformAcctId,
    p_nettmark_fee_amount: nettmarkFeeAmount,
    p_credited_amount: creditedAmount,
  });

  if (rpc.error && rpc.error.code !== "PGRST202") {
    throw new Error(`credit_wallet_topup RPC failed: ${rpc.error.message}`);
  }

  if (rpc.error?.code === "PGRST202") {
    const { data: existingTopup, error: existingTopupError } = await supabase
      .from("wallet_topups")
      .select("id, stripe_id")
      .eq("stripe_id", checkoutSessionId)
      .maybeSingle();

    if (existingTopupError) {
      throw new Error(`topup idempotency check failed: ${existingTopupError.message}`);
    }

    if (!existingTopup) {
      const { error: insertError } = await supabase.from("wallet_topups").insert({
        affiliate_email: email,
        amount_gross: grossAmount,
        stripe_fees: fees,
        amount_net: creditedAmount,
        credited_amount: creditedAmount,
        nettmark_fee_amount: nettmarkFeeAmount,
        stripe_id: checkoutSessionId,
        status: "succeeded",
        platform_acct_id: platformAcctId,
      });

      if (insertError) {
        throw new Error(`wallet_topups insert failed: ${insertError.message}`);
      }
    }
  }

  await recordPlatformFeeLedger(supabase as never, {
    sourceType: "wallet_topup",
    sourceId: checkoutSessionId,
    feeCategory: "nettmark_transaction_fee",
    amount: nettmarkFeeAmount,
    currency: "aud",
    principalAmount: creditedAmount,
    grossAmount,
    stripeFeeAmount: fees,
    stripeObjectId: checkoutSessionId,
    metadata: {
      affiliate_email: email,
      platform_acct_id: platformAcctId,
      reconciled_via: "api/stripe/reconcile-topup",
    },
  });

  try {
    await syncAffiliateWalletCache(supabase as never, email);
  } catch (syncError: unknown) {
    console.error("[❌ wallet cache sync error after top-up reconcile]", syncError);
  }

  return {
    credited: Boolean(rpc.data?.credited ?? true),
    mode: rpc.error?.code === "PGRST202" ? "fallback" : "rpc",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || body?.sessionId || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionAction = session.metadata?.nettmark_action || session.metadata?.purpose;

    if (sessionAction !== "wallet_topup") {
      return NextResponse.json({ error: "Session is not a wallet top-up" }, { status: 400 });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Session is not paid yet" }, { status: 409 });
    }

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

    if (!paymentIntentId) {
      return NextResponse.json({ error: "Missing payment intent" }, { status: 400 });
    }

    const email =
      session.customer_email ||
      session.metadata?.affiliate_email ||
      session.metadata?.email ||
      "";

    if (!email) {
      return NextResponse.json({ error: "Missing affiliate email" }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });

    let latestCharge = paymentIntent.latest_charge;
    if (!latestCharge) {
      const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });
      latestCharge = charges.data[0] || null;
    }

    if (!latestCharge) {
      return NextResponse.json({ error: "Unable to resolve latest charge" }, { status: 409 });
    }

    const charge = typeof latestCharge === "string"
      ? await stripe.charges.retrieve(latestCharge, { expand: ["balance_transaction"] })
      : latestCharge;

    const balanceTransaction = charge.balance_transaction;
    if (!balanceTransaction) {
      return NextResponse.json({ error: "Unable to resolve balance transaction" }, { status: 409 });
    }

    const balanceTx = typeof balanceTransaction === "string"
      ? await stripe.balanceTransactions.retrieve(balanceTransaction)
      : balanceTransaction;

    let platformAcctId = "unknown";
    try {
      const platformAccount = await stripe.accounts.retrieve();
      platformAcctId = platformAccount.id;
    } catch (err: unknown) {
      console.error("[❌ Stripe platform account retrieve error during top-up reconcile]", err);
    }

    const grossAmount = +(balanceTx.amount / 100).toFixed(2);
    const fees = +(balanceTx.fee / 100).toFixed(2);
    const creditedAmount = Number(session.metadata?.topup_amount || 0) || grossAmount;
    const nettmarkFeeAmount = Number(session.metadata?.nettmark_fee_amount || 0);

    const creditResult = await creditWalletTopup({
      email,
      checkoutSessionId: session.id,
      grossAmount,
      fees,
      creditedAmount,
      nettmarkFeeAmount,
      platformAcctId,
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      paymentIntentId,
      grossAmount,
      fees,
      creditedAmount,
      nettmarkFeeAmount,
      ...creditResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Top-up reconciliation failed";
    console.error("[❌ reconcile-topup]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
