import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isBusinessSubscriptionGateEnabled,
  assertBusinessSubscriptionGate,
} from '../utils/businessEntitlements';

const root = process.cwd();
const migrationSql = [
  'supabase/migrations/20260721101000_business_subscription_gate.sql',
  'supabase/migrations/20260813090000_paid_ad_only_business_subscription_gate.sql',
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const paidAdOnlyMigrationSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260813090000_paid_ad_only_business_subscription_gate.sql'),
  'utf8',
);
const modal = fs.readFileSync(
  path.join(root, 'components/business/BusinessSubscriptionActivationModal.tsx'),
  'utf8',
);
const affiliateRoute = fs.readFileSync(
  path.join(root, 'app/api/business/affiliate-requests/update-status/route.ts'),
  'utf8',
);
const adIdeaRoute = fs.readFileSync(
  path.join(root, 'app/api/business/ad-ideas/update-status/route.ts'),
  'utf8',
);
const organicRoute = fs.readFileSync(
  path.join(root, 'app/api/business/organic-campaigns/route.ts'),
  'utf8',
);
const metaRoute = fs.readFileSync(
  path.join(root, 'app/api/meta/callback/upload-video/route.ts'),
  'utf8',
);
const checkoutRoute = fs.readFileSync(
  path.join(root, 'app/api/business-subscription/create-checkout-session/route.ts'),
  'utf8',
);
const webhookRoute = fs.readFileSync(
  path.join(root, 'app/api/business-subscription/webhook/route.ts'),
  'utf8',
);
const analyticsRoute = fs.readFileSync(
  path.join(root, 'app/api/business-subscription/analytics/route.ts'),
  'utf8',
);
const analyticsHelper = fs.readFileSync(
  path.join(root, 'utils/businessSubscriptionAnalytics.ts'),
  'utf8',
);
const postIdeasPage = fs.readFileSync(
  path.join(root, 'app/business/my-business/post-ideas/page.tsx'),
  'utf8',
);
const adIdeasPage = fs.readFileSync(
  path.join(root, 'app/business/my-business/ad-ideas/page.tsx'),
  'utf8',
);
const affiliateRequestsPage = fs.readFileSync(
  path.join(root, 'app/business/my-business/affiliate-requests/page.tsx'),
  'utf8',
);
const businessDashboardPage = fs.readFileSync(
  path.join(root, 'app/business/dashboard/page.tsx'),
  'utf8',
);
const approvalEnforcement = fs.readFileSync(
  path.join(root, 'utils/approvals/enforcement.ts'),
  'utf8',
);

async function run() {
  // Gate is independently staged and defaults off.
  delete process.env.BUSINESS_SUBSCRIPTIONS_ENABLED;
  delete process.env.BUSINESS_SUBSCRIPTION_GATE_ENABLED;
  assert.equal(isBusinessSubscriptionGateEnabled(), false);
  assert.match(migrationSql, /VALUES \('campaign_activation', false\)/);
  assert.match(migrationSql, /business_subscription_gate_settings/);

  // Database backstop protects only paid ad idea approval and paid live_ad inserts once enabled.
  assert.match(paidAdOnlyMigrationSql, /DROP TRIGGER IF EXISTS enforce_business_subscription_affiliate_requests/);
  assert.match(paidAdOnlyMigrationSql, /DROP TRIGGER IF EXISTS enforce_business_subscription_live_campaigns/);
  assert.match(paidAdOnlyMigrationSql, /BEFORE UPDATE ON public\.ad_ideas/);
  assert.match(paidAdOnlyMigrationSql, /BEFORE INSERT ON public\.live_ads/);
  assert.doesNotMatch(paidAdOnlyMigrationSql, /CREATE TRIGGER enforce_business_subscription_affiliate_requests/);
  assert.doesNotMatch(paidAdOnlyMigrationSql, /CREATE TRIGGER enforce_business_subscription_live_campaigns/);
  assert.match(paidAdOnlyMigrationSql, /BUSINESS_SUBSCRIPTION_REQUIRED/);

  // Analytics uses the exact Rollout 3 event names and carries safe campaign/business/attribution context.
  for (const eventName of [
    'campaign_received_by_business',
    'campaign_review_opened',
    'subscription_gate_viewed',
    'subscription_checkout_started',
    'subscription_checkout_cancelled',
    'subscription_activated',
    'campaign_approved_after_subscription',
    'subscription_gate_dismissed',
  ]) {
    assert.match(migrationSql + analyticsHelper + analyticsRoute + modal + webhookRoute, new RegExp(eventName));
  }
  assert.match(migrationSql + analyticsHelper + analyticsRoute, /campaign_id/);
  assert.match(migrationSql + analyticsHelper + analyticsRoute, /business_id/);
  assert.match(migrationSql + analyticsHelper + analyticsRoute, /attribution/);

  // User-facing modal has the required copy and preserves intent.
  assert.match(modal, /Launch your paid affiliate ad/);
  assert.match(modal, /\$49 AUD/);
  assert.match(modal, /nettmark:business-subscription-intent/);
  assert.match(modal, /submissionId/);
  assert.match(modal, /intendedAction/);
  assert.match(modal, /returnTo/);
  assert.match(modal, /max-w-lg rounded-t-\[28px\]/, 'Mobile modal should render bottom-sheet style before centering on larger screens');
  assert.match(modal, /subscription_checkout_cancelled/);

  // Server-side gate opens only for paid ad approval/launch, not ordinary affiliate or organic flows.
  assert.doesNotMatch(affiliateRoute, /requireBusinessCampaignLaunchEntitlement/);
  assert.doesNotMatch(organicRoute, /requireBusinessCampaignLaunchEntitlement/);
  for (const source of [adIdeaRoute, metaRoute]) {
    assert.match(source, /requireBusinessCampaignLaunchEntitlement/);
    assert.match(source, /BUSINESS_SUBSCRIPTION_REQUIRED|subscriptionRequired|buildSubscriptionRequiredResponse/);
  }

  // Launch enforcement must agree with the business offer card readiness badges.
  assert.doesNotMatch(approvalEnforcement, /select\('id, business_email, tracking_connected/);
  assert.match(approvalEnforcement, /site_host, meta_pixel_id/);
  assert.match(approvalEnforcement, /offerRow\.site_host \|\| offerRow\.meta_pixel_id/);

  // Review pages allow free businesses to inspect submissions before approval/launch.
  assert.match(postIdeasPage + adIdeasPage + affiliateRequestsPage, /campaign_received_by_business/);
  assert.match(postIdeasPage + adIdeasPage, /campaign_review_opened/);

  // The Nettmark Business checkout modal is available only from paid Ad Ideas.
  assert.match(adIdeasPage, /<BusinessSubscriptionActivationModal/);
  assert.doesNotMatch(businessDashboardPage + affiliateRequestsPage + postIdeasPage, /<BusinessSubscriptionActivationModal/);
  assert.doesNotMatch(businessDashboardPage + affiliateRequestsPage + postIdeasPage, /readSubscriptionIntentFromResponse/);

  // Checkout preserves the return route instead of granting entitlement in-browser.
  assert.match(checkoutRoute, /safeReturnPath/);
  assert.match(checkoutRoute, /success_url: `\$\{baseUrl\}\$\{returnTo\}/);
  assert.match(checkoutRoute, /entitlement\.isGrandfathered/);
  assert.match(checkoutRoute, /subscription_checkout_started/);
  assert.match(checkoutRoute, /campaignId/);
  assert.match(webhookRoute, /subscription_activated/);
  assert.match(adIdeaRoute + metaRoute, /campaign_approved_after_subscription/);

  // Entitlement gate allows grandfathered / active subscribers and blocks free businesses only when both flags are enabled.
  process.env.BUSINESS_SUBSCRIPTIONS_ENABLED = 'true';
  process.env.BUSINESS_SUBSCRIPTION_GATE_ENABLED = 'true';

  const grandfathered = await assertBusinessSubscriptionGate({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                business_id: 'biz_1',
                business_email: 'owner@example.com',
                billing_status: 'grandfathered',
                is_grandfathered: true,
                subscription_required: false,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never,
    businessId: 'biz_1',
  });
  assert.equal(grandfathered.ok, true, '1. Grandfathered business approves without a prompt.');

  const activeSubscriber = await assertBusinessSubscriptionGate({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                business_id: 'biz_active',
                business_email: 'active@example.com',
                billing_status: 'subscription_active',
                is_grandfathered: false,
                subscription_required: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never,
    businessId: 'biz_active',
  });
  assert.equal(activeSubscriber.ok, true, '2. Active subscriber approves without a prompt.');

  const blocked = await assertBusinessSubscriptionGate({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                business_id: 'biz_2',
                business_email: 'new@example.com',
                billing_status: 'subscription_required',
                is_grandfathered: false,
                subscription_required: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never,
    businessId: 'biz_2',
  });
  assert.equal(blocked.ok, false, '4. New free business is gated at approval/launch.');
  if (!blocked.ok) assert.equal(blocked.error, 'BUSINESS_SUBSCRIPTION_REQUIRED');

  process.env.BUSINESS_SUBSCRIPTION_GATE_ENABLED = 'false';
  const flagOff = await assertBusinessSubscriptionGate({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                business_id: 'biz_2',
                business_email: 'new@example.com',
                billing_status: 'subscription_required',
                is_grandfathered: false,
                subscription_required: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never,
    businessId: 'biz_2',
  });
  assert.equal(flagOff.ok, true, '12. Turning off the gate feature flag restores the old workflow.');

  assert.match(adIdeaRoute + metaRoute, /status: 402/, '5. Direct paid-ad API attempt is blocked.');
  assert.doesNotMatch(affiliateRoute + organicRoute, /status: 402/, '5a. Affiliate request and organic flows do not open the subscription gate.');
  assert.match(checkoutRoute, /getOwnedBusinessForUser/, '6. Checkout begins from the correct business and campaign.');
  assert.match(modal + checkoutRoute, /subscription=cancelled/, '7. Cancelled Checkout returns safely.');
  assert.match(webhookRoute, /syncBusinessEntitlementFromStripeSubscription/, '8. Successful webhook activation unlocks the campaign.');
  assert.match(modal + checkoutRoute, /nettmark:business-subscription-intent|submissionId/, '9. Intended campaign remains available after activation.');
  assert.doesNotMatch(paidAdOnlyMigrationSql, /CREATE TRIGGER enforce_business_subscription_live_campaigns/, '11. Organic live campaigns are not subscription-gated.');

  console.log('business subscription gate tests passed');
}

void run();
