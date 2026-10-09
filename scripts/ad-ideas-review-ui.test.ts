import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/business/my-business/ad-ideas/page.tsx', 'utf8');
const route = readFileSync('app/api/business/ad-ideas/review-readiness/route.ts', 'utf8');
const launchRoute = readFileSync('app/api/business/ad-ideas/launch/route.ts', 'utf8');
const detailPage = readFileSync('app/business/my-business/ad-ideas/[id]/page.tsx', 'utf8');
const reviewRoute = readFileSync('app/api/business/ad-ideas/[adIdeaId]/review/route.ts', 'utf8');
const metaUploadRoute = readFileSync('app/api/meta/callback/upload-video/route.ts', 'utf8');
const businessLogin = readFileSync('app/login/business/page.tsx', 'utf8');
const affiliateLogin = readFileSync('app/login/affiliate/page.tsx', 'utf8');
const webhookDedupeMigration = readFileSync('supabase/migrations/20261009095838_dedupe_proposal_approved_webhooks.sql', 'utf8');
const webhookLaunchMigration = readFileSync('supabase/migrations/20261009102230_emit_proposal_approved_only_after_live_launch.sql', 'utf8');
const cleanupPartialRoute = readFileSync('app/api/business/ad-ideas/cleanup-partial/route.ts', 'utf8');

// Business review remains proposal-first: the business can inspect pending proposals,
// see current derived launch blockers, reject at any time, and only launch when ready.
assert.match(page, /RequirementCard/);
assert.match(page, /Commission\/ad-spend billing/);
assert.match(page, /Nettmark Business subscription/);
assert.match(page, /not the Nettmark subscription/);
assert.match(page, /Start 14-day Growth trial/);
assert.match(page, /Connect billing/);
assert.match(page, /function formatBudgetLabel/);
assert.match(page, /idea\.budget_amount \/ 100/);
assert.doesNotMatch(page, /Budget \$\{idea\.daily_budget \|\| idea\.budget_amount\}/);
assert.match(page, /review-readiness/);
assert.match(page, /campaignReadiness/);
assert.match(page, /isCampaignReady/);
assert.match(page, /Waiting for affiliate funding/);
assert.match(page, /Campaign dates need updating/);
assert.match(page, /Previous Meta launch needs recovery before retry/);
assert.match(page, /Approve &amp; launch/);
assert.match(page, /disabled=\{reviewReadinessLoading \|\| !isCampaignReady\(idea\.id\)\}/);
assert.match(page, />\s*Reject\s*</);

// Proposal detail must explain the exact blocker and keep affiliate identity public-only.
assert.match(detailPage, /Commission billing required/);
assert.match(detailPage, /Add commission payment method/);
assert.match(detailPage, /CommissionBillingForm/);
assert.match(detailPage, /affiliate_username/);
assert.doesNotMatch(detailPage, /proposal\.affiliate_email/);
assert.doesNotMatch(detailPage, />Setup required</i);
assert.match(reviewRoute, /affiliate_username/);
assert.doesNotMatch(reviewRoute, /affiliate_email:\s*idea\.affiliate_email/);

// Review readiness is derived from current server-side state rather than submission-time assumptions.
assert.match(route, /getBusinessPaymentReadiness/);
assert.match(route, /getBusinessEntitlement/);
assert.match(route, /getAffiliateCampaignFundingReadiness/);
assert.match(route, /assertOfferTrackingReady/);
assert.match(route, /resolveOfferPaidReadiness/);
assert.match(route, /validatePaidCampaignTiming/);
assert.match(route, /business_profiles/);
assert.match(route, /fallbackBusinessId/);
assert.match(route, /billing/);
assert.match(route, /subscription/);
assert.match(route, /campaigns/);

// UI readiness is advisory; launch route independently revalidates hard blockers.
assert.match(launchRoute, /getAffiliateCampaignFundingReadiness/);
assert.match(launchRoute, /assertOfferTrackingReady/);
assert.match(launchRoute, /requireBusinessCampaignLaunchEntitlement/);
assert.match(launchRoute, /assertBusinessPaymentReadyForCommission/);
assert.match(launchRoute, /validatePaidCampaignTiming/);

// Meta v24+ requires an explicit ad-set budget sharing decision for ad-set budgets.
assert.match(metaUploadRoute, /is_adset_budget_sharing_enabled:\s*false/);
assert.match(metaUploadRoute, /error_user_msg/);
assert.match(metaUploadRoute, /status:\s*"PAUSED"/);
assert.match(metaUploadRoute, /execution_options/);
assert.match(metaUploadRoute, /validate_only/);
assert.match(metaUploadRoute, /requestedAgeMax >= 65/);
assert.match(metaUploadRoute, /advantage_audience:\s*useAdvantageAudience \? 1 : 0/);
assert.match(metaUploadRoute, /cleanupPartialMetaCampaign/);
assert.match(metaUploadRoute, /status:\s*"paused"/);
assert.match(metaUploadRoute, /new URLSearchParams\(\{ status: "ACTIVE" \}\)/);
assert.match(detailPage, /Meta cleanup required/);
assert.match(detailPage, /Clean up partial campaign/);
assert.match(detailPage, /\/api\/business\/ad-ideas\/cleanup-partial/);
assert.match(cleanupPartialRoute, /auth\.getUser/);
assert.match(cleanupPartialRoute, /live_ads/);
assert.match(cleanupPartialRoute, /method:\s*"DELETE"/);
assert.match(cleanupPartialRoute, /meta_campaign_id:\s*null/);

// Failed launch errors must survive the readiness refresh so users see the real Meta failure.
assert.match(detailPage, /const launchError/);
assert.match(detailPage, /await load\(\);\s*setError\(launchError\)/);

// Login must never globally revoke an existing session just to switch accounts.
assert.doesNotMatch(businessLogin, /auth\.signOut\(\)/);
assert.doesNotMatch(affiliateLogin, /auth\.signOut\(\)/);

// Proposal approval webhook is one-time per proposal, even after launch retries.
assert.match(webhookDedupeMigration, /proposal\.approved:/);
assert.match(webhookDedupeMigration, /before insert on public\.affiliate_webhook_outbox/);
assert.match(metaUploadRoute, /enqueueAffiliateWebhookEvent/);
assert.match(metaUploadRoute, /eventType:\s*"proposal\.approved"/);
assert.match(metaUploadRoute, /live_ad_id:/);
assert.match(webhookLaunchMigration, /not exists[\s\S]*public\.live_ads/);
assert.match(webhookLaunchMigration, /return null/);

console.log('ad ideas review UI tests passed');
