export const OFFER_ONBOARDING_BASELINE = {
  offerName: '', websiteUrl: '', productPrice: '', commissionPercent: '', description: '',
  currency: 'AUD', participationMode: 'open', offerType: 'one-time', conversionScope: 'store_wide',
  eligibleProductIdsText: '', eligibleVariantIdsText: '',
};
export type OfferOnboardingFields = typeof OFFER_ONBOARDING_BASELINE;

export function offerOnboardingDraftKey(userId: string) {
  return `nettmark:offer-onboarding-draft:${userId}`;
}

export function differsFromOfferOnboardingBaseline(
  fields: OfferOnboardingFields,
  baseline: OfferOnboardingFields = OFFER_ONBOARDING_BASELINE,
): boolean {
  return (Object.keys(baseline) as (keyof OfferOnboardingFields)[]).some(key => fields[key] !== baseline[key]);
}

/** Only explicitly allowed text fields can be restored or persisted. */
export function readOfferOnboardingDraft(raw: string | null): OfferOnboardingFields | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const fields = { ...OFFER_ONBOARDING_BASELINE };
    for (const key of Object.keys(fields) as (keyof OfferOnboardingFields)[]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'string') fields[key] = value;
    }
    if (!['open', 'approval_required', 'private'].includes(fields.participationMode) ||
      !['one-time', 'recurring'].includes(fields.offerType) ||
      !['store_wide', 'specific_products'].includes(fields.conversionScope)) return null;
    return differsFromOfferOnboardingBaseline(fields) ? fields : null;
  } catch { return null; }
}
