import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  entitlementAllowsBillingAccess,
  isLiveStripeSubscription,
  mapStripeSubscriptionStatus,
  resolveBillingStatusFromSubscription,
  shouldPreserveAccessUntilPeriodEnd,
} from '../utils/businessSubscriptions';
import { evaluateBusinessEntitlement } from '../utils/businessEntitlements';

const root = process.cwd();
const migrationSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260721092000_business_subscription_stripe_sync.sql'),
  'utf8',
);
const checkoutRoute = fs.readFileSync(
  path.join(root, 'app/api/business-subscription/create-checkout-session/route.ts'),
  'utf8',
);
const portalRoute = fs.readFileSync(
  path.join(root, 'app/api/business-subscription/create-portal-session/route.ts'),
  'utf8',
);
const webhookRoute = fs.readFileSync(
  path.join(root, 'app/api/business-subscription/webhook/route.ts'),
  'utf8',
);
const getSessionRoute = fs.readFileSync(
  path.join(root, 'app/api/business-subscription/get-session/route.ts'),
  'utf8',
);
const helper = fs.readFileSync(path.join(root, 'utils/businessSubscriptions.ts'), 'utf8');

function run() {
  // 1. New business creates a Checkout Session.
  assert.match(checkoutRoute, /stripe\.checkout\.sessions\.create\(/);
  assert.match(checkoutRoute, /mode:\s*"subscription"/);
  assert.match(checkoutRoute, /STRIPE_NETTMARK_BUSINESS_MONTHLY_PRICE_ID|BusinessSubscriptionPriceId/);

  // 2. Subscription checkout keeps the revenue Stripe customer separate from the transactions Stripe customer.
  assert.match(helper, /existingSubscriptionCustomerId = params\.entitlement\.subscriptionStripeCustomerId/);
  assert.doesNotMatch(helper, /entitlement\.subscriptionStripeCustomerId \|\| params\.business\.stripe_customer_id/);
  assert.match(helper, /customers\.retrieve\(existingSubscriptionCustomerId\)/);
  assert.match(helper, /customers\.search/);

  // 3. Grandfathered business does not get charged.
  assert.match(checkoutRoute, /if \(entitlement\.isGrandfathered\)/);
  assert.match(checkoutRoute, /status:\s*"grandfathered"/);

  // 4. Duplicate active subscription is prevented.
  assert.equal(isLiveStripeSubscription('active'), true);
  assert.equal(isLiveStripeSubscription('trialing'), true);
  assert.equal(isLiveStripeSubscription('past_due'), true);
  assert.equal(isLiveStripeSubscription('canceled'), false);
  assert.match(checkoutRoute, /findExistingLiveSubscription/);
  assert.match(checkoutRoute, /already_subscribed/);
  assert.match(checkoutRoute, /idempotencyKey:\s*`business_subscription_checkout:/);

  // 5. Checkout completion browser return alone does not grant entitlement.
  assert.match(getSessionRoute, /entitlementUpdated:\s*false/);
  assert.doesNotMatch(getSessionRoute, /from\("business_entitlements"\)\.update/);

  // 6. Webhook activates the subscription.
  assert.equal(mapStripeSubscriptionStatus('active'), 'subscription_active');
  assert.equal(resolveBillingStatusFromSubscription({ id: 'sub_1', status: 'active' }), 'subscription_active');
  assert.match(webhookRoute, /checkout\.session\.completed/);
  assert.match(webhookRoute, /syncBusinessEntitlementFromStripeSubscription/);

  // 7. Payment failure changes billing state.
  assert.equal(mapStripeSubscriptionStatus('past_due'), 'subscription_past_due');
  assert.equal(mapStripeSubscriptionStatus('unpaid'), 'subscription_unpaid');
  assert.match(webhookRoute, /invoice\.payment_failed/);

  // 8. Cancellation preserves access until period end.
  const future = Math.floor(Date.now() / 1000) + 86400;
  assert.equal(
    shouldPreserveAccessUntilPeriodEnd({ id: 'sub_2', status: 'canceled', cancel_at_period_end: true, current_period_end: future }),
    true,
  );
  assert.equal(
    resolveBillingStatusFromSubscription({ id: 'sub_2', status: 'canceled', cancel_at_period_end: true, current_period_end: future }),
    'subscription_active',
  );

  // 9. Webhook replay is idempotent.
  assert.match(migrationSql, /stripe_event_id text NOT NULL/);
  assert.match(migrationSql, /UNIQUE \(stripe_event_id\)/);
  assert.match(webhookRoute, /insert\(\{[\s\S]*stripe_event_id: event\.id/);
  assert.match(webhookRoute, /insertEvent\.error\.code === "23505"/);

  // 10. Unauthorised user cannot create Checkout for another business.
  assert.match(checkoutRoute, /auth\.getUser\(\)/);
  assert.match(checkoutRoute, /getOwnedBusinessForUser/);
  assert.match(helper, /\.eq\("id", params\.businessId\)[\s\S]*\.eq\("business_email", params\.userEmail\)/);

  // Billing portal is restricted to subscribers/subscription customers.
  assert.match(portalRoute, /entitlementAllowsBillingAccess/);
  assert.match(portalRoute, /billingPortal\.sessions\.create/);

  // Entitlement evaluation knows trialing is launch-capable for future Rollout 3 enforcement, but no route gates launches here.
  const trialing = evaluateBusinessEntitlement({
    business_id: 'biz_1',
    business_email: 'owner@example.com',
    billing_status: 'subscription_trialing',
    is_grandfathered: false,
    subscription_required: true,
  });
  assert.equal(trialing.hasActiveSubscription, true);
  assert.equal(entitlementAllowsBillingAccess(trialing), true);

  assert.doesNotMatch(portalRoute + webhookRoute, /approve|launch/i, 'Billing portal/webhook must not gate campaign approval or launch');

  console.log('business-subscriptions tests passed');
}

run();
