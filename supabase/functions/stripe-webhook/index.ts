// Enable Deno type definitions
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import Stripe SDK
import Stripe from "npm:stripe@13";

// Initialize Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

// Serve the function
Deno.serve(async (req) => {
  // Stripe requires the raw body
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("Received Stripe event:", event.type);

  // Get Supabase client
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Handle specific events
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Example: Insert a record of the completed checkout
    const { error } = await supabaseClient
      .from("wallet_topups")
      .insert({
        stripe_session_id: session.id,
        customer_email: session.customer_email,
        amount: session.amount_total,
        currency: session.currency,
        status: "succeeded",
      });

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response("Error inserting into Supabase", { status: 500 });
    }

    console.log("Inserted top-up record successfully");
  }

  // Return a 200 so Stripe knows we received it
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});