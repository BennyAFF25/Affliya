import { parseTrackingRef } from "../utils/tracking/parseTrackingRef";
import assert from "node:assert/strict";
import { formatGrowthPrice } from "../utils/businessOnboardingFunnel";
import { shouldPauseForFunding } from "../utils/adSpend/pauseGuardrail";
import { buildTrackingUrl } from "../utils/tracking/buildTrackingUrl";
import { isLikelyAutomatedVisit } from "../utils/tracking/visitMetrics";
assert.equal(formatGrowthPrice(4900, "AUD"), "A$49");
assert.equal(formatGrowthPrice(4950, "AUD"), "A$49.5");
assert.equal(shouldPauseForFunding(0, 0, 0), true);
assert.equal(shouldPauseForFunding(30, 15, 10), false);
assert.equal(shouldPauseForFunding(15, 0, 10), false);
assert.equal(shouldPauseForFunding(5, 0, 10), true, "Debit exhausting the buffer must pause even with no unpaid spend");
assert.equal(shouldPauseForFunding(10, 15, 10), true);
assert.equal(buildTrackingUrl({ campaignId: "campaign", affiliateId: "private@example.com" }), "https://www.nettmark.com/go/campaign");
assert.equal(isLikelyAutomatedVisit("facebookexternalhit/1.1"), true);
assert.equal(isLikelyAutomatedVisit("Mozilla/5.0 Safari"), false);
console.log("Test-user currency, privacy, bot and funding checks passed");

const id = "11111111-1111-4111-8111-111111111110";
assert.deepEqual(parseTrackingRef(id), [id, ""]);
assert.deepEqual(parseTrackingRef(`${id}-first-last@example.com`), [id, "first-last@example.com"]);
assert.deepEqual(parseTrackingRef(`${id}___${id}`), [id, id]);
assert.deepEqual(parseTrackingRef("123-first-last@example.com"), ["123", "first-last@example.com"]);

async function checkFundingSnapshot() {
  const { getAdSpendFundingSnapshot } = await import("../utils/adSpend/settlements");
  const filters: [string, unknown][] = [];
  const rows: Record<string, unknown> = {
    wallet_topups: [{ credited_amount: 20, status: "succeeded" }],
    wallet_deductions: [{ amount: 15 }],
    wallet_refunds: [],
    business_activation_subsidies: { subsidy_amount: 30, consumed_amount: 10 },
  };
  const client = { from(table: string) {
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) { filters.push([column, value]); return query; },
      in(column: string, value: unknown) { filters.push([column, value]); return query; },
      maybeSingle() { return Promise.resolve({ data: rows[table], error: null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows[table], error: null }).then(resolve); },
    };
    return query;
  } };
  const result = await getAdSpendFundingSnapshot(client as never, {
    offerId: "offer", businessEmail: "business@test.invalid", affiliateEmail: "affiliate@test.invalid",
  });
  assert.equal(result.availableBalance, 25, "Wallet 5 plus reserved starter 20");
  assert.ok(filters.some(([column, value]) => column === "reserved_for_affiliate_email" && value === "affiliate@test.invalid"));
  assert.ok(filters.some(([column, value]) => column === "offer_id" && value === "offer"));
  assert.ok(filters.some(([column, value]) => column === "business_email" && value === "business@test.invalid"));
  rows.wallet_deductions = [{ amount: 20 }];
  rows.business_activation_subsidies = { subsidy_amount: 30, consumed_amount: 30 };
  const after = await getAdSpendFundingSnapshot(client as never, {
    offerId: "offer", businessEmail: "business@test.invalid", affiliateEmail: "affiliate@test.invalid",
  });
  assert.equal(after.availableBalance, 0);
  assert.equal(shouldPauseForFunding(after.availableBalance, 0, 10), true);
}
void checkFundingSnapshot().then(() => console.log("Reserved starter funding and post-settlement exhaustion checks passed"));
