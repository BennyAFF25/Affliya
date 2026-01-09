import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_APP_SECRET!);

export async function POST(req: Request) {
  const { email, role } = await req.json();

  if (!email || !role) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const PRICE_ID = process.env.PRICE_ID!;
  const BASE_URL = process.env.BASE_URL!;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      // REQUIRED so webhook can match before Supabase user exists
      customer_email: email,
      client_reference_id: email,

      metadata: {
        email,
        role, // "business" | "affiliate"
        source: "stripe-app",
      },

      subscription_data: {
        metadata: {
          email,
          role,
          source: "stripe-app",
        },
      },

      line_items: [
        { price: PRICE_ID, quantity: 1 },
      ],

      success_url: `${BASE_URL}/auth/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/pricing`,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}