import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/business/my-business/ad-ideas/page.tsx', 'utf8');
const route = readFileSync('app/api/business/ad-ideas/review-readiness/route.ts', 'utf8');

assert.match(page, /Paid launch review/);
assert.match(page, /RequirementCard/);
assert.match(page, /Commission\/ad-spend billing/);
assert.match(page, /Nettmark Business subscription/);
assert.match(page, /not the Nettmark subscription/);
assert.match(page, /Start subscription/);
assert.match(page, /Connect billing/);
assert.match(page, /function formatBudgetLabel/);
assert.match(page, /idea\.budget_amount \/ 100/);
assert.doesNotMatch(page, /Budget \$\{idea\.daily_budget \|\| idea\.budget_amount\}/);
assert.match(page, /review-readiness/);
assert.match(page, /Finish billing and subscription above before this can launch/);
assert.match(page, /disabled=\{!launchRequirementsReady\}/);
assert.match(page, /bg-\[#05080b\]/);

assert.match(route, /getBusinessPaymentReadiness/);
assert.match(route, /getBusinessEntitlement/);
assert.match(route, /business_profiles/);
assert.match(route, /fallbackBusinessId/);
assert.match(route, /billing/);
assert.match(route, /subscription/);

console.log('ad ideas review UI tests passed');
