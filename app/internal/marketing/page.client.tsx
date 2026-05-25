"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type DashboardData = {
  ok: boolean;
  days: number;
  totals: {
    pageViews: number;
    createAccountStarts: number;
  };
  byPage: Record<string, { pageViews: number; createAccountStarts: number }>;
  byAudience: Record<string, { pageViews: number; createAccountStarts: number }>;
  daily: Array<{ date: string; pageViews: number; createAccountStarts: number }>;
  recentCount: number;
};

export default function MarketingDashboardClient({ viewerEmail }: { viewerEmail: string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/marketing-events?days=${days}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || `Failed to load (${res.status})`);
        }
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,194,203,0.12),transparent_28%),linear-gradient(180deg,#091114_0%,#06090d_60%,#030405_100%)] px-5 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7ff5fb]/75">
                Internal only
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Marketing traffic dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                Lightweight counts for homepage/demo traffic and how many people make it to the create-account screen.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {[7, 30, 90].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    days === value
                      ? "bg-[#00C2CB] text-black"
                      : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
                >
                  {value}d
                </button>
              ))}
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/55">
                {viewerEmail}
              </span>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-white/70">
            Loading dashboard…
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-red-200">
            {error}
          </div>
        ) : data ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <StatCard label="Page views" value={data.totals.pageViews.toLocaleString()} />
              <StatCard label="Create account starts" value={data.totals.createAccountStarts.toLocaleString()} />
              <StatCard label="View → start rate" value={`${conversionRate.toFixed(1)}%`} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              <Panel title="By page">
                <div className="space-y-3">
                  {Object.entries(data.byPage).map(([page, counts]) => (
                    <Row
                      key={page}
                      label={page}
                      pageViews={counts.pageViews}
                      createAccountStarts={counts.createAccountStarts}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="By audience">
                <div className="space-y-3">
                  {Object.entries(data.byAudience).map(([audience, counts]) => (
                    <Row
                      key={audience}
                      label={audience}
                      pageViews={counts.pageViews}
                      createAccountStarts={counts.createAccountStarts}
                    />
                  ))}
                </div>
              </Panel>
            </section>

            <Panel title="Daily trend">
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/[0.03] text-left text-white/55">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Page views</th>
                      <th className="px-4 py-3 font-medium">Create account starts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {data.daily.length ? (
                      data.daily.map((row) => (
                        <tr key={row.date}>
                          <td className="px-4 py-3 text-white/75">{row.date}</td>
                          <td className="px-4 py-3 text-white">{row.pageViews}</td>
                          <td className="px-4 py-3 text-white">{row.createAccountStarts}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-5 text-center text-white/55">
                          No tracked events yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
      <p className="text-sm text-white/55">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function Row({
  label,
  pageViews,
  createAccountStarts,
}: {
  label: string;
  pageViews: number;
  createAccountStarts: number;
}) {
  const rate = pageViews ? ((createAccountStarts / pageViews) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-white/50">View → start rate {rate}%</p>
        </div>
        <div className="flex gap-4 text-sm text-white/75">
          <span>Views: <strong className="text-white">{pageViews}</strong></span>
          <span>Starts: <strong className="text-white">{createAccountStarts}</strong></span>
        </div>
      </div>
    </div>
  );
}
