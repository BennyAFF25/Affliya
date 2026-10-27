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

export function billingRecoveryMessage(stage: BillingRecoveryStage, formattedAmount: string) {
  switch (stage) {
    case "immediate":
      return {
        subject: "Action required: your Nettmark Growth payment failed",
        heading: "We couldn't process your Growth payment",
        body: `Your Growth subscription invoice for ${formattedAmount} remains unpaid. Please use the secure link below to complete your payment or update your payment method.`,
      };
    case "after_48h":
      return {
        subject: "Reminder: your Nettmark Growth payment is outstanding",
        heading: "Your Growth payment is still outstanding",
        body: `Your Growth invoice for ${formattedAmount} is still unpaid. Your bank may retry automatically, but you can resolve it now using the secure link below.`,
      };
    case "after_5d":
      return {
        subject: "Your Growth subscription payment remains unpaid",
        heading: "Please review your outstanding Growth payment",
        body: `Your Growth subscription invoice for ${formattedAmount} remains unpaid. To avoid any subscription restrictions under your billing settings, please resolve the invoice as soon as possible.`,
      };
  }
}
