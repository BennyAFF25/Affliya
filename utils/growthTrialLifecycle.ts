import type { RenderNettmarkEmailArgs } from "./email/renderNettmarkEmail";
import { billingFooter } from "./billingNotifications";

export type GrowthTrialReminderDay = 1 | 3 | 10 | 12;

/**
 * Select a 24-hour milestone window and its offer-dependent variant.
 * includeDay12=false when TRIAL_BILLING_REMINDERS_V2_ENABLED moves the day-12
 * billing reminder to the trial-end based path (selectTrialBillingReminder).
 */
export function selectGrowthTrialReminder(ageDays: number, offerCount: number, options: { includeDay12?: boolean } = {}) {
  let day: GrowthTrialReminderDay;
  if (ageDays >= 1 && ageDays < 2 && offerCount === 0) day = 1;
  else if (ageDays >= 3 && ageDays < 4) day = 3;
  else if (ageDays >= 10 && ageDays < 11) day = 10;
  else if (ageDays >= 12 && ageDays < 13 && options.includeDay12 !== false) day = 12;
  else return null;
  const noOffer = offerCount === 0 && (day === 1 || day === 3);
  const variant = `${day}${day === 3 && noOffer ? "-no-offer" : ""}`;
  const eventType = `growth_trial_reminder_day_${day}${day === 3 && noOffer ? "_no_offer" : ""}`;
  return {
    day, noOffer, variant, eventType,
    // Either day-three variant exhausts this milestone, even if offers change.
    dedupeEventTypes: day === 3
      ? ["growth_trial_reminder_day_3", "growth_trial_reminder_day_3_no_offer"]
      : [eventType],
  };
}

export function shouldAlertFounder(ageDays: number, offerCount: number) {
  return Number.isFinite(ageDays) && ageDays >= 2 / 24 && offerCount === 0;
}

export type TrialBillingReminder = {
  stage: "e3_2_day" | "e2_7_day";
  eventType: string;
  idempotencyKey: (businessId: string) => string;
};

/**
 * Billing reminders based on the trial end (subscription_current_period_end),
 * for every trialing business regardless of signup cohort.
 * E3 (2 days) keeps the legacy day-12 event and key so nobody gets both.
 * E2 (7 days) is optional because Stripe's hosted 7-day reminder is the default.
 */
export function selectTrialBillingReminder(hoursLeft: number, options: { e3: boolean; e2: boolean }): TrialBillingReminder | null {
  if (!Number.isFinite(hoursLeft)) return null;
  if (options.e3 && hoursLeft > 1 && hoursLeft <= 48) {
    return { stage: "e3_2_day", eventType: "growth_trial_reminder_day_12", idempotencyKey: id => `growth-trial-12/${id}` };
  }
  if (options.e2 && hoursLeft > 72 && hoursLeft <= 168) {
    return { stage: "e2_7_day", eventType: "growth_trial_reminder_day_7", idempotencyKey: id => `growth-trial-7/${id}` };
  }
  return null;
}

/** E2 / E3 copy from 04-billing-emails-spec §4. */
export function trialBillingReminderEmail(stage: TrialBillingReminder["stage"], f: { trialEnd: string; amount: string; last4: string | null; portal: string }): { subject: string; content: RenderNettmarkEmailArgs } {
  const card = f.last4 ? ` to your card ending ${f.last4}` : " to your card";
  if (stage === "e3_2_day") {
    const body = `Just a final reminder: your free trial ends on ${f.trialEnd}, when ${f.amount}/month will be charged${card}. To avoid being charged, cancel before then.`;
    return { subject: `2 days left: your Growth trial ends on ${f.trialEnd}`, content: {
      previewText: body, badge: { text: "Growth trial", tone: "info" },
      heading: `Your Growth trial ends on ${f.trialEnd}`, body,
      cta: { label: "Manage or cancel my trial", href: f.portal },
      footerNote: `Payments are non-refundable for change of mind or forgetting to cancel, except where required by the Australian Consumer Law. ${billingFooter(f.portal)}`,
    } };
  }
  const body = `Your free trial ends on ${f.trialEnd}. Unless you cancel before then, we'll charge ${f.amount}${card} on ${f.trialEnd}, then monthly until you cancel. If Nettmark isn't right for you, you can cancel in a minute. You don't need to sign in to Nettmark; just use your billing email.`;
  return { subject: `Your Growth trial ends on ${f.trialEnd} — ${f.amount}/month starts then`, content: {
    previewText: body, badge: { text: "Growth trial", tone: "info" },
    heading: `Your Growth trial ends on ${f.trialEnd}`, body,
    cta: { label: "Manage or cancel my trial", href: f.portal },
    footerNote: `Payments are non-refundable for change of mind or forgetting to cancel, except where required by the Australian Consumer Law. ${billingFooter(f.portal)}`,
  } };
}
