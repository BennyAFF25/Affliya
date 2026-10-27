import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  createBusinessSubscriptionStripeClient,
  createServerSupabaseClient,
} from "../../../../utils/businessSubscriptions";
import {
  BILLING_RECOVERY_MAX_AGE_MS,
  billingRecoveryMessage,
  selectBillingRecoveryStage,
  type BillingRecoveryStage,
} from "../../../../utils/billingRecovery";
import { renderNettmarkEmail } from "../../../../utils/email/renderNettmarkEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RECOVERY_STAGES: BillingRecoveryStage[] = ["immediate", "after_48h", "after_5d"];

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const actual = req.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  return expected.length > 0 &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function stripeId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

/**
 * Claim one recovery stage per invoice. Unique DB key prevents competing cron
 * executions from sending the same stage. A failed/interrupted send can retry
 * after 15 minutes, up to three attempts, with the same Resend idempotency key.
 */
async function claimStage(
  admin: ReturnType<typeof createServerSupabaseClient>,
  params: { businessId: string; invoiceId: string; stage: BillingRecoveryStage; email: string },
): Promise<string | null> {
  const table = admin.from("business_billing_recovery_emails");
  const { data: created, error: createError } = await table.insert({
    business_id: params.businessId,
    stripe_invoice_id: params.invoiceId,
    stage: params.stage,
    recipient_email: params.email,
    status: "sending",
  }).select("id").maybeSingle();

  if (!createError && created?.id) return created.id;
  if (createError?.code !== "23505") throw new Error("Could not reserve a billing reminder.");

  const { data: previous, error: previousError } = await admin
    .from("business_billing_recovery_emails")
    .select("id,status,attempt_count,claimed_at")
    .eq("stripe_invoice_id", params.invoiceId)
    .eq("stage", params.stage)
    .maybeSingle();
  if (previousError) throw new Error("Could not load billing reminder status.");
  if (!previous || previous.status === "sent" || previous.status === "skipped" || previous.attempt_count >= 3) return null;

  const claimCutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const shouldRetry = previous.status === "failed" ||
    (previous.status === "sending" && previous.claimed_at < claimCutoff);
  if (!shouldRetry) return null;

  let update = admin.from("business_billing_recovery_emails")
    .update({ status: "sending", claimed_at: new Date().toISOString(), attempt_count: previous.attempt_count + 1, last_error: null })
    .eq("id", previous.id)
    .eq("status", previous.status)
    .eq("attempt_count", previous.attempt_count);
  if (previous.status === "sending") update = update.lt("claimed_at", claimCutoff);
  const { data: claimed, error: updateError } = await update.select("id").maybeSingle();
  if (updateError) throw new Error("Could not reclaim billing reminder.");
  return claimed?.id || null;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.BILLING_RECOVERY_EMAILS_ENABLED !== "true") {
    return NextResponse.json({ ok: true, disabled: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const admin = createServerSupabaseClient();
  const stripe = createBusinessSubscriptionStripeClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = `${process.env.RESEND_FROM_NAME || "Nettmark"} <${process.env.RESEND_FROM_EMAIL}>`;
  let sent = 0, skipped = 0, failed = 0;

  // The local status is for discovery only. Stripe is rechecked both before
  // claiming a reminder and immediately before emailing the customer.
  const { data: businesses, error: listingError } = await admin.from("business_entitlements")
    .select("business_id,business_email,subscription_stripe_customer_id,stripe_subscription_id")
    .eq("is_grandfathered", false)
    .in("billing_status", ["subscription_past_due", "subscription_unpaid"])
    .order("updated_at", { ascending: false })
    .limit(400);
  if (listingError) return NextResponse.json({ error: "Billing accounts unavailable" }, { status: 503 });

  for (const business of businesses || []) {
    const businessId = String(business.business_id || "");
    const subscriptionId = String(business.stripe_subscription_id || "");
    if (!businessId || !subscriptionId) { skipped++; continue; }

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
      if (!["past_due", "unpaid"].includes(subscription.status) || subscription.cancel_at_period_end || subscription.cancel_at) {
        skipped++; continue;
      }
      const invoiceRef = subscription.latest_invoice;
      const invoiceId = stripeId(invoiceRef);
      if (!invoiceId) { skipped++; continue; }

      const invoice = typeof invoiceRef === "string"
        ? await stripe.invoices.retrieve(invoiceRef)
        : invoiceRef;
      if (!invoice || invoice.status !== "open" || !invoice.attempted ||
          invoice.amount_remaining <= 0 || invoice.collection_method !== "charge_automatically" ||
          !["subscription_cycle", "subscription_create"].includes(String(invoice.billing_reason)) ||
          invoice.currency !== "aud" ||
          (business.subscription_stripe_customer_id &&
            stripeId(invoice.customer) !== business.subscription_stripe_customer_id)) {
        skipped++; continue;
      }
      const stage = selectBillingRecoveryStage(invoice.created, Date.now());
      if (!stage || !RECOVERY_STAGES.includes(stage)) { skipped++; continue; }

      const recipient = String(invoice.customer_email || business.business_email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) { skipped++; continue; }
      const claimedId = await claimStage(admin, { businessId, invoiceId, stage, email: recipient });
      if (!claimedId) { skipped++; continue; }

      try {
        // Recheck after claim so paying during a running cron stops the email.
        const freshInvoice = await stripe.invoices.retrieve(invoiceId);
        if (freshInvoice.status !== "open" || freshInvoice.amount_remaining <= 0) {
          await admin.from("business_billing_recovery_emails").update({ status: "skipped" }).eq("id", claimedId);
          skipped++; continue;
        }

        const amount = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })
          .format(freshInvoice.amount_remaining / 100);
        const message = billingRecoveryMessage(stage, amount);
        const link = freshInvoice.hosted_invoice_url || "https://www.nettmark.com/business/settings";
        const { data: sendData, error: sendError } = await resend.emails.send({
          from,
          to: [recipient],
          subject: message.subject,
          html: renderNettmarkEmail({
            previewText: message.body,
            badge: { text: "Growth billing", tone: "warning" },
            heading: message.heading,
            body: message.body,
            rows: [{ label: "Amount outstanding", value: amount }],
            cta: { label: "Resolve my payment", href: link },
            secondaryCta: { label: "Manage Growth billing", href: "https://www.nettmark.com/business/settings" },
            footerNote: "This message concerns an outstanding Nettmark Growth invoice. It does not change your subscription or initiate another charge.",
          }),
        }, { idempotencyKey: `growth-billing-recovery/${invoiceId}/${stage}` });
        if (sendError) throw new Error("Resend rejected recovery email.");
        const { error: markError } = await admin.from("business_billing_recovery_emails").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_email_id: sendData?.id || null,
          last_error: null,
        }).eq("id", claimedId);
        if (markError) throw new Error("Recovery email sent, but audit persistence failed.");
        sent++;
      } catch (error) {
        failed++;
        await admin.from("business_billing_recovery_emails").update({
          status: "failed",
          last_error: error instanceof Error ? error.message.slice(0, 200) : "Delivery failed",
        }).eq("id", claimedId);
      }
    } catch (error) {
      console.warn("[payment-recovery] account check failed", { businessId, reason: error instanceof Error ? error.message : "unknown" });
      failed++;
    }
  }

  return NextResponse.json({ ok: failed === 0, sent, skipped, failed }, {
    status: failed ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
