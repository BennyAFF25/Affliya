"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MetricCounts = {
  pageViews: number;
  createAccountStarts: number;
  businessDemoCtaClicks: number;
  completedSignups: number;
};

type DashboardData = {
  ok: boolean;
  period: "24h" | "today" | "7d" | "30d" | "90d" | "all" | string;
  totals: MetricCounts;
  byPage: Record<string, MetricCounts>;
  byAudience: Record<string, MetricCounts>;
  bySource: Record<string, MetricCounts>;
  byPlacement: Record<string, MetricCounts>;
  recentCount: number;
  revenue?: {
    total: number;
    count: number;
  };
};

type Period = "24h" | "today" | "7d" | "30d" | "90d" | "all";
type Audience = "business" | "affiliate" | "all";

type CompactRow = {
  label: string;
  views: number;
  clicks: number;
  starts: number;
  conversions: number;
};

const PERIODS: Array<{ label: string; value: Period }> = [
  { label: "24H", value: "24h" },
  { label: "Today", value: "today" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "All", value: "all" },
];

function pct(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value || 0);
}

function buildRows(record: Record<string, MetricCounts>) {
  return Object.entries(record)
    .map(([label, counts]) => ({
      label,
      views: counts.pageViews || 0,
      clicks: counts.businessDemoCtaClicks || 0,
      starts: counts.createAccountStarts || 0,
      conversions: counts.completedSignups || 0,
    }))
    .sort((a, b) => b.conversions - a.conversions || b.starts - a.starts || b.clicks - a.clicks || b.views - a.views);
}

export default function MarketingDashboardClient({ viewerEmail }: { viewerEmail: string }) {
  const [period, setPeriod] = useState<Period>("24h");
  const [audience, setAudience] = useState<Audience>("business");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/marketing-events?period=${period}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed to load (${res.status})`);
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const selectedCounts = useMemo(() => {
    if (!data) return { pageViews: 0, businessDemoCtaClicks: 0, createAccountStarts: 0, completedSignups: 0 };
    if (audience === "all") return data.totals;
    return data.byAudience[audience] || { pageViews: 0, businessDemoCtaClicks: 0, createAccountStarts: 0, completedSignups: 0 };
  }, [audience, data]);

  const pageRows = useMemo(() => {
    if (!data) return [] as CompactRow[];
    const rows: CompactRow[] = [];

    if (audience !== "affiliate") {
      const businessDemo = data.byPage["/lp/business-demo"] || { pageViews: 0, businessDemoCtaClicks: 0, createAccountStarts: 0, completedSignups: 0 };
      rows.push({ label: "Business demo page", views: businessDemo.pageViews, clicks: businessDemo.businessDemoCtaClicks, starts: businessDemo.createAccountStarts, conversions: businessDemo.completedSignups });
    }

    if (audience !== "business") {
      const partnerDemo = data.byPage["/lp/partner-demo"] || { pageViews: 0, businessDemoCtaClicks: 0, createAccountStarts: 0, completedSignups: 0 };
      rows.push({ label: "Affiliate demo page", views: partnerDemo.pageViews, clicks: partnerDemo.businessDemoCtaClicks, starts: partnerDemo.createAccountStarts, conversions: partnerDemo.completedSignups });
    }

    const createAccount = data.byPage["/create-account"] || { pageViews: 0, businessDemoCtaClicks: 0, createAccountStarts: 0, completedSignups: 0 };
    rows.push({ label: "Signup page", views: createAccount.pageViews, clicks: createAccount.businessDemoCtaClicks, starts: createAccount.createAccountStarts, conversions: createAccount.completedSignups });

    return rows;
  }, [audience, data]);

  const topSource = useMemo(() => {
    if (!data) return null;
    const rows = buildRows(data.bySource).filter((row) => row.label !== "unknown");
    return rows[0] || null;
  }, [data]);

  const topPlacement = useMemo(() => {
    if (!data) return null;
    const rows = buildRows(data.byPlacement).filter((row) => row.label !== "unknown");
    return rows[0] || null;
  }, [data]);

  const actualConversionRate = useMemo(
    () => pct(selectedCounts.completedSignups, selectedCounts.pageViews),
    [selectedCounts.completedSignups, selectedCounts.pageViews],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,194,203,0.12),transparent_28%),linear-gradient(180deg,#071014_0%,#04080b_70%,#030405_100%)] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#aefcff]">Internal only</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Nettmark analytics</h1>
              <p className="mt-1 text-sm text-white/55">Readable funnel: visitors → clicks → signup starts → actual signups.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
              <Link href="/" className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-black/30">Home</Link>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{viewerEmail}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${period === item.value ? "bg-[#00C2CB] text-black" : "border border-white/10 bg-black/20 text-white/75 hover:bg-black/30"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {([
              { label: "Business", value: "business" },
              { label: "Affiliate", value: "affiliate" },
              { label: "All", value: "all" },
            ] as Array<{ label: string; value: Audience }>).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setAudience(item.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${audience === item.value ? "border border-[#00C2CB]/50 bg-[#00C2CB]/15 text-[#aefcff]" : "border border-white/10 bg-black/20 text-white/65 hover:bg-black/30"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/65">Loading…</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>
        ) : data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CompactStat label="Visitors" value={selectedCounts.pageViews.toLocaleString()} sublabel={`${audience} · ${data.period}`} />
              <CompactStat label="CTA clicks" value={selectedCounts.businessDemoCtaClicks.toLocaleString()} sublabel={`visitor → click ${pct(selectedCounts.businessDemoCtaClicks, selectedCounts.pageViews)}`} />
              <CompactStat label="Signup starts" value={selectedCounts.createAccountStarts.toLocaleString()} sublabel={`click → signup page ${pct(selectedCounts.createAccountStarts, selectedCounts.businessDemoCtaClicks)}`} />
              <CompactStat label="Actual signups" value={selectedCounts.completedSignups.toLocaleString()} sublabel={`visitor → signup ${actualConversionRate}`} />
            </section>

            <section className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
              <Card title="Funnel">
                <div className="space-y-3">
                  <FunnelStep label="Visitors" value={selectedCounts.pageViews} />
                  <FunnelStep label="CTA clicks" value={selectedCounts.businessDemoCtaClicks} rate={pct(selectedCounts.businessDemoCtaClicks, selectedCounts.pageViews)} />
                  <FunnelStep label="Signup page opens" value={selectedCounts.createAccountStarts} rate={pct(selectedCounts.createAccountStarts, selectedCounts.businessDemoCtaClicks)} />
                  <FunnelStep label="Actual account creations" value={selectedCounts.completedSignups} rate={pct(selectedCounts.completedSignups, selectedCounts.createAccountStarts)} />
                </div>
              </Card>

              <Card title="Quick reads">
                <div className="space-y-3 text-sm text-white/78">
                  <MiniLine label="Actual conversion rate" value={actualConversionRate} />
                  <MiniLine label="Signup-start rate" value={pct(selectedCounts.createAccountStarts, selectedCounts.pageViews)} />
                  <MiniLine label="Top traffic source" value={topSource ? `${topSource.label} (${topSource.starts} starts)` : "—"} />
                  <MiniLine label="Best CTA position" value={topPlacement ? `${topPlacement.label} (${topPlacement.clicks} clicks)` : "—"} />
                  <MiniLine label="Tracked revenue" value={fmtMoney(data.revenue?.total || 0)} />
                </div>
              </Card>
            </section>

            <Card title="What each number means">
              <div className="space-y-2 text-sm text-white/72">
                <p><span className="font-medium text-white">Visitors</span> = tracked page views on Nettmark marketing pages.</p>
                <p><span className="font-medium text-white">CTA clicks</span> = people who clicked a tracked “start” button.</p>
                <p><span className="font-medium text-white">Signup starts</span> = people who opened the create-account page.</p>
                <p><span className="font-medium text-white">Actual signups</span> = real new rows in <span className="font-mono text-xs text-[#aefcff]">public.profiles</span> during the selected period.</p>
              </div>
            </Card>

            <section className="grid gap-3 lg:grid-cols-2">
              <Card title="Pages">
                <CompactTable rows={pageRows} />
              </Card>
              <Card title="Top sources">
                <CompactTable rows={buildRows(data.bySource).slice(0, 5)} />
              </Card>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CompactStat({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">{label}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/55">{sublabel}</div>
    </div>
  );
}

function FunnelStep({ label, value, rate }: { label: string; value: number; rate?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-white/80">{label}</span>
        <span className="text-lg font-bold text-white">{value.toLocaleString()}</span>
      </div>
      {rate ? <div className="mt-1 text-xs text-[#aefcff]">{rate}</div> : null}
    </div>
  );
}

function MiniLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
      <span className="text-white/60">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}

function CompactTable({ rows }: { rows: CompactRow[] }) {
  if (!rows.length) {
    return <div className="text-sm text-white/50">No data yet.</div>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-white">{row.label}</div>
            <div className="text-xs text-white/50">{pct(row.conversions, row.views)} actual conversion rate</div>
          </div>
          <div className="mt-2 grid gap-1 text-xs text-white/65">
            <span>Visitors: {row.views}</span>
            <span>CTA clicks: {row.clicks}</span>
            <span>Signup starts: {row.starts}</span>
            <span>Actual signups: {row.conversions}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
