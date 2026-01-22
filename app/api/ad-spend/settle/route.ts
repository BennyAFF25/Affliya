// app/api/ad-spend/settle/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil" as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const liveAdId = body?.liveAdId as string | undefined;

    if (!liveAdId) {
      return NextResponse.json({ error: "Missing liveAdId" }, { status: 400 });
    }

    // 1) Load live_ads row
    const { data: liveAd, error: liveAdError } = await supabase
      .from("live_ads")
      .select("id, affiliate_email, business_email, offer_id, spend, spend_transferred")
      .eq("id", liveAdId)
      .single();

    if (liveAdError || !liveAd) {
      console.error("[❌ live_ads lookup error]", liveAdError);
      return NextResponse.json(
        { error: "Live ad not found", details: liveAdError },
        { status: 404 }
      );
    }

    const spend = Number(liveAd.spend ?? 0);
    const transferredBefore = Number((liveAd as any).spend_transferred ?? 0);
    const unpaidBefore = spend - transferredBefore;

    console.log("[🧮 Ad spend state]", {
      liveAdId,
      spend,
      transferredBefore,
      unpaidBefore,
    });

    if (unpaidBefore <= 0) {
      return NextResponse.json({
        success: true,
        liveAdId,
        spend,
        transferredBefore,
        transferredAfter: transferredBefore,
        unpaidBefore,
        unpaidAfter: 0,
        chargedAmount: 0,
        message: "No unpaid spend remaining for this ad.",
      });
    }

    const affiliateEmail = String(liveAd.affiliate_email || "");
    const businessEmail = String(liveAd.business_email || "");
    const offerId = (liveAd.offer_id as string | null) || null;

    if (!affiliateEmail || !businessEmail || !offerId) {
      return NextResponse.json(
        {
          error: "MISSING_REQUIRED_FIELDS_ON_LIVE_AD",
          details: { affiliateEmail, businessEmail, offerId },
        },
        { status: 400 }
      );
    }

    // 2) Wallet snapshot (sum topups - sum deductions)
    const { data: topupRows, error: topupError } = await supabase
      .from("wallet_topups")
      .select("amount_net")
      .eq("affiliate_email", affiliateEmail)
      .eq("status", "succeeded");

    if (topupError) {
      console.error("[❌ wallet_topups error]", topupError);
      return NextResponse.json(
        { error: "Failed to read wallet topups", details: topupError },
        { status: 500 }
      );
    }

    const totalTopups =
      (topupRows || []).reduce((sum, row: any) => sum + Number(row.amount_net || 0), 0) || 0;

    const { data: deductionRows, error: deductionError } = await supabase
      .from("wallet_deductions")
      .select("amount")
      .eq("affiliate_email", affiliateEmail);

    if (deductionError) {
      console.error("[❌ wallet_deductions error]", deductionError);
      return NextResponse.json(
        { error: "Failed to read wallet deductions", details: deductionError },
        { status: 500 }
      );
    }

    const totalDeductions =
      (deductionRows || []).reduce((sum, row: any) => sum + Number(row.amount || 0), 0) || 0;

    const availableBalanceBefore = totalTopups - totalDeductions;

    console.log("[👛 Wallet snapshot BEFORE]", {
      affiliateEmail,
      totalTopups,
      totalDeductions,
      availableBalanceBefore,
      unpaidBefore,
    });

    if (availableBalanceBefore <= 0 || availableBalanceBefore < unpaidBefore) {
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_WALLET_BALANCE",
          liveAdId,
          spend,
          transferredBefore,
          unpaidBefore,
          availableBalanceBefore,
          message:
            "Affiliate wallet cannot cover current unpaid spend. Campaign should be paused and topped up.",
        },
        { status: 400 }
      );
    }

    // 3) Claim settlement (optimistic lock) — IMPORTANT: NO .limit() ON UPDATE
    const chargedAmount = unpaidBefore;
    const transferredAfter = transferredBefore + chargedAmount;

    const { data: updatedRows, error: claimErr } = await supabase
      .from("live_ads")
      .update({ spend_transferred: transferredAfter })
      .eq("id", liveAdId)
      .eq("spend_transferred", transferredBefore)
      .select("id, spend, spend_transferred");

    if (claimErr) {
      console.error("[❌ live_ads claim update error]", claimErr);
      return NextResponse.json(
        { error: "Failed to claim settlement (live_ads update)", details: claimErr },
        { status: 500 }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Another request likely updated spend_transferred first (idempotent)
      const { data: latest, error: latestErr } = await supabase
        .from("live_ads")
        .select("spend, spend_transferred")
        .eq("id", liveAdId)
        .single();

      if (latestErr) {
        console.error("[❌ live_ads refetch error after claim miss]", latestErr);
      }

      const latestSpend = Number((latest as any)?.spend ?? spend);
      const latestTransferred = Number((latest as any)?.spend_transferred ?? transferredBefore);
      const latestUnpaid = Math.max(0, latestSpend - latestTransferred);

      return NextResponse.json({
        success: true,
        liveAdId,
        spend: latestSpend,
        transferredBefore,
        transferredAfter: latestTransferred,
        unpaidBefore,
        unpaidAfter: latestUnpaid,
        chargedAmount: 0,
        message: "Settlement already processed (idempotent).",
      });
    }

    // 4) Insert wallet deduction ledger row
    const { error: insertDeductionError } = await supabase
      .from("wallet_deductions")
      .insert({
        affiliate_email: affiliateEmail,
        business_email: businessEmail,
        offer_id: offerId,
        ad_id: liveAdId,
        amount: chargedAmount,
        description: "Meta ad spend settlement",
      });

    if (insertDeductionError) {
      console.error("[❌ wallet_deductions insert error]", insertDeductionError);

      // Best-effort rollback (put spend_transferred back)
      const { error: rollbackErr } = await supabase
        .from("live_ads")
        .update({ spend_transferred: transferredBefore })
        .eq("id", liveAdId)
        .eq("spend_transferred", transferredAfter);

      if (rollbackErr) {
        console.error("[❌ live_ads rollback error]", rollbackErr);
      }

      return NextResponse.json(
        { error: "Failed to insert wallet deduction", details: insertDeductionError },
        { status: 500 }
      );
    }

    // 5) Lookup business stripe_account_id
    const { data: businessProfile, error: businessErr } = await supabase
      .from("business_profiles")
      .select("stripe_account_id")
      .eq("business_email", businessEmail)
      .single();

    if (businessErr) {
      console.error("[❌ business_profiles lookup error]", businessErr);
    }

    const destinationAcct = businessProfile?.stripe_account_id as string | undefined;

    const unpaidAfter = Math.max(0, spend - transferredAfter);
    const availableBalanceAfter = availableBalanceBefore - chargedAmount;

    if (!destinationAcct) {
      return NextResponse.json({
        success: true,
        liveAdId,
        spend,
        transferredBefore,
        transferredAfter,
        unpaidBefore,
        unpaidAfter,
        chargedAmount,
        wallet: {
          totalTopups,
          totalDeductions: totalDeductions + chargedAmount,
          availableBalanceBefore,
          availableBalanceAfter,
        },
        stripeTransfer: null,
        note: "Wallet updated, but no Stripe transfer (no connected account).",
      });
    }

    // 6) Stripe transfer (platform -> business Connect)
    const transferAmountCents = Math.round(chargedAmount * 100);

    let transfer: Stripe.Transfer | null = null;
    let stripeTransferError: string | null = null;

    try {
      transfer = await stripe.transfers.create({
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
    } catch (e: any) {
      stripeTransferError = e?.message || "Stripe transfer failed";
      console.error("[❌ Stripe transfer failed]", e);
    }

    return NextResponse.json({
      success: true,
      liveAdId,
      spend,
      transferredBefore,
      transferredAfter,
      unpaidBefore,
      unpaidAfter,
      chargedAmount,
      wallet: {
        totalTopups,
        totalDeductions: totalDeductions + chargedAmount,
        availableBalanceBefore,
        availableBalanceAfter,
      },
      stripeTransfer: transfer
        ? {
            id: transfer.id,
            amount: transfer.amount / 100,
            currency: transfer.currency,
            destination: transfer.destination,
            created: transfer.created,
          }
        : null,
      stripeTransferError,
    });
  } catch (err: any) {
    console.error("[❌ Unhandled ad-spend/settle error]", err);
    return NextResponse.json(
      { error: "Internal error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}