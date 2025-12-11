// app/api/ad-spend/settle/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // match your other Stripe usage (webhook/create-topup-session)
  apiVersion: "2025-08-27.basil" as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const liveAdId = body.liveAdId as string | undefined;

    if (!liveAdId) {
      return NextResponse.json(
        { error: "Missing liveAdId" },
        { status: 400 }
      );
    }

    // 1) Load the live ad row
    const { data: liveAd, error: liveAdError } = await supabase
      .from("live_ads")
      .select(
        `
        id,
        affiliate_email,
        business_email,
        offer_id,
        spend,
        spend_transferred
      `
      )
      .eq("id", liveAdId)
      .single();

    if (liveAdError || !liveAd) {
      console.error("[❌ live_ads lookup error]", liveAdError);
      return NextResponse.json(
        { error: "Live ad not found" },
        { status: 404 }
      );
    }

    const spend = Number(liveAd.spend || 0);
    const alreadyTransferred = Number(liveAd.spend_transferred || 0);
    const unpaidSpendBefore = spend - alreadyTransferred;

    console.log("[🧮 Ad spend state]", {
      liveAdId,
      spend,
      alreadyTransferred,
      unpaidSpendBefore,
    });

    if (unpaidSpendBefore <= 0) {
      return NextResponse.json({
        success: true,
        liveAdId,
        message: "No unpaid spend remaining for this ad.",
        amountCharged: 0,
      });
    }

    // 2) Wallet view for the affiliate
    const affiliateEmail = liveAd.affiliate_email as string;
    const businessEmail = liveAd.business_email as string;
    const offerId = liveAd.offer_id as string | null;

    const { data: topupRows, error: topupError } = await supabase
      .from("wallet_topups")
      .select("amount_net")
      .eq("affiliate_email", affiliateEmail)
      .eq("status", "succeeded");

    if (topupError) {
      console.error("[❌ wallet_topups error]", topupError);
      return NextResponse.json(
        { error: "Failed to read wallet topups" },
        { status: 500 }
      );
    }

    const totalTopups =
      (topupRows || []).reduce(
        (sum, row) => sum + Number(row.amount_net || 0),
        0
      ) || 0;

    const { data: deductionRows, error: deductionError } = await supabase
      .from("wallet_deductions")
      .select("amount")
      .eq("affiliate_email", affiliateEmail);

    if (deductionError) {
      console.error("[❌ wallet_deductions error]", deductionError);
      return NextResponse.json(
        { error: "Failed to read wallet deductions" },
        { status: 500 }
      );
    }

    const totalDeductions =
      (deductionRows || []).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
      ) || 0;

    const availableBalanceBefore = totalTopups - totalDeductions;

    console.log("[👛 Wallet snapshot BEFORE]", {
      affiliateEmail,
      totalTopups,
      totalDeductions,
      availableBalanceBefore,
      unpaidSpendBefore,
    });

    if (availableBalanceBefore <= 0 || availableBalanceBefore < unpaidSpendBefore) {
      // For now we just bail if there isn't enough to cover the full unpaid spend
      // (you can change this to partial charging if you want later)
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_WALLET_BALANCE",
          liveAdId,
          unpaidSpendBefore,
          availableBalanceBefore,
        },
        { status: 400 }
      );
    }

    // 3) Record the wallet deduction for this ad
    const { error: insertDeductionError } = await supabase
      .from("wallet_deductions")
      .insert({
        affiliate_email: affiliateEmail,
        business_email: businessEmail,
        offer_id: offerId,
        ad_id: liveAdId,
        amount: unpaidSpendBefore,
        description: "Meta ad spend debit",
      });

    if (insertDeductionError) {
      console.error("[❌ wallet_deductions insert error]", insertDeductionError);
      return NextResponse.json(
        { error: "Failed to insert wallet deduction" },
        { status: 500 }
      );
    }

    // 4) Update live_ads.spend_transferred
    const newSpendTransferred = alreadyTransferred + unpaidSpendBefore;

    const { error: updateAdError } = await supabase
      .from("live_ads")
      .update({ spend_transferred: newSpendTransferred })
      .eq("id", liveAdId);

    if (updateAdError) {
      console.error("[❌ live_ads update error]", updateAdError);
      return NextResponse.json(
        { error: "Failed to update live ad spend_transferred" },
        { status: 500 }
      );
    }

    // 5) Look up the business's connected Stripe account
    //    🔴 IMPORTANT: adjust table/column names if yours differ.
    const { data: businessProfile, error: businessError } = await supabase
      .from("business_profiles")
      .select("stripe_account_id")
      .eq("business_email", businessEmail)
      .single();

    if (businessError) {
      console.error("[❌ business_profiles lookup error]", businessError);
    }

    const destinationAcct = businessProfile?.stripe_account_id as string | undefined;

    if (!destinationAcct) {
      console.warn(
        "[⚠️ No connected Stripe account for business]",
        businessEmail
      );
      // We still return success for the ledger, but note that no Stripe transfer happened.
      return NextResponse.json({
        success: true,
        liveAdId,
        amountCharged: unpaidSpendBefore,
        unpaidSpendBefore,
        newSpendTransferred,
        wallet: {
          totalTopups,
          totalDeductions: totalDeductions + unpaidSpendBefore,
          availableBalanceAfter:
            availableBalanceBefore - unpaidSpendBefore,
        },
        stripeTransfer: null,
        note: "Wallet updated, but no Stripe transfer (no connected account).",
      });
    }

    // 6) Create the transfer from platform → business connected account
    const transferAmountCents = Math.round(unpaidSpendBefore * 100);

    console.log("[🚀 Creating Stripe transfer]", {
      amount: transferAmountCents,
      destinationAcct,
      affiliateEmail,
      businessEmail,
      liveAdId,
      offerId,
    });

    const transfer = await stripe.transfers.create({
      amount: transferAmountCents,
      currency: "aud",
      destination: destinationAcct,
      metadata: {
        nettmark_role: "ad_spend_settlement",
        live_ad_id: liveAdId,
        affiliate_email: affiliateEmail,
        business_email: businessEmail,
        offer_id: offerId || "",
      },
    });

    console.log("[✅ Stripe transfer created]", {
      transferId: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination,
    });

    const availableBalanceAfter =
      availableBalanceBefore - unpaidSpendBefore;

    return NextResponse.json({
      success: true,
      liveAdId,
      amountCharged: unpaidSpendBefore,
      unpaidSpendBefore,
      newSpendTransferred,
      wallet: {
        totalTopups,
        totalDeductions: totalDeductions + unpaidSpendBefore,
        availableBalanceAfter,
      },
      stripeTransfer: {
        id: transfer.id,
        amount: transfer.amount / 100,
        currency: transfer.currency,
        destination: transfer.destination,
        created: transfer.created,
      },
    });
  } catch (err: any) {
    console.error("[❌ Unhandled ad-spend/settle error]", err);
    return NextResponse.json(
      { error: "Internal error", details: err?.message },
      { status: 500 }
    );
  }
}