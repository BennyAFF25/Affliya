import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
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

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;

    console.log("[⚡️ Account Updated Event]", {
      id: account.id,
      payouts_enabled: account.payouts_enabled,
      charges_enabled: account.charges_enabled,
    });

    const { error } = await supabase
      .from("business_profiles")
      .update({
        stripe_onboarding_complete: account.charges_enabled && account.payouts_enabled,
        status: account.charges_enabled && account.payouts_enabled ? "active" : "pending_verification"
      })
      .eq("stripe_account_id", account.id);

    if (error) {
      console.error("[❌ Supabase Update Error]", error);
      return new NextResponse("Supabase update failed", { status: 500 });
    }

    console.log("[✅ Business profile updated successfully]");
  }

  return new NextResponse("Webhook processed", { status: 200 });
}

export const config = {
  api: {
    bodyParser: false
  }
};