"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Search } from "lucide-react";
import { FUNNEL_STAGES, LANDING_PATH, reachedFunnelStage, summarizeBusinessFunnel, type LandingFunnelReport, type FunnelJourney, type FunnelStageKey } from "@/../utils/marketing/landingFunnel";
import { percent, sourceLabel } from "./dashboard-data";
import s from "./marketing.module.css";

const number = (value: number) => new Intl.NumberFormat("en-AU").format(value);
const date = (value: string) => new Date(value).toLocaleString("en-AU", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const MILESTONES: Array<{ key: FunnelStageKey; label: string }> = [
  ...FUNNEL_STAGES, { key: "freeChosenAt", label: "Free confirmed" }, { key: "growthClickedAt", label: "Growth selected" },
  { key: "checkoutAt", label: "Trial checkout created" }, { key: "trialStartedAt", label: "Trial confirmed" },
];

export default function BusinessFunnel({ report }: { report: LandingFunnelReport }) {
  const [source, setSource] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [stage, setStage] = useState<FunnelStageKey | "all">("all");
  const [search, setSearch] = useState("");
  const [showJourneys, setShowJourneys] = useState(false);
  const sourceOptions = useMemo(() => [...new Set(report.journeys.map((journey) => sourceLabel(journey.source)))].sort(), [report]);
  const campaignOptions = useMemo(() => [...new Set(report.journeys.map((journey) => journey.campaign))].sort(), [report]);
  const journeys = useMemo(() => report.journeys.filter((journey) =>
    (source === "all" || sourceLabel(journey.source) === source) && (campaign === "all" || journey.campaign === campaign)), [report, source, campaign]);
  const summary = useMemo(() => summarizeBusinessFunnel(journeys), [journeys]);
  const total = journeys.length;
  const planCount = summary.stages[4].count;
  const planMeasured = journeys.filter((journey) => journey.planViewedAt).length;
  const chosenCount = journeys.filter((journey) => reachedFunnelStage(journey, "freeChosenAt") || reachedFunnelStage(journey, "growthClickedAt")).length;
  const missingOfferMeasurements = summary.measuredOffers - summary.stages[3].count;
  const missingTrialMeasurements = summary.measuredTrials - summary.trials;
  const sourceRows = useMemo(() => {
    const groups = new Map<string, { source: string; campaign: string; journeys: FunnelJourney[] }>();
    for (const journey of journeys) {
      const label = sourceLabel(journey.source);
      const key = JSON.stringify([label, journey.campaign]);
      const group = groups.get(key) || { source: label, campaign: journey.campaign, journeys: [] };
      group.journeys.push(journey);
      groups.set(key, group);
    }
    return [...groups.values()].map((group) => ({ ...group, summary: summarizeBusinessFunnel(group.journeys) }))
      .sort((a, b) => b.summary.measuredTrials - a.summary.measuredTrials || b.journeys.length - a.journeys.length);
  }, [journeys]);
  const shownBusinesses = useMemo(() => journeys.filter((journey) => journey.email &&
    (stage === "all" || reachedFunnelStage(journey, stage)) && journey.email.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) => Date.parse(b.signedUpAt!) - Date.parse(a.signedUpAt!)), [journeys, stage, search]);

  function inspectStage(key: FunnelStageKey) {
    setStage(key); setShowJourneys(true);
    requestAnimationFrame(() => document.getElementById("linked-business-journeys")?.scrollIntoView({
      block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    }));
  }

  return <>
    <div className={s.funnelHeading}>
      <div><span className={s.eyebrow}>01 / BUSINESS JOURNEY</span><h2>From landing page to first trial.</h2><p><code>{LANDING_PATH}</code> · arrivals in the selected period · progress through the latest update</p></div>
      <div className={s.funnelFilters}>
        <label>Source<select aria-label="Source" className={s.select} value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{sourceOptions.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
        <label>Campaign<select aria-label="Campaign" className={s.select} value={campaign} onChange={(event) => setCampaign(event.target.value)}><option value="all">All campaigns</option>{campaignOptions.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
      </div>
    </div>
    {report.unlinkedViews > 0 && <p className={s.coverageNote}><strong>{number(report.landingViews)} recorded landing-page views</strong> in this period, including repeats. {number(report.unlinkedViews)} have no visitor identity, so their unique visitors and later outcomes are unknown. The journey below shows the linked portion.</p>}
    <div className={s.metricGrid}>
      {[
        ["Landing visitors", total, "Distinct tracked browsers"],
        ["Onboarding offers published", summary.measuredOffers, "Saved offers from linked new businesses"],
        ["Plan page reached", planMeasured, "Linked new businesses viewing plan choice"],
        ["Growth trials started", summary.measuredTrials, "Confirmed trial history, including ended trials"],
      ].map(([label, value, note], index) => <div className={s.metric + (index === 0 || index === 3 ? " " + s.metricAccent : "")} key={String(label)}><span className={s.eyebrow}>{label}</span><strong>{number(Number(value))}</strong><p>{note}</p></div>)}
    </div>
    <section className={s.panel + " " + s.funnelPanel} aria-label="Ordered business funnel">
      <div className={s.panelHead}><div><h3>The complete journey</h3><p>Each stage requires the preceding stages in order. Select a stage to inspect its linked businesses.</p></div><span className={s.countBadge}>Tracked visitors</span></div>
      <ol className={s.funnelStages}>
        {summary.stages.map((item, index) => <li key={item.key}>
          <button type="button" className={s.funnelStage} onClick={() => inspectStage(item.key)} aria-label={`${item.label}: ${number(item.count)}. View linked businesses.`}>
            <span className={s.stageNumber}>{String(index + 1).padStart(2, "0")}<ArrowRight size={14} aria-hidden="true" /></span>
            <strong>{number(item.count)}</strong><span className={s.stageLabel}>{item.label}</span>
            <span className={s.stageRate}>{index === 0 ? "Starting point" : `${percent(item.count, summary.stages[index - 1].count)} of previous stage`}</span>
            <span className={s.track}><span style={{ width: `${total ? item.count / total * 100 : 0}%` }} /></span>
            {index > 0 && <span className={s.stageGap}>{number(summary.stages[index - 1].count - item.count)} without next milestone</span>}
          </button>
        </li>)}
      </ol>
      <div className={s.planBranches}>
        <button className={s.freeBranch} type="button" onClick={() => inspectStage("freeChosenAt")}><span className={s.eyebrow}>FREE PATH</span><strong>{number(summary.free)}</strong><span>Continued with Free</span><small>{percent(summary.free, planCount)} of plan-page visitors · successful choice</small><ChevronRight size={16} aria-hidden="true" /></button>
        <div className={s.growthBranch}><span className={s.eyebrow}>GROWTH PATH</span><div className={s.growthStages}>{([
          ["growthClickedAt", "Selected Growth", summary.growth, planCount],
          ["checkoutAt", "Checkout created", summary.checkout, summary.growth],
          ["trialStartedAt", "Trial confirmed", summary.trials, summary.checkout],
        ] as const).map(([key, label, count, previous]) => <button key={key} type="button" onClick={() => inspectStage(key)}><strong>{number(count)}</strong><span>{label}</span><small>{percent(count, previous)} of previous stage</small></button>)}</div></div>
      </div>
      <p className={s.helper}>Free and Growth are separate paths; a business may try both over time. A Growth click or checkout return is not a confirmed trial. Recent arrivals may still be completing onboarding.</p>
      {(missingOfferMeasurements > 0 || missingTrialMeasurements > 0) && <p className={s.funnelNote}>Missing intermediate tracking: {number(missingOfferMeasurements)} saved offers and {number(missingTrialMeasurements)} confirmed trials appear in the headline totals but cannot be placed in the fully ordered funnel.</p>}
    </section>
    <div className={s.twoColumns}>
      <section className={s.panel}><div className={s.panelHead}><div><h3>Where progress pauses</h3><p>Missing next milestones, rather than assumed abandonment.</p></div></div>
        {[
          ["Account created → onboarding", summary.stages[1].count - summary.stages[2].count],
          ["Onboarding → published offer", summary.stages[2].count - summary.stages[3].count],
          ["Published offer → plan page", summary.stages[3].count - planCount],
          ["Plan page → a plan choice", planCount - chosenCount],
          ["Trial checkout → confirmed trial", summary.checkout - summary.trials],
        ].map(([label, count]) => <div className={s.gap} key={String(label)}><span className={Number(count) ? s.gapDot : s.zeroDot} /><span>{label}</span><strong>{number(Number(count))}</strong></div>)}
      </section>
      <section className={s.panel}><div className={s.panelHead}><div><h3>Inside offer onboarding</h3><p>Linked businesses with recorded onboarding activity.</p></div></div>
        {[["Welcome opened", 1], ["Product details opened", 2], ["Commission details opened", 3], ["Offer review opened", 4]].map(([label, step]) => <div className={s.activityRow} key={String(label)}><span>{label}</span><strong>{number(journeys.filter((journey) => journey.onboardingSteps.includes(Number(step))).length)}</strong></div>)}
        <div className={s.activityRow}><span>Publish attempted</span><strong>{number(journeys.filter((journey) => journey.publishAttempted).length)}</strong></div>
        <div className={s.activityRow}><span>Publish failure recorded</span><strong>{number(journeys.filter((journey) => journey.publishFailed).length)}</strong></div>
        <p className={s.helper}>A failure can be followed by a successful retry. Opening a step does not prove its fields were completed.</p>
      </section>
    </div>
    <section className={s.panel + " " + s.funnelPanel}><div className={s.panelHead}><div><h3>Which traffic produces offers and trials?</h3><p>Source and campaign from each browser’s first recorded landing visit in this period.</p></div></div>
      {sourceRows.length ? <div className={s.tableScroll}><table className={s.table}><caption className={s.srOnly}>Landing visitor outcomes by source and campaign</caption><thead><tr><th>Source / campaign</th><th>Visitors</th><th>Accounts</th><th>Saved offers</th><th>Free confirmed</th><th>Trials confirmed</th><th>Visitor → trial</th></tr></thead><tbody>{sourceRows.map((row) => <tr key={JSON.stringify([row.source, row.campaign])}><td>{row.source}<span className={s.small}>{row.campaign}</span></td><td>{number(row.journeys.length)}</td><td>{number(row.summary.stages[1].count)}</td><td>{number(row.summary.measuredOffers)}</td><td>{number(row.journeys.filter((journey) => journey.freeChosenAt).length)}</td><td>{number(row.summary.measuredTrials)}</td><td>{percent(row.summary.measuredTrials, row.journeys.length)}</td></tr>)}</tbody></table></div> : <div className={s.empty}>No linked landing visitors for these filters yet. Historical page views are shown below.</div>}
    </section>
    <section id="linked-business-journeys" className={s.panel + " " + s.funnelPanel + " " + s.journeySection}>
      <div className={s.panelHead}><div><h3>The businesses behind this journey</h3><p>Linked new accounts, with recorded milestone times in UTC.</p></div><button className={s.outlineButton} type="button" aria-expanded={showJourneys} onClick={() => setShowJourneys(!showJourneys)}>{showJourneys ? "Hide businesses" : "View businesses"}<ChevronRight size={14} aria-hidden="true" /></button></div>
      {showJourneys && <><div className={s.businessControls}><label className={s.search}><Search size={15} aria-hidden="true" /><span className={s.srOnly}>Search linked businesses by email</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business email…" /></label><label><span className={s.srOnly}>Filter by journey milestone</span><select className={s.select} value={stage} onChange={(event) => setStage(event.target.value as FunnelStageKey | "all")}><option value="all">All linked businesses</option>{MILESTONES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>
        {shownBusinesses.length ? <div className={s.tableScroll}><table className={s.table + " " + s.journeyTable}><caption className={s.srOnly}>Linked business milestone timestamps</caption><thead><tr><th>Business</th><th>Source / campaign</th><th>Recorded journey</th></tr></thead><tbody>{shownBusinesses.slice(0, 100).map((journey) => <tr key={journey.email}><td className={s.businessEmail}>{journey.email}<span className={s.small}>Joined {date(journey.signedUpAt!)} UTC</span></td><td>{sourceLabel(journey.source)}<span className={s.small}>{journey.campaign}</span></td><td><details className={s.journeyDetails}><summary>{journey.trialStartedAt ? "Trial confirmed" : journey.freeChosenAt ? "Free confirmed" : [...MILESTONES].reverse().find((item) => reachedFunnelStage(journey, item.key))?.label || "Account linked"}</summary>{MILESTONES.map(({ key, label }) => <div className={s.journeyMilestone} key={key}><span>{label}</span><span>{journey[key] ? date(journey[key]!) + " UTC" : "Not recorded"}</span></div>)}</details></td></tr>)}</tbody></table></div> : <div className={s.empty}>No linked businesses match this milestone and search.</div>}
        <p className={s.helper}>{number(shownBusinesses.length)} match · showing up to 100. Anonymous visitors cannot be identified as businesses until they create an account.</p>
      </>}
    </section>
    <details className={s.details}><summary>Tracking coverage and how to read this funnel</summary><p>{number(report.landingViews)} landing-page views in this period, including repeats. {number(report.unlinkedViews)} views have no browser identity and cannot establish a unique visitor or signup link. {number(report.unlinkedBusinessSignups)} business signups have no eligible link to this landing page.</p><p>A visitor means a distinct tracked browser, not an exact count of people. Different devices, cleared storage and blocked tracking affect coverage. Returning accounts created before a landing visit are excluded from new-account conversions. Each business links to one browser journey; a shared browser links to its first eligible new business.</p><p>The selected period includes browsers with a recorded landing visit during that period. Later authenticated activity links the account using its verified signup time. Missing stages are never inferred. Saved onboarding offers are checked against offer identity and ownership; trials use persisted trial history maintained by the subscription webhook. Historical visits cannot be reconstructed reliably.</p><p>Source/campaign filters apply to every number in this business journey. Historical coverage totals above describe the full period and are not source-filtered. This is internal acquisition reporting; commission attribution and billing rules are unchanged.</p></details>
  </>;
}
