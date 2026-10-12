"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@supabase/auth-helpers-react";
import {
  Activity, ArrowRight, CheckCircle2, ChevronRight, Clock3,
  Inbox, ListChecks, Plus, RefreshCw, Users, Wallet,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import MetaMark from "../../../components/brand/MetaMark";
import { logProductEvent } from "../../../utils/productEvents";

type Range = "7d" | "30d" | "all";
type ActivityDay = { name: string; requested: number; approved: number };
type DashboardCampaign = {
  id: string;
  status: string;
  __source: "paid" | "organic";
  campaign_type: string;
  created_at: string;
  spend: number | null;
  offerTitle: string;
  affiliateHandle: string;
};
type SpendSnapshot = {
  reportedMetaSpend: number;
  awaitingWalletSettlement: number;
  queuedForTransfer: number;
  transferredToBusiness: number;
  observedAt: string;
};
type DashboardSnapshot = {
  success: boolean;
  campaigns: DashboardCampaign[];
  finance: SpendSnapshot | null;
  affiliateSeries: ActivityDay[];
  activeCampaignCount: number;
  pendingAdProposals: number;
  pendingAffiliateRequests: number;
  approvedAffiliates: number;
};

const panel = "rounded-[22px] border border-white/[0.09] bg-[#151718] shadow-[0_22px_60px_rgba(0,0,0,0.18)]";
const muted = "text-[#94a3b8]";
const money = (value: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", currencyDisplay: "narrowSymbol" }).format(value);
const shortDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
};

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-white/[0.11] bg-white/[0.02] px-4 text-xs font-semibold text-slate-200 transition hover:border-[#00C2CB]/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C2CB]">
      {children}<ArrowRight className="h-3.5 w-3.5 text-[#00C2CB]" />
    </Link>
  );
}

function FinanceTile({ label, value, icon, note, important = false }: {
  label: string; value: string; icon: React.ReactNode; note: string; important?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-[17px] border border-white/[0.08] bg-[#101415] px-3 py-4 sm:p-4">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[#19d4dd]">{icon}</span>
        <div className="min-w-0">
          <p className="min-h-[32px] text-[11px] leading-4 text-slate-300 sm:text-xs">{label}</p>
          <p className={"mt-2 whitespace-nowrap text-[clamp(1.1rem,2.2vw,1.65rem)] font-semibold tracking-tight " + (important ? "text-[#63e8ee]" : "text-white")}>{value}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[#94a3b8]">{note}</p>
    </div>
  );
}

function MiniStat({ label, value, icon, description, href }: {
  label: string; value: string; icon: React.ReactNode; description: string; href: string;
}) {
  return (
    <Link href={href} className="group min-w-0 rounded-[19px] border border-white/[0.09] bg-[#151718] p-3 transition hover:border-white/[0.18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00C2CB]/[0.09] text-[#19d4dd]">{icon}</span>
        <ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-[#00C2CB]" />
      </div>
      <p className="mt-3 text-[11px] leading-4 text-slate-300 sm:text-xs">{label}</p>
      <p className="mt-1 text-[25px] font-semibold leading-none tracking-tight text-white">{value}</p>
      <p className="mt-1.5 text-[10px] leading-4 text-[#94a3b8]">{description}</p>
    </Link>
  );
}

export default function BusinessDashboard() {
  const session = useSession();
  const email = session?.user?.email;
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>("30d");

  const refresh = useCallback(async (firstLoad = false) => {
    if (!email) return;
    if (firstLoad) setLoading(true);
    try {
      const response = await fetch("/api/business/dashboard/summary", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error("Could not load your dashboard.");
      setSnapshot(result as DashboardSnapshot);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (!email) return;
    void refresh(true);
    void logProductEvent({
      eventType: "business_dashboard_viewed",
      actorRole: "business",
      meta: { source: "business_dashboard" },
    });
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(visible, 60_000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
    };
  }, [email, refresh]);

  const activity = useMemo(() => {
    const days = snapshot?.affiliateSeries || [];
    if (range === "all") return days;
    const from = new Date();
    from.setDate(from.getDate() - (range === "7d" ? 7 : 30));
    return days.filter((day) => Date.parse(day.name) >= from.getTime());
  }, [snapshot?.affiliateSeries, range]);

  const campaign = snapshot?.campaigns[0] || null;
  const finance = snapshot?.finance;
  const pendingProposals = snapshot?.pendingAdProposals ?? 0;
  const pendingRequests = snapshot?.pendingAffiliateRequests ?? 0;

  if (loading && !snapshot) {
    return (
      <div role="status" className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--muted-foreground)] sm:px-6">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-white/[0.08]" />
        <div className="mt-6 h-52 animate-pulse rounded-[22px] bg-[#151718]" />
        <p className="mt-4 text-sm">Loading business dashboard…</p>
      </div>
    );
  }

  return (
    <main className="business-dashboard-theme min-h-screen w-full bg-[var(--background)] px-4 pb-12 pt-6 text-white sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-[1460px] space-y-4 sm:space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.20em] text-[#63e8ee]">Overview</p>
            <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[34px]">Business Dashboard</h1>
            <p className={"mt-1 text-[13px] " + muted}>Your campaigns, affiliate activity and ad spend in one place.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionLink href="/business/my-business/create-offer"><Plus className="h-4 w-4" /> New offer</ActionLink>
            <ActionLink href="/business/manage-campaigns">Manage campaigns</ActionLink>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3 text-sm text-amber-200">
            <span>{error} {snapshot ? "Showing last loaded values." : "Please retry."}</span>
            <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 font-semibold underline underline-offset-2"><RefreshCw className="h-4 w-4" /> Retry</button>
          </div>
        )}

        <section className={panel + " p-4 sm:p-5"} aria-labelledby="reconciliation-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00C2CB]/[0.09] text-[#19d4dd]"><Wallet className="h-5 w-5" /></span>
              <div>
                <h2 id="reconciliation-heading" className="text-[16px] font-semibold text-white">Ad spend reconciliation</h2>
                <p className={"mt-1 max-w-xl text-xs leading-5 " + muted}>Follow affiliate-funded spend from Meta reporting through to reimbursement.</p>
              </div>
            </div>
            <ActionLink href="/business/manage-campaigns">View campaigns</ActionLink>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <FinanceTile label="Reported Meta spend" value={finance ? money(finance.reportedMetaSpend) : "—"} icon={<MetaMark className="h-5 w-7" />} note="Cumulative Meta reports" />
            <FinanceTile label="Awaiting wallet settlement" value={finance ? money(finance.awaitingWalletSettlement) : "—"} icon={<Clock3 className="h-5 w-5" />} note="Spend not yet deducted" important />
            <FinanceTile label="Queued for business transfer" value={finance ? money(finance.queuedForTransfer) : "—"} icon={<Activity className="h-5 w-5" />} note="Accounted, not yet transferred" />
            <FinanceTile label="Transferred to business" value={finance ? money(finance.transferredToBusiness) : "—"} icon={<CheckCircle2 className="h-5 w-5" />} note="Stripe transfer confirmed" />
          </div>
          <p className={"mt-3 text-[11px] leading-5 " + muted}>
            {finance
              ? "Based on stored Meta reports and Nettmark's settlement ledger. Meta reporting may lag; these totals are cumulative, not month-to-date."
              : "Reconciliation figures are temporarily unavailable. Campaigns and other business activity can still be viewed."}
          </p>
        </section>

        <section aria-label="Business summary" className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <MiniStat label="Approved affiliates" value={snapshot ? String(snapshot.approvedAffiliates) : "—"} icon={<Users className="h-[18px] w-[18px]" />} description="In your network" href="/business/my-business/affiliate-requests" />
          <MiniStat label="Pending ad proposals" value={snapshot ? String(pendingProposals) : "—"} icon={<ListChecks className="h-[18px] w-[18px]" />} description={pendingProposals ? "Needs your review" : "All reviewed"} href="/business/my-business/ad-ideas" />
          <MiniStat label="Live campaigns" value={snapshot ? String(snapshot.activeCampaignCount) : "—"} icon={<Activity className="h-[18px] w-[18px]" />} description="Running or live" href="/business/manage-campaigns" />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={panel + " min-w-0 p-4 sm:p-5"} aria-labelledby="live-campaign-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="live-campaign-title" className="text-[15px] font-semibold text-white">Live campaign</h2>
              <ActionLink href="/business/manage-campaigns">View all</ActionLink>
            </div>
            {campaign ? (
              <Link href={"/business/manage-campaigns/" + encodeURIComponent(campaign.id)} className="mt-4 block rounded-[17px] border border-white/[0.08] bg-[#101415] p-4 transition hover:border-[#00C2CB]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB]">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#151718] text-[#19d4dd]">
                    {campaign.__source === "paid" ? <MetaMark className="h-6 w-9" /> : <Activity className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[13px] font-semibold text-white">{campaign.offerTitle}</h3>
                    <p className={"mt-1 truncate text-xs " + muted}>{campaign.affiliateHandle === "Affiliate" ? "Affiliate campaign" : "@" + campaign.affiliateHandle}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-semibold text-emerald-300">Active</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3">
                  <div className="min-w-0"><p className="text-[10px] text-slate-400">Channel</p><p className="mt-1 truncate text-xs font-medium text-slate-100">{campaign.__source === "paid" ? "Meta Ads" : "Organic"}</p></div>
                  <div className="min-w-0"><p className="text-[10px] text-slate-400">Recorded spend</p><p className="mt-1 truncate text-xs font-medium text-slate-100">{campaign.__source === "paid" ? money(Number(campaign.spend || 0)) : "—"}</p></div>
                  <div className="min-w-0"><p className="text-[10px] text-slate-400">Started</p><p className="mt-1 truncate text-xs font-medium text-slate-100">{shortDate(campaign.created_at)}</p></div>
                </div>
              </Link>
            ) : (
              <div className="mt-4 flex min-h-40 flex-col justify-center rounded-[17px] border border-dashed border-white/[0.10] bg-[#101415] p-4">
                <p className="text-sm font-semibold text-white">No live campaigns yet</p>
                <p className={"mt-1 text-xs " + muted}>Publish an offer to start growing with affiliates.</p>
                <Link href="/business/my-business/create-offer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#63e8ee]">Create an offer <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            )}
          </section>

          <section className={panel + " min-w-0 p-4 sm:p-5"} aria-labelledby="attention-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="attention-heading" className="text-[15px] font-semibold text-white">Needs attention</h2>
              <ActionLink href="/business/inbox">Open inbox</ActionLink>
            </div>
            <div className="mt-4 divide-y divide-white/[0.07] overflow-hidden rounded-[17px] border border-white/[0.08] bg-[#101415]">
              <Link href="/business/my-business/ad-ideas" className="flex min-h-[74px] items-center gap-3 p-3 transition hover:bg-white/[0.03]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-300/[0.08] text-amber-300"><ListChecks className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-white">{pendingProposals ? pendingProposals + " ad proposal" + (pendingProposals === 1 ? "" : "s") + " waiting" : "Ad proposals"}</span>
                  <span className={"mt-1 block text-[11px] " + muted}>{pendingProposals ? "Review submissions from your affiliates" : "Nothing waiting for review"}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
              </Link>
              <Link href={pendingRequests ? "/business/my-business/affiliate-requests" : "/business/inbox"} className="flex min-h-[74px] items-center gap-3 p-3 transition hover:bg-white/[0.03]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00C2CB]/[0.09] text-[#19d4dd]">{pendingRequests ? <Users className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-white">{pendingRequests ? pendingRequests + " affiliate request" + (pendingRequests === 1 ? "" : "s") + " pending" : "Messages & updates"}</span>
                  <span className={"mt-1 block text-[11px] " + muted}>{pendingRequests ? "Approve partners who want to promote you" : "Stay in touch with your affiliates"}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
              </Link>
            </div>
          </section>
        </div>

        <section className={panel + " min-w-0 p-4 sm:p-5"} aria-labelledby="affiliate-activity-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="affiliate-activity-heading" className="text-[15px] font-semibold text-white">Affiliate activity</h2>
              <p className={"mt-1 text-xs " + muted}>Requests and approvals over time</p>
            </div>
            <div role="group" aria-label="Affiliate activity range" className="flex gap-1 rounded-full border border-white/[0.08] bg-[#101415] p-1">
              {(["7d", "30d", "all"] as Range[]).map((option) => (
                <button key={option} type="button" aria-pressed={range === option} onClick={() => setRange(option)}
                  className={"min-h-8 rounded-full px-3 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB] " +
                    (range === option ? "bg-[#00C2CB] text-[#0f0f0f]" : "text-slate-400 hover:text-white")}>
                  {option === "all" ? "All" : option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 h-[170px] w-full sm:h-[205px]">
            {activity.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity} barCategoryGap="36%" margin={{ top: 12, right: 6, left: -26, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="name" tickFormatter={(date: string) => shortDate(date).replace(/ \d{4}$/, "")} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} minTickGap={23} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#101415", border: "1px solid #303335", borderRadius: 12, fontSize: 12, color: "#fff" }} labelFormatter={(label) => shortDate(String(label))} />
                  <Bar dataKey="requested" name="Requests" fill="#00C2CB" maxBarSize={18} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="approved" name="Approved" fill="#22c55e" maxBarSize={18} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-[17px] border border-dashed border-white/[0.09] bg-[#101415] text-center">
                <Users className="mb-2 h-5 w-5 text-[#00C2CB]" />
                <p className="text-xs font-semibold text-white">No affiliate activity in this period</p>
                <p className={"mt-1 text-[11px] " + muted}>Requests and approvals will appear here.</p>
              </div>
            )}
          </div>
          {activity.length > 0 && (
            <div className="mt-2 flex items-center justify-center gap-5 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#00C2CB]" /> Requests</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Approved</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
