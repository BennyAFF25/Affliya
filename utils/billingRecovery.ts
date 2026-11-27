/** Recovery milestones are based on Stripe invoice creation, not on a stale local trial timestamp. */
export type BillingRecoveryStage = "immediate" | "after_48h" | "after_5d";

const HOUR = 60 * 60 * 1000;
export const BILLING_RECOVERY_MAX_AGE_MS = 30 * 24 * HOUR;

export function selectBillingRecoveryStage(
  invoiceCreatedSeconds: number,
  nowMs: number,
): BillingRecoveryStage | null {
  if (!Number.isFinite(invoiceCreatedSeconds) || invoiceCreatedSeconds <= 0) return null;
  const age = nowMs - invoiceCreatedSeconds * 1000;
  if (age < 0 || age > BILLING_RECOVERY_MAX_AGE_MS) return null;
  if (age >= 5 * 24 * HOUR) return "after_5d";
  if (age >= 48 * HOUR) return "after_48h";
  return "immediate";
}

/** E5 copy (04-billing-emails-spec §4). Mentioning cancellation is fair and reduces chargebacks. */
export function billingRecoveryMessage(stage: BillingRecoveryStage, formattedAmount: string, last4?: string | null) {
  const card = last4 ? ` to your card ending ${last4}` : " to your card";
  switch (stage) {
    case "immediate":
      return {
        subject: `Action needed: your Nettmark Growth payment of ${formattedAmount} failed`,
        heading: "We couldn't process your Growth payment",
        body: `We couldn't charge ${formattedAmount}${card} for your Growth subscription. Please update your card or pay the invoice so your Growth features keep working. Your bank may retry automatically over the next few days.`,
      };
    case "after_48h":
      return {
        subject: `Reminder: ${formattedAmount} still outstanding on your Growth subscription`,
        heading: "Your Growth payment is still outstanding",
        body: `Your Growth payment of ${formattedAmount} is still unpaid. Update your card or pay now to avoid interruption.`,
      };
    case "after_5d":
      return {
        subject: "Final reminder: update your card to keep Nettmark Growth",
        heading: "Please update your card to keep Growth",
        body: `We still haven't been able to collect ${formattedAmount}. If it isn't paid when the automatic retries finish, your Growth subscription will be cancelled and your account will move to Free.`,
      };
  }
}
