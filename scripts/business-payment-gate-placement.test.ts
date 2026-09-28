import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const affiliatePromote = readFileSync('app/affiliate/dashboard/promote/[offerId]/page.tsx', 'utf8');
const adIdeaRoute = readFileSync('app/api/business/ad-ideas/update-status/route.ts', 'utf8');
const launchRoute = readFileSync('app/api/business/ad-ideas/launch/route.ts', 'utf8');
const adIdeasPage = readFileSync('app/business/my-business/ad-ideas/page.tsx', 'utf8');
const postIdeasPage = readFileSync('app/business/my-business/post-ideas/page.tsx', 'utf8');
const myBusinessPage = readFileSync('app/business/my-business/page.tsx', 'utf8');

assert.doesNotMatch(affiliatePromote, /payment-readiness/);
assert.doesNotMatch(affiliatePromote, /businessPaymentReady/);
assert.doesNotMatch(affiliatePromote, /A payment method is required before paid campaigns can launch/);
assert.doesNotMatch(affiliatePromote, /The business needs a payment method before paid campaigns can launch/);

// Proposal submission/status mutation no longer owns launch billing. The centralized
// launch route re-checks it immediately before Meta creation.
assert.match(adIdeaRoute, /APPROVE_VIA_LAUNCH_REQUIRED/);
assert.match(launchRoute, /assertBusinessPaymentReadyForCommission/);
assert.match(launchRoute, /paymentReady\.error/);
assert.match(launchRoute, /connect_business_billing/);
assert.match(launchRoute, /business_email|businessEmail/);

assert.match(adIdeasPage, /BUSINESS_PAYMENT_METHOD_REQUIRED/);
assert.match(adIdeasPage, /billing=required&returnTo=\/business\/my-business\/ad-ideas/);

assert.match(postIdeasPage, /BUSINESS_PAYMENT_METHOD_REQUIRED/);
assert.match(postIdeasPage, /billing=required&returnTo=\/business\/my-business\/post-ideas/);

assert.match(myBusinessPage, /billingRequiredPrompt/);
assert.match(myBusinessPage, /not a Nettmark subscription/);
assert.match(myBusinessPage, /handleAddPaymentMethod/);

console.log('business payment gate placement tests passed');
