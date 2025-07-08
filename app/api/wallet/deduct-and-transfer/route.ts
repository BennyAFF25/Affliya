import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { affiliateEmail, businessStripeAccountId, amount } = await req.json();

    if (!affiliateEmail || !businessStripeAccountId || !amount) {
      return NextResponse.json(
        { error: "Missing parameters." },
        { status: 400 }
      );
    }

    // Sum the amount_net from wallet_topups
    const { data, error } = await supabase
      .from("wallet_topups")
      .select("amount_net")
      .eq("affiliate_email", affiliateEmail);

    if (error) {
      console.error("[❌ Supabase Fetch Error]", error);
      return NextResponse.json(
        { error: "Failed to fetch wallet topups." },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No wallet topups found." },
        { status: 404 }
      );
    }

    const totalBalance = data.reduce(
      (sum, t) => sum + (Number(t.amount_net) || 0),
      0
    );

    if (totalBalance < amount) {
      return NextResponse.json(
        { error: "Insufficient wallet balance." },
        { status: 400 }
      );
    }

    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      destination: businessStripeAccountId,
      description: `Affiliate payout for ${affiliateEmail}`,
    });

    return NextResponse.json({
      success: true,
      transfer,
    });
  } catch (err) {
    console.error("[❌ Deduct and Transfer Error]", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}