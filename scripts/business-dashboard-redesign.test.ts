import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/business/dashboard/page.tsx", "utf8");
const summary = readFileSync("app/api/business/dashboard/summary/route.ts", "utf8");
const mark = readFileSync("components/brand/MetaMark.tsx", "utf8");
const campaigns = readFileSync("components/business/ManageCampaignsWorkspace.tsx", "utf8");

// Backend must scope privileged data to the signed-in business.
assert.match(summary, /userClient\.auth\.getUser\(\)/);
assert.match(summary, /profile\?\.role !== "business"/);
assert.match(summary, /\.ilike\("business_email", email\)/);
assert.match(summary, /"live_ads"/);
assert.match(summary, /"ad_spend_settlements"/);
assert.match(summary, /spend_transferred/);
assert.match(summary, /Math\.max\(0, Number\(row\.spend \|\| 0\) - Number\(row\.spend_transferred \|\| 0\)\)/);
assert.match(summary, /row\.status === "transfer_succeeded" && !!row\.stripe_transfer_id/);
assert.match(summary, /queuedForTransfer/);
assert.match(summary, /finance:|finance,/);
assert.match(summary, /"Cache-Control": "private, no-store"/);
assert.doesNotMatch(summary, /\.from\("wallets"\)|\.from\("wallet_topups"\)/);
assert.doesNotMatch(summary, /\.update\(|\.insert\(|stripe\.transfers/);

// Responsive UI has only the essential cards; no duplicated business
// dashboard finance queries or browser writes.
assert.match(page, /Ad spend reconciliation/);
assert.match(page, /Awaiting wallet settlement/);
assert.match(page, /Queued for business transfer/);
assert.match(page, /Transferred to business/);
assert.match(page, /Reported Meta spend/);
assert.match(page, /xl:grid-cols-4/);
assert.match(page, /grid-cols-3/);
assert.match(page, /bg-\[#151718\]/);
assert.match(page, /bg-\[#101415\]/);
assert.match(page, /#00C2CB/);
assert.match(page, /meta.*reports|Meta reporting may lag/i);
assert.match(page, /\/api\/business\/dashboard\/summary/);
assert.doesNotMatch(page, /wallet_payouts|wallet_topups|ad_spend_settlements/);
assert.doesNotMatch(page, /showTransactionsModal|salesSeriesRaw|showAllAffiliateActivity/);
assert.ok(page.split("\n").length < 380, "replace legacy bloat rather than stacking new UI");
assert.match(mark, /#1688FA/);
assert.match(campaigns, /import MetaMark from "\.\.\/brand\/MetaMark"/);
console.log("business dashboard minimalist redesign regression checks passed");
