import { businessFunnelVersion, BUSINESS_FUNNEL_ROLLOUT_AT } from "../businessOnboardingFunnel";
type Row = { created_at?: string; business_email?: string | null; business_id?: string | null; [key: string]: unknown };
type EventRow = Row & { event_type: string; actor_email?: string | null; meta?: Record<string, unknown> | null };
type StripeRow = Row & { event_type: string; processing_status: string; received_at: string; metadata?: Record<string, unknown> | null };
export const FUNNEL_METRICS = [
  ["signups", "Business signup", "database"],
  ["offerPublished", "Offer published", "database"],
  ["screenReached", "Continuation screen reached", "event"],
  ["trialScreenReached", "Trial-first screen reached", "event"],
  ["growthClicked", "Growth clicked", "event"],
  ["checkoutStarted", "Checkout started", "server event"],
  ["trialStarted", "Trial started", "database"],
  ["freeChosen", "Free chosen (confirmed)", "server event"],
  ["affiliateRequest", "Affiliate request received", "database"],
  ["metaConnected", "Meta connected", "database"],
  ["campaignCreated", "Paid Meta campaign created", "database"],
  ["spendObserved", "Paid campaign spend observed now", "current snapshot"],
  ["trialCancellationRequested", "Trial cancellation requested", "signed Stripe event"],
  ["trialCancelled", "Trial ended with cancellation", "signed Stripe event"],
  ["paidConversion", "First positive live invoice paid", "signed Stripe event"],
] as const;
export type FunnelMetric = typeof FUNNEL_METRICS[number][0];
export type FunnelCounts = Record<FunnelMetric, number>;
export type FunnelGroup = { version: string; counts: FunnelCounts; rates: FunnelCounts; matureTrials: number };
const email = (value: unknown) => String(value || "").trim().toLowerCase();
const time = (value: unknown) => Date.parse(String(value || ""));
export function aggregateBusinessFunnel(input: {
  businesses: Array<{ id: string; email: string | null; created_at: string }>;
  offers: Row[]; events: EventRow[]; requests: Row[]; metaConnections: Row[];
  paidCampaigns: Row[]; entitlements: Row[]; stripeEvents: StripeRow[];
  signupFrom: string | null; signupTo: string; observedThrough: string; trialDays: number;
}) {
  const observed = time(input.observedThrough);
  const businesses = input.businesses.filter(b => Number.isFinite(time(b.created_at)) &&
    (!input.signupFrom || time(b.created_at) >= time(input.signupFrom)) && time(b.created_at) < time(input.signupTo) && time(b.created_at) <= observed);
  const empty = () => Object.fromEntries(FUNNEL_METRICS.map(([key]) => [key, 0])) as FunnelCounts;
  const groups: FunnelGroup[] = ["pre_experiment", "plan_choice_v1", "trial_first_v1"].map(version => ({ version, counts: empty(), rates: empty(), matureTrials: 0 }));
  const detail = businesses.map(b => {
    const identity = email(b.email);
    const afterSignup = (at: unknown) => Number.isFinite(time(at)) && time(at) >= time(b.created_at) && time(at) <= observed;
    const matches = (row: Row) => row.business_id ? row.business_id === b.id : Boolean(identity && email(row.business_email) === identity);
    const own = (rows: Row[]) => rows.filter(row => matches(row) && afterSignup(row.created_at));
    const events = input.events.filter(e => (e.meta?.business_id ? e.meta.business_id === b.id : email(e.actor_email) === identity) && afterSignup(e.created_at));
    const has = (type: string, check?: (e: EventRow) => boolean) => events.some(e => e.event_type === type && (!check || check(e)));
    const entitlement = input.entitlements.find(matches);
    const trialStart = entitlement?.growth_trial_started_at;
    const stripeEvents = input.stripeEvents.filter(e => e.business_id === b.id && e.processing_status === "processed" && e.metadata?.livemode === true &&
      afterSignup(e.metadata.stripe_created_at || e.received_at) && time(e.received_at) <= observed);
    const cancelledInTrial = (e: StripeRow) => {
      const facts = e.metadata || {};
      const trialStartAt = time(facts.trial_started_at);
      const trialEndAt = time(facts.trial_ends_at);
      const cancelledAt = time(facts.cancelled_at || facts.stripe_created_at || e.received_at);
      return Number.isFinite(trialStartAt) && trialStartAt > 0 && cancelledAt >= trialStartAt &&
        (facts.stripe_status === "trialing" || (Number.isFinite(trialEndAt) && cancelledAt <= trialEndAt));
    };
    const campaigns = own(input.paidCampaigns).filter(row => Boolean(row.meta_ad_id && row.meta_campaign_id));
    const flags: Record<FunnelMetric, boolean> = {
      signups: true, offerPublished: own(input.offers).length > 0,
      screenReached: has("plan_choice_viewed"),
      trialScreenReached: has("plan_choice_viewed", e => e.meta?.screen === "trial_first"),
      growthClicked: has("plan_growth_clicked"), checkoutStarted: has("plan_growth_checkout_started"),
      trialStarted: Boolean(entitlement?.growth_trial_used && afterSignup(trialStart)) ||
        stripeEvents.some(e => afterSignup(e.metadata?.trial_started_at)),
      freeChosen: has("plan_free_clicked", e => e.meta?.choice_confirmed === true),
      affiliateRequest: own(input.requests).length > 0,
      metaConnected: own(input.metaConnections).some(row => Boolean(row.ad_account_id && row.page_id)),
      campaignCreated: campaigns.length > 0,
      spendObserved: campaigns.some(row => Number(row.spend) > 0),
      trialCancellationRequested: stripeEvents.some(e => e.metadata?.cancellation_requested === true && cancelledInTrial(e)),
      trialCancelled: stripeEvents.some(e => e.event_type === "customer.subscription.deleted" && cancelledInTrial(e)),
      paidConversion: stripeEvents.some(e => e.event_type === "invoice.paid" && Boolean(e.metadata?.invoice_id) &&
        Number(e.metadata?.invoice_amount_paid) > 0),
    };
    const version = businessFunnelVersion(b.id, b.created_at) || "pre_experiment";
    const group = groups.find(g => g.version === version)!;
    for (const [key] of FUNNEL_METRICS) if (flags[key]) group.counts[key]++;
    if (flags.trialStarted && Number.isFinite(time(trialStart)) && time(trialStart) + input.trialDays * 86400000 <= observed) group.matureTrials++;
    return { businessId: b.id, version, flags };
  });
  for (const group of groups) for (const [key] of FUNNEL_METRICS) group.rates[key] = group.counts.signups ? Number((group.counts[key] / group.counts.signups * 100).toFixed(1)) : 0;
  return {
    rolloutAt: BUSINESS_FUNNEL_ROLLOUT_AT, allocation: "50/50 deterministic business UUID",
    signupWindow: { from: input.signupFrom, toExclusive: input.signupTo }, observedThrough: input.observedThrough,
    metrics: FUNNEL_METRICS.map(([key, label, source]) => ({ key, label, source })),
    groups, detail,
    notes: [
      "All signup-cohort businesses are included, even without events or screen exposure. Rates use that same signup denominator.",
      "Missing historical events are unknown behaviour. Durable milestones are independent; no strict sequential conversion is implied.",
      "A paid Meta runtime row with Meta ad/campaign IDs establishes campaign creation. Current spend > 0 is delivery evidence, not a historical as-of spend snapshot.",
      "Paid conversion requires a processed signed live invoice.paid with positive amount. Older invoices without captured amount/live-mode facts are unknown, not proven unpaid.",
      "Compare equally aged cohorts and wait for complete trial follow-up. Current entitlement status alone is not payment evidence.",
    ],
  };
}
export type BusinessFunnelReport = ReturnType<typeof aggregateBusinessFunnel>;
