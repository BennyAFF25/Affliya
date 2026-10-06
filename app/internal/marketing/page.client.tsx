"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Check, CircleAlert, LockKeyhole, RefreshCw, Search, CalendarDays, Menu } from "lucide-react";
import { audienceData, EMPTY_COUNTS, groupSources, percent, type Audience, type DashboardData, type Period } from "./dashboard-data";
import s from "./marketing.module.css";
import BusinessFunnel from "./BusinessFunnel";
import MarketingOverview from "./MarketingOverview";

const PERIODS: { value: Period; label: string }[] = [
  { value: "24h", label: "24 hours" }, { value: "today", label: "Today" },
  { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" }, { value: "all", label: "All time" },
];
const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "all", label: "Everyone" }, { value: "business", label: "Businesses" },
  { value: "affiliate", label: "Affiliates" }, { value: "unknown", label: "Unassigned" },
];
const NAV = [
  { id: "overview", label: "Overview" }, { id: "acquisition", label: "Acquisition" },
  { id: "activation", label: "Activation" }, { id: "revenue", label: "Revenue" },
];
const number = (value: number) => new Intl.NumberFormat("en-AU").format(value);
const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(value);
const date = (value: string, hour = false) => new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC", ...(hour ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }),
}).format(new Date(value));
const fullDate = (value: string) => new Date(value).toLocaleString("en-AU", { timeZone: "UTC" });
const human = (value: string) => value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function Panel({ title, subtitle, children, aside }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return <section className={s.panel}><div className={s.panelHead}><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{aside}</div>{children}</section>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className={s.empty}>{children}</div>;
}
function Status({ yes, label }: { yes: boolean; label: string }) {
  return <span className={s.status + (yes ? " " + s.statusYes : "")} title={yes ? label + " recorded" : "No " + label.toLowerCase() + " recorded"}>{yes && <Check size={12} aria-hidden="true" />}{label}{!yes && <span className={s.srOnly}>: not recorded</span>}</span>;
}

export default function MarketingDashboardClient({ viewerEmail }: { viewerEmail: string }) {
  const [signupFrom, setSignupFrom] = useState("");
  const [signupTo, setSignupTo] = useState("");
  const [observedThrough, setObservedThrough] = useState("");
  const [cohortQuery, setCohortQuery] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [audience, setAudience] = useState<Audience>("all");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");
  const [chartMetric, setChartMetric] = useState<"pageViews" | "createAccountStarts">("pageViews");
  const [search, setSearch] = useState("");
  const [businessFilter, setBusinessFilter] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cohort = new URLSearchParams();
    for (const key of ["signupFrom", "signupTo", "observedThrough"]) {
      const value = params.get(key);
      if (value) cohort.set(key, value);
    }
    setSignupFrom(cohort.get("signupFrom") || "");
    setSignupTo(cohort.get("signupTo") || "");
    setObservedThrough(cohort.get("observedThrough") || "");
    if (cohort.size) setCohortQuery("&" + cohort.toString());
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    async function load() {
      try {
        const response = await fetch("/api/marketing-events?period=" + period + cohortQuery, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Unable to load analytics (" + response.status + ")");
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load analytics");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [period, refresh, cohortQuery]);

  const website = useMemo(() => data ? audienceData(data, audience) : null, [data, audience]);
  const sources = useMemo(() => groupSources(website?.bySource || {}), [website]);
  const chart = useMemo(() => (data?.timeline || []).map((bucket) => ({
    at: bucket.at, ...(audience === "all" ? bucket.totals : bucket.byAudience[audience] || EMPTY_COUNTS),
  })), [data, audience]);
  const businesses = useMemo(() => (data?.businessActivation?.recentBusinesses || []).filter((business) => {
    if (!business.email.toLowerCase().includes(search.toLowerCase().trim())) return false;
    if (businessFilter === "no-offer") return !business.offerPublished;
    if (businessFilter === "trial") return business.growthTrialStarted;
    if (businessFilter === "published") return business.offerPublished;
    return true;
  }), [data, search, businessFilter]);

  const growth = data?.growthSummary;
  const activation = data?.businessActivation;
  const plan = data?.planSelection;
  const trials = data?.trialValue;
  const signupCount = activation?.steps.find((step) => step.key === "signup")?.count ?? 0;
  const gaps = activation ? [
    { label: "Offer started, no publish recorded", count: activation.blockers.offerStartedNoPublish },
    { label: "Publish failure recorded", count: activation.blockers.publishFailures },
    { label: "Offer live, no affiliate request", count: activation.blockers.publishedNoAffiliateRequest },
    { label: "Offer live, Meta not connected", count: activation.blockers.publishedNoMeta },
  ].sort((a, b) => b.count - a.count) : [];
  const hourly = period === "24h" || period === "today";
  const openSection = (id: string) => {
    setActiveSection(id === "businesses" ? "activation" : id);
    requestAnimationFrame(() => document.getElementById(id === "businesses" ? "businesses" : "dashboard-tabs")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start",
    }));
  };

  return (
    <div className={s.dashboard}>
      <a className={s.skip} href="#dashboard-tabs">Skip to analytics</a>
      <header className={s.topbar}>
        <Link className={s.brand} href="/" aria-label="Nettmark home"><span className={s.logoCrop}><img src="/nettmark-logo.png" alt="Nettmark" width="1080" height="1080" /></span></Link>
        <div className={s.controls}><label className={s.periodControl}><CalendarDays size={17} aria-hidden="true" /><span className={s.srOnly}>Reporting period</span><select value={period} onChange={event => setPeriod(event.target.value as Period)}>{PERIODS.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
          <details className={s.menu}><summary aria-label="Workspace menu"><Menu size={20} /></summary><div><button type="button" onClick={event => { setRefresh(value => value + 1); event.currentTarget.closest("details")?.removeAttribute("open"); }} disabled={loading}><RefreshCw size={15} />Refresh analytics</button><button type="button" onClick={event => { openSection("businesses"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>Business directory</button><span><LockKeyhole size={12} />Private · {viewerEmail}</span><Link href="/">Back to Nettmark</Link></div></details>
        </div>
      </header>
      <main className={s.main}>
        <div className={s.heading}><div><h1>Internal Marketing</h1><p>Track growth and business activation across Nettmark.</p></div></div>
        <div className={s.navbar} id="dashboard-tabs" tabIndex={-1}><nav role="tablist" aria-label="Dashboard sections">{NAV.map(({ id, label }, index) => <button type="button" role="tab" id={"tab-" + id} aria-controls={id} aria-selected={activeSection === id} tabIndex={activeSection === id ? 0 : -1} key={id} onClick={() => setActiveSection(id)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % NAV.length : event.key === "ArrowLeft" ? (index + NAV.length - 1) % NAV.length : event.key === "Home" ? 0 : event.key === "End" ? NAV.length - 1 : null;
          if (next !== null) { event.preventDefault(); setActiveSection(NAV[next].id); document.getElementById("tab-" + NAV[next].id)?.focus(); }
        }} className={activeSection === id ? s.navActive : ""}>{label}</button>)}</nav></div>
        {loading ? <div className={s.loading} role="status"><span className={s.srOnly}>Loading your analytics</span><div className={s.skeletonCards}>{[1, 2, 3, 4].map((key) => <div key={key} className={s.skeleton} />)}</div><div className={s.skeleton + " " + s.skeletonChart} /></div>
          : error ? <div className={s.error} role="alert"><CircleAlert size={20} /><div><h2>Analytics couldn’t load</h2><p>{error}</p><button className={s.textButton} onClick={() => setRefresh((value) => value + 1)}>Try again <ArrowUpRight size={14} /></button></div></div>
          : data ? <>
            {!!data.dataQuality.limitedSources.length && <div className={s.notice} role="status"><CircleAlert size={16} /><p>Partial report: {data.dataQuality.limitedSources.join(", ")} reached the {number(data.dataQuality.rowLimit)} row limit. Choose a shorter period for a more complete view.</p></div>}
            <section id="overview" role="tabpanel" tabIndex={0} aria-labelledby="tab-overview" hidden={activeSection !== "overview"} className={s.section}>
              <MarketingOverview data={data} openSection={openSection} />
            </section>

            <section id="acquisition" role="tabpanel" tabIndex={0} aria-labelledby="tab-acquisition" hidden={activeSection !== "acquisition"} className={s.section}>
              <div className={s.sectionHead}><div><span className={s.eyebrow}>WEBSITE ACTIVITY</span><h2>Acquisition</h2></div><div><label className={s.srOnly} htmlFor="marketing-audience">Website audience</label><select id="marketing-audience" className={s.select} value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>{AUDIENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
              <div className={s.chartGrid}>
                <Panel title="Website activity" subtitle={(hourly ? "Hourly" : "Daily") + " recorded events · UTC · " + AUDIENCES.find((item) => item.value === audience)?.label} aside={<div className={s.segmented} aria-label="Chart metric">{(["pageViews", "createAccountStarts"] as const).map((metric) => <button type="button" key={metric} aria-pressed={chartMetric === metric} className={chartMetric === metric ? s.segmentActive : ""} onClick={() => setChartMetric(metric)}>{metric === "pageViews" ? "Views" : "Account starts"}</button>)}</div>}>
                  <div className={s.chartTotal}><strong>{number(website?.counts[chartMetric] ?? 0)}</strong><span>{chartMetric === "pageViews" ? "page views" : "account-start clicks"}</span></div>
                  {chart.some((bucket) => bucket[chartMetric] > 0) ? <div className={s.chart} role="img" aria-label="Website activity over time. Exact values are available in the chart data table below."><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="marketingArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00C2CB" stopOpacity={0.17} /><stop offset="100%" stopColor="#00C2CB" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#2a3033" strokeDasharray="3 5" /><XAxis dataKey="at" tickFormatter={(value: string) => date(value, hourly)} axisLine={false} tickLine={false} minTickGap={35} tick={{ fill: "#94a3b8", fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} /><Tooltip labelFormatter={(value) => fullDate(String(value)) + " UTC"} formatter={(value) => [number(Number(value)), chartMetric === "pageViews" ? "Page views" : "Account starts"]} contentStyle={{ border: "1px solid #2a3033", borderRadius: 14, boxShadow: "0 8px 30px #0000000a", fontSize: 12, color: "#f5f7f8", backgroundColor: "#151718" }} /><Area type="linear" dataKey={chartMetric} stroke="#00C2CB" strokeWidth={2.5} fill="url(#marketingArea)" dot={chart.length === 1} activeDot={{ r: 4, strokeWidth: 3, stroke: "#151718" }} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <Empty>No recorded {chartMetric === "pageViews" ? "page views" : "account starts"} for this audience and period.</Empty>}
                  <details className={s.details}><summary>View chart data</summary><div className={s.tableScroll}><table className={s.table}><caption className={s.srOnly}>Website events over time</caption><thead><tr><th>Period (UTC)</th><th>Views</th><th>Starts</th><th>Demo</th></tr></thead><tbody>{chart.map((bucket) => <tr key={bucket.at}><td>{fullDate(bucket.at)}</td><td>{number(bucket.pageViews)}</td><td>{number(bucket.createAccountStarts)}</td><td>{number(bucket.businessDemoCtaClicks)}</td></tr>)}</tbody></table></div></details>
                </Panel>
                <Panel title="Intent signals" subtitle="Clicks recorded on your marketing pages.">
                  <div className={s.intent}><span className={s.eyebrow}>ACCOUNT STARTS</span><strong>{number(website?.counts.createAccountStarts ?? 0)}</strong><p>{percent(website?.counts.createAccountStarts ?? 0, website?.counts.pageViews ?? 0)} clicks per page view</p></div>
                  <div className={s.intent}><span className={s.eyebrow}>DEMO CTA CLICKS</span><strong>{number(website?.counts.businessDemoCtaClicks ?? 0)}</strong><p>Interest in the business demo</p></div>
                  <p className={s.helper}>Counts include repeat visits and clicks. Account starts are clicks, not completed signups. The audience filter applies to this acquisition section.</p>
                </Panel>
              </div>
              <div className={s.twoColumns}>
                <Panel title="Where people come from" subtitle="UTM source first, then source or recorded referrer.">
                  {sources.length ? <><div className={s.sourceHeader}><span>Source</span><span>Views / starts</span></div>{sources.map((source) => <div className={s.sourceRow} key={source.label}><div className={s.sourceTitle}><span title={source.label}>{source.label}</span><span><strong>{number(source.pageViews)}</strong><span className={s.muted}> / {number(source.createAccountStarts)}</span></span></div><div className={s.track}><span style={{ width: (website?.counts.pageViews ? source.pageViews / website.counts.pageViews * 100 : 0) + "%" }} /></div></div>)}</> : <Empty>No source activity recorded.</Empty>}
                  <p className={s.helper}>Unattributed means a source was not recorded. These events do not establish signup attribution.</p>
                </Panel>
                <Panel title="Pages & placements" subtitle="Pages and calls to action receiving attention.">
                  {Object.keys(website?.byPage || {}).length ? <div className={s.tableScroll}><table className={s.table}><caption className={s.srOnly}>Page performance</caption><thead><tr><th>Page</th><th>Views</th><th>Starts</th><th>Demo</th></tr></thead><tbody>{Object.entries(website?.byPage || {}).sort((a, b) => b[1].pageViews - a[1].pageViews).map(([path, counts]) => <tr key={path}><td className={s.path}>{path === "/" ? "Homepage" : path}</td><td>{number(counts.pageViews)}</td><td>{number(counts.createAccountStarts)}</td><td>{number(counts.businessDemoCtaClicks)}</td></tr>)}</tbody></table></div> : <Empty>No page activity recorded.</Empty>}
                  <details className={s.details}><summary>CTA placement details</summary><div className={s.tableScroll}><table className={s.table}><caption className={s.srOnly}>CTA placements</caption><thead><tr><th>Placement</th><th>Starts</th><th>Demo</th></tr></thead><tbody>{Object.entries(website?.byPlacement || {}).filter(([, counts]) => counts.createAccountStarts + counts.businessDemoCtaClicks > 0).sort((a, b) => b[1].createAccountStarts - a[1].createAccountStarts).map(([placement, counts]) => <tr key={placement}><td>{placement === "unknown" ? "Unassigned" : human(placement)}</td><td>{number(counts.createAccountStarts)}</td><td>{number(counts.businessDemoCtaClicks)}</td></tr>)}</tbody></table></div></details>
                </Panel>
              </div>
            </section>

            <section id="activation" role="tabpanel" tabIndex={0} aria-labelledby="tab-activation" hidden={activeSection !== "activation"} className={s.section}>
              <div className={s.sectionHead}><div><span className={s.eyebrow}>BUSINESS ACTIVATION</span><h2>Business activation</h2><p>Selected business signup cohort · outcomes followed through the observation date.</p></div></div>
              <details className={s.secondaryDetails}><summary>Landing-page journey <span>Source filters, ordered funnel and linked business drilldowns</span></summary>
                {data.landingFunnel ? <BusinessFunnel key={period} report={data.landingFunnel} /> : <Empty>The landing journey report is unavailable.</Empty>}
              </details>
              <Panel title="Business onboarding experiment" subtitle="Trial-first vs plan choice · fixed signup cohort, followed through the observation date">
                <form className={s.planGrid} onSubmit={event => {
                  event.preventDefault();
                  const params = new URLSearchParams();
                  if (signupFrom) params.set("signupFrom", signupFrom);
                  if (signupTo) params.set("signupTo", signupTo);
                  if (observedThrough) params.set("observedThrough", observedThrough);
                  setCohortQuery(params.size ? "&" + params.toString() : "");
                  window.history.replaceState(null, "", window.location.pathname + (params.size ? "?" + params.toString() : ""));
                  setRefresh(n => n + 1);
                }}>
                  <label>Signup from (UTC)<input type="date" value={signupFrom} onChange={e => setSignupFrom(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-transparent px-3" /></label>
                  <label>Signup to (exclusive)<input type="date" value={signupTo} onChange={e => setSignupTo(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-transparent px-3" /></label>
                  <label>Observe through (UTC)<input type="date" max={new Date().toISOString().slice(0, 10)} value={observedThrough} onChange={e => setObservedThrough(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-transparent px-3" /></label>
                  <button type="submit" className="min-h-11 self-end rounded-full border border-white/10 px-4">Apply cohort dates</button>
                </form>
                {data.businessFunnel && <>
                  <p className={s.helper}>Signups: {data.businessFunnel.signupWindow.from ? fullDate(data.businessFunnel.signupWindow.from) : "all time"} → {fullDate(data.businessFunnel.signupWindow.toExclusive)} (exclusive). Outcomes through {fullDate(data.businessFunnel.observedThrough)}. Leave observation blank to keep following a fixed signup window. Initial 50/50 allocation starts {fullDate(data.businessFunnel.rolloutAt)}; 100% trial-first starts {fullDate(data.businessFunnel.fullRolloutAt)}.</p>
                  <div className={s.tableScroll}><table className={s.table}><caption className={s.srOnly}>Business onboarding experiment comparison</caption>
                    <thead><tr><th>Milestone / source</th>{data.businessFunnel.groups.map(group => <th key={group.version}>{group.version === "pre_experiment" ? "Historical" : group.version === "plan_choice_v1" ? "Control (50/50)" : group.version === "trial_first_v1" ? "Trial-first (50/50)" : "Trial-first (100%)"}</th>)}</tr></thead>
                    <tbody>{data.businessFunnel.metrics.map(metric => <tr key={metric.key}><td>{metric.label}<br /><small className={s.muted}>{metric.source}</small></td>{data.businessFunnel!.groups.map(group => <td key={group.version}>{number(group.counts[metric.key])} <small className={s.muted}>({group.counts.signups ? group.rates[metric.key] + "%" : "—"})</small></td>)}</tr>)}
                      <tr><td>Trials past full trial duration</td>{data.businessFunnel.groups.map(group => <td key={group.version}>{group.matureTrials}</td>)}</tr>
                    </tbody>
                  </table></div>
                  {data.businessFunnel.notes.map(note => <p key={note} className={s.helper}>{note}</p>)}
                </>}
              </Panel>
              <details className={s.secondaryDetails}><summary>Milestones & tracking gaps</summary>
              <div className={s.twoColumns}>
                <Panel title="Business milestones" subtitle="Each percentage is a share of this signup cohort.">
                  {signupCount > 0 ? <div className={s.milestones}>{activation?.steps.map((step, index) => <div key={step.key} className={s.milestone}><div className={s.milestoneLabel}><span className={s.step}>{String(index + 1).padStart(2, "0")}</span><span>{step.label}</span><strong>{number(step.count)}</strong><span className={s.muted}>{percent(step.count, signupCount)}</span></div><div className={s.track}><span style={{ width: Math.min(100, step.count / signupCount * 100) + "%" }} /></div></div>)}</div> : <Empty>No new businesses in this period.</Empty>}
                  <p className={s.helper}>Missing events can reflect tracking gaps. Affiliate requests and Meta connections are independent milestones.</p>
                </Panel>
                <Panel title="Where progress pauses" subtitle="Recorded gaps can overlap; counts should not be added.">
                  {signupCount > 0 && activation?.instrumentationStarted ? gaps.map((gap) => <div key={gap.label} className={s.gap}><span className={gap.count > 0 ? s.gapDot : s.zeroDot} /><span>{gap.label}</span><strong>{number(gap.count)}</strong></div>) : <Empty>{signupCount ? "Product tracking has no events for this cohort yet." : "Gaps will appear when businesses sign up."}</Empty>}
                </Panel>
              </div>
              </details>
              <div className={s.twoColumns}>
                <Panel title="Plans & trials" subtitle="Plan activity for the business signup cohort.">
                  <div className={s.planGrid}>{[
                    ["Plan screen reached", plan?.reached ?? 0], ["Free click / confirmed choice", plan?.freeClicked ?? 0],
                    ["Growth clicked", plan?.growthClicked ?? 0], ["Checkout started", plan?.growthCheckoutStarted ?? 0],
                    ["Trial started", plan?.growthTrialStarted ?? 0], ["Paid active now", plan?.growthPaidActive ?? 0],
                  ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{number(Number(value))}</strong></div>)}</div>

                </Panel>
                <Panel title="Dashboard actions" subtitle={number(data.dashboardBehavior?.totalClickers ?? 0) + " businesses · " + number(data.dashboardBehavior?.totalClicks ?? 0) + " recorded clicks in this signup cohort"}>
                  {data.dashboardBehavior?.actions.length ? <div className={s.tableScroll}><table className={s.table}><caption className={s.srOnly}>Business dashboard actions</caption><thead><tr><th>Action</th><th>Businesses</th><th>Clicks</th></tr></thead><tbody>{data.dashboardBehavior.actions.map((action) => <tr key={action.action}><td title={action.destination || undefined}>{action.label}</td><td>{number(action.uniqueBusinesses)}</td><td>{number(action.count)}</td></tr>)}</tbody></table></div> : <Empty>No dashboard actions recorded for this cohort.</Empty>}

                </Panel>
              </div>

            <section id="businesses" className={s.directory}>
              <div className={s.sectionHead}><div><span className={s.eyebrow}>BUSINESS DIRECTORY</span><h2>All recent business accounts.</h2><p>Up to 30 most recent businesses in the selected signup cohort.</p></div></div>
              <Panel title="Recent businesses" aside={<span className={s.countBadge}>{businesses.length} shown</span>}>
                <div className={s.businessControls}><div className={s.search}><Search size={15} aria-hidden="true" /><label className={s.srOnly} htmlFor="business-search">Search businesses by email</label><input id="business-search" placeholder="Search email…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><label className={s.srOnly} htmlFor="business-filter">Business status</label><select id="business-filter" className={s.select} value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)}><option value="all">All statuses</option><option value="no-offer">No offer recorded</option><option value="published">Offer published</option><option value="trial">Trial started</option></select></div>
                {businesses.length ? <div className={s.tableScroll}><table className={s.table + " " + s.businessTable}><caption className={s.srOnly}>Recent business signup activity</caption><thead><tr><th>Business / signup</th><th>Progress</th><th>Plan activity</th><th>Latest activity</th></tr></thead><tbody>{businesses.map((business) => <tr key={business.email}><td><div className={s.businessEmail}>{business.email}</div><span className={s.small} title={fullDate(business.signedUpAt) + " UTC"}>{date(business.signedUpAt)} · {number(business.offerCount)} {business.offerCount === 1 ? "offer" : "offers"}</span></td><td><div className={s.statuses}><Status yes={business.dashboardReached} label="Dashboard" /><Status yes={business.offerStarted} label="Builder" /><Status yes={business.offerPublished} label="Published" /></div><details className={s.businessDetails}><summary>More activity</summary><div className={s.statuses}><Status yes={business.publishClicked} label="Publish click" /><Status yes={business.affiliateRequest} label="Request" /><Status yes={business.metaEnabled} label="Meta" /></div><p className={s.helper}>First dashboard action: {business.firstDashboardAction?.label || "Not recorded"}</p></details></td><td><span className={s.planBadge}>{business.growthActivated ? "Growth enabled" : business.growthTrialStarted ? "Trial started" : business.planChoice ? human(business.planChoice) + " event" : "Unrecorded"}</span>{business.growthCheckoutStarted && <div className={s.small}>Checkout started</div>}</td><td><span>{human(business.lastEvent)}</span><div className={s.small}>{date(business.lastEventAt, true)} · {date(business.lastEventAt)} UTC</div></td></tr>)}</tbody></table></div> : <Empty>{search || businessFilter !== "all" ? "No businesses match these filters." : "No new businesses in this period."}</Empty>}
              </Panel>
            </section>
            </section>
            <section id="revenue" role="tabpanel" tabIndex={0} aria-labelledby="tab-revenue" hidden={activeSection !== "revenue"} className={s.section}>
              <div className={s.sectionHead}><div><h2>Revenue & trials</h2><p>Activity-period trial history and accrued fees.</p></div></div>
              <Panel title="Trial status & potential" subtitle="Scenario based on current trial state, not collected revenue">
                  <div className={s.trialBox}><div><span className={s.eyebrow}>CURRENT TRIALS</span><strong>{number(trials?.trialing ?? 0)}</strong></div>
                    <p>{trials?.price ? `Configured Growth price: ${trials.price.formatted} / ${trials.price.intervalCount === 1 ? trials.price.interval : trials.price.intervalCount + " " + trials.price.interval + "s"}.` : "Configured Growth price could not be verified."}</p>
                    <p className={s.helper}>Current entitlement snapshot for trials started in the selected activity period. Active status is not evidence of payment. Use signed invoice conversion and cancellation facts in the experiment table.</p>
                    <details className={s.details}><summary>Trial breakdown</summary><div className={s.activityRow}><span>Trials started in activity period</span><strong>{number(trials?.trialStarts ?? 0)}</strong></div><div className={s.activityRow}><span>Currently trialing</span><strong>{number(trials?.trialing ?? 0)}</strong></div></details>
                  </div>
                <div className={s.planGrid}>{[
                  ["Cancellation marked", trials?.cancellationMarked ?? 0], ["No cancellation marked", trials?.withoutCancellation ?? 0],
                ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{number(Number(value))}</strong></div>)}</div>
                {trials?.fullConversionMonthlyAud != null && <p className={s.helper}>Full trial conversion potential: {money(trials.fullConversionMonthlyAud)}/month AUD. Without marked cancellations: {money(trials.withoutCancellationMonthlyAud ?? 0)}/month AUD. These are scenarios, not MRR.</p>}
              </Panel>
              <Panel title="Accrued platform fees" subtitle="Activity period · currencies kept separate"><div className={s.chartTotal}><strong>{money(data.revenue?.byCurrency.AUD ?? 0)}</strong><span>AUD accrued, not cash received</span></div>
                  {data.revenue && <details className={s.details}><summary>Fee ledger by currency</summary>{Object.entries(data.revenue.byCurrency).map(([currency, value]) => <div className={s.activityRow} key={currency}><span>{currency}</span><strong>{number(Math.round(value * 100) / 100)}</strong></div>)}<p className={s.helper}>Accrued amounts including adjustments, rather than cash received. Currencies are kept separate.</p></details>}
              </Panel>
              <details className={s.secondaryDetails}><summary>Other platform activity</summary><div className={s.planGrid}>{[
                ["New affiliates", growth?.affiliateSignups ?? 0], ["Affiliate requests", growth?.affiliateRequests ?? 0], ["Campaigns created", growth?.liveCampaigns ?? 0],
              ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{number(Number(value))}</strong></div>)}</div><p className={s.helper}>All platform activity in the selected reporting period. Campaigns include organic and paid.</p></details>
            </section>
            <details className={s.details + " " + s.methodology}><summary>About these numbers</summary><p>Periods use UTC. Website analytics count recorded events, not unique visitors. Signup and marketplace counts describe activity in the selected period. Activation and dashboard actions describe the selected signup cohort, with outcomes followed through its observation date. Cohort date controls are independent of the activity period. Current subscription statuses and Meta connections are snapshots.</p><p>Acquisition uses recorded UTM, source and referrer data. These broader website totals do not link individual visits to completed signups. The landing journey in Activation uses browser linkage where available. Source gaps and missing product events can limit conclusions. Reports read up to {number(data.dataQuality.rowLimit)} rows per source and flag sources that reach that limit.</p><p>Reporting window: {data.range.from ? fullDate(data.range.from) : "All available history"} → {fullDate(data.range.to)} UTC.</p></details>
          </> : null}
        <p className={s.updated}>{data ? "Updated " + date(data.generatedAt, true) + " UTC" : "Reporting in UTC"}</p>
        <footer className={s.footer}><span><LockKeyhole size={12} aria-hidden="true" />Personal workspace · {viewerEmail}</span><Link href="/">Back to Nettmark <ArrowUpRight size={13} /></Link></footer>
      </main>
    </div>
  );
}
