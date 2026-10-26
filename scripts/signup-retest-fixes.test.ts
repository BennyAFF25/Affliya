import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { supportWidgetHiddenRoute } from '../utils/supportWidget';
import { onboardingBrandKey, dedupeOnboardingOffers, rankOnboardingOffers, onboardingReadinessLabel, type OnboardingOffer } from '../utils/affiliate/onboarding';
import { computeOfferMetaReady } from '../utils/offerMetaReadiness';
import { passwordResetDestination, showPasswordUpdatedNoticeOn } from '../utils/auth/passwordResetDestination';

for (const path of ['/login', '/login/affiliate', '/auth/update-password', '/create-account', '/affiliate/inbox', '/affiliate/inbox/compose', '/business/inbox', '/business/inbox/thread/1']) {
  assert.equal(supportWidgetHiddenRoute(path), true, path);
}
for (const path of ['/onboarding/for-partners', '/onboarding/for-business', '/affiliate/dashboard/promote', '/affiliate/dashboard/reviews/paid/123', '/business/review-campaign/123', '/business/my-business/ad-ideas', '/business/my-business/post-ideas', '/lp/business-demo', '/lp/partner-demo']) {
  assert.equal(supportWidgetHiddenRoute(path, true), true, path);
  assert.equal(supportWidgetHiddenRoute(path), false, path);
}
for (const path of [null, '', '/', '/affiliate/dashboard', '/business/my-business', '/affiliate/inboxes', '/login-other', '/affiliate/marketplace']) assert.equal(supportWidgetHiddenRoute(path, true), false, String(path));
const offer = { id: 'a', title: 'Urban Spirit', description: '', participationMode: 'open', requestStatus: null, readyOrganicCount: 0 } as OnboardingOffer;
const other = { ...offer, id: 'b' };
assert.deepEqual(dedupeOnboardingOffers([offer, other, { ...offer, metaReady: true }]), [{ ...offer, metaReady: true }, other]);
assert.equal(rankOnboardingOffers([offer, offer, other]).length, 2);
assert.equal(onboardingReadinessLabel({ metaReady: computeOfferMetaReady({ business_email: 'brand@example.test', meta_page_id: 'page', meta_ad_account_id: 'ads' }).metaReady }), 'Ads enabled');
assert.equal(onboardingReadinessLabel({ metaReady: computeOfferMetaReady({ meta_page_id: 'page' }).metaReady }), 'Organic now, paid soon');
assert.equal(onboardingReadinessLabel({}), 'Organic now, paid soon');
const api = readFileSync('app/api/onboarding/affiliate-offers/route.ts', 'utf8');
assert.match(api, /from\("offers"\)\.select\("\*"\)/); // Includes all readiness fields.
assert.match(api, /metaReady: computeOfferMetaReady\(row, connectionsByBusiness/);
assert.match(api, /select\("business_email,page_id,ad_account_id"\)/);
assert.equal(onboardingReadinessLabel({ metaReady: computeOfferMetaReady({ business_email: 'brand@example.test' }, [{ page_id: 'page', ad_account_id: 'ads' }]).metaReady }), 'Ads enabled');
assert.equal(onboardingReadinessLabel({ metaReady: computeOfferMetaReady({ business_email: 'brand@example.test' }, [{ page_id: 'one', ad_account_id: 'ads' }, { page_id: 'two' }]).metaReady }), 'Organic now, paid soon');
for (const role of ['affiliate', 'business', 'admin', undefined]) assert.equal(passwordResetDestination(true, role), '/auth-redirect?passwordUpdated=1');
for (const role of ['affiliate', 'business']) assert.equal(passwordResetDestination(false, role), `/login/${role}?reset=1&passwordUpdated=1`);
assert.equal(passwordResetDestination(false, '', 'business'), '/login/business?reset=1&passwordUpdated=1');
for (const role of [undefined, 'admin', '/business/my-business']) assert.equal(passwordResetDestination(false, role), '/login?passwordUpdated=1');
for (const p of ['/business/choose-plan', '/onboarding/for-partners', '/affiliate/dashboard', '/login/business', '/business/my-business']) assert.ok(showPasswordUpdatedNoticeOn(p), p);
for (const p of ['/auth-redirect', '/auth/update-password', null]) assert.ok(!showPasswordUpdatedNoticeOn(p));
const notice = readFileSync('components/PasswordUpdatedNotice.tsx', 'utf8');
assert.match(notice, /sessionStorage/);
console.log('Signup retest fixes passed');

assert.equal(onboardingBrandKey({ business_email: "A@x.com", title: "Urban Spirit " }), onboardingBrandKey({ business_email: "a@x.com", title: "urban spirit" }));
assert.notEqual(onboardingBrandKey({ business_email: "a@x.com", title: "Urban Spirit" }), onboardingBrandKey({ business_email: "b@x.com", title: "Urban Spirit" }));
