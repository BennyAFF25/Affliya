import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const myBusinessPage = readFileSync('app/business/my-business/page.tsx', 'utf8');
const route = readFileSync('app/api/stripe/business-billing-profile/route.ts', 'utf8');
const readinessRoute = readFileSync('app/api/stripe/check-customer-card/route.ts', 'utf8');

assert.doesNotMatch(myBusinessPage, /\.from\("business_profiles"\)\s*\n\s*\.select\(\s*\n\s*"stripe_customer_id, stripe_account_id, stripe_onboarding_complete"/);
assert.doesNotMatch(myBusinessPage, /\.eq\("business_email", user\.email\)\s*\n\s*\.single\(\)/);
assert.match(myBusinessPage, /\/api\/stripe\/business-billing-profile/);
assert.match(myBusinessPage, /billingRequiredPrompt/);
assert.match(myBusinessPage, /void handleConnectBilling\(\)/);

assert.match(route, /business_profiles/);
assert.match(route, /\.limit\(1\)/);
assert.match(route, /\.maybeSingle\(\)/);
assert.match(route, /stripe\.customers\.create/);
assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(route, /stripe_customer_id/);

// Billing readiness must come from the same server-side Stripe helper used by launch checks.
// Browser-local cache must never be authoritative.
assert.doesNotMatch(myBusinessPage, /nm_has_card_/);
assert.doesNotMatch(myBusinessPage, /localStorage\.getItem\([^\n]*has_card/);
assert.match(myBusinessPage, /\/api\/stripe\/check-customer-card/);
assert.match(readinessRoute, /getBusinessPaymentReadiness/);
assert.match(readinessRoute, /createServerSupabaseClient/);
assert.doesNotMatch(readinessRoute, /paymentMethods\.list/);
assert.doesNotMatch(readinessRoute, /customers\.retrieve/);

console.log('business billing profile tests passed');
