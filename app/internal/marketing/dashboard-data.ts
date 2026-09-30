import type { MetricCounts, Breakdown, TimelineBucket } from "@/../utils/marketing/reporting";
export type { MetricCounts, Breakdown, TimelineBucket } from "@/../utils/marketing/reporting";

export type GrowthSummary = {
  businessSignups: number;
  affiliateSignups: number;
  offersPublished: number;
  affiliateRequests: number;
  liveCampaigns: number;
  trackedRevenue: number;
};

export type DashboardData = {
  ok: boolean;
  period: "24h" | "today" | "7d" | "30d" | "90d" | "all" | string;
  generatedAt: string;
  range: { from: string | null; to: string; timezone: string };
  dataQuality: { rowLimit: number; limitedSources: string[] };
  timeline: TimelineBucket[];
  audienceBreakdowns: Record<string, Breakdown>;
  totals: MetricCounts;
  byPage: Record<string, MetricCounts>;
  byAudience: Record<string, MetricCounts>;
  bySource: Record<string, MetricCounts>;
  byPlacement: Record<string, MetricCounts>;
  recentCount: number;
  revenue?: {
    total: number;
    count: number;
    currency: string;
    byCurrency: Record<string, number>;
  };
  growthSummary?: GrowthSummary;
  planSelection?: {
    reached: number;
    freeClicked: number;
    growthClicked: number;
    growthCheckoutStarted: number;
    growthTrialStarted: number;
    growthActivated: number;
    growthPaidActive: number;
  };
  trialValue?: {
    trialStarts: number;
    trialing: number;
    cancellationMarked: number;
    withoutCancellation: number;
    monthlyPriceAud: number;
    fullConversionMonthlyAud: number;
    withoutCancellationMonthlyAud: number;
  };
  dashboardBehavior?: {
    totalClickers: number;
    totalClicks: number;
    actions: Array<{
      action: string;
      label: string;
      destination: string | null;
      count: number;
      uniqueBusinesses: number;
    }>;
  };
  businessActivation?: {
    steps: Array<{
      key: string;
      label: string;
      count: number;
      rateFromPrevious: number | null;
      dropOffFromPrevious: number;
    }>;
    blockers: {
      neverReachedDashboard: number;
      dashboardNoOfferStart: number;
      offerStartedNoPublish: number;
      publishFailures: number;
      publishedNoAffiliateRequest: number;
      publishedNoMeta: number;
    };
    recentBusinesses: Array<{
      email: string;
      signedUpAt: string;
      dashboardReached: boolean;
      offerStarted: boolean;
      publishClicked: boolean;
      offerPublished: boolean;
      affiliateRequest: boolean;
      metaEnabled: boolean;
      offerCount: number;
      planChoice: "free" | "growth" | null;
      growthCheckoutStarted: boolean;
      growthTrialStarted: boolean;
      growthActivated: boolean;
      firstDashboardAction: { action: string; label: string; at: string } | null;
      lastEvent: string;
      lastEventAt: string;
    }>;
    instrumentationStarted: boolean;
  };
};

export type Period = "24h" | "today" | "7d" | "30d" | "90d" | "all";
export type Audience = "business" | "affiliate" | "unknown" | "all";


export const EMPTY_COUNTS: MetricCounts = { pageViews: 0, createAccountStarts: 0, businessDemoCtaClicks: 0 };

export function percent(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : "—";
}

export function sourceLabel(input: string): string {
  const raw = input.trim();
  const value = raw.toLowerCase();
  if (!value || value === "unknown") return "Unattributed";
  const aliases: Record<string, string> = {
    fb: "Facebook", facebook: "Facebook", ig: "Instagram", instagram: "Instagram",
    google: "Google", tiktok: "TikTok", reddit: "Reddit", direct: "Direct / Nettmark",
    "create-account": "Direct / Nettmark", email: "Email",
  };
  if (Object.prototype.hasOwnProperty.call(aliases, value)) return aliases[value];
  try {
    const host = new URL(value.includes("://") ? value : `https://${value}`).hostname.replace(/^www\./, "");
    const domainIs = (domain: string) => host === domain || host.endsWith(`.${domain}`);
    if (domainIs("facebook.com") || domainIs("fb.com")) return "Facebook";
    if (domainIs("instagram.com")) return "Instagram";
    if (domainIs("google.com") || domainIs("google.com.au")) return "Google";
    if (domainIs("tiktok.com")) return "TikTok";
    if (domainIs("reddit.com")) return "Reddit";
    if (domainIs("nettmark.com")) return "Direct / Nettmark";
    return host;
  } catch {
    return raw;
  }
}

export function groupSources(input: Record<string, MetricCounts>) {
  const grouped = new Map<string, MetricCounts>();
  for (const [raw, counts] of Object.entries(input)) {
    const label = sourceLabel(raw);
    const current = grouped.get(label) || { ...EMPTY_COUNTS };
    current.pageViews += counts.pageViews;
    current.createAccountStarts += counts.createAccountStarts;
    current.businessDemoCtaClicks += counts.businessDemoCtaClicks;
    grouped.set(label, current);
  }
  return Array.from(grouped, ([label, counts]) => ({ label, ...counts }))
    .sort((a, b) => b.pageViews - a.pageViews || b.createAccountStarts - a.createAccountStarts);
}

export function audienceData(data: DashboardData, audience: Audience) {
  if (audience === "all") return { counts: data.totals, byPage: data.byPage, bySource: data.bySource, byPlacement: data.byPlacement };
  const breakdown = data.audienceBreakdowns[audience];
  return {
    counts: data.byAudience[audience] || EMPTY_COUNTS,
    byPage: breakdown?.byPage || {},
    bySource: breakdown?.bySource || {},
    byPlacement: breakdown?.byPlacement || {},
  };
}
