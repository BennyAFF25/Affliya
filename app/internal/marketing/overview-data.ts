import type { DashboardData } from "./dashboard-data";

/** Independent durable cohort milestones. Never infer adjacent conversions from activity totals. */
export function overviewSignals(data: Pick<DashboardData, "businessFunnel" | "dataQuality">) {
  const businesses = data.businessFunnel?.detail;
  if (!businesses?.length) return { milestones: null, opportunities: [] };
  const count = (key: "offerPublished" | "trialStarted" | "campaignCreated") => businesses.filter(b => b.flags[key]).length;
  const opportunities = [
    { title: "Publish the first offer", count: businesses.filter(b => !b.flags.offerPublished).length, detail: "businesses have no saved offer yet." },
    { title: "Review the trial step", count: businesses.filter(b => b.flags.offerPublished && !b.flags.trialStarted).length, detail: "businesses have an offer but no recorded trial." },
    { title: "Help trials reach a campaign", count: businesses.filter(b => b.flags.trialStarted && !b.flags.campaignCreated).length, detail: "businesses started a trial but have no paid Meta campaign." },
  ].filter(item => item.count > 0).sort((a, b) => b.count - a.count);
  return {
    milestones: { signups: businesses.length, offers: count("offerPublished"), trials: count("trialStarted"), campaigns: count("campaignCreated") },
    opportunities: data.dataQuality.limitedSources.length ? [] : opportunities.slice(0, 3),
  };
}
