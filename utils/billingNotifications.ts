import type Stripe from "stripe";
import { formatAdelaideDate } from "./legal/trialTerms";
import { NETTMARK_LEGAL_ENTITY } from "./billingLinks";
import type { RenderNettmarkEmailArgs } from "./email/renderNettmarkEmail";

/** Ledger kinds (business_billing_notifications.kind). Copy: 04-billing-emails-spec §4. */
export const BILLING_NOTIFICATION_KINDS = [
  "trial_started", "trial_converted", "payment_receipt", "subscription_cancel_scheduled",
  "subscription_ended", "cancelled_nonpayment", "refund",
] as const;
export type BillingNotificationKind = typeof BILLING_NOTIFICATION_KINDS[number];

/** Master switch for enqueueing (webhook) and sending (cron). Off by default. */
export function billingNotificationsEnabled(value: string | undefined = process.env.BILLING_NOTIFICATIONS_ENABLED) {
  return value === "true";
}

/**
 * BILLING_NOTIFICATION_KINDS env allowlist. Unset/blank = every kind; "none" = no kinds.
 * Use it to switch off kinds Stripe already sends, e.g. drop payment_receipt,
 * trial_converted and refund while Stripe's receipt / refund emails are on.
 */
export function allowedBillingNotificationKinds(value: string | undefined = process.env.BILLING_NOTIFICATION_KINDS) {
  const raw = (value || "").trim();
  if (!raw) return new Set<BillingNotificationKind>(BILLING_NOTIFICATION_KINDS);
  const requested = raw.split(",").map(item => item.trim()).filter(Boolean);
  return new Set(BILLING_NOTIFICATION_KINDS.filter(kind => requested.includes(kind)));
}

export type BillingNotificationIntent = {
  kind: BillingNotificationKind;
  stripeObjectId: string;
  stripeSubscriptionId: string | null;
  payload: Record<string, unknown>;
};

const refId = (ref: unknown): string | null =>
  typeof ref === "string" ? ref : ref && typeof ref === "object" && "id" in ref && typeof (ref as { id?: unknown }).id === "string" ? (ref as { id: string }).id : null;

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number | null }).current_period_end;
  return legacy || subscription.items?.data?.[0]?.current_period_end || null;
}

/** First paid invoice after a trial: a cycle invoice created around trial_end. */
export function isTrialConversionInvoice(invoice: Pick<Stripe.Invoice, "billing_reason" | "created">, subscription: Pick<Stripe.Subscription, "trial_end">) {
  if (invoice.billing_reason !== "subscription_cycle" || !subscription.trial_end) return false;
  return invoice.created >= subscription.trial_end - 3600 && invoice.created <= subscription.trial_end + 3 * 86400;
}

/**
 * Map a Stripe webhook event (already resolved to a business subscription) to
 * ledger rows. Pure: no I/O. charge.refunded is handled by refundNotificationIntent.
 */
export function billingNotificationIntents(event: Stripe.Event, subscription: Stripe.Subscription | null): BillingNotificationIntent[] {
  if (!subscription) return [];
  const subId = subscription.id;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || subscription.status !== "trialing") return [];
    return [{ kind: "trial_started", stripeObjectId: subId, stripeSubscriptionId: subId, payload: {
      checkout_session_id: session.id, trial_start: subscription.trial_start, trial_end: subscription.trial_end,
      consent_terms_of_service: session.consent?.terms_of_service || null,
    } }];
  }
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    if (!invoice.id || !(invoice.amount_paid > 0)) return [];
    const kind = isTrialConversionInvoice(invoice, subscription) ? "trial_converted" : "payment_receipt";
    return [{ kind, stripeObjectId: invoice.id, stripeSubscriptionId: subId, payload: {
      amount_paid: invoice.amount_paid, currency: invoice.currency, billing_reason: invoice.billing_reason,
    } }];
  }
  if (event.type === "customer.subscription.updated") {
    const previous = (event.data.previous_attributes || {}) as Partial<Pick<Stripe.Subscription, "cancel_at_period_end" | "cancel_at" | "status">>;
    const scheduledNow = subscription.cancel_at_period_end === true || Boolean(subscription.cancel_at);
    const scheduledBefore = ("cancel_at_period_end" in previous ? previous.cancel_at_period_end === true : subscription.cancel_at_period_end === true) ||
      ("cancel_at" in previous ? Boolean(previous.cancel_at) : Boolean(subscription.cancel_at));
    const changed = "cancel_at_period_end" in previous || "cancel_at" in previous;
    const intents: BillingNotificationIntent[] = [];
    if (changed && scheduledNow && !scheduledBefore && subscription.status !== "canceled") {
      const accessUntil = subscription.status === "trialing" && subscription.trial_end
        ? subscription.trial_end : subscription.cancel_at || subscriptionPeriodEnd(subscription);
      intents.push({ kind: "subscription_cancel_scheduled", stripeObjectId: `${subId}:cancel:${accessUntil || event.created}`, stripeSubscriptionId: subId, payload: {
        trialing: subscription.status === "trialing", access_until: accessUntil,
      } });
    }
    if (previous.status && previous.status !== "unpaid" && subscription.status === "unpaid") {
      intents.push({ kind: "cancelled_nonpayment", stripeObjectId: subId, stripeSubscriptionId: subId, payload: { reason: "unpaid", latest_invoice: refId(subscription.latest_invoice) } });
    }
    return intents;
  }
  if (event.type === "customer.subscription.deleted") {
    const reason = subscription.cancellation_details?.reason || null;
    const kind = reason === "payment_failed" ? "cancelled_nonpayment" : "subscription_ended";
    return [{ kind, stripeObjectId: subId, stripeSubscriptionId: subId, payload: {
      reason, ended_at: subscription.ended_at || subscription.canceled_at || event.created, latest_invoice: refId(subscription.latest_invoice),
    } }];
  }
  return [];
}

/** charge.refunded: one row per cumulative refunded amount, only when it increased. */
export function refundNotificationIntent(event: Stripe.Event, stripeSubscriptionId: string | null): BillingNotificationIntent | null {
  if (event.type !== "charge.refunded") return null;
  const charge = event.data.object as Stripe.Charge;
  const previous = (event.data.previous_attributes || {}) as Partial<Pick<Stripe.Charge, "amount_refunded">>;
  const before = typeof previous.amount_refunded === "number" ? previous.amount_refunded : 0;
  const delta = charge.amount_refunded - before;
  if (!(delta > 0)) return null;
  return { kind: "refund", stripeObjectId: `${charge.id}:${charge.amount_refunded}`, stripeSubscriptionId, payload: {
    charge_id: charge.id, amount_refunded: charge.amount_refunded, refunded_delta: delta, currency: charge.currency,
  } };
}

export function formatStripeAmount(amount: number, currency: string) {
  const code = String(currency || "aud").toUpperCase();
  const formatted = new Intl.NumberFormat("en-AU", { style: "currency", currency: code }).format(amount / 100);
  return code === "AUD" && formatted.startsWith("$") ? `A${formatted}` : formatted;
}

export function stripeDate(seconds: number | null | undefined) {
  return seconds ? formatAdelaideDate(new Date(seconds * 1000)) : "";
}

export type BillingEmailFacts = {
  business?: string | null;
  amount?: string | null;
  last4?: string | null;
  date?: string | null;
  trialEnd?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  invoiceUrl?: string | null;
  refundId?: string | null;
  trialing?: boolean;
  firstChargeAfterTrial?: boolean;
  portal: string;
  site: string;
};

const card = (last4?: string | null) => last4 ? ` to your card ending ${last4}` : " to your card";

export function billingFooter(portal: string) {
  return `${NETTMARK_LEGAL_ENTITY} · Manage or cancel: ${portal}`;
}

/** Render arguments + subject for each kind. Exact copy from 04 §4 (E1, E4, E6, E7, E8). */
export function billingNotificationEmail(kind: BillingNotificationKind, f: BillingEmailFacts): { subject: string; content: RenderNettmarkEmailArgs } {
  const footerNote = billingFooter(f.portal);
  const terms = `${f.site}/legal/privacy/terms-of-service`;
  switch (kind) {
    case "trial_started": {
      const body = `Thanks for starting Nettmark Growth${f.business ? `, ${f.business}` : ""}. Here's a summary of what you agreed to:`;
      return { subject: "Your Nettmark Growth trial has started — here are your terms", content: {
        previewText: `Your trial ends on ${f.trialEnd}. Cancel before then and you won't be charged.`,
        badge: { text: "Growth trial", tone: "info" },
        heading: "Your 14-day Growth trial is active", body,
        rows: [
          { label: "Trial start", value: f.date || "" },
          { label: "Trial ends", value: f.trialEnd || "" },
          { label: "Then", value: `${f.amount}/month, charged automatically${card(f.last4)} on ${f.trialEnd} and monthly after, until you cancel` },
          { label: "Cancel", value: `Anytime before ${f.trialEnd} and you won't be charged` },
        ],
        notice: { body: "We'll remind you 7 days before your trial ends. Payments are non-refundable for change of mind, unused time or forgetting to cancel, except where the Australian Consumer Law requires. See clause 7 of our Terms.", tone: "neutral" },
        cta: { label: "Manage or cancel my trial", href: f.portal },
        secondaryCta: { label: "Read the Terms", href: terms },
        footerNote,
      } };
    }
    case "trial_converted":
    case "payment_receipt": {
      const first = kind === "trial_converted" || f.firstChargeAfterTrial;
      const body = first
        ? `Your free trial ended on ${f.date} and your Growth subscription is now active. We've charged ${f.amount}${card(f.last4)}.`
        : `We've charged ${f.amount} for your Growth subscription.`;
      return { subject: `Payment received — Nettmark Growth ${f.amount}`, content: {
        previewText: body,
        badge: { text: "Growth billing", tone: "success" },
        heading: "Thanks — your Growth subscription is active", body,
        rows: [
          { label: "Amount", value: f.amount || "" },
          { label: "Date", value: f.date || "" },
          ...(f.periodStart && f.periodEnd ? [{ label: "Period", value: `${f.periodStart} – ${f.periodEnd}` }] : []),
          ...(f.periodEnd ? [{ label: "Next charge", value: f.periodEnd }] : []),
        ],
        notice: { body: `You can cancel anytime. You'll keep access until ${f.periodEnd || "the end of your paid period"} and won't be charged again. Payments are non-refundable for change of mind or unused time, except where the Australian Consumer Law requires.`, tone: "neutral" },
        cta: f.invoiceUrl ? { label: "View invoice", href: f.invoiceUrl } : { label: "Manage subscription", href: f.portal },
        secondaryCta: f.invoiceUrl ? { label: "Manage subscription", href: f.portal } : undefined,
        footerNote,
      } };
    }
    case "cancelled_nonpayment": {
      const body = `We weren't able to collect ${f.amount || "your Growth payment"} after several attempts, so your Growth subscription was cancelled on ${f.date} and your account has moved to the Free plan. Your offers and data are still there. You can restart Growth anytime from Settings → Subscription & billing.`;
      return { subject: "Your Nettmark Growth subscription has been cancelled", content: {
        previewText: body, badge: { text: "Growth billing", tone: "warning" },
        heading: "Your Growth subscription has been cancelled", body,
        cta: { label: "Restart Growth", href: `${f.site}/business/choose-plan` },
        footerNote,
      } };
    }
    case "subscription_cancel_scheduled": {
      const body = f.trialing
        ? `Your trial has been cancelled and you won't be charged. You'll keep Growth access until ${f.trialEnd}.`
        : `Your subscription is cancelled and you won't be charged again. You'll keep Growth access until ${f.periodEnd}, then your account moves to Free.`;
      return { subject: "You've cancelled Nettmark Growth — no further charges", content: {
        previewText: body, badge: { text: "Growth billing", tone: "info" },
        heading: "Your cancellation is confirmed", body,
        cta: { label: "Changed your mind? Resume", href: f.portal },
        footerNote,
      } };
    }
    case "subscription_ended": {
      const body = `Your Growth subscription ended on ${f.date}. You won't be charged again.`;
      return { subject: "Your Nettmark Growth subscription has ended", content: {
        previewText: body, badge: { text: "Growth billing", tone: "info" },
        heading: "Your Growth subscription has ended", body,
        cta: { label: "Changed your mind? Resume", href: f.portal },
        footerNote,
      } };
    }
    case "refund": {
      const body = `We've refunded ${f.amount}${card(f.last4)}${f.refundId ? ` (reference ${f.refundId})` : ""}. Refunds usually appear within 5–10 business days, depending on your bank. If your card was charged in another currency, the amount you see may differ slightly because of exchange rates.`;
      return { subject: `Refund processed — ${f.amount}`, content: {
        previewText: body, badge: { text: "Growth billing", tone: "success" },
        heading: "Your refund has been processed", body,
        recipientNote: "Questions? Reply to this email.",
        footerNote,
      } };
    }
  }
}
