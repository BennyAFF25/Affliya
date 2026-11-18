export type BillingEvidence = {
  stripe_billing_reserved?: boolean;
  billing_provider?: string | null; billing_status?: string | null; is_grandfathered?: boolean | null;
  stripe_subscription_id?: string | null; subscription_stripe_customer_id?: string | null;
  subscription_started_at?: string | null; growth_trial_used?: boolean | null; growth_trial_started_at?: string | null;
};
// Conservatively retain Stripe customers, including cancelled subscription history.
export function resolveBillingRoute(row: BillingEvidence, appStoreFirst = false): 'stripe' | 'shopify' {
  if (row.stripe_billing_reserved || row.is_grandfathered || row.billing_status === 'grandfathered' || row.stripe_subscription_id ||
      row.subscription_stripe_customer_id || row.subscription_started_at) return 'stripe';
  if (row.billing_provider === 'shopify') return 'shopify';
  if (row.growth_trial_used || row.growth_trial_started_at ||
      !['free', 'subscription_required'].includes(row.billing_status || 'free')) return 'stripe';
  return appStoreFirst ? 'shopify' : 'stripe';
}

// Eligibility only; the SQL reservation rechecks this under the entitlement lock.
export function isStripeBillingEligible(provider: string | null | undefined, connected: boolean, status: string | null | undefined) {
  return provider !== 'shopify' || (!connected && !['ACTIVE', 'FROZEN', 'PENDING'].includes(status || ''));
}
