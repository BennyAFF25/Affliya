import assert from "node:assert/strict";
import { buildBusinessFunnel, reachedFunnelStage, summarizeBusinessFunnel, type FunnelProductEvent } from "../utils/marketing/landingFunnel";
import { readReportRows } from "../utils/marketing/reportRows";
import { getMarketingVisitorId, marketingVisitorId } from "../utils/marketing/visitor";
import type { MarketingEvent } from "../utils/marketing/reporting";

const visitor = "11111111-1111-4111-8111-111111111111";
const anotherVisitor = "22222222-2222-4222-8222-222222222222";
const at = (minute: number) => new Date(Date.UTC(2026, 9, 6, 10, minute)).toISOString();
const landing = (id: string | null = visitor, minute = 0): MarketingEvent => ({
  event_type: "page_view", page_path: "/lp/business-demo", audience: "business",
  meta: { visitor_id: id, utm_source: "reddit", utm_campaign: "business-demo" }, created_at: at(minute),
});
const product = (event_type: string, minute: number, meta: Record<string, unknown> = {}): FunnelProductEvent => ({
  event_type, actor_email: "Owner@example.com", actor_role: "business", offer_id: null,
  meta: { visitor_id: visitor, flow: "business_onboarding", ...meta }, created_at: at(minute),
});
const input = {
  events: [landing(), landing(visitor, 3), { ...landing(visitor, 4), meta: { visitor_id: visitor, utm_source: "google" } }, landing(null, 1)],
  products: [
    product("business_signup_completed", 5), product("onboarding_started", 6),
    product("offer_create_step", 6, { step: 1 }), product("offer_create_step", 7, { step: 2 }),
    product("offer_create_step", 7, { step: 2 }), product("offer_publish_clicked", 8),
    { ...product("offer_published", 9), offer_id: "saved-offer" }, product("plan_choice_viewed", 10),
    product("plan_growth_clicked", 11), product("plan_growth_clicked", 11),
    product("plan_growth_checkout_started", 12, { source: "checkout_endpoint", trialEligible: true }),
  ].reverse(),
  profiles: [{ email: "owner@example.com", created_at: at(5) }],
  offers: [{ id: "saved-offer", business_email: "OWNER@example.com", created_at: at(8) }],
  entitlements: [{ business_email: "owner@example.com", growth_trial_used: true, growth_trial_started_at: at(13) }],
  from: at(0), to: at(30),
};
const report = buildBusinessFunnel(input);
assert.equal(report.landingViews, 4);
assert.equal(report.unlinkedViews, 1);
assert.equal(report.journeys.length, 1, "repeat views count once per browser");
assert.equal(report.journeys[0].source, "reddit", "first observed landing source survives subsequent sources");
assert.deepEqual(report.journeys[0].onboardingSteps, [1, 2]);
assert.equal(report.journeys[0].email, "owner@example.com");
assert.equal(report.unlinkedBusinessSignups, 0);
const freshSource = buildBusinessFunnel({ ...input, events: [{ ...landing(), meta: { visitor_id: visitor, utm_source: "stale-source", utm_campaign: "stale-campaign", referrer: "https://www.nettmark.com/lp/business-demo", landing_attribution: {}, landing_referrer: "https://www.reddit.com/" } }] });
assert.equal(freshSource.journeys[0].source, "https://www.reddit.com/", "actual landing referrer wins over stale stored UTM metadata");
assert.equal(freshSource.journeys[0].campaign, "Unassigned");
const summary = summarizeBusinessFunnel(report.journeys);
assert.deepEqual(summary.stages.map((row) => row.count), [1, 1, 1, 1, 1]);
assert.equal(summary.trials, 1);
assert.equal(summary.measuredTrials, 1);
assert.equal(summary.checkout, 1);
assert.equal(summary.growth, 1);
assert.equal(summary.free, 0);

const free = buildBusinessFunnel({ ...input, entitlements: [], products: [
  ...input.products.filter((row) => !row.event_type.startsWith("plan_growth")),
  product("plan_free_clicked", 11), // legacy click, not a successful choice
  product("plan_free_clicked", 12, { outcome: "confirmed" }),
] });
assert.equal(summarizeBusinessFunnel(free.journeys).free, 1);
assert.equal(free.journeys[0].freeChosenAt, at(12));
const failedFree = buildBusinessFunnel({ ...input, products: [product("plan_free_clicked", 11)] });
assert.equal(failedFree.journeys[0].freeChosenAt, null, "raw clicks do not prove successful Free selection");

const gap = buildBusinessFunnel({ ...input, products: input.products.filter((row) => row.event_type !== "onboarding_started") });
assert.equal(summarizeBusinessFunnel(gap.journeys).trials, 0, "missing intermediate measurements never invent ordered conversions");
assert.equal(summarizeBusinessFunnel(gap.journeys).measuredTrials, 1, "confirmed outcomes remain visible when measurements are missing");
assert.equal(summarizeBusinessFunnel(gap.journeys).measuredOffers, 1);
const existing = buildBusinessFunnel({ ...input, profiles: [{ email: "owner@example.com", created_at: at(-1) }] });
assert.equal(existing.journeys[0].email, null, "accounts predating landing visits are not new-account conversions");

const wrongOwner = buildBusinessFunnel({ ...input, offers: [{ ...input.offers[0], business_email: "someone-else@example.com" }] });
assert.equal(wrongOwner.journeys[0].offerPublishedAt, null, "offer identity and ownership are checked");
assert.equal(buildBusinessFunnel({ ...input, offers: [] }).journeys[0].offerPublishedAt, null);
const generalOffer = buildBusinessFunnel({ ...input, products: input.products.map((row) => row.event_type === "offer_published" ? { ...row, meta: { visitor_id: visitor } } : row) });
assert.equal(generalOffer.journeys[0].offerPublishedAt, null, "dashboard-created offers cannot impersonate onboarding outcomes");
const futureOffer = buildBusinessFunnel({ ...input, offers: [{ ...input.offers[0], created_at: at(20) }] });
assert.equal(futureOffer.journeys[0].offerPublishedAt, null);
const expiredTrial = buildBusinessFunnel({ ...input, entitlements: [{ ...input.entitlements[0], growth_trial_started_at: at(40) }] });
assert.equal(expiredTrial.journeys[0].trialStartedAt, null);
const priorTrial = buildBusinessFunnel({ ...input, entitlements: [{ ...input.entitlements[0], growth_trial_started_at: at(1) }] });
assert.equal(priorTrial.journeys[0].trialStartedAt, null);
const paidCheckout = buildBusinessFunnel({ ...input, products: input.products.map((row) => row.event_type === "plan_growth_checkout_started" ? { ...row, meta: { ...row.meta, trialEligible: false } } : row) });
assert.equal(paidCheckout.journeys[0].checkoutAt, null, "paid subscription resumption is not trial checkout");
const unauthenticated = buildBusinessFunnel({ ...input, products: input.products.map((row) => ({ ...row, actor_role: "affiliate" })) });
assert.equal(unauthenticated.journeys[0].email, null);

const sharedAccount = buildBusinessFunnel({ ...input, events: [...input.events, { ...landing(anotherVisitor, 1), meta: { visitor_id: anotherVisitor, utm_source: "facebook" } }], products: [...input.products, { ...product("onboarding_started", 7), meta: { visitor_id: anotherVisitor, flow: "business_onboarding" } }] });
assert.equal(sharedAccount.journeys.length, 2);
assert.equal(sharedAccount.journeys.filter((journey) => journey.email).length, 1, "one business cannot inflate multiple visitor conversions");
assert.equal(summarizeBusinessFunnel(sharedAccount.journeys.filter((journey) => journey.source === "facebook")).trials, 0, "source filtering keeps linked outcomes isolated");
const sharedBrowser = buildBusinessFunnel({ ...input, profiles: [...input.profiles, { email: "second@example.com", created_at: at(14) }], products: [...input.products, { ...product("onboarding_started", 15), actor_email: "second@example.com" }] });
assert.equal(sharedBrowser.journeys[0].email, "owner@example.com");
assert.equal(sharedBrowser.unlinkedBusinessSignups, 1);
const recoveryLink = buildBusinessFunnel({ ...input, products: input.products.filter((row) => row.event_type !== "business_signup_completed") });
assert.equal(recoveryLink.journeys[0].signedUpAt, at(5), "authenticated onboarding can bridge a deferred email-confirm signup");
const retry = buildBusinessFunnel({ ...input, products: [...input.products, product("plan_choice_viewed", 7), product("offer_publish_failed", 7)] });
assert.equal(retry.journeys[0].planViewedAt, at(10), "early navigation must not hide a later correctly ordered view");
assert.equal(retry.journeys[0].publishFailed, true);
assert.equal(summarizeBusinessFunnel(retry.journeys).measuredOffers, 1, "failed attempts do not erase successful retries");
const resumed = buildBusinessFunnel({ ...input, products: input.products.map((row) => row.event_type === "plan_choice_viewed" ? { ...row, meta: { ...row.meta, resume: true } } : row) });
assert.equal(resumed.journeys[0].planViewedAt, null);
assert.equal(reachedFunnelStage({ ...report.journeys[0], trialStartedAt: at(11) }, "trialStartedAt"), false);

assert.equal(marketingVisitorId(visitor.toUpperCase()), visitor);
assert.equal(marketingVisitorId("arbitrary"), null);
assert.equal(getMarketingVisitorId(), null, "server rendering never creates a browser identity");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  crypto: { randomUUID: () => visitor },
  localStorage: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) },
} });
assert.equal(getMarketingVisitorId(), visitor);
assert.equal(getMarketingVisitorId(), visitor, "landing and authenticated events reuse the same browser identity");
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  localStorage: { getItem: () => { throw new Error("storage disabled"); } },
} });
assert.equal(getMarketingVisitorId(), null, "storage denial must not create inflated unique visitor counts");
if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
else Reflect.deleteProperty(globalThis, "window");
const empty = buildBusinessFunnel({ ...input, events: [] });
assert.equal(empty.journeys.length, 0);
assert.equal(empty.unlinkedBusinessSignups, 1);
assert.equal(summarizeBusinessFunnel([]).trials, 0);
const legacy = buildBusinessFunnel({ ...input, events: [landing(null)] });
assert.equal(legacy.journeys.length, 0);
assert.equal(legacy.unlinkedViews, 1);
const boundaries = buildBusinessFunnel({ ...input, events: [landing(visitor, -1), landing(visitor, 31), { ...landing(), page_path: "/" }, { ...landing(), event_type: "create_account_start" }] });
assert.equal(boundaries.landingViews, 0);

async function checkPagination() {
  const rows = Array.from({ length: 5200 }, (_, id) => ({ id }));
  let requests = 0;
  const cap = await readReportRows({ range: async (from, to) => { requests++; return { data: rows.slice(from, to + 1), error: null }; } });
  assert.equal(cap.data?.length, 5000);
  assert.equal(requests, 5, "explicit query cap is respected");
  const partial = await readReportRows({ range: async (from, to) => ({ data: rows.slice(0, 1400).slice(from, to + 1), error: null }) });
  assert.equal(partial.data?.length, 1400, "reports must not silently stop at the default 1000-row page");
  const failed = await readReportRows({ range: async (from, to) => from ? { data: null, error: "query failure" } : { data: rows.slice(from, to + 1), error: null } });
  assert.equal(failed.data, null, "a failed later page cannot masquerade as a complete report");
  assert.equal(failed.error, "query failure");
}
checkPagination().then(() => console.log("Business funnel checks passed: deduplication, linkage, chronological stages, confirmed outcomes, ownership, source isolation, tracking gaps and pagination.")).catch((error) => { console.error(error); process.exitCode = 1; });

const currentFlow = buildBusinessFunnel({ ...input, products: [
  ...input.products.map(row => ({ ...row, event_type: row.event_type === "onboarding_started" ? "offer_create_viewed" : row.event_type, meta: { ...row.meta, flow: undefined, source: row.event_type === "plan_growth_checkout_started" ? "checkout_endpoint" : "business_onboarding" } })),
  product("plan_free_clicked", 12, { choice_confirmed: true }),
] });
assert.equal(summarizeBusinessFunnel(currentFlow.journeys).stages[4].count, 1, "current server-confirmed onboarding stays linked");
assert.equal(summarizeBusinessFunnel(currentFlow.journeys).free, 1, "server-confirmed Free choice is counted");
