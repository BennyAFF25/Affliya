import assert from 'node:assert/strict';
import { businessOfferOnboardingNudge, businessOfferOnboardingSessionKey, isBusinessOfferOnboardingExempt } from '../utils/businessOfferOnboardingNudge';
import { OFFER_ONBOARDING_BASELINE as baseline, differsFromOfferOnboardingBaseline, offerOnboardingDraftKey, readOfferOnboardingDraft } from '../utils/offerOnboardingDraft';

const input = { billingStatus: 'subscription_trialing', offerCount: 0, pathname: '/business/dashboard', sessionFlag: false };
for (const billingStatus of ['subscription_trialing', 'subscription_active']) {
  assert.deepEqual(businessOfferOnboardingNudge({ ...input, billingStatus }), { shouldRedirect: true, shouldShowBanner: false });
  assert.deepEqual(businessOfferOnboardingNudge({ ...input, billingStatus, sessionFlag: true }), { shouldRedirect: false, shouldShowBanner: true });
}
for (const billingStatus of [null, undefined, 'free', 'grandfathered', 'subscription_required', 'subscription_past_due', 'subscription_unpaid', 'subscription_incomplete', 'subscription_cancelled']) {
  for (const sessionFlag of [false, true]) assert.deepEqual(businessOfferOnboardingNudge({ ...input, billingStatus, sessionFlag }), { shouldRedirect: false, shouldShowBanner: false });
}
for (const offerCount of [null, 1, 2, -1]) {
  for (const sessionFlag of [false, true]) assert.deepEqual(businessOfferOnboardingNudge({ ...input, offerCount, sessionFlag }), { shouldRedirect: false, shouldShowBanner: false });
}
for (const pathname of ['/business/choose-plan', '/business/billing', '/business/billing/history', '/business/account', '/business/settings', '/logout', '/business/logout', '/business/my-business/connect-meta', '/business/meta/connect', '/business/meta-connect', '/subscription/return', '/business/subscription-return', '/onboarding', '/onboarding/for-business', '/business/my-business?subscription=trial_confirmed', '/business/my-business?subscription=processing']) {
  assert.equal(isBusinessOfferOnboardingExempt(pathname), true, pathname);
  for (const sessionFlag of [false, true]) assert.deepEqual(businessOfferOnboardingNudge({ ...input, pathname, sessionFlag }), { shouldRedirect: false, shouldShowBanner: false }, pathname);
}
assert.equal(isBusinessOfferOnboardingExempt('/business/my-business'), false);
assert.equal(isBusinessOfferOnboardingExempt('/business/billing-report'), false);
assert.notEqual(businessOfferOnboardingSessionKey('one'), businessOfferOnboardingSessionKey('two'));
assert.notEqual(offerOnboardingDraftKey('one'), offerOnboardingDraftKey('two'));
assert.equal(differsFromOfferOnboardingBaseline({ ...baseline }), false);
const prefilled = { ...baseline, offerName: 'Prefilled brand' };
assert.equal(differsFromOfferOnboardingBaseline({ ...prefilled }, prefilled), false);
assert.equal(differsFromOfferOnboardingBaseline({ ...prefilled, description: 'Edited' }, prefilled), true);
for (const key of Object.keys(baseline) as (keyof typeof baseline)[]) assert.equal(differsFromOfferOnboardingBaseline({ ...baseline, [key]: 'changed' }), true, key);
for (const raw of [null, '', '{', 'null', '[]', '{}', JSON.stringify(baseline), '{"logoFile":{},"secret":"excluded"}']) assert.equal(readOfferOnboardingDraft(raw), null);
assert.deepEqual(readOfferOnboardingDraft(JSON.stringify({ ...prefilled, secret: 'excluded', logoFile: {}, productImagePreviews: ['blob:excluded'] })), prefilled);
assert.equal(readOfferOnboardingDraft(JSON.stringify({ ...prefilled, participationMode: 'invalid' })), null);
console.log('Business offer onboarding nudge and draft tests passed.');
