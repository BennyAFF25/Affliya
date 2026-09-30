
export type MetricCounts = { pageViews: number; createAccountStarts: number; businessDemoCtaClicks: number };
export type Breakdown = {
  byPage: Record<string, MetricCounts>;
  bySource: Record<string, MetricCounts>;
  byPlacement: Record<string, MetricCounts>;
};
export type TimelineBucket = {
  at: string; totals: MetricCounts; byAudience: Record<string, MetricCounts>;
  businessSignups: number; affiliateSignups: number;
};
export type MarketingEvent = {
  event_type: string; page_path: string; audience: string | null;
  meta?: Record<string, unknown> | null; created_at: string;
};
const empty = (): MetricCounts => ({ pageViews: 0, createAccountStarts: 0, businessDemoCtaClicks: 0 });
const dictionary = <T>(): Record<string, T> => Object.create(null);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

/** Counts recorded events, not unique visitors or attributed signups. */
export function aggregateMarketingReport(input: {
  events: MarketingEvent[];
  businesses: Array<{ created_at: string }>;
  affiliates: Array<{ created_at: string }>;
  from: string | null; to: string; hourly: boolean;
}) {
  const totals = empty();
  const byPage = dictionary<MetricCounts>();
  const bySource = dictionary<MetricCounts>();
  const byPlacement = dictionary<MetricCounts>();
  const byAudience = dictionary<MetricCounts>();
  const audienceBreakdowns = dictionary<Breakdown>();
  const timelineMap = new Map<string, TimelineBucket>();
  const bucketSize = input.hourly ? 3600000 : 86400000;
  const bucketKey = (iso: string) => new Date(Math.floor(new Date(iso).getTime() / bucketSize) * bucketSize).toISOString();
  const entryFor = (iso: string) => {
    const at = bucketKey(iso);
    let entry = timelineMap.get(at);
    if (!entry) {
      entry = { at, totals: empty(), byAudience: dictionary<MetricCounts>(), businessSignups: 0, affiliateSignups: 0 };
      timelineMap.set(at, entry);
    }
    return entry;
  };
  const withinRange = (iso: string) => {
    const time = new Date(iso).getTime();
    return Number.isFinite(time) && time <= new Date(input.to).getTime() &&
      (!input.from || time >= new Date(input.from).getTime());
  };
  const increment = (group: Record<string, MetricCounts>, key: string, metric: keyof MetricCounts) => {
    if (!group[key]) group[key] = empty();
    group[key][metric] += 1;
  };
  for (const row of input.events) {
    const metric: keyof MetricCounts | null = row.event_type === "page_view" ? "pageViews"
      : row.event_type === "create_account_start" ? "createAccountStarts"
      : row.event_type === "business_demo_cta_click" ? "businessDemoCtaClicks" : null;
    if (!metric || !withinRange(row.created_at)) continue;
    const audience = text(row.audience) || "unknown";
    const source = text(row.meta?.utm_source) || text(row.meta?.source) || text(row.meta?.referrer) || "unknown";
    const placement = text(row.meta?.cta_placement) || "unknown";
    totals[metric] += 1;
    increment(byPage, row.page_path, metric);
    increment(bySource, source, metric);
    increment(byPlacement, placement, metric);
    increment(byAudience, audience, metric);
    if (!audienceBreakdowns[audience]) audienceBreakdowns[audience] = {
      byPage: dictionary<MetricCounts>(), bySource: dictionary<MetricCounts>(), byPlacement: dictionary<MetricCounts>(),
    };
    const breakdown = audienceBreakdowns[audience];
    increment(breakdown.byPage, row.page_path, metric);
    increment(breakdown.bySource, source, metric);
    increment(breakdown.byPlacement, placement, metric);
    const entry = entryFor(row.created_at);
    entry.totals[metric] += 1;
    increment(entry.byAudience, audience, metric);
  }
  for (const row of input.businesses) if (withinRange(row.created_at)) entryFor(row.created_at).businessSignups += 1;
  for (const row of input.affiliates) if (withinRange(row.created_at)) entryFor(row.created_at).affiliateSignups += 1;
  const firstAt = Array.from(timelineMap.keys()).sort()[0];
  const start = input.from || firstAt || input.to;
  for (let time = Math.floor(new Date(start).getTime() / bucketSize) * bucketSize; time <= new Date(input.to).getTime(); time += bucketSize) {
    entryFor(new Date(time).toISOString());
  }
  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.at.localeCompare(b.at));
  return { totals, byPage, bySource, byPlacement, byAudience, audienceBreakdowns, timeline };
}

/** Ledger amounts are accrued fees; never add different currencies together. */
export function aggregateFees(rows: Array<{ amount: number | string | null; currency: string | null }>) {
  const byCurrency = dictionary<number>();
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const currency = text(row.currency).toUpperCase() || "UNKNOWN";
    byCurrency[currency] = (byCurrency[currency] || 0) + amount;
  }
  for (const currency of Object.keys(byCurrency)) byCurrency[currency] = Number(byCurrency[currency].toFixed(2));
  return { total: byCurrency.AUD ?? 0, currency: "AUD", byCurrency, count: rows.length };
}
