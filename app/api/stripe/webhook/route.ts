// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

// Debug log to confirm which Stripe account is active
stripe.accounts.retrieve().then((acct) => {
  console.log("[Stripe Webhook Account]", acct.id, acct.email);
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const buf = await req.arrayBuffer();
  const rawBody = Buffer.from(buf);
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    console.error("[❌ Webhook signature error]", err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log('[🔔 Webhook event]', event.type);
  const platformAccount = await stripe.accounts.retrieve();
  const platformAcctId = platformAccount.id;

  switch (event.type) {
    case "checkout.session.completed": {
      console.log('[✅ Handling checkout.session.completed]');
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId = session.payment_intent as string | null;

      if (!paymentIntentId) {
        console.warn('[⚠️ checkout.session.completed: No payment_intent on session]', session.id);
        break;
      }

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['charges'] });
      const charge = (pi.charges?.data?.[0]) as Stripe.Charge | undefined;

      if (!charge || !charge.balance_transaction) {
        console.warn('[⚠️ checkout.session.completed: No charge/balance_transaction yet]', paymentIntentId);
        break;
      }

      const balanceTx = await stripe.balanceTransactions.retrieve(charge.balance_transaction as string);

      const gross_amount = +(balanceTx.amount / 100).toFixed(2);
      const fees = +(balanceTx.fee / 100).toFixed(2);
      const net_amount = +(balanceTx.net / 100).toFixed(2);
      const email = charge.billing_details?.email ?? "unknown@example.com";

      console.log("[✅ Stripe Top-up Details (from session)]", { email, gross_amount, fees, net_amount });

      const { error } = await supabase.from("wallet_topups").insert({
        affiliate_email: email,
        amount_gross: gross_amount,
        stripe_fees: fees,
        amount_net: net_amount,
        stripe_id: paymentIntentId,
        status: "succeeded",
        platform_acct_id: platformAcctId,
      });

      if (error) {
        console.error("[❌ Supabase Insert Error]", error);
      } else {
        console.log("[✅ Wallet Top-up Recorded (from session)]");
      }

      break;
    }
    case "charge.succeeded":
    case "charge.updated": {
      console.log(`[✅ Handling ${event.type} event]`);

      const charge = event.data.object as Stripe.Charge;
      const balanceTxId = charge.balance_transaction as string | null;

      if (!balanceTxId) {
        console.warn(`[⚠️ ${event.type}: No balance_transaction yet]`, charge.id);
        break;
      }

      const balanceTx = await stripe.balanceTransactions.retrieve(balanceTxId);

      const gross_amount = +(balanceTx.amount / 100).toFixed(2);
      const fees = +(balanceTx.fee / 100).toFixed(2);
      const net_amount = +(balanceTx.net / 100).toFixed(2);
      const email = charge.billing_details?.email ?? "unknown@example.com";

      console.log("[✅ Stripe Top-up Details]", {
        email,
        gross_amount,
        fees,
        net_amount,
      });

      const { error } = await supabase.from("wallet_topups").insert({
        affiliate_email: email,
        amount_gross: gross_amount,
        stripe_fees: fees,
        amount_net: net_amount,
        stripe_id: charge.payment_intent,
        status: "succeeded",
        platform_acct_id: platformAcctId, // track origin account id
      });

      if (error) {
        console.error("[❌ Supabase Insert Error]", error);
      } else {
        console.log("[✅ Wallet Top-up Recorded]");
      }

      break;
    }

    default:
      console.log(`[ℹ️ Unhandled event type]: ${event.type}`);
      console.log('[platform acct]', platformAcctId);
  }

  return NextResponse.json({ received: true });
}