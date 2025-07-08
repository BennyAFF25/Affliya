
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log(`[✅ Stripe Webhook Event Received]: ${event.type}`);
  } catch (err: any) {
    console.error("[❌ Stripe Webhook Signature Error]", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "payout.paid") {
    const payout = event.data.object as Stripe.Payout;

    console.log("[⚡️ Payout Paid Event]", {
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      arrival_date: payout.arrival_date
    });

    const { error } = await supabase
      .from("business_payouts")
      .insert({
        stripe_payout_id: payout.id,
        amount: payout.amount / 100,
        currency: payout.currency,
        arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
        status: payout.status
      });

    if (error) {
      console.error("[❌ Supabase Insert Error]", error);
      return new NextResponse("Supabase insert failed", { status: 500 });
    }

    console.log("[✅ Payout recorded in Supabase]");
  }

  return new NextResponse("Webhook processed", { status: 200 });
}

export const config = {
  api: {
    bodyParser: false
  }
};