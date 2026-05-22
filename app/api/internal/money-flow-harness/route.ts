import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { calculateWalletTopupCharge, recordPlatformFeeLedger, toStripeAmount } from "@/../utils/feeAccounting";
import { createStripeClient, getPlatformBalanceSnapshot } from "@/../utils/stripe";
import { getWalletBalanceSnapshot } from "@/../utils/wallet/balance";
import { getRefundLockState } from "@/../utils/wallet/refundLock";
import { syncAffiliateWalletCache } from "@/../utils/wallet/syncAffiliateWalletCache";

export const runtime = "nodejs";

type Json = Record<string, unknown>;

type HarnessAction =
  | "state"
  | "simulate_topup"
  | "ensure_affiliate_approval"
  | "create_live_ad"
  | "add_live_ad_spend"
  | "settle_ad_spend"
  | "stripe_balance_state"
  | "process_ad_spend_transfers"
  | "sync_active_ads"
  | "trigger_conversion"
  | "run_payout"
  | "run_refund";

const AFFILIATE_EMAIL = "affiliate@testuser.com";
const BUSINESS_EMAIL = "biz@testuser.com";
const HARNESS_SOURCE = "money-flow-harness";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY || "");

function isHarnessEnabled() {
  if (process.env.ENABLE_MONEY_FLOW_HARNESS === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function badRequest(error: string, details?: unknown, status = 400) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

function ok(data: Json = {}) {
  return NextResponse.json({ ok: true, ...data });
}

function toAmount(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n * 100) / 100;
}

async function getBusinessProfile() {
  const { data, error } = await supabase
    .from("business_profiles")
    .select("id, business_email, stripe_customer_id, stripe_account_id, stripe_onboarding_complete")
    .eq("business_email", BUSINESS_EMAIL)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`business profile missing: ${error?.message || BUSINESS_EMAIL}`);
  }

  return data;
}

async function getAffiliateProfile() {
  const { data, error } = await supabase
    .from("affiliate_profiles")
    .select("user_id, email, stripe_account_id, stripe_onboarding_complete")
    .eq("email", AFFILIATE_EMAIL)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`affiliate profile missing: ${error?.message || AFFILIATE_EMAIL}`);
  }

  return data;
}

async function getDefaultOffer() {
  const { data, error } = await supabase
    .from("offers")
    .select("id, title, business_email, commission, commission_value, currency, price, type, payout_mode, payout_interval, payout_cycles, created_at")
    .eq("business_email", BUSINESS_EMAIL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`default offer missing: ${error?.message || BUSINESS_EMAIL}`);
  }

  return data;
}

async function ensureAffiliateApproval(offerId: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("affiliate_requests")
    .select("id, status")
    .eq("offer_id", offerId)
    .eq("affiliate_email", AFFILIATE_EMAIL)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`affiliate approval lookup failed: ${lookupError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("affiliate_requests")
      .update({
        status: "approved",
        business_email: BUSINESS_EMAIL,
        notes: "approved by money-flow harness",
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`affiliate approval update failed: ${updateError.message}`);
    }

    return { id: existing.id, status: "approved", reused: true };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("affiliate_requests")
    .insert({
      offer_id: offerId,
      affiliate_email: AFFILIATE_EMAIL,
      business_email: BUSINESS_EMAIL,
      status: "approved",
      notes: "created by money-flow harness",
    })
    .select("id, status")
    .limit(1)
    .maybeSingle();

  if (insertError || !inserted) {
    throw new Error(`affiliate approval insert failed: ${insertError?.message || "unknown"}`);
  }

  return { ...inserted, reused: false };
}

async function fetchHarnessState() {
  const [business, affiliate, offer] = await Promise.all([
    getBusinessProfile(),
    getAffiliateProfile(),
    getDefaultOffer(),
  ]);

  const [walletSnapshot, refundLock, walletRow, topups, payouts, deductions, liveAds, settlements, audit, approvals, stripeBalance, platformFees] = await Promise.all([
    getWalletBalanceSnapshot(supabase as never, AFFILIATE_EMAIL),
    getRefundLockState(supabase as never, AFFILIATE_EMAIL),
    supabase
      .from("wallets")
      .select("email, role, balance, last_transaction_id, last_transaction_status, last_topup_amount, last_fee_amount, last_net_amount")
      .eq("email", AFFILIATE_EMAIL)
      .maybeSingle(),
    supabase
      .from("wallet_topups")
      .select("id, stripe_id, amount_gross, stripe_fees, amount_net, credited_amount, nettmark_fee_amount, amount_refunded, status, created_at")
      .eq("affiliate_email", AFFILIATE_EMAIL)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("wallet_payouts")
      .select("id, amount, gross_charge_amount, nettmark_fee_amount, stripe_fee_amount, status, offer_id, source_event_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, payout_error_code, payout_error_message, created_at")
      .or(`business_email.eq.${BUSINESS_EMAIL},affiliate_email.eq.${AFFILIATE_EMAIL}`)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("wallet_deductions")
      .select("id, ad_id, amount, description, settlement_key, created_at")
      .or(`business_email.eq.${BUSINESS_EMAIL},affiliate_email.eq.${AFFILIATE_EMAIL}`)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("live_ads")
      .select("id, offer_id, spend, spend_transferred, status, billing_state, meta_ad_id, created_at")
      .or(`business_email.eq.${BUSINESS_EMAIL},affiliate_email.eq.${AFFILIATE_EMAIL}`)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ad_spend_settlements")
      .select("id, settlement_key, amount, status, stripe_transfer_id, transfer_batch_id, transfer_retry_count, transfer_error_message, live_ad_id, created_at")
      .or(`business_email.eq.${BUSINESS_EMAIL},affiliate_email.eq.${AFFILIATE_EMAIL}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("money_flow_audit_log")
      .select("id, event_type, severity, reason_code, message, entity_id, payout_id, live_ad_id, created_at")
      .or(`business_email.eq.${BUSINESS_EMAIL},affiliate_email.eq.${AFFILIATE_EMAIL}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("affiliate_requests")
      .select("id, offer_id, status, created_at")
      .eq("offer_id", offer.id)
      .eq("affiliate_email", AFFILIATE_EMAIL)
      .order("created_at", { ascending: false })
      .limit(5),
    getPlatformBalanceSnapshot(stripe, "aud"),
    supabase
      .from("platform_fee_ledger")
      .select("id, source_type, source_id, fee_category, amount, principal_amount, gross_amount, stripe_fee_amount, stripe_object_id, status, metadata, accrued_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const settlementRows = settlements.data || [];
  const settlementSummary = settlementRows.reduce<Record<string, number>>((acc, row) => {
    const key = String((row as { status?: string }).status || "unknown");
    acc[key] = (acc[key] || 0) + Number((row as { amount?: number }).amount || 0);
    return acc;
  }, {});

  return {
    harness: {
      enabled: true,
      businessEmail: BUSINESS_EMAIL,
      affiliateEmail: AFFILIATE_EMAIL,
      source: HARNESS_SOURCE,
    },
    business,
    affiliate,
    offer,
    walletSnapshot,
    refundLock,
    walletRow: walletRow.data,
    topups: topups.data || [],
    payouts: payouts.data || [],
    deductions: deductions.data || [],
    liveAds: liveAds.data || [],
    settlements: settlementRows,
    settlementSummary,
    stripeBalance,
    platformFees: platformFees.data || [],
    audit: audit.data || [],
    approvals: approvals.data || [],
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveBalanceTransaction(paymentIntentId: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });

    let latestCharge: Stripe.Charge | null = null;
    if (pi.latest_charge) {
      latestCharge =
        typeof pi.latest_charge === "string"
          ? await stripe.charges.retrieve(pi.latest_charge, {
              expand: ["balance_transaction"],
            })
          : (pi.latest_charge as Stripe.Charge);
    }

    if (!latestCharge) {
      const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });
      const fallbackChargeId = charges.data[0]?.id;
      if (fallbackChargeId) {
        latestCharge = await stripe.charges.retrieve(fallbackChargeId, {
          expand: ["balance_transaction"],
        });
      }
    }

    const balanceTransaction = latestCharge?.balance_transaction;
    if (latestCharge && balanceTransaction) {
      return typeof balanceTransaction === "string"
        ? await stripe.balanceTransactions.retrieve(balanceTransaction)
        : balanceTransaction;
    }

    if (attempt < 3) {
      await sleep(750 * attempt);
    }
  }

  throw new Error(`Missing balance transaction for payment intent ${paymentIntentId}`);
}

async function simulateTopup(amount: number, opts: { paymentMethod?: string; label?: string } = {}) {
  const feeBreakdown = calculateWalletTopupCharge(amount);
  const amountCents = toStripeAmount(feeBreakdown.totalChargeAmount);
  if (amountCents < 50) {
    throw new Error("Top-up amount must be at least 0.50 AUD");
  }

  const paymentMethod = opts.paymentMethod || "pm_card_visa";

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "aud",
    payment_method: paymentMethod,
    confirm: true,
    automatic_payment_methods: { enabled: false },
    payment_method_types: ["card"],
    receipt_email: AFFILIATE_EMAIL,
    metadata: {
      source: HARNESS_SOURCE,
      harness_mode: opts.label || (paymentMethod === "pm_card_bypassPending" ? "bypass_pending" : "standard"),
      affiliate_email: AFFILIATE_EMAIL,
      business_email: BUSINESS_EMAIL,
      purpose: "wallet_topup",
    },
  });

  if (paymentIntent.status !== "succeeded") {
    throw new Error(`Payment intent did not succeed: ${paymentIntent.status}`);
  }

  const balanceTx = await resolveBalanceTransaction(paymentIntent.id);
  const grossAmount = +(balanceTx.amount / 100).toFixed(2);
  const fees = +(balanceTx.fee / 100).toFixed(2);
  const stripeNetAmount = +(balanceTx.net / 100).toFixed(2);
  const platformAccount = await stripe.accounts.retrieve();

  const { data, error } = await supabase.rpc("credit_wallet_topup", {
    p_affiliate_email: AFFILIATE_EMAIL,
    p_checkout_session_id: paymentIntent.id,
    p_amount_gross: grossAmount,
    p_stripe_fees: fees,
    p_amount_net: feeBreakdown.principalAmount,
    p_platform_acct_id: platformAccount.id,
    p_nettmark_fee_amount: feeBreakdown.feeAmount,
    p_credited_amount: feeBreakdown.principalAmount,
  });

  if (error) {
    throw new Error(`credit_wallet_topup failed: ${error.message}`);
  }

  await recordPlatformFeeLedger(supabase as never, {
    sourceType: "wallet_topup",
    sourceId: paymentIntent.id,
    feeCategory: "nettmark_transaction_fee",
    amount: feeBreakdown.feeAmount,
    currency: "aud",
    principalAmount: feeBreakdown.principalAmount,
    grossAmount,
    stripeFeeAmount: fees,
    stripeObjectId: paymentIntent.id,
    metadata: {
      harness: true,
      stripeNetAmount,
    },
  });

  try {
    await syncAffiliateWalletCache(supabase as never, AFFILIATE_EMAIL);
  } catch (syncError: unknown) {
    console.error("[money-flow-harness] wallet cache sync failed after top-up", syncError);
  }

  return {
    paymentIntentId: paymentIntent.id,
    chargeId: typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id,
    paymentMethod,
    grossAmount,
    fees,
    stripeNetAmount,
    creditedAmount: feeBreakdown.principalAmount,
    nettmarkFeeAmount: feeBreakdown.feeAmount,
    creditResult: data,
  };
}

async function createLiveAd(params: { spend?: number; offerId?: string }) {
  const [business, affiliate, offer] = await Promise.all([
    getBusinessProfile(),
    getAffiliateProfile(),
    params.offerId ? Promise.resolve({ id: params.offerId }) : getDefaultOffer(),
  ]);

  const stamp = Date.now();
  const { data, error } = await supabase
    .from("live_ads")
    .insert({
      meta_ad_id: `harness_meta_ad_${stamp}`,
      campaign_id: crypto.randomUUID(),
      ad_set_id: crypto.randomUUID(),
      creative_id: crypto.randomUUID(),
      affiliate_email: AFFILIATE_EMAIL,
      business_email: BUSINESS_EMAIL,
      spend: toAmount(params.spend, 0),
      spend_transferred: 0,
      offer_id: offer.id,
      business_id: business.id,
      affiliate_user_id: affiliate.user_id,
      status: "active",
      billing_state: "active",
    })
    .select("id, offer_id, spend, spend_transferred, status, billing_state, created_at")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`create live ad failed: ${error?.message || "unknown"}`);
  }

  return data;
}

async function addLiveAdSpend(liveAdId: string, amount: number) {
  const { data: liveAd, error: lookupError } = await supabase
    .from("live_ads")
    .select("id, spend")
    .eq("id", liveAdId)
    .maybeSingle();

  if (lookupError || !liveAd) {
    throw new Error(`live ad not found: ${lookupError?.message || liveAdId}`);
  }

  const newSpend = toAmount(Number(liveAd.spend || 0) + amount);
  const { data, error } = await supabase
    .from("live_ads")
    .update({ spend: newSpend })
    .eq("id", liveAdId)
    .select("id, spend, spend_transferred, status, billing_state")
    .maybeSingle();

  if (error || !data) {
    throw new Error(`live ad spend update failed: ${error?.message || "unknown"}`);
  }

  return data;
}

async function proxyJson(req: NextRequest, path: string, body: Json, opts?: { authCron?: boolean }) {
  const url = new URL(path, req.url);
  const headers: Record<string, string> = { "content-type": "application/json" };

  if (opts?.authCron && process.env.CRON_SECRET) {
    headers["x-cron-secret"] = process.env.CRON_SECRET;
    headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

export async function POST(req: NextRequest) {
  if (!isHarnessEnabled()) {
    return badRequest("money_flow_harness_disabled", { enable: "Set ENABLE_MONEY_FLOW_HARNESS=true or use non-production mode." }, 403);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Json;
    const action = String(body.action || "state") as HarnessAction;

    switch (action) {
      case "state": {
        return ok({ state: await fetchHarnessState() });
      }

      case "simulate_topup": {
        const amount = toAmount(body.amount, 25);
        const immediateAvailable = body.immediateAvailable === true;
        const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : undefined;
        const result = await simulateTopup(amount, {
          paymentMethod: paymentMethod || (immediateAvailable ? "pm_card_bypassPending" : undefined),
          label: immediateAvailable ? "bypass_pending" : "standard",
        });
        return ok({ action, result, state: await fetchHarnessState() });
      }

      case "ensure_affiliate_approval": {
        const offerId = String(body.offerId || (await getDefaultOffer()).id);
        const approval = await ensureAffiliateApproval(offerId);
        return ok({ action, approval, state: await fetchHarnessState() });
      }

      case "create_live_ad": {
        const offerId = body.offerId ? String(body.offerId) : undefined;
        const spend = toAmount(body.spend, 0);
        const liveAd = await createLiveAd({ offerId, spend });
        return ok({ action, liveAd, state: await fetchHarnessState() });
      }

      case "add_live_ad_spend": {
        const liveAdId = String(body.liveAdId || "");
        if (!liveAdId) return badRequest("liveAdId_required");
        const amount = toAmount(body.amount, 5);
        if (amount <= 0) return badRequest("amount_must_be_positive");
        const liveAd = await addLiveAdSpend(liveAdId, amount);
        return ok({ action, liveAd, state: await fetchHarnessState() });
      }

      case "settle_ad_spend": {
        const liveAdId = String(body.liveAdId || "");
        if (!liveAdId) return badRequest("liveAdId_required");
        const chunkAmount = body.chunkAmount == null ? undefined : toAmount(body.chunkAmount, 0);
        const result = await proxyJson(req, "/api/ad-spend/settle", {
          liveAdId,
          ...(chunkAmount ? { chunkAmount } : {}),
        });
        return NextResponse.json({ ok: result.ok, action, result, state: await fetchHarnessState() }, { status: result.status });
      }

      case "stripe_balance_state": {
        return ok({ stripeBalance: await getPlatformBalanceSnapshot(stripe, "aud"), state: await fetchHarnessState() });
      }

      case "process_ad_spend_transfers": {
        const limitBusinesses = Number(body.limitBusinesses ?? 10);
        const result = await proxyJson(req, "/api/ad-spend/process-transfer-batches", { limitBusinesses }, { authCron: true });
        return NextResponse.json({ ok: result.ok, action, result, state: await fetchHarnessState() }, { status: result.status });
      }

      case "sync_active_ads": {
        const dryRun = body.dryRun === true;
        const result = await proxyJson(req, "/api/meta/sync-active-ads", { dryRun }, { authCron: true });
        return NextResponse.json({ ok: result.ok, action, result, state: await fetchHarnessState() }, { status: result.status });
      }

      case "trigger_conversion": {
        const liveAdId = String(body.liveAdId || "");
        if (!liveAdId) return badRequest("liveAdId_required");
        const amount = toAmount(body.amount, 100);
        if (amount <= 0) return badRequest("amount_must_be_positive");

        const [business, affiliate, offer] = await Promise.all([
          getBusinessProfile(),
          getAffiliateProfile(),
          getDefaultOffer(),
        ]);
        await ensureAffiliateApproval(offer.id);

        const { data: insertedEvent, error: eventError } = await supabase
          .from("campaign_tracking_events")
          .insert({
            event_type: "conversion",
            affiliate_id: AFFILIATE_EMAIL,
            campaign_id: liveAdId,
            offer_id: offer.id,
            event_data: {
              source: HARNESS_SOURCE,
              simulated: true,
              requested_amount: amount,
            },
            amount,
            currency: "AUD",
            business_id: business.id,
            affiliate_user_id: affiliate.user_id,
          })
          .select("id")
          .limit(1)
          .maybeSingle();

        if (eventError || !insertedEvent) {
          throw new Error(`conversion event insert failed: ${eventError?.message || "unknown"}`);
        }

        const result = await proxyJson(req, "/api/process-conversion", { event_id: insertedEvent.id });
        return NextResponse.json({ ok: result.ok, action, eventId: insertedEvent.id, result, state: await fetchHarnessState() }, { status: result.status });
      }

      case "run_payout": {
        const payoutId = String(body.payoutId || "");
        if (!payoutId) return badRequest("payoutId_required");
        const result = await proxyJson(req, "/api/run-payout", { payout_id: payoutId });
        return NextResponse.json({ ok: result.ok, action, result, state: await fetchHarnessState() }, { status: result.status });
      }

      case "run_refund": {
        const amount = toAmount(body.amount, 5);
        if (amount <= 0) return badRequest("amount_must_be_positive");
        const stripeChargeId = body.stripeChargeId ? String(body.stripeChargeId) : undefined;
        const result = await proxyJson(req, "/api/stripe/refund", {
          email: AFFILIATE_EMAIL,
          refundAmount: amount,
          ...(stripeChargeId ? { stripe_charge_id: stripeChargeId } : {}),
        });
        return NextResponse.json({ ok: result.ok, action, result, state: await fetchHarnessState() }, { status: result.status });
      }

      default:
        return badRequest("unknown_action", { action });
    }
  } catch (error: unknown) {
    console.error("[money-flow-harness]", error);
    return badRequest(
      "money_flow_harness_failed",
      error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) },
      500,
    );
  }
}
