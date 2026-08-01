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
const internalRoute = fs.readFileSync(path.join(root, 'app/api/internal/launch-fund/route.ts'), 'utf8');
const offerRoute = fs.readFileSync(path.join(root, 'app/api/launch-fund/offer/route.ts'), 'utf8');
const campaignStartedRoute = fs.readFileSync(path.join(root, 'app/api/launch-fund/campaign-started/route.ts'), 'utf8');
const promotePage = fs.readFileSync(path.join(root, 'app/affiliate/dashboard/promote/[offerId]/page.tsx'), 'utf8');
const wizard = fs.readFileSync(path.join(root, 'app/affiliate/dashboard/promote/components/AdCampaignWizard.tsx'), 'utf8');
const settlementHelper = fs.readFileSync(path.join(root, 'utils/adSpend/settlements.ts'), 'utf8');
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

  // 1. New affiliate receives no automatic credit.
  assert.doesNotMatch(createAccountPage + onboardingPage, /allocateLaunchFund|affiliate_launch_fund_allocations|launch_fund_allocated/, 'Signup/onboarding must not auto-grant Launch Fund credit.');

  // A/B. Dedicated audited structure separate from cash wallet.
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

  // C/D. Controlled allocation only.
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

  // E. UI appears only after allocation and explains restrictions.
  assert.match(promotePage, /\/api\/launch-fund\/offer/);
  assert.match(promotePage, /launchFundAllocation &&/);
  assert.match(promotePage, /This offer qualifies for a \$10 Nettmark Launch Fund/);
  assert.match(promotePage, /cannot be withdrawn or transferred/);
  assert.match(promotePage, /expires/);
  assert.match(wizard, /Launch Fund credit is promotional ad credit only/);

  // F/G. Wallet integration and restrictions.
  assert.match(settlementHelper, /computeLaunchFundSpendSplit/);
  assert.match(settlementHelper, /redeemLaunchFundForSettlement/);
  assert.match(settlementHelper, /cashAmount/);
  assert.match(settlementHelper, /promotionalAmount/);
  assert.match(settlementHelper, /consumptionOrder: "launch_fund_then_cash"/);
  assert.match(settlementHelper, /amount: cashAmount[\s\S]*\.from\("wallet_deductions"\)/, 'Cash wallet deductions must record only the cash portion.');
  assert.doesNotMatch(settlementHelper, /wallet_topups/);
  assert.match(helper, /getActiveLaunchFundAllocation/);
  assert.match(helper, /gt\("expires_at", new Date\(\)\.toISOString\(\)\)/);
  assert.match(helper, /allocated_for_offer_id/);
  assert.match(metaUploadRoute, /markLaunchFundCampaignWentLive/);
  assert.match(campaignStartedRoute, /launch_fund_campaign_started/);
  assert.doesNotMatch(campaignStartedRoute, /redeemed/, 'Clicking/submitting must not redeem credit.');

  // H/I. Expiry, cancellation, analytics.
  assert.match(migrationSql, /expire_affiliate_launch_fund_allocations/);
  assert.match(helper, /cancelLaunchFundAllocation/);
  for (const eventName of ['launch_fund_allocated', 'launch_fund_viewed', 'launch_fund_campaign_started', 'launch_fund_redeemed', 'launch_fund_expired', 'launch_fund_cancelled', 'launch_fund_campaign_went_live']) {
    assert.match(migrationSql + helper + promotePage + metaUploadRoute, new RegExp(eventName));
  }

  // J. Requirement coverage and package script.
  assert.match(packageJson, /test:launch-fund/);
  assert.match(helper, /allowDuplicate/);
  assert.match(helper, /allocation_not_redeemable/);
  assert.match(helper, /campaign_went_live/);
  assert.match(helper, /affiliate_launch_fund_transactions/);
  assert.match(helper, /settlement_key/);

  console.log('launch fund rollout tests passed');
}

void run();
