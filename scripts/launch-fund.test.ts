import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_LAUNCH_FUND_AMOUNT,
  DEFAULT_LAUNCH_FUND_EXPIRY_DAYS,
  getLaunchFundExpiryDays,
} from '../utils/launchFund';

const root = process.cwd();
const migrationSql = fs.readFileSync(path.join(root, 'supabase/migrations/20260728130000_affiliate_launch_fund.sql'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'utils/launchFund.ts'), 'utf8');
const fundingReadiness = fs.readFileSync(path.join(root, 'utils/paidCampaignLaunchReadiness.ts'), 'utf8');
const launchRoute = fs.readFileSync(path.join(root, 'app/api/business/ad-ideas/launch/route.ts'), 'utf8');
const internalRoute = fs.readFileSync(path.join(root, 'app/api/internal/launch-fund/route.ts'), 'utf8');
const offerRoute = fs.readFileSync(path.join(root, 'app/api/launch-fund/offer/route.ts'), 'utf8');
const campaignStartedRoute = fs.readFileSync(path.join(root, 'app/api/launch-fund/campaign-started/route.ts'), 'utf8');
const metaUploadRoute = fs.readFileSync(path.join(root, 'app/api/meta/callback/upload-video/route.ts'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const createAccountPage = fs.readFileSync(path.join(root, 'app/create-account/page.tsx'), 'utf8');
const onboardingPage = fs.readFileSync(path.join(root, 'app/onboarding/for-business/page.tsx'), 'utf8');

async function run() {
  assert.equal(DEFAULT_LAUNCH_FUND_AMOUNT, 10, 'Initial Launch Fund amount is AU$10.');
  assert.equal(DEFAULT_LAUNCH_FUND_EXPIRY_DAYS, 14, 'Launch Fund default expiry is 14 days.');
  delete process.env.LAUNCH_FUND_EXPIRY_DAYS;
  assert.equal(getLaunchFundExpiryDays(), 14, 'Expiry defaults to 14 days.');
  process.env.LAUNCH_FUND_EXPIRY_DAYS = '21';
  assert.equal(getLaunchFundExpiryDays(), 21, 'Expiry is configurable before implementation/deploy.');
  delete process.env.LAUNCH_FUND_EXPIRY_DAYS;

  // New affiliate receives no automatic credit.
  assert.doesNotMatch(createAccountPage + onboardingPage, /allocateLaunchFund|affiliate_launch_fund_allocations|launch_fund_allocated/, 'Signup/onboarding must not auto-grant Launch Fund credit.');

  // Dedicated audited structure remains separate from the cash wallet.
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.affiliate_launch_fund_allocations/);
  for (const column of ['id', 'affiliate_id', 'amount', 'currency', 'status', 'allocated_for_offer_id', 'allocated_for_campaign_id', 'reason', 'source', 'allocated_by', 'allocated_at', 'expires_at', 'redeemed_at', 'cancelled_at', 'created_at', 'updated_at']) {
    assert.match(migrationSql, new RegExp(column));
  }
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.affiliate_launch_fund_transactions/);
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.affiliate_launch_fund_events/);
  assert.match(migrationSql, /status IN \('allocated', 'reserved', 'redeemed', 'expired', 'cancelled'\)/);
  assert.match(migrationSql, /amount numeric\(12,2\) NOT NULL DEFAULT 10\.00/);
  assert.match(helper, /nonWithdrawable: true/);
  assert.match(helper, /nonTransferable: true/);
  assert.doesNotMatch(helper + internalRoute + offerRoute + campaignStartedRoute, /wallet_topups/);

  // Controlled allocation only.
  assert.match(internalRoute, /isTrustedLaunchFundRequest/);
  assert.match(helper, /INTERNAL_LAUNCH_FUND_KEY/);
  assert.match(internalRoute, /action === "allocate"/);
  assert.match(internalRoute, /action === "cancel"/);
  assert.match(internalRoute, /action === "history"/);
  assert.match(helper, /affiliate_requests/);
  assert.match(helper, /affiliate_not_approved/);
  assert.match(helper, /offer_not_active/);
  assert.match(helper, /duplicate_allocation_prevented/);
  assert.match(migrationSql, /affiliate_launch_fund_initial_offer_once_idx/);
  assert.match(migrationSql, /TO service_role/);
  assert.doesNotMatch(migrationSql, /TO authenticated[\s\S]*INSERT/, 'Affiliates must not be able to insert their own allocation.');

  // Existing Launch Fund lifecycle remains authoritative and separate from proposal submission.
  assert.match(helper, /getActiveLaunchFundAllocation/);
  assert.match(helper, /gt\("expires_at", new Date\(\)\.toISOString\(\)\)/);
  assert.match(helper, /allocated_for_offer_id/);
  assert.match(metaUploadRoute, /markLaunchFundCampaignWentLive/);
  assert.match(campaignStartedRoute, /launch_fund_campaign_started/);
  assert.doesNotMatch(campaignStartedRoute, /redeemed/, 'Submitting/starting must not redeem credit.');

  // Proposal-first launch readiness must include eligible Launch Fund credit at the
  // authoritative server boundary without reserving/redeeming it at proposal time.
  assert.match(fundingReadiness, /getActiveLaunchFundAllocation/);
  assert.match(fundingReadiness, /allocated_for_campaign_id/);
  assert.match(fundingReadiness, /!committedCampaignId/);
  assert.match(fundingReadiness, /walletAvailable \+ activationSubsidyAvailable \+ launchFundAvailable/);
  assert.match(launchRoute, /getAffiliateCampaignFundingReadiness/);
  assert.match(launchRoute, /AFFILIATE_CAMPAIGN_FUNDING_REQUIRED/);
  assert.doesNotMatch(launchRoute, /redeemLaunchFundForSettlement/);

  // Expiry, cancellation and analytics remain intact.
  assert.match(migrationSql, /expire_affiliate_launch_fund_allocations/);
  assert.match(helper, /cancelLaunchFundAllocation/);
  for (const eventName of ['launch_fund_allocated', 'launch_fund_viewed', 'launch_fund_campaign_started', 'launch_fund_redeemed', 'launch_fund_expired', 'launch_fund_cancelled', 'launch_fund_campaign_went_live']) {
    assert.match(migrationSql + helper + metaUploadRoute + offerRoute, new RegExp(eventName));
  }

  assert.match(packageJson, /test:launch-fund/);
  assert.match(helper, /allowDuplicate/);
  assert.match(helper, /allocation_not_redeemable/);
  assert.match(helper, /campaign_went_live/);
  assert.match(helper, /affiliate_launch_fund_transactions/);
  assert.match(helper, /settlement_key/);

  console.log('launch fund rollout tests passed');
}

void run();
