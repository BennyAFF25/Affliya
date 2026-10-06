import type { MarketingEvent } from "./reporting";
import { marketingVisitorId } from "./visitor";

export const LANDING_PATH = "/lp/business-demo";
export type FunnelProductEvent = {
  event_type: string; actor_email: string | null; actor_role: string | null;
  offer_id: string | null; meta?: Record<string, unknown> | null; created_at: string;
};
export type FunnelJourney = {
  source: string; campaign: string; landedAt: string; email: string | null;
  signedUpAt: string | null; onboardingAt: string | null; offerPublishedAt: string | null;
  planViewedAt: string | null; freeChosenAt: string | null; growthClickedAt: string | null;
  checkoutAt: string | null; trialStartedAt: string | null;
  onboardingSteps: number[]; publishAttempted: boolean; publishFailed: boolean;
};
export type LandingFunnelReport = {
  landingViews: number; unlinkedViews: number; journeys: FunnelJourney[];
  unlinkedBusinessSignups: number;
};
export const FUNNEL_STAGES = [
  { key: "landedAt", label: "Landing visitors" },
  { key: "signedUpAt", label: "Account created" },
  { key: "onboardingAt", label: "Onboarding started" },
  { key: "offerPublishedAt", label: "Offer published" },
  { key: "planViewedAt", label: "Plan page reached" },
] as const;
export type FunnelStageKey = typeof FUNNEL_STAGES[number]["key"] | "freeChosenAt" | "growthClickedAt" | "checkoutAt" | "trialStartedAt";
const timestamp = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
const emailKey = (value: string | null) => (value || "").trim().toLowerCase();
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const iso = (value: string) => new Date(value).toISOString();

/** Strictly ordered stages; missing measurements are not inferred from later outcomes. */
export function reachedFunnelStage(journey: FunnelJourney, stage: FunnelStageKey): boolean {
  const keys: FunnelStageKey[] = FUNNEL_STAGES.map(({ key }) => key);
  if (stage === "freeChosenAt") keys.push("freeChosenAt");
  if (["growthClickedAt", "checkoutAt", "trialStartedAt"].includes(stage)) {
    keys.push("growthClickedAt", "checkoutAt", "trialStartedAt");
  }
  let previous = -Infinity;
  for (const key of keys) {
    const at = timestamp(journey[key]);
    if (!Number.isFinite(at) || at < previous) return false;
    if (key === stage) return true;
    previous = at;
  }
  return false;
}

export function summarizeBusinessFunnel(journeys: FunnelJourney[]) {
  const count = (key: FunnelStageKey) => journeys.filter((journey) => reachedFunnelStage(journey, key)).length;
  return {
    stages: FUNNEL_STAGES.map(({ key, label }) => ({ key, label, count: count(key) })),
    free: count("freeChosenAt"), growth: count("growthClickedAt"), checkout: count("checkoutAt"), trials: count("trialStartedAt"),
    measuredOffers: journeys.filter((journey) => journey.offerPublishedAt).length,
    measuredTrials: journeys.filter((journey) => journey.trialStartedAt).length,
  };
}

/** Browser cohorts, never ad/commission attribution. Only verified new business profiles link. */
export function buildBusinessFunnel(input: {
  events: MarketingEvent[]; products: FunnelProductEvent[];
  profiles: Array<{ email: string | null; created_at: string }>;
  offers: Array<{ id: string; business_email: string | null; created_at: string }>;
  entitlements: Array<{ business_email: string | null; growth_trial_used: boolean | null; growth_trial_started_at: string | null }>;
  from: string | null; to: string;
}): LandingFunnelReport {
  const from = input.from ? timestamp(input.from) : -Infinity;
  const to = timestamp(input.to);
  const inWindow = (at: string) => timestamp(at) >= from && timestamp(at) <= to;
  const landings = input.events.filter((row) => row.event_type === "page_view" && row.page_path === LANDING_PATH && inWindow(row.created_at))
    .sort((a, b) => timestamp(a.created_at) - timestamp(b.created_at));
  const visitors = new Map<string, MarketingEvent>();
  let unlinkedViews = 0;
  for (const row of landings) {
    const id = marketingVisitorId(row.meta?.visitor_id);
    if (!id) unlinkedViews++;
    else if (!visitors.has(id)) visitors.set(id, row);
  }
  const profiles = new Map(input.profiles.filter((row) => emailKey(row.email) && inWindow(row.created_at)).map((row) => [emailKey(row.email), row]));
  const products = input.products.filter((row) => row.actor_role === "business" && inWindow(row.created_at))
    .sort((a, b) => timestamp(a.created_at) - timestamp(b.created_at));
  const productsByEmail = new Map<string, FunnelProductEvent[]>();
  for (const row of products) {
    const email = emailKey(row.actor_email);
    const rows = productsByEmail.get(email) || [];
    rows.push(row);
    productsByEmail.set(email, rows);
  }
  const offers = new Map(input.offers.map((row) => [row.id, row]));
  const entitlements = new Map(input.entitlements.map((row) => [emailKey(row.business_email), row]));
  const linkedEmails = new Set<string>();
  const journeys: FunnelJourney[] = [];
  for (const [visitorId, landing] of visitors) {
    // Earliest eligible new account per browser; each business links to at most one browser.
    const candidates = products.filter((row) => marketingVisitorId(row.meta?.visitor_id) === visitorId &&
      timestamp(row.created_at) >= timestamp(profiles.get(emailKey(row.actor_email))?.created_at))
      .map((row) => profiles.get(emailKey(row.actor_email)))
      .filter((profile) => profile && timestamp(profile.created_at) >= timestamp(landing.created_at))
      .sort((a, b) => timestamp(a!.created_at) - timestamp(b!.created_at));
    const profile = candidates.find((candidate) => candidate && !linkedEmails.has(emailKey(candidate.email)));
    const email = profile ? emailKey(profile.email) : null;
    if (email) linkedEmails.add(email);
    const signupTime = timestamp(profile?.created_at);
    const rows = email ? (productsByEmail.get(email) || []).filter((row) => timestamp(row.created_at) >= signupTime) : [];
    const firstEvent = (eventType: string, predicate: (row: FunnelProductEvent) => boolean = () => true, after = signupTime) => {
      const row = rows.find((row) => row.event_type === eventType && timestamp(row.created_at) >= after && predicate(row));
      return row ? iso(row.created_at) : null;
    };
    const onboarding = (row: FunnelProductEvent) => (row.meta?.flow === "business_onboarding" || row.meta?.source === "business_onboarding");
    const onboardingAt = firstEvent("onboarding_started", onboarding) || firstEvent("offer_create_viewed", onboarding);
    const offerPublishedAt = firstEvent("offer_published", (row) => {
      const offer = row.offer_id ? offers.get(row.offer_id) : null;
      return Boolean(onboarding(row) && offer && emailKey(offer.business_email) === email &&
        timestamp(offer.created_at) >= signupTime && timestamp(offer.created_at) <= timestamp(row.created_at));
    }, timestamp(onboardingAt) || signupTime);
    const planViewedAt = firstEvent("plan_choice_viewed", (row) => row.meta?.resume !== true, timestamp(offerPublishedAt) || signupTime);
    const growthClickedAt = firstEvent("plan_growth_clicked", () => true, timestamp(planViewedAt) || signupTime);
    const entitlement = email ? entitlements.get(email) : null;
    const trialAt = entitlement?.growth_trial_used ? entitlement.growth_trial_started_at : null;
    const rawAttribution = landing.meta?.landing_attribution;
    const attribution = rawAttribution && typeof rawAttribution === "object" && !Array.isArray(rawAttribution)
      ? rawAttribution as Record<string, unknown> : landing.meta;
    journeys.push({
      source: text(attribution?.utm_source) || text(attribution?.source) || text(landing.meta?.landing_referrer) || "unknown",
      campaign: text(attribution?.utm_campaign) || "Unassigned",
      landedAt: iso(landing.created_at), email,
      signedUpAt: profile ? iso(profile.created_at) : null,
      onboardingAt, offerPublishedAt, planViewedAt,
      freeChosenAt: firstEvent("plan_free_clicked", (row) => (row.meta?.outcome === "confirmed" || row.meta?.choice_confirmed === true), timestamp(planViewedAt) || signupTime),
      growthClickedAt,
      checkoutAt: firstEvent("plan_growth_checkout_started", (row) => row.meta?.source === "checkout_endpoint" && row.meta?.trialEligible === true, timestamp(growthClickedAt) || signupTime),
      trialStartedAt: trialAt && timestamp(trialAt) >= signupTime && timestamp(trialAt) <= to ? iso(trialAt) : null,
      onboardingSteps: [...new Set(rows.filter((row) => row.event_type === "offer_create_step" && onboarding(row))
        .map((row) => Number(row.meta?.step)).filter((step) => Number.isInteger(step) && step >= 1 && step <= 4))].sort(),
      publishAttempted: rows.some((row) => row.event_type === "offer_publish_clicked" && onboarding(row)),
      publishFailed: rows.some((row) => row.event_type === "offer_publish_failed" && onboarding(row)),
    });
  }
  return { landingViews: landings.length, unlinkedViews, journeys, unlinkedBusinessSignups: profiles.size - linkedEmails.size };
}
