import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } }; // not necessary in Next 15 app router but fine

// Use the App Revenue account secret for subscriptions webhook verification
const stripeApp = new Stripe(process.env.STRIPE_APP_SECRET as string);

// Admin client (service role) for server-side updates from webhooks
// NEVER expose this key client-side.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

async function buffer(req: Request) {
  const arr = await req.arrayBuffer();
  return Buffer.from(arr);
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const buf = await buffer(req);

  let event;
  try {
    event = stripeApp.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_APP_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const supabase = supabaseAdmin;

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const sub = event.data.object as any;
    const status: string = sub.status; // trialing | active | past_due | canceled | unpaid
    const customerId: string = sub.customer;

    await supabase
      .from("profiles")
      .update({ subscription_status: status })
      .eq("stripe_customer_id", customerId);
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as any;
    await supabase
      .from("profiles")
      .update({ subscription_status: "canceled" })
      .eq("stripe_customer_id", sub.customer);
  }

  return NextResponse.json({ received: true });
}