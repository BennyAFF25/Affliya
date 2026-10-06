"use client";

import { ArrowRight, BarChart3, ChevronRight, Eye, Funnel, Lightbulb, Tag, Target, Users, Zap } from "lucide-react";
import { percent, type DashboardData } from "./dashboard-data";
import { overviewSignals } from "./overview-data";
import s from "./marketing.module.css";

const number = (value: number | undefined) => value === undefined ? "—" : new Intl.NumberFormat("en-AU").format(value);
const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(value);

export default function MarketingOverview({ data, openSection }: { data: DashboardData; openSection: (id: string) => void }) {
  const { milestones, opportunities } = overviewSignals(data);
  const potential = data.trialValue?.fullConversionMonthlyAud;
  return <div className={s.commandOverview}>
    <div className={s.platformStat} aria-label="All-time Nettmark users">
      <span className={s.metricIcon}><Users size={19} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className={s.platformStatBody}><span>Total users</span><strong>{number(data.platformSummary?.totalUsers)}</strong></span>
      <small>ALL TIME</small>
    </div>
    <div className={s.primaryMetrics}>
      {[
        { label: "Website views", value: data.totals.pageViews, note: "Recorded events · activity period", icon: Eye, section: "acquisition" },
        { label: "New businesses", value: data.growthSummary?.businessSignups, note: "Selected signup cohort", icon: Users, section: "activation" },
        { label: "Offers published", value: data.growthSummary?.offersPublished, note: "Saved offers · activity period", icon: Tag, section: "activation" },
        { label: "Trials started", value: data.trialValue?.trialStarts, note: "Trial history · activity period", icon: Zap, section: "revenue" },
      ].map(({ label, value, note, icon: Icon, section }) => <button type="button" className={s.primaryMetric} key={label} onClick={() => openSection(section)}>
        <span className={s.metricIcon}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className={s.metricBody}><span>{label}</span><strong>{number(value)}</strong><small>{note}</small></span>
      </button>)}
    </div>
    <section className={s.commercialCard} aria-labelledby="commercial-title">
      <span className={s.metricIcon}><BarChart3 size={22} aria-hidden="true" /></span>
      <div><h2 id="commercial-title">{potential != null ? "Trial revenue potential" : "Current trials"}</h2>
        <strong>{potential != null ? money(potential) : number(data.trialValue?.trialing)}{potential != null && <small>/mo</small>}</strong>
        <p>{potential != null ? "If current trials convert · AUD, not MRR" : "Current trial state · no AUD monthly scenario"}</p>
      </div>
      <button type="button" className={s.cardAction} onClick={() => openSection("revenue")} aria-label="View revenue and trial details"><ArrowRight size={18} /></button>
    </section>
    <section className={s.overviewCard} aria-labelledby="overview-funnel-title">
      <div className={s.overviewCardHead}><span className={s.metricIcon}><Funnel size={20} aria-hidden="true" /></span><div><h2 id="overview-funnel-title">From click to campaign</h2><p>Website activity & business milestones</p></div><button type="button" className={s.cardAction} onClick={() => openSection("activation")} aria-label="View funnel details"><ArrowRight size={18} /></button></div>
      <ol className={s.compactFunnel}>
        {[
          { label: "Views", value: data.totals.pageViews, icon: Eye, rate: "Events" },
          { label: "Signups", value: milestones?.signups, icon: Users, rate: milestones ? "100%" : "—" },
          { label: "Offers", value: milestones?.offers, icon: Tag, rate: milestones ? percent(milestones.offers, milestones.signups) : "—" },
          { label: "Trials", value: milestones?.trials, icon: Zap, rate: milestones ? percent(milestones.trials, milestones.signups) : "—" },
          { label: "Campaigns", value: milestones?.campaigns, icon: BarChart3, rate: milestones ? percent(milestones.campaigns, milestones.signups) : "—" },
        ].map(({ label, value, icon: Icon, rate }) => <li key={label}><span className={s.metricIcon}><Icon size={18} aria-hidden="true" /></span><strong>{number(value)}</strong><span>{label}</span><small>{rate}</small></li>)}
      </ol>
      <p className={s.scopeNote}>Business rates are shares of the signup cohort, not step conversions. Campaigns are paid Meta campaigns. Views include repeat visits.</p>
    </section>
    {(opportunities.length !== 1) && <section className={s.overviewCard} aria-labelledby="opportunities-title">
      <div className={s.overviewCardHead}><span className={s.metricIcon}><Target size={20} aria-hidden="true" /></span><div><h2 id="opportunities-title">What to improve next</h2><p>Observed gaps · selected signup cohort</p></div></div>
      {opportunities.length ? opportunities.slice(1).map(item => <button type="button" className={s.insightRow} key={item.title} onClick={() => openSection("activation")}><span className={s.insightIcon}><ChevronRight size={18} aria-hidden="true" /></span><span><strong>{item.title}</strong><small>{number(item.count)} {item.detail}</small></span><ArrowRight size={16} aria-hidden="true" /></button>) : <p className={s.scopeNote}>{data.dataQuality.limitedSources.length ? "Report is partial. Choose a shorter window before prioritising gaps." : milestones ? "No gaps in these milestones. Check activation detail for the next signal." : "Choose a signup cohort with businesses to see opportunities."}</p>}
    </section>}
    {opportunities[0] && <button type="button" className={s.topSignal} onClick={() => openSection("activation")}><span className={s.metricIcon}><Lightbulb size={23} aria-hidden="true" /></span><span><small>TOP SIGNAL</small><strong>{opportunities[0].title}</strong><p>Largest observed gap: {number(opportunities[0].count)} {opportunities[0].detail} Recent signups may still be progressing.</p></span><ChevronRight size={18} aria-hidden="true" /></button>}
  </div>;
}
