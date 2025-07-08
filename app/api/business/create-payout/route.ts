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
    const {
      affiliate_email,
      business_email,
      offer_id,
      amount,
      currency
    } = await req.json();

    if (!affiliate_email || !business_email || !offer_id || !amount) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Get business Stripe account
    const { data: biz, error: bizError } = await supabase
      .from("business_profiles")
      .select("stripe_account_id")
      .eq("business_email", business_email)
      .single();

    if (bizError || !biz || !biz.stripe_account_id) {
      return NextResponse.json(
        { error: "Business Stripe account not found." },
        { status: 404 }
      );
    }

    // Create transfer
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // convert to cents
      currency: currency || "usd",
      destination: biz.stripe_account_id,
      description: `Payout for offer ${offer_id}`
    });

    // Log payout
    const { error: payoutError } = await supabase
      .from("wallet_payouts")
      .insert({
        affiliate_email,
        business_email,
        offer_id,
        amount,
        stripe_transfer_id: transfer.id,
        status: "succeeded"
      });

    if (payoutError) {
      console.error("[❌ Payout Insert Error]", payoutError);
      return NextResponse.json(
        { error: "Failed to log payout." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, transfer_id: transfer.id });
  } catch (err: any) {
    console.error("[❌ Payout Error]", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}