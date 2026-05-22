import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { calculateWalletTopupCharge, toStripeAmount } from "@/../utils/feeAccounting";
import { buildNettmarkStripeMetadata, createStripeClient } from "@/../utils/stripe";

export const runtime = "nodejs";

const stripe = createStripeClient((process.env.STRIPE_SECRET_KEY || "").trim());

function getBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();
  const vercel = (process.env.VERCEL_URL || "").trim();
  const fromVercel = vercel ? `https://${vercel}` : "";
  const fallbackLocal = "http://localhost:3000";
  const base = explicit || fromVercel || fallbackLocal;

  try {
    new URL(base);
  } catch {
    throw new Error(
      `Invalid BASE URL. Got "${base}". Check NEXT_PUBLIC_BASE_URL / VERCEL_URL env vars (hidden whitespace/newlines cause this).`,
    );
  }

  return base;
}

function absUrl(pathname: string) {
  const base = getBaseUrl();
  return new URL(pathname, base).toString();
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const email = (body?.email || user.email).toString().trim();
    const currency = (body?.currency || "aud").toString().toLowerCase().trim();
    const amountRaw = body?.amount;
    const amountNumber = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);

    if (email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const { data: affiliateProfile, error: affiliateError } = await supabase
      .from("affiliate_profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("user_id", user.id)
      .maybeSingle();

    if (affiliateError) {
      console.error("[❌ affiliate billing gate lookup failed]", affiliateError.message);
      return NextResponse.json({ error: "Failed to verify billing status" }, { status: 500 });
    }

    const billingReady = !!affiliateProfile?.stripe_account_id && !!affiliateProfile?.stripe_onboarding_complete;
    if (!billingReady) {
      return NextResponse.json(
        { error: "Connect billing in Affiliate Settings before topping up your wallet." },
        { status: 403 },
      );
    }

    const feeBreakdown = calculateWalletTopupCharge(amountNumber);
    const unitAmount = toStripeAmount(feeBreakdown.totalChargeAmount);
    const successUrl = absUrl(`/affiliate/wallet?topup=success`);
    const cancelUrl = absUrl(`/affiliate/wallet?topup=cancel`);

    console.log("[stripe/create-topup-session]", {
      baseUrl: getBaseUrl(),
      successUrl,
      cancelUrl,
      email,
      currency,
      principalAmount: feeBreakdown.principalAmount,
      nettmarkFeeAmount: feeBreakdown.feeAmount,
      estimatedStripeFeeAmount: feeBreakdown.estimatedStripeFeeAmount,
      grossChargeAmount: feeBreakdown.totalChargeAmount,
      netBeforeStripeAmount: feeBreakdown.passthroughBaseAmount,
      feeBps: feeBreakdown.feeBps,
      stripeFeeBps: feeBreakdown.stripeFeeBps,
      stripeFixedFeeAmount: feeBreakdown.stripeFixedFeeAmount,
      unitAmount,
      mode: process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live" : "test",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: "Nettmark Wallet Top-Up" },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: buildNettmarkStripeMetadata("wallet_topup", {
        affiliate_email: email,
        purpose: "wallet_topup",
        currency,
        topup_amount: feeBreakdown.principalAmount,
        gross_charge_amount: feeBreakdown.totalChargeAmount,
        stripe_fee_passthrough_amount: feeBreakdown.estimatedStripeFeeAmount,
        nettmark_fee_amount: feeBreakdown.feeAmount,
        fee_bps: feeBreakdown.feeBps,
      }),
      payment_intent_data: {
        metadata: buildNettmarkStripeMetadata("wallet_topup", {
          affiliate_email: email,
          purpose: "wallet_topup",
          currency,
          topup_amount: feeBreakdown.principalAmount,
          gross_charge_amount: feeBreakdown.totalChargeAmount,
          stripe_fee_passthrough_amount: feeBreakdown.estimatedStripeFeeAmount,
          nettmark_fee_amount: feeBreakdown.feeAmount,
          fee_bps: feeBreakdown.feeBps,
        }),
      },
    });

    return NextResponse.json(
      {
        url: session.url,
        sessionId: session.id,
        principalAmount: feeBreakdown.principalAmount,
        nettmarkFeeAmount: feeBreakdown.feeAmount,
        estimatedStripeFeeAmount: feeBreakdown.estimatedStripeFeeAmount,
        grossChargeAmount: feeBreakdown.totalChargeAmount,
        feeBps: feeBreakdown.feeBps,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create topup session failed";
    const stack = err instanceof Error ? err.stack : undefined;

    console.error("[❌ create-topup-session]", {
      message,
      stack,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
