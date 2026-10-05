import * as assert from "node:assert/strict";
import { businessFunnelVersion, BUSINESS_FUNNEL_ROLLOUT_AT, formatGrowthPrice } from "../utils/businessOnboardingFunnel";
import { aggregateBusinessFunnel } from "../utils/marketing/businessFunnel";
const treatment = "11111111-1111-4111-8111-111111111110", control = "11111111-1111-4111-8111-111111111111";
const signup = BUSINESS_FUNNEL_ROLLOUT_AT;
assert.equal(businessFunnelVersion(treatment, signup), "trial_first_v1");
assert.equal(businessFunnelVersion(control, signup), "plan_choice_v1");
assert.equal(businessFunnelVersion(treatment, "2026-10-04T23:59:59Z"), null);
assert.equal(businessFunnelVersion("garbage", signup), null);
let allocated = 0;
for (let i = 0; i < 256; i++) if (businessFunnelVersion("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa" + i.toString(16).padStart(2, "0"), signup) === "trial_first_v1") allocated++;
assert.equal(allocated, 128);
assert.equal(formatGrowthPrice(4900, "AUD").replace(/\u00a0/g, " "), "AUD 49.00");
assert.equal(formatGrowthPrice(4900, "JPY").replace(/\u00a0/g, " "), "JPY 4,900");
const later = new Date(Date.parse(signup) + 86400000).toISOString();
const trialEnd = new Date(Date.parse(later) + 14 * 86400000).toISOString();
const observation = new Date(Date.parse(trialEnd) + 86400000).toISOString();
const invoice = (overrides: Record<string, unknown> = {}) => ({ event_type: "invoice.paid", business_id: treatment, processing_status: "processed", received_at: trialEnd, metadata: { livemode: true, invoice_id: "in_1", invoice_amount_paid: 4900, stripe_created_at: trialEnd, ...overrides } });
const base = {
  businesses: [{ id: treatment, email: "Owner@Example.test", created_at: signup }, { id: control, email: "dropout@example.test", created_at: signup }],
  signupFrom: signup, signupTo: later, observedThrough: observation, trialDays: 14,
  offers: [{ business_email: "owner@example.test", created_at: later }],
  events: [{ event_type: "plan_choice_viewed", actor_email: "owner@example.test", created_at: later, meta: { screen: "trial_first", business_id: treatment } },
    { event_type: "plan_free_clicked", actor_email: "owner@example.test", created_at: later, meta: {} }],
  requests: [{ business_email: "owner@example.test", created_at: later }],
  metaConnections: [{ business_email: "owner@example.test", created_at: later, page_id: "page", ad_account_id: "act" }],
  paidCampaigns: [{ business_id: treatment, business_email: "old-email@example.test", created_at: later, meta_ad_id: "ad", meta_campaign_id: "campaign", spend: 1 }],
  entitlements: [{ business_id: treatment, growth_trial_used: true, growth_trial_started_at: later, billing_status: "subscription_active" }],
  stripeEvents: [invoice(), invoice()],
};
const result = aggregateBusinessFunnel(base), group = result.groups.find(g => g.version === "trial_first_v1")!;
assert.equal(result.groups.find(g => g.version === "plan_choice_v1")!.counts.signups, 1, "Include dropouts without events");
for (const key of ["offerPublished","affiliateRequest","metaConnected","campaignCreated","spendObserved","trialStarted","paidConversion"] as const) assert.equal(group.counts[key], 1, key);
assert.equal(group.matureTrials, 1);
assert.equal(group.counts.freeChosen, 0, "Historical click is not confirmed Free");
assert.equal(group.counts.paidConversion, 1, "Duplicate invoices do not double count businesses");
for (const overrides of [{ invoice_amount_paid: 0 }, { livemode: false }, { livemode: undefined }, { invoice_id: null }]) {
  assert.equal(aggregateBusinessFunnel({ ...base, stripeEvents: [invoice(overrides)] }).groups[2].counts.paidConversion, 0);
}
assert.equal(aggregateBusinessFunnel({ ...base, stripeEvents: [] }).groups[2].counts.paidConversion, 0, "Active entitlement is not payment evidence");
const before = aggregateBusinessFunnel({ ...base, observedThrough: signup }).groups[2];
assert.equal(before.counts.offerPublished, 0); assert.equal(before.counts.trialStarted, 0);
const forged = aggregateBusinessFunnel({ ...base, events: [{ ...base.events[0], meta: { business_id: control, business_onboarding_funnel: "trial_first_v1", screen: "trial_first" } }] });
assert.equal(forged.groups[1].counts.signups, 1, "Client tags cannot reassign stable cohorts");
const cancellation = { event_type: "customer.subscription.updated", business_id: treatment, processing_status: "processed", received_at: later, metadata: { livemode: true, stripe_created_at: later, trial_started_at: later, trial_ends_at: trialEnd, cancellation_requested: true, stripe_status: "trialing", cancelled_at: later } };
const cancels = aggregateBusinessFunnel({ ...base, stripeEvents: [cancellation] }).groups[2].counts;
assert.equal(cancels.trialCancellationRequested, 1); assert.equal(cancels.trialCancelled, 0);
const ends = aggregateBusinessFunnel({ ...base, stripeEvents: [{ ...cancellation, event_type: "customer.subscription.deleted", metadata: { ...cancellation.metadata, stripe_status: "canceled" } }] }).groups[2].counts;
assert.equal(ends.trialCancelled, 1);
assert.equal(aggregateBusinessFunnel({ ...base, paidCampaigns: [{ ...base.paidCampaigns[0], meta_ad_id: null }] }).groups[2].counts.campaignCreated, 0);
console.log("Business funnel allocation and durable milestone tests passed");
