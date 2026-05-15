export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createStripeClient } from "@/../utils/stripe";
import { syncAffiliateWalletCache } from "@/../utils/wallet/syncAffiliateWalletCache";

export const config = {
  api: {
    bodyParser: false,
  },
};

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
  console.error("[❌ Missing Stripe environment keys]");
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

let POST: (req: Request) => Promise<Response>;
if (!stripeSecretKey || !endpointSecret) {
  POST = async function POST() {
    return NextResponse.json(
      { error: "Missing Stripe environment keys" },
      { status: 500 },
    );
  };
} else {
  const stripe = createStripeClient(stripeSecretKey);

  (async () => {
    try {
      const acct = await stripe.accounts.retrieve();
      console.log(
        "[Stripe Webhook Account]",
        acct.id,
        acct.email ? acct.email : "(email not available)",
      );
    } catch (err: unknown) {
      console.error(
        "[❌ Stripe account retrieve error]",
        err instanceof Error ? err.message : err,
      );
    }
  })();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  async function creditWalletTopup(params: {
    email: string;
    checkoutSessionId: string;
    grossAmount: number;
    fees: number;
    netAmount: number;
    platformAcctId: string;
  }) {
    const {
      email,
      checkoutSessionId,
      grossAmount,
      fees,
      netAmount,
      platformAcctId,
    } = params;

    // Prefer DB-side atomic RPC when present. Fallback keeps patch compatible
    // before the migration is applied.
    const rpc = await supabase.rpc("credit_wallet_topup", {
      p_affiliate_email: email,
      p_checkout_session_id: checkoutSessionId,
      p_amount_gross: grossAmount,
      p_stripe_fees: fees,
      p_amount_net: netAmount,
      p_platform_acct_id: platformAcctId,
    });

    if (!rpc.error) {
      try {
        await syncAffiliateWalletCache(supabase as never, email);
      } catch (syncError: unknown) {
        console.error("[❌ wallet cache sync error after top-up RPC]", syncError);
      }

      console.log("[✅ credit_wallet_topup RPC applied]", rpc.data);
      return { credited: Boolean(rpc.data?.credited ?? true), mode: "rpc" };
    }

    if (rpc.error.code !== "PGRST202") {
      throw new Error(`credit_wallet_topup RPC failed: ${rpc.error.message}`);
    }

    console.warn("[⚠️ credit_wallet_topup RPC missing; using fallback path]");

    const { data: existingTopup, error: existingTopupError } = await supabase
      .from("wallet_topups")
      .select("id, stripe_id")
      .eq("stripe_id", checkoutSessionId)
      .maybeSingle();

    if (existingTopupError) {
      throw new Error(`topup idempotency check failed: ${existingTopupError.message}`);
    }

    if (existingTopup) {
      console.log("[ℹ️ Duplicate checkout session ignored]", checkoutSessionId);
      return { credited: false, mode: "fallback-duplicate" };
    }

    const { error: insertError } = await supabase.from("wallet_topups").insert({
      affiliate_email: email,
      amount_gross: grossAmount,
      stripe_fees: fees,
      amount_net: netAmount,
      stripe_id: checkoutSessionId,
      status: "succeeded",
      platform_acct_id: platformAcctId,
    });

    if (insertError) {
      throw new Error(`wallet_topups insert failed: ${insertError.message}`);
    }

    const { error: upsertError } = await supabase.from("wallets").upsert(
      {
        email,
        role: "affiliate",
        balance: Number(netAmount || 0),
        last_transaction_id: checkoutSessionId,
        last_transaction_status: "succeeded",
        last_topup_amount: grossAmount,
        last_fee_amount: fees,
        last_net_amount: netAmount,
      },
      { onConflict: "email" },
    );

    if (upsertError) {
      throw new Error(`wallet upsert failed: ${upsertError.message}`);
    }

    try {
      const snapshot = await syncAffiliateWalletCache(supabase as never, email);
      console.log("[✅ Wallet cache synced via fallback path]", {
        email,
        checkoutSessionId,
        availableBalance: snapshot.availableBalance,
      });
    } catch (syncError: unknown) {
      console.error("[❌ wallet cache sync error after top-up fallback]", syncError);
    }

    console.log("[✅ Wallet credited via fallback path]", {
      email,
      checkoutSessionId,
      netAmount,
    });

    return { credited: true, mode: "fallback" };
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function resolveBalanceTransactionDetails(paymentIntentId: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const pi = (await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      })) as Stripe.PaymentIntent;

      let latestCharge: Stripe.Charge | null = null;

      if (pi.latest_charge) {
        latestCharge =
          typeof pi.latest_charge === "string"
            ? await stripe.charges.retrieve(pi.latest_charge, {
                expand: ["balance_transaction"],
              })
            : (pi.latest_charge as Stripe.Charge);
      }

      if (!latestCharge) {
        const charges = await stripe.charges.list({
          payment_intent: paymentIntentId,
          limit: 1,
        });
        const fallbackChargeId = charges.data[0]?.id;
        if (fallbackChargeId) {
          latestCharge = await stripe.charges.retrieve(fallbackChargeId, {
            expand: ["balance_transaction"],
          });
        }
      }

      const balanceTransaction = latestCharge?.balance_transaction;
      if (latestCharge && balanceTransaction) {
        const balanceTxId =
          typeof balanceTransaction === "string"
            ? balanceTransaction
            : balanceTransaction.id;
        const balanceTx =
          typeof balanceTransaction === "string"
            ? await stripe.balanceTransactions.retrieve(balanceTxId)
            : balanceTransaction;

        return {
          paymentIntent: pi,
          latestCharge,
          balanceTx,
          attempt,
        };
      }

      console.warn(
        `[⚠️ Top-up balance transaction not ready] attempt=${attempt}`,
        paymentIntentId,
      );

      if (attempt < 3) {
        await sleep(750 * attempt);
      }
    }

    return null;
  }

  POST = async function POST(req: Request) {
    const buf = await req.arrayBuffer();
    const rawBody = Buffer.from(buf);
    const sig = req.headers.get("stripe-signature")!;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Webhook signature error";
      console.error("[❌ Webhook signature error]", message);
      return NextResponse.json(
        { error: `Webhook Error: ${message}` },
        { status: 400 },
      );
    }

    console.log("[🔔 Webhook event]", event.type);
    let platformAcctId = "unknown";
    try {
      const platformAccount = await stripe.accounts.retrieve();
      platformAcctId = platformAccount.id;
    } catch (err: unknown) {
      console.error(
        "[❌ Stripe platform account retrieve error]",
        err instanceof Error ? err.message : err,
      );
    }

    try {
      switch (event.type) {
        case "account.updated": {
          const account = event.data.object as Stripe.Account;

          const isComplete =
            account.details_submitted === true &&
            account.charges_enabled === true &&
            account.payouts_enabled === true;

          console.log("[✅ account.updated]", {
            accountId: account.id,
            isComplete,
          });

          if (isComplete) {
            const { error } = await supabase
              .from("affiliate_profiles")
              .update({
                stripe_account_id: account.id,
                stripe_onboarding_complete: true,
              })
              .eq("stripe_account_id", account.id);

            if (error) {
              console.error("[❌ affiliate_profiles update failed]", error);
            } else {
              console.log("[✅ affiliate_profiles onboarding marked complete]");
            }
          }

          break;
        }

        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          const sessionAction = session.metadata?.nettmark_action || session.metadata?.purpose;

          if (sessionAction !== "wallet_topup") {
            console.log("[ℹ️ checkout.session.completed ignored: non-topup session]", session.id);
            break;
          }

          const paymentIntentId = session.payment_intent as string | null;
          if (!paymentIntentId) {
            console.warn("[⚠️ checkout.session.completed missing payment_intent]", session.id);
            break;
          }

          const email =
            session.customer_email ||
            (session.metadata?.email as string | undefined) ||
            "";

          if (!email) {
            console.warn("[⚠️ checkout.session.completed missing email]", session.id);
            break;
          }

          const paymentDetails = await resolveBalanceTransactionDetails(paymentIntentId);

          if (!paymentDetails) {
            console.warn(
              "[⚠️ checkout.session.completed missing latest_charge/balance_transaction after retries]",
              session.id,
            );
            break;
          }

          const { balanceTx } = paymentDetails;

          const grossAmount = +(balanceTx.amount / 100).toFixed(2);
          const fees = +(balanceTx.fee / 100).toFixed(2);
          const netAmount = +(balanceTx.net / 100).toFixed(2);

          console.log("[✅ Stripe Top-up Details (session source of truth)]", {
            email,
            checkoutSessionId: session.id,
            paymentIntentId,
            grossAmount,
            fees,
            netAmount,
            platformAcctId,
          });

          await creditWalletTopup({
            email,
            checkoutSessionId: session.id,
            grossAmount,
            fees,
            netAmount,
            platformAcctId,
          });

          break;
        }

        case "charge.succeeded":
        case "charge.updated":
        case "payment_intent.succeeded": {
          console.log(`[ℹ️ ${event.type} received; no wallet mutation allowed for top-ups]`);
          break;
        }

        default:
          console.log(`[ℹ️ Unhandled event type]: ${event.type}`);
          console.log("[platform acct]", platformAcctId);
      }
    } catch (err: unknown) {
      console.error(
        "[❌ Webhook handler error]",
        err instanceof Error ? err.message : err,
      );
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  };
}

export { POST };
