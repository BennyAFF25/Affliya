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
  apiVersion: "2025-05-28.basil",
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

  switch (event.type) {
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
  }

  return NextResponse.json({ received: true });
}