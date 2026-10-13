import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/business/ad-spend-recovery/route.ts", "utf8");
const sql = readFileSync("supabase/migrations/20261013120000_manual_ad_spend_recovery.sql", "utf8");
const detail = readFileSync("app/business/manage-campaigns/[campaignId]/page.tsx", "utf8");
const workspace = readFileSync("components/campaigns/CampaignDetailWorkspace.tsx", "utf8");
const settlement = readFileSync("utils/adSpend/settlements.ts", "utf8");

for (const pattern of [
  /auth\.getUser\(\)/,
  /business_email.*user\.email/,
  /business_profiles/,
  /Object\.keys\(body\)\.length !== 1/,
  /INVALID_ORIGIN/,
  /manual_ad_spend_recoveries/,
  /META_AD_NOT_PAUSED/,
  /META_OBJECT_MISMATCH/,
  /date_preset: "maximum"/,
  /metaAd\.account_id/,
  /adAccount\.currency !== "AUD"/,
  /idea\.status !== "approved"/,
  /verified_meta_spend: metaSpend/,
  /writeMoneyFlowAudit/,
  /RECOVERY_ALREADY_REQUESTED/,
  /settleAdSpendLedger/,
  /CAMPAIGN_CHANGED_REVIEW_REQUIRED/,
  /GRACE_MS/,
]) {
  assert.match(route, pattern, "Missing mandatory recovery guard: " + pattern);
}
assert.doesNotMatch(route, /access_token=\$\{/);
assert.doesNotMatch(route, /chunkAmount:|body\.amount|body\.spend|req\.headers\.get\("x-cron-secret"\)/);
assert.match(sql, /live_ad_id uuid PRIMARY KEY/);
assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
assert.match(sql, /REVOKE ALL ON public\.manual_ad_spend_recoveries FROM PUBLIC, anon, authenticated/);
assert.match(sql, /GRANT ALL ON public\.manual_ad_spend_recoveries TO service_role/);
assert.match(sql, /NEW\.spend IS DISTINCT FROM OLD\.spend/);
assert.match(sql, /NEW\.spend_transferred IS DISTINCT FROM OLD\.spend_transferred/);
assert.match(sql, /NEW\.business_email IS DISTINCT FROM OLD\.business_email/);
assert.match(sql, /NEW\.meta_ad_id IS DISTINCT FROM OLD\.meta_ad_id/);
assert.match(sql, /REVOKE INSERT ON public\.live_ads FROM PUBLIC, anon, authenticated/);
assert.match(detail, /\/api\/business\/ad-spend-recovery\?liveAdId=/);
assert.match(detail, /body: JSON\.stringify\(\{ liveAdId: campaign\.id \}\)/);
assert.match(detail, /businessRecoveryEligible=\{recoveryState\.eligible\}/);
assert.match(workspace, /businessRecoveryEligible && !isOrganic/);
assert.match(workspace, /Meta confirms the final amount/);
assert.match(settlement, /buildAdSpendSettlementKey/);
assert.match(settlement, /settlement_key/);
console.log("manual ad spend recovery security checks passed");
