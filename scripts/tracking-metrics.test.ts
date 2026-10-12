import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isLikelyAutomatedVisit, isTrackedLandingVisit } from "../utils/tracking/visitMetrics";

const tracker = readFileSync("public/tracker.js", "utf8");
const business = readFileSync("app/business/manage-campaigns/[campaignId]/page.tsx", "utf8");
const affiliate = readFileSync("app/affiliate/dashboard/manage-campaigns/[campaignId]/page.tsx", "utf8");

assert.match(tracker, /var eventType = "page_view"/, "A page load is a visit");
assert.doesNotMatch(tracker, /var eventType = "click"/, "A page load must not become a click");
assert.doesNotMatch(tracker, /url\.match\(\/thank\|order\|checkout/, "No URL-triggered purchases");
assert.doesNotMatch(tracker, /eventType = 'conversion'/, "No automatic billable conversion");
assert.match(tracker, /event_source: 'page_load'/);

assert.equal(isTrackedLandingVisit({ event_type: "page_view", user_agent: "Mozilla/5.0 Safari" }), true);
assert.equal(isTrackedLandingVisit({ event_type: "click", user_agent: "Mozilla/5.0 Safari" }), true, "Old page-load events remain visit telemetry");
assert.equal(isTrackedLandingVisit({ event_type: "conversion", user_agent: "Mozilla/5.0 Safari" }), false);
assert.equal(isTrackedLandingVisit({ event_type: "click", user_agent: "facebookexternalhit/1.1" }), false);
assert.equal(isLikelyAutomatedVisit("meta-externalhit/1.1"), true);

for (const code of [business, affiliate]) {
  assert.match(code, /user_agent/, "Visit reporting must load user agent for crawler filtering");
  assert.match(code, /isTrackedLandingVisit/, "Shared visit classifier used on both dashboards");
  assert.match(code, /Meta clicks \(last sync\)/, "Paid-network clicks must have a distinct label");
  assert.match(code, /Landing visits/, "Nettmark page views must have an accurate label");
}

assert.match(business, /Number\(campaign\.clicks \|\| 0\)/, "Business Meta clicks source is live_ads.clicks");
assert.match(affiliate, /Number\(\(campaign as any\)\.clicks \|\| 0\)/, "Affiliate Meta clicks source is live_ads.clicks");
console.log("tracking metrics regression checks passed");
