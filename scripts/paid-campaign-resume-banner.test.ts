import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const banner = readFileSync("components/business/PaidCampaignResumeBanner.tsx", "utf8");
const pending = readFileSync("app/api/business/ad-ideas/pending-summary/route.ts", "utf8");
const detail = readFileSync("app/business/my-business/ad-ideas/[id]/page.tsx", "utf8");

assert.match(pending, /searchParams\.get\("banner"\) === "1"/);
assert.match(pending, /query = query\.gt\("start_time", new Date\(\)\.toISOString\(\)\)/);
assert.match(pending, /\.eq\("status", "pending"\)/);
assert.match(banner, /pending-summary\?banner=1/);
assert.match(banner, /if \(!res\.ok \|\| !json\?\.success\)/);
assert.match(banner, /setCampaign\(null\)/);
assert.doesNotMatch(banner, /if \(refresh\(\)\) return/, "SessionStorage cannot bypass server status verification");
assert.match(banner, /DISMISSED_KEY/);
assert.match(banner, /pendingIdsRef\.current/);
assert.match(banner, /aria-label="Dismiss paid campaign reminder"/);
assert.match(banner, /pathname\?\.startsWith\("\/business\/my-business\/ad-ideas"\)/);
assert.match(banner, /visibilitychange/);
assert.match(banner, /\/business\/my-business\/ad-ideas\/" \+ encodeURIComponent\(selected\.id\)/);
assert.match(detail, /clearPaidCampaignResume\(proposal\.id\)/);
console.log("paid campaign resume banner regression checks passed");
