// Immutable signup cohort: never derive assignment from current subscription state.
export const BUSINESS_FUNNEL_ROLLOUT_AT = "2026-10-05T06:00:00.000Z";
// Preserve the original randomized window; future signups receive the full rollout.
export const BUSINESS_FUNNEL_FULL_ROLLOUT_AT = "2026-10-05T07:00:00.000Z";
export type BusinessFunnelVersion = "plan_choice_v1" | "trial_first_v1" | "trial_first_v1_100";
export function isTrialFirstBusinessFunnel(version: string | null | undefined) {
  return version === "trial_first_v1" || version === "trial_first_v1_100";
}
export function businessFunnelVersion(businessId: string, signedUpAt: string): BusinessFunnelVersion | null {
  if (!businessId || !Number.isFinite(Date.parse(signedUpAt)) || Date.parse(signedUpAt) < Date.parse(BUSINESS_FUNNEL_ROLLOUT_AT)) return null;
  // Validate identity before either allocation; prior assignments never change.
  const compact = businessId.replace(/-/g, "");
  if (!/^[a-f0-9]{32}$/i.test(compact)) return null;
  if (Date.parse(signedUpAt) >= Date.parse(BUSINESS_FUNNEL_FULL_ROLLOUT_AT)) return "trial_first_v1_100";
  // Original randomized window stays stable independent of visit/browser/billing.
  return parseInt(compact.slice(-2), 16) % 2 === 0 ? "trial_first_v1" : "plan_choice_v1";
}
export function businessFunnelMetadata(businessId: string, signedUpAt: string) {
  return {
    business_id: businessId,
    business_onboarding_funnel: businessFunnelVersion(businessId, signedUpAt) || "pre_experiment",
    business_onboarding_rollout_at: BUSINESS_FUNNEL_ROLLOUT_AT,
  };
}
export type GrowthPrice = { amount: number; currency: string; interval: string; intervalCount: number; formatted: string; taxNotice: string };
export function formatGrowthPrice(amount: number, currency: string) {
  const zeroDecimal = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","vnd","vuv","xaf","xof","xpf"]);
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: currency.toUpperCase(), currencyDisplay: "code" })
    .format(amount / (zeroDecimal.has(currency.toLowerCase()) ? 1 : 100));
}
