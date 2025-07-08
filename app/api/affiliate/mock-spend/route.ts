import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      spend_amount,
      currency
    } = await req.json();

    if (!affiliate_email || !business_email || !offer_id || !spend_amount) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Get current balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("email", affiliate_email)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: "Wallet not found." },
        { status: 404 }
      );
    }

    if (wallet.balance < spend_amount) {
      return NextResponse.json(
        { error: "Insufficient balance." },
        { status: 400 }
      );
    }

    // Deduct balance
    const { error: updateError } = await supabase
      .from("wallets")
      .update({
        balance: wallet.balance - spend_amount
      })
      .eq("email", affiliate_email);

    if (updateError) {
      console.error("[❌ Balance Update Error]", updateError);
      return NextResponse.json(
        { error: "Failed to update balance." },
        { status: 500 }
      );
    }

    // Log deduction
    const { error: insertError } = await supabase
      .from("wallet_deductions")
      .insert({
        affiliate_email,
        business_email,
        offer_id,
        amount: spend_amount,
        description: "Mock ad spend deduction"
      });

    if (insertError) {
      console.error("[❌ Deduction Insert Error]", insertError);
      return NextResponse.json(
        { error: "Failed to log deduction." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[❌ Mock Spend Error]", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}