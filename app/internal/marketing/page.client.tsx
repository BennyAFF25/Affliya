"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";

type DashboardData = {
  ok: boolean;
  days: number | "all";
  totals: {
    pageViews: number;
    createAccountStarts: number;
  };
  byPage: Record<string, { pageViews: number; createAccountStarts: number }>;
  byAudience: Record<string, { pageViews: number; createAccountStarts: number }>;
  daily: Array<{ date: string; pageViews: number; createAccountStarts: number }>;
  recentCount: number;
  revenue?: {
    total: number;
    byStatus: Record<string, number>;
    daily: Array<{ date: string; amount: number }>;
    count: number;
  };
};

const PAGE_LABELS: Record<string, string> = {
  "/": "Home page",
  "/lp/partner-demo": "Affiliate demo",
  "/lp/business-demo": "Business demo",
  "/create-account": "Create account",
};

const PAGE_ORDER = ["/lp/partner-demo", "/lp/business-demo", "/", "/create-account"];

function friendlyPage(path: string) {
  return PAGE_LABELS[path] || path;
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value || 0);
}

export default function MarketingDashboardClient({ viewerEmail }: { viewerEmail: string }) {
  const [days, setDays] = useState<7 | 30 | 90 | 180 | 365 | "all">(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRevenue, setShowRevenue] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/marketing-events?days=${days}`, { cache: "no-store" });
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
  }, [days]);

  const conversionRate = useMemo(() => {
    if (!data?.totals.pageViews) return 0;
    return (data.totals.createAccountStarts / data.totals.pageViews) * 100;
  }, [data]);

  const pageRows = useMemo(() => {
    if (!data) return [] as Array<{ key: string; label: string; pageViews: number; createAccountStarts: number }>;
    return PAGE_ORDER.map((path) => ({
      key: path,
      label: friendlyPage(path),
      pageViews: data.byPage[path]?.pageViews || 0,
      createAccountStarts: data.byPage[path]?.createAccountStarts || 0,
    }));
  }, [data]);

  const trendRows = useMemo(() => {
    if (!data) return [];
    const revenueMap = new Map((data.revenue?.daily || []).map((r) => [r.date, r.amount]));
    return data.daily.map((d) => ({
      ...d,
      revenue: revenueMap.get(d.date) || 0,
      label: d.date.slice(5),
    }));
  }, [data]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,194,203,0.18),transparent_30%),linear-gradient(180deg,#071014_0%,#04080b_62%,#030405_100%)] px-5 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7ff5fb]/80">Internal only</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Nettmark analytics</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/" className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white">Visit Nettmark home</Link>
                <Link href="/internal/marketing-login" className="rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/12 px-3 py-1.5 text-xs font-semibold text-[#aefcff] transition hover:bg-[#00C2CB]/18">Analytics access link</Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {[
                { label: "7D", value: 7 as const },
                { label: "30D", value: 30 as const },
                { label: "90D", value: 90 as const },
                { label: "6M", value: 180 as const },
                { label: "1Y", value: 365 as const },
                { label: "All", value: "all" as const },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDays(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${days === value ? "bg-[#00C2CB] text-black" : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"}`}
                >
                  {label}
                </button>
              ))}
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/55">{viewerEmail}</span>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-white/70">Loading dashboard…</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-red-200">{error}</div>
        ) : data ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <StatCard label="Page views" value={data.totals.pageViews.toLocaleString()} tone="cyan" />
              <StatCard label="Create account starts" value={data.totals.createAccountStarts.toLocaleString()} tone="violet" />
              <StatCard label="View → start rate" value={`${conversionRate.toFixed(1)}%`} tone="emerald" />
              <StatCard
                label="Fee ledger revenue"
                value={fmtMoney(data.revenue?.total || 0)}
                tone="amber"
                note={data.revenue?.count ? `${data.revenue.count} ledger rows` : "No ledger rows yet"}
              />
            </section>

            <Panel
              title="Daily trend"
              right={<label className="inline-flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={showRevenue} onChange={(e) => setShowRevenue(e.target.checked)} /> Show revenue</label>}
            >
              <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-white/70">
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-6 rounded-full bg-[#00C2CB]" /> Page views</span>
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-6 rounded-full bg-[#8B5CF6]" /> Create account starts</span>
                {showRevenue ? <span className="inline-flex items-center gap-2"><span className="h-1.5 w-6 rounded-full bg-[#F59E0B]" /> Revenue</span> : null}
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendRows}>
                    <defs>
                      <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00C2CB" stopOpacity={0.55} /><stop offset="100%" stopColor="#00C2CB" stopOpacity={0.04} /></linearGradient>
                      <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.45} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.04} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.11)" vertical={false} strokeDasharray="4 5" />
                    <XAxis
                      dataKey="label"
                      stroke="rgba(255,255,255,0.6)"
                      tickMargin={10}
                      minTickGap={24}
                      interval="preserveStartEnd"
                    />
                    <YAxis yAxisId="left" stroke="rgba(255,255,255,0.6)" tickMargin={8} width={40} />
                    {showRevenue ? <YAxis yAxisId="right" orientation="right" stroke="rgba(245,158,11,0.9)" tickFormatter={(v) => `$${Math.round(Number(v || 0))}`} width={52} /> : null}
                    <Tooltip
                      contentStyle={{ background: "#051018", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 12 }}
                      formatter={(value: number, name: string) => {
                        if (name === "revenue") return [fmtMoney(Number(value || 0)), "Revenue"];
                        if (name === "pageViews") return [Number(value || 0), "Page views"];
                        if (name === "createAccountStarts") return [Number(value || 0), "Create account starts"];
                        return [Number(value || 0), name];
                      }}
                    />
                    <Area type="monotone" dataKey="pageViews" stroke="#00C2CB" fill="url(#pv)" strokeWidth={2.2} />
                    <Area type="monotone" dataKey="createAccountStarts" stroke="#8B5CF6" fill="url(#ca)" strokeWidth={2.2} />
                    {showRevenue ? <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={2} dot={false} /> : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="By page" subtitle="Clean view of your key pages">
              <div className="space-y-3">
                {pageRows.map((row) => (
                  <CollapsibleStatCard key={row.key} label={row.label} pageViews={row.pageViews} createAccountStarts={row.createAccountStarts} />
                ))}
              </div>
            </Panel>

            <Panel title="By audience">
              <div className="space-y-3">
                {Object.entries(data.byAudience).map(([audience, counts]) => (
                  <CollapsibleStatCard key={audience} label={audience === "unknown" ? "Unknown" : audience} pageViews={counts.pageViews} createAccountStarts={counts.createAccountStarts} />
                ))}
              </div>
            </Panel>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-white/55">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, tone, note }: { label: string; value: string; tone: "cyan" | "violet" | "emerald" | "amber"; note?: string }) {
  const toneClass: Record<string, string> = {
    cyan: "from-cyan-400/25",
    violet: "from-violet-400/25",
    emerald: "from-emerald-400/25",
    amber: "from-amber-400/25",
  };
  return (
    <div className={`rounded-3xl border border-white/10 bg-gradient-to-br ${toneClass[tone]} to-transparent p-5`}>
      <p className="text-sm text-white/65">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {note ? <p className="mt-1 text-xs text-white/55">{note}</p> : null}
    </div>
  );
}

function CollapsibleStatCard({ label, pageViews, createAccountStarts }: { label: string; pageViews: number; createAccountStarts: number }) {
  const rate = pageViews ? (createAccountStarts / pageViews) * 100 : 0;
  const chartRows = [
    { name: "Views", value: pageViews, fill: "#00C2CB" },
    { name: "Starts", value: createAccountStarts, fill: "#8B5CF6" },
  ];

  return (
    <details className="group rounded-2xl border border-white/10 bg-black/20 open:bg-black/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-white/55">View → start {rate.toFixed(1)}%</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/80">
          <span>Views <strong className="text-white">{pageViews}</strong></span>
          <span>Starts <strong className="text-white">{createAccountStarts}</strong></span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </div>
      </summary>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.65)" />
              <YAxis stroke="rgba(255,255,255,0.65)" />
              <Tooltip contentStyle={{ background: "#051018", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 12 }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartRows.map((row) => (
                  <Cell key={row.name} fill={row.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </details>
  );
}
