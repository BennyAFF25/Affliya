/** Shared, client-safe wording for the Growth trial / paid start consent (03 §2.2). */
export const REFUND_SUMMARY =
  "Payments are non-refundable for change of mind, unused time, or forgetting to cancel, except where the Australian Consumer Law requires a refund. You can cancel anytime; you keep access until the end of your paid month and won't be charged again.";

export function formatAdelaideDate(date: Date) {
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Adelaide" });
}

/** Today plus trialDays, shown in Australia/Adelaide. Stripe sets the real trial end when checkout completes. */
export function trialEndDate(trialDays: number, now = new Date()) {
  return formatAdelaideDate(new Date(now.getTime() + Math.max(0, trialDays) * 86_400_000));
}

export type GrowthTermsInput = {
  trialEligible: boolean;
  trialDays: number;
  /** Formatted price from Stripe, e.g. "A$49". */
  price: string;
  /** e.g. "month" */
  period: string;
  taxNotice?: string | null;
  now?: Date;
};

export function growthTermsCopy(input: GrowthTermsInput) {
  const end = trialEndDate(input.trialDays, input.now);
  const perPeriod = `${input.price}/${input.period}`;
  if (!input.trialEligible) {
    const bullets = [
      `${perPeriod}, charged today and every ${input.period} until you cancel.${input.taxNotice ? ` ${input.taxNotice}` : ""}`,
      "Cancel anytime in Settings → Subscription & billing, or from the link in any billing email. You keep Growth until the end of the period you've paid for.",
      "Refunds: payments are non-refundable for change of mind, unused time or forgetting to cancel, except where the Australian Consumer Law requires.",
    ];
    const checkbox = `I understand Growth is a paid ${perPeriod} subscription charged today and every ${input.period} until I cancel, and I agree to the Terms of Service, including the refund policy.`;
    return { context: "paid_start" as const, heading: "Your Growth subscription", trialEnd: null, bullets, checkbox, button: "Continue to secure checkout" };
  }
  const bullets = [
    `${input.trialDays} days free, starting today, ending ${end}.`,
    `Then ${perPeriod}, charged automatically on ${end} and every ${input.period} after, until you cancel.${input.taxNotice ? ` ${input.taxNotice}` : ""}`,
    `Cancel anytime in Settings → Subscription & billing, or from the link in any billing email. Cancel before ${end} and you pay nothing.`,
    "We'll email you 7 days before your trial ends.",
    "Refunds: payments are non-refundable for change of mind, unused time or forgetting to cancel, except where the Australian Consumer Law requires.",
  ];
  const checkbox = `I understand my trial becomes a paid ${perPeriod} subscription on ${end} unless I cancel before then, and I agree to the Terms of Service, including the refund policy.`;
  return { context: "trial_start" as const, heading: "Your free trial", trialEnd: end, bullets, checkbox, button: `Start ${input.trialDays}-day free trial (card required)` };
}

/** Exact text stored as evidence with the acceptance record. */
export function growthTermsEvidence(copy: ReturnType<typeof growthTermsCopy>) {
  return [copy.heading, ...copy.bullets.map(item => `• ${item}`), `☑ ${copy.checkbox}`].join("\n").slice(0, 4000);
}
