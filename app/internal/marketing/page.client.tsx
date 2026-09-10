"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Globe2,
  LayoutDashboard,
  Megaphone,
  MousePointerClick,
  Send,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

type MetricCounts = {
  pageViews: number;
  createAccountStarts: number;
  businessDemoCtaClicks: number;
};

type GrowthSummary = {
  businessSignups: number;
  affiliateSignups: number;
  offersPublished: number;
  affiliateRequests: number;
  liveCampaigns: number;
  trackedRevenue: number;
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
  growthSummary?: GrowthSummary;
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
      lastEvent: string;
      lastEventAt: string;
    }>;
    instrumentationStarted: boolean;
  };
};

type Period = "24h" | "today" | "7d" | "30d" | "90d" | "all";
type Audience = "business" | "affiliate" | "all";

const PERIODS: Array<{ label: string; value: Period }> = [
  { label: "24H", value: "24h" },
  { label: "Today", value: "today" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "All", value: "all" },
];

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "business-funnel", label: "Business funnel", icon: BriefcaseBusiness },
  { id: "acquisition", label: "Acquisition", icon: Megaphone },
  { id: "users", label: "Users", icon: Users },
  { id: "website", label: "Website analytics", icon: Globe2 },
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

function ago(iso: string) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "—";
  const diff = Math.max(0, Date.now() - time);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function normaliseSource(input: string) {
  const source = String(input || "").trim().toLowerCase();
  if (!source || source === "unknown") return "Unknown";
  if (source === "fb" || source.includes("facebook")) return "Facebook";
  if (source === "ig" || source.includes("instagram")) return "Instagram";
  if (source.includes("google")) return "Google";
  if (source.includes("create-account") || source.includes("nettmark.com")) return "Direct / Nettmark";
  return input.length > 42 ? `${input.slice(0, 39)}…` : input;
}

export default function MarketingDashboardClient({ viewerEmail }: { viewerEmail: string }) {
  const [period, setPeriod] = useState<Period>("7d");
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
    if (!data) return { pageViews: 0, businessDemoCtaClicks: 0, createAccountStarts: 0 };
    if (audience === "all") return data.totals;
    return data.byAudience[audience] || { pageViews: 0, businessDemoCtaClicks: 0, createAccountStarts: 0 };
  }, [audience, data]);

  const sources = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<string, MetricCounts>();

    Object.entries(data.bySource).forEach(([raw, counts]) => {
      const label = normaliseSource(raw);
      const current = grouped.get(label) || { pageViews: 0, createAccountStarts: 0, businessDemoCtaClicks: 0 };
      current.pageViews += counts.pageViews || 0;
      current.createAccountStarts += counts.createAccountStarts || 0;
      current.businessDemoCtaClicks += counts.businessDemoCtaClicks || 0;
      grouped.set(label, current);
    });

    return Array.from(grouped.entries())
      .map(([label, counts]) => ({ label, ...counts }))
      .sort((a, b) => b.createAccountStarts - a.createAccountStarts || b.pageViews - a.pageViews)
      .slice(0, 6);
  }, [data]);

  const growth = data?.growthSummary;
  const activation = data?.businessActivation;
  const signupStep = activation?.steps.find((step) => step.key === "signup")?.count || 0;
  const offerStep = activation?.steps.find((step) => step.key === "offer_live")?.count || 0;
  const noOffer = Math.max(0, signupStep - offerStep);

  const biggestBlocker = useMemo(() => {
    if (!activation) return null;
    const items = [
      ["Never reached dashboard", activation.blockers.neverReachedDashboard],
      ["Dashboard → no offer start", activation.blockers.dashboardNoOfferStart],
      ["Offer started → not published", activation.blockers.offerStartedNoPublish],
      ["Publish failures", activation.blockers.publishFailures],
      ["Offer live → no affiliate yet", activation.blockers.publishedNoAffiliateRequest],
      ["Offer live → Meta not enabled", activation.blockers.publishedNoMeta],
    ] as const;
    return [...items].sort((a, b) => b[1] - a[1])[0];
  }, [activation]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#041014] text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-[#061217]/95 px-4 py-5 backdrop-blur-xl lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00C2CB]/15 text-[#5df7ff]">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">Nettmark</div>
            <div className="text-xs text-white/40">Internal analytics</div>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {NAV.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${index === 0 ? "bg-[#00C2CB]/12 text-[#75f8ff]" : "text-white/62 hover:bg-white/[0.05] hover:text-white"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-[#00C2CB]/15 bg-gradient-to-br from-[#08262b] to-[#071217] p-4">
          <div className="text-sm font-semibold">Distribution for everyone.</div>
          <div className="mt-1 text-xs text-white/40">Nettmark internal</div>
        </div>
      </aside>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
          <section id="overview" className="scroll-mt-4">
            <header className="flex flex-col gap-5 border-b border-white/8 pb-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#73f6fc]">
                  <span className="h-2 w-2 rounded-full bg-[#00C2CB]" />
                  Internal only
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Nettmark Growth Dashboard</h1>
                <p className="mt-2 text-sm text-white/48">Acquisition, business activation and marketplace movement in one place.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  {PERIODS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPeriod(item.value)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === item.value ? "bg-[#00C2CB] text-black" : "text-white/55 hover:bg-white/[0.05]"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">{viewerEmail}</span>
                <Link href="/" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06]">Home</Link>
              </div>
            </header>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {NAV.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => scrollTo(id)} className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/65">
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-white/55">Loading analytics…</div>
            ) : error ? (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>
            ) : data ? (
              <>
                <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <MetricCard icon={BriefcaseBusiness} label="Business signups" value={growth?.businessSignups || signupStep} note={data.period} />
                  <MetricCard icon={Store} label="Offers published" value={growth?.offersPublished || offerStep} note={`${pct(growth?.offersPublished || offerStep, growth?.businessSignups || signupStep)} of business signups`} />
                  <MetricCard icon={Users} label="Affiliate signups" value={growth?.affiliateSignups || 0} note={data.period} />
                  <MetricCard icon={Send} label="Affiliate requests" value={growth?.affiliateRequests || 0} note="marketplace demand" />
                  <MetricCard icon={BarChart3} label="Live campaigns" value={growth?.liveCampaigns || 0} note="created in period" />
                  <MetricCard icon={CircleDollarSign} label="Tracked revenue" value={fmtMoney(growth?.trackedRevenue || data.revenue?.total || 0)} note="platform fees tracked" />
                </section>

                <section id="business-funnel" className="mt-5 grid scroll-mt-5 gap-4 xl:grid-cols-[1.35fr_0.85fr]">
                  <Panel title="Business activation funnel" subtitle="From signup to an active marketplace business.">
                    <div className="space-y-3">
                      {(activation?.steps || []).map((step, index) => {
                        const max = Math.max(1, activation?.steps?.[0]?.count || 1);
                        const width = Math.max(6, (step.count / max) * 100);
                        return (
                          <div key={step.key}>
                            <div className="mb-1.5 flex items-end justify-between gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#00C2CB]/12 text-[11px] font-bold text-[#82faff]">{index + 1}</span>
                                <span className="text-white/78">{step.label}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-white">{step.count}</span>
                                {step.rateFromPrevious !== null ? <span className="ml-2 text-xs text-white/40">{step.rateFromPrevious.toFixed(1)}%</span> : null}
                              </div>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#00C2CB] via-[#19dbe4] to-[#7f6cff]" style={{ width: `${width}%` }} />
                            </div>
                            {step.dropOffFromPrevious > 0 ? <div className="mt-1 text-right text-[11px] text-rose-300/70">{step.dropOffFromPrevious} dropped from previous step</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  </Panel>

                  <Panel title="Key insights" subtitle="The things worth looking at first.">
                    <div className="space-y-3">
                      <Insight tone="warning" icon={Activity} title={biggestBlocker ? `Biggest drop-off: ${biggestBlocker[0]}` : "No blocker data yet"} body={biggestBlocker ? `${biggestBlocker[1]} businesses currently sit in this gap.` : "Fresh event data will populate this automatically."} />
                      <Insight tone="info" icon={BriefcaseBusiness} title={`${noOffer} business${noOffer === 1 ? "" : "es"} without an offer`} body={signupStep ? `${pct(noOffer, signupStep)} of business signups in this period have not published an offer yet.` : "No business signups in this period."} />
                      <Insight tone="success" icon={Store} title={`${offerStep} offers published`} body={signupStep ? `Signup → offer publication is currently ${pct(offerStep, signupStep)}.` : "Waiting for data."} />
                      <Insight tone="info" icon={Gauge} title="New tracking is now active" body="Dashboard reach, offer-builder entry, publish attempts and failures are being captured for new users." />
                    </div>
                  </Panel>
                </section>

                <section id="acquisition" className="mt-5 grid scroll-mt-5 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <Panel title="Acquisition snapshot" subtitle="Website traffic is still here, but now underneath product activation.">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniStat label="Views" value={selectedCounts.pageViews} foot={audience} icon={Globe2} />
                      <MiniStat label="CTA clicks" value={selectedCounts.businessDemoCtaClicks} foot={pct(selectedCounts.businessDemoCtaClicks, selectedCounts.pageViews)} icon={MousePointerClick} />
                      <MiniStat label="Account starts" value={selectedCounts.createAccountStarts} foot={pct(selectedCounts.createAccountStarts, selectedCounts.pageViews)} icon={Sparkles} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(["business", "affiliate", "all"] as Audience[]).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setAudience(item)}
                          className={`rounded-full border px-3 py-1.5 text-xs capitalize ${audience === item ? "border-[#00C2CB]/40 bg-[#00C2CB]/12 text-[#8ffbff]" : "border-white/10 bg-white/[0.02] text-white/45"}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Top sources" subtitle="Normalised from current attribution data.">
                    <div className="space-y-2">
                      {sources.length ? sources.map((source) => (
                        <div key={source.label} className="rounded-xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm text-white/75">{source.label}</span>
                            <span className="text-sm font-semibold">{source.createAccountStarts}</span>
                          </div>
                          <div className="mt-1 text-xs text-white/35">{source.pageViews} views · {source.businessDemoCtaClicks} CTA clicks</div>
                        </div>
                      )) : <div className="text-sm text-white/40">No source data yet.</div>}
                    </div>
                  </Panel>
                </section>

                <section id="users" className="mt-5 scroll-mt-5">
                  <Panel title="Recent business journeys" subtitle="Who joined, how far they got, and what they did last.">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-left text-sm">
                        <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.14em] text-white/35">
                          <tr>
                            <th className="px-2 py-3 font-medium">Business</th>
                            <th className="px-2 py-3 font-medium">Signed up</th>
                            <th className="px-2 py-3 font-medium">Dashboard</th>
                            <th className="px-2 py-3 font-medium">Offer started</th>
                            <th className="px-2 py-3 font-medium">Offer live</th>
                            <th className="px-2 py-3 font-medium">Affiliate</th>
                            <th className="px-2 py-3 font-medium">Paid enabled</th>
                            <th className="px-2 py-3 font-medium">Last action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {(activation?.recentBusinesses || []).map((business) => (
                            <tr key={business.email} className="text-white/68 hover:bg-white/[0.02]">
                              <td className="max-w-[260px] truncate px-2 py-3 font-medium text-white/88">{business.email}</td>
                              <td className="px-2 py-3 text-white/45">{ago(business.signedUpAt)}</td>
                              <td className="px-2 py-3"><Status active={business.dashboardReached} /></td>
                              <td className="px-2 py-3"><Status active={business.offerStarted} /></td>
                              <td className="px-2 py-3"><Status active={business.offerPublished} /></td>
                              <td className="px-2 py-3"><Status active={business.affiliateRequest} /></td>
                              <td className="px-2 py-3"><Status active={business.metaEnabled} /></td>
                              <td className="px-2 py-3 text-white/50">{business.lastEvent.replaceAll("_", " ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </section>

                <section id="website" className="mt-5 grid scroll-mt-5 gap-4 pb-10 xl:grid-cols-2">
                  <Panel title="Website funnel" subtitle="The old marketing view, kept for context.">
                    <FunnelRow label="Views" value={selectedCounts.pageViews} rate="100%" />
                    <FunnelRow label="CTA clicks" value={selectedCounts.businessDemoCtaClicks} rate={pct(selectedCounts.businessDemoCtaClicks, selectedCounts.pageViews)} />
                    <FunnelRow label="Create account starts" value={selectedCounts.createAccountStarts} rate={pct(selectedCounts.createAccountStarts, selectedCounts.pageViews)} />
                  </Panel>

                  <Panel title="Founder quick read" subtitle="A deliberately small decision panel.">
                    <div className="space-y-3">
                      <QuickLine label="Business signup → offer live" value={pct(offerStep, signupStep)} />
                      <QuickLine label="Businesses without offers" value={String(noOffer)} />
                      <QuickLine label="Tracked revenue" value={fmtMoney(growth?.trackedRevenue || data.revenue?.total || 0)} />
                      <QuickLine label="Events in period" value={data.recentCount.toLocaleString()} />
                    </div>
                  </Panel>
                </section>
              </>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a171b]/85 p-5 shadow-[0_16px_60px_rgba(0,0,0,0.16)]">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-white/38">{subtitle}</p> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, note }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a171b]/85 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-white/52">{label}</div>
        <div className="rounded-lg bg-[#00C2CB]/10 p-2 text-[#66f6fd]"><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="mt-1 text-[11px] text-white/34">{note}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, foot }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; foot: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/15 p-4">
      <div className="flex items-center gap-2 text-xs text-white/42"><Icon className="h-4 w-4 text-[#63f7ff]" />{label}</div>
      <div className="mt-2 text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-white/35">{foot}</div>
    </div>
  );
}

function Insight({ icon: Icon, title, body, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; tone: "success" | "info" | "warning" }) {
  const styles = tone === "success"
    ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
    : tone === "warning"
      ? "border-amber-400/15 bg-amber-400/[0.05] text-amber-300"
      : "border-sky-400/15 bg-sky-400/[0.05] text-sky-300";

  return (
    <div className={`rounded-xl border p-3 ${styles}`}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="text-sm font-medium text-white/88">{title}</div>
          <div className="mt-1 text-xs leading-5 text-white/42">{body}</div>
        </div>
      </div>
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-[11px] text-emerald-300">✓</span>
    : <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/12 text-[11px] text-white/24">·</span>;
}

function FunnelRow({ label, value, rate }: { label: string; value: number; rate: string }) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-xl border border-white/8 bg-black/15 px-4 py-3 last:mb-0">
      <span className="text-sm text-white/55">{label}</span>
      <div className="text-right">
        <span className="font-semibold">{value.toLocaleString()}</span>
        <span className="ml-3 text-xs text-[#79f7fd]">{rate}</span>
      </div>
    </div>
  );
}

function QuickLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/15 px-4 py-3">
      <span className="text-sm text-white/48">{label}</span>
      <span className="text-sm font-semibold text-white/85">{value}</span>
    </div>
  );
}
