import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const affiliateList = readFileSync("app/affiliate/dashboard/manage-campaigns/page.tsx", "utf8");
const affiliateDetail = readFileSync("app/affiliate/dashboard/manage-campaigns/[campaignId]/page.tsx", "utf8");
const businessList = readFileSync("app/business/manage-campaigns/page.tsx", "utf8");
const cron = readFileSync("vercel.json", "utf8");
const sync = readFileSync("app/api/meta/sync-active-ads/route.ts", "utf8");

for (const [name, source] of [
  ["affiliate list", affiliateList],
  ["affiliate detail", affiliateDetail],
  ["business list", businessList],
] as const) {
  assert.match(source, /setInterval\([^,]+,\s*30_000\)/, name + " should refresh while open");
  assert.match(source, /document\.visibilityState !== "visible"/, name + " should not poll hidden tabs");
  assert.match(source, /visibilitychange/, name + " should refresh on return");
  assert.match(source, /window\.addEventListener\("focus"/, name + " should refresh on focus");
  assert.match(source, /window\.clearInterval\(/, name + " should clean up intervals");
}

assert.match(affiliateList, /loadAffiliatePaidCampaigns\(supabase, email\)/);
assert.match(affiliateDetail, /\.from\("live_ads"\)\s*\.select\("id,spend,clicks,spend_transferred,status,billing_state"\)/);
assert.match(businessList, /\.from\("live_ads"\)\s*\.select\("id,spend,clicks,conversions,status,spend_transferred,billing_state"\)/);
// The read-only polling code must never trigger the financial or Meta sync APIs.
for (const [name, source] of [
  ["affiliate list", affiliateList],
  ["affiliate detail", affiliateDetail],
  ["business list", businessList],
] as const) {
  const start = source.indexOf("const refreshRecorded");
  assert.ok(start >= 0, name + " has cached totals refresh");
  const next = source.indexOf("  },", start);
  const region = source.slice(start, next > start ? next : start + 3000);
  assert.doesNotMatch(region, /fetch\(["']\/api\/meta\/ad-insights|fetch\(["']\/api\/ad-spend\/settle/, name + " must not sync or settle from the polling function");
}
assert.ok(JSON.parse(cron).crons.some((c: { path: string; schedule: string }) =>
  c.path === "/api/meta/sync-active-ads" && c.schedule === "*/5 * * * *"
), "server has an independent 5-minute scheduled job");
assert.match(sync, /insightsEndpoint/, "server job queries Meta separately");
console.log("automatic read-only Meta metric refresh regression checks passed");
