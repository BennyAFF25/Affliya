import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const myBusinessPage = readFileSync('app/business/my-business/page.tsx', 'utf8');
const route = readFileSync('app/api/stripe/business-billing-profile/route.ts', 'utf8');

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

console.log('business billing profile tests passed');
