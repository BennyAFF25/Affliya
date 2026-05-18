// app/api/run-payout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  calculateChargeOnTopFee,
  recordPlatformFeeLedger,
  toStripeAmount,
} from "@/../utils/feeAccounting";
import {
  buildNettmarkStripeMetadata,
  createStripeClient,
} from "@/../utils/stripe";
import { tryWriteMoneyFlowAudit } from "@/../utils/moneyFlowAudit";

const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY as string);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

function getChargeId(paymentIntent: Stripe.PaymentIntent) {
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge) return null;
  if (typeof latestCharge === "string") return latestCharge;
  return latestCharge.id || null;
}

function buildPaymentIntentIdempotencyKey(payoutId: string) {
  return `wallet_payout:${payoutId}:payment_intent`;
}

function buildTransferIdempotencyKey(payoutId: string) {
  return `wallet_payout:${payoutId}:transfer`;
}

async function resolvePaymentIntentStripeFee(paymentIntent: Stripe.PaymentIntent) {
  const latestChargeId = getChargeId(paymentIntent);
  if (!latestChargeId) {
    return { chargeId: null, stripeFeeAmount: null };
  }

  const charge = await stripe.charges.retrieve(latestChargeId, {
    expand: ["balance_transaction"],
  });

  const balanceTransaction = charge.balance_transaction;
  let stripeFeeAmount: number | null = null;
  if (balanceTransaction && typeof balanceTransaction !== "string") {
    stripeFeeAmount = Math.round((balanceTransaction.fee / 100) * 100) / 100;
  }

  return {
    chargeId: charge.id,
    stripeFeeAmount,
  };
}

async function updatePayoutBookkeeping(
  payoutId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("wallet_payouts").update(values).eq("id", payoutId);
  return error;
}

async function persistPayoutFeeLedger(params: {
  payout: Record<string, unknown>;
  chargeId: string | null;
  paymentIntentId: string;
  transferId?: string | null;
  payoutPrincipalAmount: number;
  grossChargeAmount: number;
  nettmarkFeeAmount: number;
  stripeFeeAmount: number | null;
  payoutState: "payment_succeeded_transfer_pending" | "transfer_failed" | "completed";
  errorMessage?: string | null;
}) {
  const {
    payout,
    chargeId,
    paymentIntentId,
    transferId,
    payoutPrincipalAmount,
    grossChargeAmount,
    nettmarkFeeAmount,
    stripeFeeAmount,
    payoutState,
    errorMessage,
  } = params;

  await recordPlatformFeeLedger(supabase as never, {
    sourceType: "wallet_payout",
    sourceId: String(payout.id),
    feeCategory: "nettmark_transaction_fee",
    amount: nettmarkFeeAmount,
    currency: "aud",
    principalAmount: payoutPrincipalAmount,
    grossAmount: grossChargeAmount,
    stripeFeeAmount,
    stripeObjectId: paymentIntentId,
    metadata: {
      business_email: payout.business_email,
      affiliate_email: payout.affiliate_email,
      stripe_charge_id: chargeId,
      stripe_transfer_id: transferId || null,
      payout_state: payoutState,
      payout_error_message: errorMessage || null,
    },
  });
}

async function markPayoutFailure(opts: {
  payoutId: string;
  errorCode: string;
  errorMessage: string;
  payout?: Record<string, unknown> | null;
}) {
  const { payoutId, errorCode, errorMessage, payout } = opts;
  const updateError = await updatePayoutBookkeeping(payoutId, {
    status: "failed",
    payout_error_code: errorCode,
    payout_error_message: errorMessage,
  });

  if (updateError) {
    console.error("[RUN_PAYOUT] Failed to persist payout failure state", updateError);
  }

  await tryWriteMoneyFlowAudit(supabase as never, {
    eventType: "wallet_payout_execution_failed",
    severity: "error",
    sourceRoute: "app/api/run-payout/route.ts",
    entityType: "wallet_payout",
    entityId: payoutId,
    payoutId,
    businessEmail: typeof payout?.business_email === "string" ? payout.business_email : null,
    affiliateEmail: typeof payout?.affiliate_email === "string" ? payout.affiliate_email : null,
    businessId: typeof payout?.business_id === "string" ? payout.business_id : null,
    affiliateUserId: typeof payout?.affiliate_user_id === "string" ? payout.affiliate_user_id : null,
    offerId: typeof payout?.offer_id === "string" ? payout.offer_id : null,
    reasonCode: errorCode,
    message: errorMessage,
  });
}

function getErrorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "unknown";
}

async function getTransferReadiness(destinationAcct: string) {
  try {
    const account = await stripe.accounts.retrieve(destinationAcct);
    const transfersCapability =
      typeof account === "object" && "capabilities" in account
        ? account.capabilities?.transfers
        : undefined;

    const transfersReady =
      transfersCapability === "active" || account.payouts_enabled === true;

    return {
      ok: transfersReady,
      accountId: destinationAcct,
      transfersCapability: transfersCapability || "unknown",
      payoutsEnabled: !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      accountId: destinationAcct,
      transfersCapability: "unknown",
      payoutsEnabled: false,
      detailsSubmitted: false,
      error: getErrorMessage(err) || "Failed to read Stripe account",
    };
  }
}

export async function POST(req: Request) {
  try {
    const { payout_id } = await req.json();

    if (!payout_id) {
      return NextResponse.json({ error: "payout_id_required" }, { status: 400 });
    }

    const { data: payout, error: payoutErr } = await supabase
      .from("wallet_payouts")
      .select("*")
      .eq("id", payout_id)
      .maybeSingle();

    if (payoutErr || !payout) {
      console.error("[RUN_PAYOUT] payout_not_found", payoutErr);
      return NextResponse.json({ error: "payout_not_found" }, { status: 404 });
    }

    if (payout.status === "completed") {
      if (!payout.stripe_payment_intent_id || !payout.stripe_transfer_id) {
        await tryWriteMoneyFlowAudit(supabase as never, {
          eventType: "wallet_payout_execution_conflict",
          severity: "warning",
          sourceRoute: "app/api/run-payout/route.ts",
          entityType: "wallet_payout",
          entityId: payout.id,
          payoutId: payout.id,
          businessEmail: payout.business_email,
          affiliateEmail: payout.affiliate_email,
          businessId: payout.business_id,
          affiliateUserId: payout.affiliate_user_id,
          offerId: payout.offer_id,
          reasonCode: "COMPLETED_PAYOUT_MISSING_STRIPE_REFS",
          message: "Completed payout row is missing Stripe refs and needs bookkeeping repair.",
          metadata: {
            stripe_payment_intent_id: payout.stripe_payment_intent_id || null,
            stripe_transfer_id: payout.stripe_transfer_id || null,
          },
        });
        return NextResponse.json(
          {
            error: "completed_payout_missing_stripe_refs",
            payout_id,
            repairable: true,
            stripe_payment_intent_id: payout.stripe_payment_intent_id || null,
            stripe_transfer_id: payout.stripe_transfer_id || null,
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        ok: true,
        alreadyCompleted: true,
        payout_id,
        stripe_payment_intent_id: payout.stripe_payment_intent_id,
        stripe_transfer_id: payout.stripe_transfer_id,
      });
    }

    const amount = Number(payout.amount);
    if (!amount || isNaN(amount)) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }

    const feeBreakdown = calculateChargeOnTopFee(amount);
    const payoutAmountInCents = toStripeAmount(amount);
    const grossChargeAmountInCents = toStripeAmount(feeBreakdown.grossAmount);
    if (payoutAmountInCents < 50) {
      return NextResponse.json(
        {
          error: "amount_below_minimum",
          message: "Payout amount must be at least $0.50 AUD",
        },
        { status: 400 },
      );
    }

    let businessQuery = supabase
      .from("business_profiles")
      .select("id, stripe_customer_id")
      .limit(1);

    businessQuery = payout.business_id
      ? businessQuery.eq("id", payout.business_id)
      : businessQuery.eq("business_email", payout.business_email);

    const { data: business, error: bizErr } = await businessQuery.maybeSingle();

    if (bizErr || !business) {
      console.error("[RUN_PAYOUT] business_not_found", bizErr);
      return NextResponse.json({ error: "business_not_found" }, { status: 400 });
    }

    let affiliateQuery = supabase
      .from("affiliate_profiles")
      .select("user_id, stripe_account_id")
      .limit(1);

    affiliateQuery = payout.affiliate_user_id
      ? affiliateQuery.eq("user_id", payout.affiliate_user_id)
      : affiliateQuery.eq("email", payout.affiliate_email);

    const { data: affiliate, error: affErr } = await affiliateQuery.maybeSingle();

    if (affErr || !affiliate) {
      console.error("[RUN_PAYOUT] affiliate_not_found", affErr);
      return NextResponse.json({ error: "affiliate_not_found" }, { status: 400 });
    }

    const customerId = business.stripe_customer_id;
    const affiliateAccountId = affiliate.stripe_account_id;

    if (!customerId) {
      return NextResponse.json({ error: "missing_business_customer_id" }, { status: 400 });
    }

    if (!affiliateAccountId) {
      return NextResponse.json({ error: "missing_affiliate_stripe_account" }, { status: 400 });
    }

    const transferReadiness = await getTransferReadiness(affiliateAccountId);
    if (!transferReadiness.ok) {
      await tryWriteMoneyFlowAudit(supabase as never, {
        eventType: "wallet_payout_execution_blocked",
        severity: "warning",
        sourceRoute: "app/api/run-payout/route.ts",
        entityType: "wallet_payout",
        entityId: payout.id,
        payoutId: payout.id,
        businessEmail: payout.business_email,
        affiliateEmail: payout.affiliate_email,
        businessId: payout.business_id,
        affiliateUserId: payout.affiliate_user_id,
        offerId: payout.offer_id,
        reasonCode: "AFFILIATE_TRANSFER_NOT_READY",
        message: "Affiliate Stripe account is not ready to receive payout transfers.",
        metadata: { transferReadiness },
      });
      return NextResponse.json(
        {
          error: "affiliate_transfer_not_ready",
          message:
            "Affiliate Stripe account is not ready to receive transfers. Ask affiliate to reconnect/complete Stripe onboarding.",
          reconnectPath: "/affiliate/wallet",
          transferReadiness,
        },
        { status: 400 },
      );
    }

    const pmList = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    if (!pmList.data.length) {
      return NextResponse.json(
        {
          error: "no_payment_method_on_customer",
          message:
            "Customer has no saved payment method. Add a card before running payouts.",
        },
        { status: 400 },
      );
    }

    const paymentMethodId = pmList.data[0].id;
    const paymentIntentIdempotencyKey = buildPaymentIntentIdempotencyKey(payout.id);
    const transferIdempotencyKey = buildTransferIdempotencyKey(payout.id);

    let paymentIntent: Stripe.PaymentIntent;
    if (payout.stripe_payment_intent_id) {
      paymentIntent = await stripe.paymentIntents.retrieve(payout.stripe_payment_intent_id);
    } else {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: grossChargeAmountInCents,
          currency: "aud",
          customer: customerId,
          payment_method: paymentMethodId,
          confirm: true,
          off_session: true,
          metadata: buildNettmarkStripeMetadata("wallet_payout", {
            wallet_payout_id: payout.id,
            source_event_id: payout.source_event_id || "",
            cycle_number: payout.cycle_number || 1,
            business_email: payout.business_email,
            affiliate_email: payout.affiliate_email,
            offer_id: payout.offer_id,
            payout_principal_amount: amount,
            gross_charge_amount: feeBreakdown.grossAmount,
            nettmark_fee_amount: feeBreakdown.feeAmount,
            stripe_role: "nettmark_business_charge",
          }),
        },
        {
          idempotencyKey: paymentIntentIdempotencyKey,
        },
      );
    }

    if (paymentIntent.status !== "succeeded") {
      await markPayoutFailure({
        payoutId: payout.id,
        errorCode: "payment_not_succeeded",
        errorMessage: `Payment intent ${paymentIntent.id} ended in status ${paymentIntent.status}`,
        payout,
      });

      console.error(
        "[RUN_PAYOUT] payment_not_succeeded",
        paymentIntent.id,
        paymentIntent.status,
      );
      return NextResponse.json(
        {
          error: "payment_not_succeeded",
          status: paymentIntent.status,
          stripe_payment_intent_id: paymentIntent.id,
        },
        { status: 402 },
      );
    }

    const paymentIntentChargeDetails = await resolvePaymentIntentStripeFee(paymentIntent);
    const chargeId = paymentIntentChargeDetails.chargeId;

    const paymentBookkeepingError = await updatePayoutBookkeeping(payout.id, {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: chargeId,
      gross_charge_amount: feeBreakdown.grossAmount,
      nettmark_fee_amount: feeBreakdown.feeAmount,
      stripe_fee_amount: paymentIntentChargeDetails.stripeFeeAmount,
      payout_error_code: null,
      payout_error_message: null,
    });

    if (paymentBookkeepingError) {
      console.error(
        "[RUN_PAYOUT] Failed to persist payment intent bookkeeping",
        paymentBookkeepingError,
      );
    }

    try {
      await persistPayoutFeeLedger({
        payout,
        chargeId,
        paymentIntentId: paymentIntent.id,
        transferId: payout.stripe_transfer_id || null,
        payoutPrincipalAmount: amount,
        grossChargeAmount: feeBreakdown.grossAmount,
        nettmarkFeeAmount: feeBreakdown.feeAmount,
        stripeFeeAmount: paymentIntentChargeDetails.stripeFeeAmount,
        payoutState: "payment_succeeded_transfer_pending",
      });
    } catch (feeLedgerError: unknown) {
      console.error("[RUN_PAYOUT] Failed to persist payout fee ledger after payment success", feeLedgerError);
    }

    let transfer: Stripe.Transfer;
    try {
      if (payout.stripe_transfer_id) {
        transfer = await stripe.transfers.retrieve(payout.stripe_transfer_id);
      } else {
        transfer = await stripe.transfers.create(
          {
            amount: payoutAmountInCents,
            currency: "aud",
            destination: affiliateAccountId,
            metadata: buildNettmarkStripeMetadata("wallet_payout", {
              wallet_payout_id: payout.id,
              source_event_id: payout.source_event_id || "",
              cycle_number: payout.cycle_number || 1,
              business_email: payout.business_email,
              affiliate_email: payout.affiliate_email,
              offer_id: payout.offer_id,
              payout_principal_amount: amount,
              gross_charge_amount: feeBreakdown.grossAmount,
              nettmark_fee_amount: feeBreakdown.feeAmount,
              stripe_role: "nettmark_affiliate_payout",
            }),
            transfer_group: `wallet_payout:${payout.id}`,
          },
          {
            idempotencyKey: transferIdempotencyKey,
          },
        );
      }
    } catch (err: unknown) {
      const transferErrorMessage = getErrorMessage(err);

      try {
        await persistPayoutFeeLedger({
          payout,
          chargeId,
          paymentIntentId: paymentIntent.id,
          transferId: null,
          payoutPrincipalAmount: amount,
          grossChargeAmount: feeBreakdown.grossAmount,
          nettmarkFeeAmount: feeBreakdown.feeAmount,
          stripeFeeAmount: paymentIntentChargeDetails.stripeFeeAmount,
          payoutState: "transfer_failed",
          errorMessage: transferErrorMessage,
        });
      } catch (feeLedgerError: unknown) {
        console.error("[RUN_PAYOUT] Failed to persist payout fee ledger after transfer failure", feeLedgerError);
      }

      await markPayoutFailure({
        payoutId: payout.id,
        errorCode: "transfer_failed",
        errorMessage: transferErrorMessage,
        payout,
      });

      return NextResponse.json(
        {
          error: "transfer_failed",
          message: transferErrorMessage,
          payout_id,
          stripe_payment_intent_id: paymentIntent.id,
          stripe_charge_id: chargeId,
          idempotency: {
            payment_intent_key: paymentIntentIdempotencyKey,
            transfer_key: transferIdempotencyKey,
          },
        },
        { status: 409 },
      );
    }

    const completedAt = new Date().toISOString();
    const { error: completionUpdateErr } = await supabase
      .from("wallet_payouts")
      .update({
        status: "completed",
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: chargeId,
        stripe_transfer_id: transfer.id,
        gross_charge_amount: feeBreakdown.grossAmount,
        nettmark_fee_amount: feeBreakdown.feeAmount,
        stripe_fee_amount: paymentIntentChargeDetails.stripeFeeAmount,
        payout_completed_at: completedAt,
        payout_error_code: null,
        payout_error_message: null,
      })
      .eq("id", payout.id);

    if (completionUpdateErr) {
      await tryWriteMoneyFlowAudit(supabase as never, {
        eventType: "wallet_payout_execution_repair_required",
        severity: "warning",
        sourceRoute: "app/api/run-payout/route.ts",
        entityType: "wallet_payout",
        entityId: payout.id,
        payoutId: payout.id,
        businessEmail: payout.business_email,
        affiliateEmail: payout.affiliate_email,
        businessId: payout.business_id,
        affiliateUserId: payout.affiliate_user_id,
        offerId: payout.offer_id,
        reasonCode: "BOOKKEEPING_REPAIR_REQUIRED",
        message: "Stripe money movement succeeded but wallet payout bookkeeping needs repair.",
        metadata: {
          stripe_payment_intent_id: paymentIntent.id,
          stripe_charge_id: chargeId,
          stripe_transfer_id: transfer.id,
        },
      });
      console.error(
        "[RUN_PAYOUT] Failed to update wallet_payouts after transfer",
        completionUpdateErr,
      );
      return NextResponse.json(
        {
          ok: false,
          error: "bookkeeping_repair_required",
          repairable: true,
          payout_id,
          charged: feeBreakdown.grossAmount,
          payout_principal: amount,
          nettmark_fee_amount: feeBreakdown.feeAmount,
          stripe_payment_intent_id: paymentIntent.id,
          stripe_charge_id: chargeId,
          stripe_transfer_id: transfer.id,
          message:
            "Money moved successfully, but payout bookkeeping could not be fully persisted. Re-running this payout is safe and will repair the ledger using the same Stripe idempotency keys.",
        },
        { status: 202 },
      );
    }

    try {
      await persistPayoutFeeLedger({
        payout,
        chargeId,
        paymentIntentId: paymentIntent.id,
        transferId: transfer.id,
        payoutPrincipalAmount: amount,
        grossChargeAmount: feeBreakdown.grossAmount,
        nettmarkFeeAmount: feeBreakdown.feeAmount,
        stripeFeeAmount: paymentIntentChargeDetails.stripeFeeAmount,
        payoutState: "completed",
      });
    } catch (feeLedgerError: unknown) {
      console.error("[RUN_PAYOUT] Failed to persist payout fee ledger after completion", feeLedgerError);
    }

    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: "wallet_payout_executed",
      severity: "info",
      sourceRoute: "app/api/run-payout/route.ts",
      entityType: "wallet_payout",
      entityId: payout.id,
      payoutId: payout.id,
      businessEmail: payout.business_email,
      affiliateEmail: payout.affiliate_email,
      businessId: payout.business_id,
      affiliateUserId: payout.affiliate_user_id,
      offerId: payout.offer_id,
      reasonCode: "PAYOUT_COMPLETED",
      message: "Wallet payout executed successfully through Stripe.",
      metadata: {
        amount,
        gross_charge_amount: feeBreakdown.grossAmount,
        nettmark_fee_amount: feeBreakdown.feeAmount,
        stripe_fee_amount: paymentIntentChargeDetails.stripeFeeAmount,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: chargeId,
        stripe_transfer_id: transfer.id,
        payment_intent_key: paymentIntentIdempotencyKey,
        transfer_key: transferIdempotencyKey,
      },
    });

    return NextResponse.json({
      ok: true,
      payout_id,
      charged: feeBreakdown.grossAmount,
      payout_principal: amount,
      nettmark_fee_amount: feeBreakdown.feeAmount,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: chargeId,
      stripe_transfer_id: transfer.id,
      idempotency: {
        payment_intent_key: paymentIntentIdempotencyKey,
        transfer_key: transferIdempotencyKey,
      },
    });
  } catch (err: unknown) {
    await tryWriteMoneyFlowAudit(supabase as never, {
      eventType: "wallet_payout_execution_failed",
      severity: "error",
      sourceRoute: "app/api/run-payout/route.ts",
      reasonCode: "RUN_PAYOUT_UNHANDLED",
      message: getErrorMessage(err),
      metadata: {
        error: err instanceof Error ? err.stack || err.message : String(err),
      },
    });
    console.error("[RUN_PAYOUT_ERROR]", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: getErrorMessage(err),
      },
      { status: 500 },
    );
  }
}
