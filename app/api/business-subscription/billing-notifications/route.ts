import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import type Stripe from "stripe";
import { createBusinessSubscriptionStripeClient, createServerSupabaseClient } from "../../../../utils/businessSubscriptions";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";
import {
  allowedBillingNotificationKinds, billingNotificationEmail, billingNotificationsEnabled, formatStripeAmount,
  isTrialConversionInvoice, stripeDate, type BillingEmailFacts, type BillingNotificationKind,
} from "../../../../utils/billingNotifications";
import { growthBillingPortalUrl } from "../../../../utils/billingLinks";
import { growthEmailAllowed, growthOrigin } from "../../../../utils/growthPartners/email";
import { excludedTrialEmail } from "../../../../utils/marketing/startTrial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MS = 15 * 60_000;
/** Rows older than this are never sent (e.g. queued long before the flag was switched on). */
const MAX_ROW_AGE_MS = 7 * 86_400_000;

type LedgerRow = {
  id: string; business_id: string; kind: BillingNotificationKind; stripe_object_id: string;
  stripe_subscription_id: string | null; recipient_email: string; payload: Record<string, unknown> | null;
  status: string; attempt_count: number; claimed_at: string | null; created_at: string;
};
class Skip extends Error {}

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const actual = req.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  return expected.length > 0 &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function cardLast4(pm: unknown) {
  if (pm && typeof pm === "object" && "card" in pm) return (pm as Stripe.PaymentMethod).card?.last4 || null;
  return null;
}

function priceAmount(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0];
  const unit = item?.price?.unit_amount;
  return unit == null ? null : formatStripeAmount(unit * (item?.quantity || 1), item?.price?.currency || "aud");
}

function periodEnd(subscription: Stripe.Subscription) {
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number | null }).current_period_end;
  return legacy || subscription.items?.data?.[0]?.current_period_end || null;
}

async function loadSubscription(stripe: Stripe, id: string | null) {
  if (!id) throw new Skip("missing subscription");
  return stripe.subscriptions.retrieve(id, { expand: ["default_payment_method", "latest_invoice"] });
}

/** Re-check the Stripe object right before sending and collect the facts for the copy. */
async function factsFor(stripe: Stripe, admin: ReturnType<typeof createServerSupabaseClient>, row: LedgerRow, base: Pick<BillingEmailFacts, "portal" | "site">): Promise<BillingEmailFacts> {
  const payload = row.payload || {};
  switch (row.kind) {
    case "trial_started": {
      const sub = await loadSubscription(stripe, row.stripe_subscription_id);
      if (sub.status !== "trialing" || sub.cancel_at_period_end || sub.cancel_at) throw new Skip("no longer an active trial");
      const { data: business } = await admin.from("business_profiles").select("business_name").eq("id", row.business_id).maybeSingle();
      return { ...base, business: business?.business_name || null, date: stripeDate(sub.trial_start), trialEnd: stripeDate(sub.trial_end), amount: priceAmount(sub), last4: cardLast4(sub.default_payment_method) };
    }
    case "trial_converted":
    case "payment_receipt": {
      const invoice = await stripe.invoices.retrieve(row.stripe_object_id);
      if (invoice.status !== "paid" || !(invoice.amount_paid > 0)) throw new Skip("invoice not paid");
      const sub = await loadSubscription(stripe, row.stripe_subscription_id);
      const line = invoice.lines?.data?.find(item => item.period?.end) || null;
      const paidAt = invoice.status_transitions?.paid_at || invoice.created;
      const first = row.kind === "trial_converted" || isTrialConversionInvoice(invoice, sub);
      return {
        ...base, amount: formatStripeAmount(invoice.amount_paid, invoice.currency), last4: cardLast4(sub.default_payment_method),
        date: stripeDate(first && sub.trial_end ? sub.trial_end : paidAt), periodStart: stripeDate(line?.period?.start), periodEnd: stripeDate(line?.period?.end || periodEnd(sub)),
        invoiceUrl: invoice.hosted_invoice_url || null, firstChargeAfterTrial: first,
      };
    }
    case "subscription_cancel_scheduled": {
      const sub = await loadSubscription(stripe, row.stripe_subscription_id);
      if (!(sub.cancel_at_period_end || sub.cancel_at) || !["trialing", "active", "past_due"].includes(sub.status)) throw new Skip("cancellation no longer scheduled");
      const trialing = sub.status === "trialing";
      return { ...base, trialing, trialEnd: stripeDate(sub.trial_end), periodEnd: stripeDate(sub.cancel_at || periodEnd(sub)) };
    }
    case "subscription_ended": {
      const sub = await loadSubscription(stripe, row.stripe_subscription_id);
      if (sub.status !== "canceled") throw new Skip("subscription not cancelled");
      // The customer already got a cancellation confirmation for this subscription.
      const { data: confirmed } = await admin.from("business_billing_notifications").select("id")
        .eq("stripe_subscription_id", row.stripe_subscription_id).eq("kind", "subscription_cancel_scheduled").eq("status", "sent").limit(1).maybeSingle();
      if (confirmed) throw new Skip("cancellation already confirmed");
      return { ...base, date: stripeDate(sub.ended_at || sub.canceled_at || Number(payload.ended_at) || null) };
    }
    case "cancelled_nonpayment": {
      const sub = await loadSubscription(stripe, row.stripe_subscription_id);
      if (!["canceled", "unpaid"].includes(sub.status)) throw new Skip("subscription recovered");
      const invoice = sub.latest_invoice && typeof sub.latest_invoice === "object" ? sub.latest_invoice as Stripe.Invoice : null;
      const owed = invoice ? (invoice.amount_remaining || invoice.amount_due) : 0;
      return { ...base, amount: invoice && owed > 0 ? formatStripeAmount(owed, invoice.currency) : priceAmount(sub), date: stripeDate(sub.ended_at || sub.canceled_at || Math.floor(Date.now() / 1000)) };
    }
    case "refund": {
      const chargeId = String(payload.charge_id || "");
      if (!chargeId) throw new Skip("missing charge");
      const charge = await stripe.charges.retrieve(chargeId);
      if (charge.amount_refunded < Number(payload.amount_refunded || 0)) throw new Skip("refund reversed");
      const refunds = await stripe.refunds.list({ charge: chargeId, limit: 1 });
      return { ...base, amount: formatStripeAmount(Number(payload.refunded_delta || 0), String(payload.currency || charge.currency)), last4: charge.payment_method_details?.card?.last4 || null, refundId: refunds.data[0]?.id || null };
    }
  }
}

/** Claim a row with a conditional update so concurrent cron runs can't send twice. */
async function claim(admin: ReturnType<typeof createServerSupabaseClient>, row: LedgerRow) {
  let update = admin.from("business_billing_notifications")
    .update({ status: "sending", claimed_at: new Date().toISOString(), attempt_count: row.attempt_count + 1, last_error: null })
    .eq("id", row.id).eq("status", row.status).eq("attempt_count", row.attempt_count);
  if (row.status === "sending" && row.claimed_at) update = update.eq("claimed_at", row.claimed_at);
  const { data, error } = await update.select("id").maybeSingle();
  return !error && Boolean(data?.id);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!billingNotificationsEnabled()) return NextResponse.json({ ok: true, disabled: true }, { headers: { "Cache-Control": "no-store" } });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return NextResponse.json({ error: "Email not configured" }, { status: 503 });

  const admin = createServerSupabaseClient();
  const stripe = createBusinessSubscriptionStripeClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = `${process.env.RESEND_FROM_NAME || "Nettmark"} <${process.env.RESEND_FROM_EMAIL}>`;
  const base = { portal: growthBillingPortalUrl(), site: growthOrigin() };
  const allowedKinds = allowedBillingNotificationKinds();
  const production = process.env.VERCEL_ENV === "production";
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  let sent = 0, skipped = 0, failed = 0;

  const { data: rows, error } = await admin.from("business_billing_notifications")
    .select("id,business_id,kind,stripe_object_id,stripe_subscription_id,recipient_email,payload,status,attempt_count,claimed_at,created_at")
    .lt("attempt_count", MAX_ATTEMPTS)
    .or(`status.eq.pending,status.eq.failed,and(status.eq.sending,claimed_at.lt."${staleBefore}")`)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: "Billing notifications unavailable" }, { status: 503 });

  for (const row of (rows || []) as LedgerRow[]) {
    const markSkipped = async (reason: string) => {
      await admin.from("business_billing_notifications").update({ status: "skipped", last_error: reason.slice(0, 200) }).eq("id", row.id);
      skipped++;
    };
    if (!allowedKinds.has(row.kind)) { await markSkipped("kind disabled by BILLING_NOTIFICATION_KINDS"); continue; }
    if (Date.now() - Date.parse(row.created_at) > MAX_ROW_AGE_MS) { await markSkipped("too old to send"); continue; }
    if (production && excludedTrialEmail(row.recipient_email)) { await markSkipped("internal or test recipient"); continue; }
    if (!growthEmailAllowed(row.recipient_email)) { await markSkipped("recipient not allowed outside production"); continue; }
    if (!await claim(admin, row)) { skipped++; continue; }

    try {
      const facts = await factsFor(stripe, admin, row, base);
      const { subject, content } = billingNotificationEmail(row.kind, facts);
      const { data: sendData, error: sendError } = await resend.emails.send({
        from, to: [row.recipient_email], replyTo: "contact@nettmark.com", subject, html: renderNettmarkEmail(content),
      }, { idempotencyKey: `billing/${row.kind}/${row.stripe_object_id}` });
      if (sendError) throw new Error("Resend rejected billing email.");
      const { error: markError } = await admin.from("business_billing_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_email_id: sendData?.id || null, last_error: null })
        .eq("id", row.id);
      if (markError) console.warn("[billing-notifications] sent but ledger update failed", { id: row.id });
      sent++;
    } catch (err) {
      if (err instanceof Skip) {
        await admin.from("business_billing_notifications").update({ status: "skipped", last_error: err.message.slice(0, 200) }).eq("id", row.id);
        skipped++;
        continue;
      }
      failed++;
      await admin.from("business_billing_notifications").update({
        status: "failed", last_error: err instanceof Error ? err.message.slice(0, 200) : "Delivery failed",
      }).eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: failed === 0, sent, skipped, failed }, {
    status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" },
  });
}
