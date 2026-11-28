/**
 * Public Stripe-hosted billing portal login. Customers verify ownership with
 * their billing email and don't need to sign in to Nettmark. Keep in sync with
 * the active Stripe Billing portal login link. STRIPE_BILLING_PORTAL_LOGIN_URL
 * can point Preview/staging at the test-mode portal link.
 */
export const STRIPE_GROWTH_BILLING_LOGIN_URL = "https://billing.stripe.com/p/login/14A7sN8fm8rM0CSaLMasg00";

export function growthBillingPortalUrl(env: Record<string, string | undefined> = process.env) {
  const override = (env.STRIPE_BILLING_PORTAL_LOGIN_URL || "").trim();
  return /^https:\/\/billing\.stripe\.com\//.test(override) ? override : STRIPE_GROWTH_BILLING_LOGIN_URL;
}

export const NETTMARK_LEGAL_ENTITY = "Nettmark Pty Ltd · ABN 51 690 432 298";
