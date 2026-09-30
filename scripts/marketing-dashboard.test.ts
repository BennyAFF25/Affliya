
import assert from "node:assert/strict";
import { aggregateFees, aggregateMarketingReport, type MarketingEvent } from "../utils/marketing/reporting";
import { audienceData, groupSources, percent, sourceLabel, type DashboardData } from "../app/internal/marketing/dashboard-data";

const from = "2026-09-01T12:00:00.000Z";
const to = "2026-09-03T12:00:00.000Z";
const event = (event_type: string, audience: string | null, day: number, source: string): MarketingEvent => ({
  event_type, audience, page_path: "/", meta: { utm_source: source, cta_placement: "hero" },
  created_at: "2026-09-0" + day + "T15:00:00.000Z",
});
const report = aggregateMarketingReport({
  events: [
    event("page_view", "business", 1, "fb"),
    event("create_account_start", "business", 1, "https://l.facebook.com/path"),
    event("page_view", "affiliate", 1, "reddit"),
    event("page_view", null, 1, "unknown"),
    event("business_demo_cta_click", "business", 1, "fb"),
    event("unexpected_event", "business", 1, "fb"),
    event("page_view", "business", 3, "fb"), // after the end of the window
    { ...event("page_view", "business", 1, ""), meta: { utm_source: "", source: "ig", referrer: "https://nettmark.com" } },
  ],
  businesses: [{ created_at: "2026-09-01T18:00:00.000Z" }],
  affiliates: [{ created_at: "2026-09-02T01:00:00.000Z" }],
  from, to, hourly: false,
});
assert.deepEqual(report.totals, { pageViews: 4, createAccountStarts: 1, businessDemoCtaClicks: 1 });
assert.equal(report.byAudience.business.pageViews, 2);
assert.equal(report.byAudience.affiliate.pageViews, 1);
assert.equal(report.byAudience.unknown.pageViews, 1);
assert.equal(report.bySource.ig.pageViews, 1, "empty UTM values must fall through to a recorded source");
assert.equal(report.timeline.length, 3, "quiet days remain visible");
assert.deepEqual(report.timeline.map((row) => row.at), [
  "2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z", "2026-09-03T00:00:00.000Z",
]);
assert.equal(report.timeline[1].totals.pageViews, 0);
assert.equal(report.timeline[0].businessSignups, 1);
assert.equal(report.timeline[1].affiliateSignups, 1);
assert.equal(report.timeline.reduce((sum, bucket) => sum + bucket.totals.pageViews, 0), report.totals.pageViews);
for (const metric of ["pageViews", "createAccountStarts", "businessDemoCtaClicks"] as const) {
  for (const group of [report.byAudience, report.byPage, report.bySource, report.byPlacement]) {
    assert.equal(Object.values(group).reduce((sum, counts) => sum + counts[metric], 0), report.totals[metric]);
  }
}
const data: DashboardData = {
  ok: true, period: "7d", generatedAt: to, range: { from, to, timezone: "UTC" },
  dataQuality: { rowLimit: 5000, limitedSources: [] }, recentCount: 8, ...report,
};
const business = audienceData(data, "business");
assert.equal(business.counts.pageViews, 2);
assert.equal(business.bySource.reddit, undefined, "affiliate source rows cannot leak into a business report");
assert.equal(business.byPlacement.hero.pageViews, 1);
assert.equal(business.byPlacement.unknown.pageViews, 1);
assert.equal(audienceData(data, "all").bySource.reddit.pageViews, 1);
const missing = audienceData({ ...data, audienceBreakdowns: {}, byAudience: {} }, "affiliate");
assert.deepEqual(missing.counts, { pageViews: 0, createAccountStarts: 0, businessDemoCtaClicks: 0 });
assert.deepEqual(missing.bySource, {});

const grouped = groupSources(report.bySource);
assert.equal(grouped.find((row) => row.label === "Facebook")?.createAccountStarts, 1);
assert.equal(grouped.reduce((sum, row) => sum + row.pageViews, 0), 4);
assert.equal(sourceLabel("https://l.facebook.com/path?utm=demo"), "Facebook");
assert.equal(sourceLabel("https://facebook.com.evil.example/path"), "facebook.com.evil.example");
assert.equal(sourceLabel("https://example.com/google-campaign"), "example.com");
assert.equal(sourceLabel("https://www.nettmark.com/create-account"), "Direct / Nettmark");
assert.equal(sourceLabel("unknown"), "Unattributed");
assert.equal(sourceLabel("__proto__"), "__proto__");
assert.equal(sourceLabel("constructor"), "constructor");
assert.equal(percent(0, 0), "—");
assert.equal(percent(2, 4), "50.0%");
assert.equal(percent(6, 4), "150.0%", "click frequency can exceed 100%; it is not a conversion rate");

const fees = aggregateFees([
  { amount: "49.15", currency: "AUD" }, { amount: 10, currency: "aud" },
  { amount: -5, currency: "AUD" }, { amount: 100, currency: "USD" },
  { amount: 7, currency: null }, { amount: "invalid", currency: "AUD" },
]);
assert.equal(fees.total, 54.15);
assert.equal(fees.byCurrency.USD, 100);
assert.equal(fees.byCurrency.UNKNOWN, 7);
assert.equal(fees.currency, "AUD");
const hourly = aggregateMarketingReport({
  events: [], businesses: [], affiliates: [],
  from: "2026-09-01T22:30:00.000Z", to: "2026-09-02T01:00:00.000Z", hourly: true,
});
assert.equal(hourly.timeline.length, 4, "hourly bins preserve an overnight UTC window");
const allTime = aggregateMarketingReport({ events: [], businesses: [], affiliates: [], from: null, to, hourly: false });
assert.equal(allTime.timeline.length, 1);
assert.equal(allTime.totals.pageViews, 0);

const oddKeys = aggregateMarketingReport({
  events: [{ ...event("page_view", "__proto__", 1, "__proto__"), page_path: "__proto__" }],
  businesses: [], affiliates: [], from, to, hourly: false,
});
assert.equal(oddKeys.bySource["__proto__"].pageViews, 1);
assert.equal(oddKeys.byAudience["__proto__"].pageViews, 1);
console.log("Marketing reporting checks passed: audience isolation, totals, UTC timelines, source grouping, and currency separation.");
