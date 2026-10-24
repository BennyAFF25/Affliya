/** Segment names shared by business and standalone account/return routes. */
export const BUSINESS_OFFER_NUDGE_EXEMPT_SEGMENTS = [
  'choose-plan', 'billing', 'account', 'settings', 'logout', 'onboarding',
  'connect-meta', 'meta-connect', 'meta', 'subscription', 'subscription-return',
] as const;

export function isBusinessOfferOnboardingExempt(pathname: string): boolean {
  const [path, query = ''] = pathname.split('?');
  const segments = path.split('/').filter(Boolean);
  return BUSINESS_OFFER_NUDGE_EXEMPT_SEGMENTS.some(segment => segments.includes(segment)) ||
    new URLSearchParams(query).has('subscription');
}

export function businessOfferOnboardingSessionKey(userId: string): string {
  return `nettmark:offer-onboarding-nudge:${userId}`;
}

type NudgeInput = {
  billingStatus: string | null | undefined;
  offerCount: number | null;
  pathname: string;
  sessionFlag: boolean;
};

export function businessOfferOnboardingNudge(input: NudgeInput) {
  const eligible = (input.billingStatus === 'subscription_trialing' || input.billingStatus === 'subscription_active') &&
    input.offerCount === 0 && !isBusinessOfferOnboardingExempt(input.pathname);
  return { shouldRedirect: eligible && !input.sessionFlag, shouldShowBanner: eligible && input.sessionFlag };
}
