"use client";

import { useMemo, useState, type ReactNode } from "react";
import MetaMark from "../brand/MetaMark";
import Link from "next/link";
import {
  Activity, Archive, ArrowRight, BarChart3, ChevronDown, CirclePause,
  ExternalLink, FileImage, Leaf, Megaphone, Plus, RefreshCw,
  Search, Store, Wallet, X,
} from "lucide-react";

export type Campaign = {
  id: string;
  _source: "meta" | "organic";
  caption?: string | null;
  display_title?: string | null;
  media_url?: string | null;
  platform?: string | null;
  type?: string | null;
  campaign_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  spend?: number | null;
  clicks?: number | null;
  conversions?: number | null;
  tracking_link?: string | null;
  billing_state?: string | null;
  terminated_by_business_at?: string | null;
  ad_ideas?: { file_url?: string | null; headline?: string | null; caption?: string | null } | null;
};

type ShopPlacement = {
  affiliate_email: string;
  displayHandle?: string;
  handle?: string | null;
  avatar_url?: string | null;
  views24h?: number;
  clicks24h?: number;
  offers?: number;
};

type SharedProps = {
  campaigns: Campaign[];
  loading: boolean;
  loadError: string | null;
  metaCurrency: string;
  syncingById: Record<string, boolean>;
  onRefresh: () => void;
  onSyncSpend: (id: string) => void;
};

type Props = SharedProps & (
  | {
      audience?: "business";
      shopPlacements: ShopPlacement[];
      onPauseOrganic: (id: string, status: string) => void;
      onStopMeta: (id: string) => void;
    }
  | {
      audience: "affiliate";
      pendingCount: number;
      unsettledSpend: number;
      pendingContent: ReactNode;
      notice?: ReactNode;
    }
);

type FilterTab = "all" | "meta" | "organic" | "archived";
type SortMode = "newest" | "oldest" | "title" | "spend";

// Palette aligned with docs/UI_DESIGN_SYSTEM.md: brand cyan, neutral dark
// overview surfaces, restrained shadows, and shared muted-text colour.
const cyanButton = "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 text-xs font-bold text-[var(--primary-foreground)] shadow-[0_10px_24px_rgba(0,194,203,0.16)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB]";
const darkButton = "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.11] bg-white/[0.02] px-3 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00c2cb]";
const activeTab = "border-[rgba(0,194,203,0.3)] bg-[rgba(0,194,203,0.07)] text-[#63e8ee] shadow-[inset_0_0_24px_rgba(0,194,203,0.025)]";
const inactiveTab = "border-transparent bg-white/[0.02] text-[var(--muted-foreground)] hover:bg-white/[0.08] hover:text-white";
const gridColumns = "grid-cols-[minmax(240px,2.1fr)_minmax(100px,1fr)_80px_94px_75px_88px_minmax(90px,0.8fr)_268px]";

function isLive(campaign: Campaign) {
  const value = String(campaign.status || "").toLowerCase();
  return value === "active" || value === "live";
}

function campaignState(campaign: Campaign) {
  if (campaign.terminated_by_business_at || campaign.billing_state === "TERMINATED_BY_BUSINESS") return "Stopped";
  const status = String(campaign.status || "").toLowerCase();
  if (status === "active" || status === "live") return "Active";
  if (status === "paused") return "Paused";
  if (status.includes("stop") || status === "terminated") return "Stopped";
  return status ? status[0].toUpperCase() + status.slice(1) : "Unknown";
}

function displayDate(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function CampaignThumbnail({ campaign }: { campaign: Campaign }) {
  const image = campaign._source === "meta"
    ? campaign.ad_ideas?.file_url
    : campaign.media_url;
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#151718] to-[#101415]">
      {image ? (
        /* Supplied campaign assets can be hosted on business-owned domains. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : campaign._source === "meta" ? (
        <MetaMark className="h-6 w-9" />
      ) : (
        <FileImage className="h-5 w-5 text-[#19d4dd]" />
      )}
    </div>
  );
}

function CampaignIdentity({ campaign, audience }: { campaign: Campaign; audience: "business" | "affiliate" }) {
  const title = campaign.display_title || (campaign._source === "meta"
    ? campaign.ad_ideas?.headline || campaign.caption || "Meta ad campaign"
    : campaign.caption || "Organic campaign");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CampaignThumbnail campaign={campaign} />
      <div className="min-w-0">
        <Link
          href={(audience === "affiliate" ? "/affiliate/dashboard/manage-campaigns/" : "/business/manage-campaigns/") + campaign.id}
          className="block truncate text-[13px] font-semibold text-slate-100 transition hover:text-[#5fe6ec]"
          title={title}
        >
          {title}
        </Link>
        <span className="mt-1 block truncate font-mono text-[10px] text-[#94a3b8]/75">
          {"#" + campaign.id.slice(0, 8)}
        </span>
      </div>
    </div>
  );
}

function Platform({ campaign }: { campaign: Campaign }) {
  const isMeta = campaign._source === "meta";
  return (
    <div className="flex min-w-0 items-center gap-2">
      {isMeta ? <MetaMark className="h-5 w-7 shrink-0" /> : <Leaf className="h-[18px] w-[18px] shrink-0 text-emerald-400" />}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-100">{isMeta ? "Meta Ads" : "Organic"}</p>
        <p className="truncate text-[11px] text-[#94a3b8]/75">
          {isMeta ? "Paid advertising" : campaign.platform || "Placement"}
        </p>
      </div>
    </div>
  );
}

function Status({ campaign }: { campaign: Campaign }) {
  const status = campaignState(campaign);
  const active = status === "Active";
  return (
    <span className={active
      ? "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300"
      : status === "Paused"
        ? "inline-flex items-center gap-1.5 text-xs font-medium text-amber-300"
        : "inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]"
    }>
      <span className={active ? "h-1.5 w-1.5 rounded-full bg-emerald-400" : status === "Paused" ? "h-1.5 w-1.5 rounded-full bg-amber-400" : "h-1.5 w-1.5 rounded-full bg-slate-500"} />
      {status}
    </span>
  );
}

function MetricCard({ label, value, helper, icon, muted }: { label: string; value: string; helper: string; icon: React.ReactNode; muted?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.09] bg-[#151718] px-3.5 py-4 shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:px-4">
      <div className="flex items-start gap-3">
        <span className={muted
          ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.02] text-slate-300"
          : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00c2cb]/[0.11] text-[#19d4dd]"
        }>{icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--muted-foreground)]">{label}</p>
          <p className="mt-1 truncate text-[23px] font-bold leading-none tracking-tight text-slate-50">{value}</p>
          <p className="mt-2 truncate text-[10px] text-[#94a3b8]/75" title={helper}>{helper}</p>
        </div>
      </div>
    </div>
  );
}

export default function ManageCampaignsWorkspace(props: Props) {
  const {
    campaigns, loading, loadError, metaCurrency,
    syncingById, onRefresh, onSyncSpend,
  } = props;
  const audience = props.audience === "affiliate" ? "affiliate" : "business";
  const shopPlacements = props.audience === "affiliate" ? [] : props.shopPlacements;
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [shopOpen, setShopOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(true);

  const money = (raw?: number | null) => {
    const value = Number(raw || 0);
    return new Intl.NumberFormat("en-AU", {
      style: "currency", currency: metaCurrency || "AUD", currencyDisplay: "narrowSymbol",
    }).format(Number.isFinite(value) ? value : 0);
  };
  const meta = campaigns.filter((item) => item._source === "meta");
  const organic = campaigns.filter((item) => item._source === "organic");
  const archived = campaigns.filter((item) => !isLive(item));
  const live = campaigns.length - archived.length;
  const spend = meta.reduce((sum, item) => sum + Number(item.spend || 0), 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns
      .filter((item) => {
        if (tab === "meta" && item._source !== "meta") return false;
        if (tab === "organic" && item._source !== "organic") return false;
        if (tab === "archived" && isLive(item)) return false;
        const state = campaignState(item).toLowerCase();
        if (statusFilter !== "all" && state !== statusFilter) return false;
        if (!term) return true;
        return [
          item.id, item.caption, item.display_title, item.platform, item.ad_ideas?.headline,
          item.campaign_type, item.type,
        ].some((value) => String(value || "").toLowerCase().includes(term));
      })
      .sort((a, b) => {
        if (sort === "title") return String(a.display_title || a.ad_ideas?.headline || a.caption || "").localeCompare(String(b.display_title || b.ad_ideas?.headline || b.caption || ""));
        if (sort === "spend") return Number(b.spend || 0) - Number(a.spend || 0);
        const aTime = Date.parse(a.created_at || "") || 0;
        const bTime = Date.parse(b.created_at || "") || 0;
        return sort === "oldest" ? aTime - bTime : bTime - aTime;
      });
  }, [campaigns, search, sort, statusFilter, tab]);

  const tabs: { id: FilterTab; title: string; count: number }[] = [
    { id: "all", title: "All campaigns", count: campaigns.length },
    { id: "meta", title: "Meta Ads", count: meta.length },
    { id: "organic", title: "Organic", count: organic.length },
    { id: "archived", title: "Archived", count: archived.length },
  ];

  const renderActions = (campaign: Campaign, compact = false) => {
    const isMeta = campaign._source === "meta";
    const stopped = campaignState(campaign) === "Stopped";
    return (
      <div className={compact ? "flex w-full flex-wrap gap-2" : "flex min-w-0 items-center justify-end gap-1.5"}>
        <Link
          href={(audience === "affiliate" ? "/affiliate/dashboard/manage-campaigns/" : "/business/manage-campaigns/") + campaign.id}
          className={compact ? cyanButton + " flex-1" : cyanButton}
          aria-label={"View campaign " + campaign.id}
        >
          View campaign
          {compact ? <ArrowRight className="h-3.5 w-3.5" /> : null}
        </Link>
        {isMeta ? (
          <>
            <button
              type="button"
              onClick={() => onSyncSpend(campaign.id)}
              disabled={!!syncingById[campaign.id]}
              className={darkButton + " disabled:cursor-wait disabled:opacity-50"}
              title="Refresh spend and Meta clicks from Meta Insights"
            >
              <RefreshCw className={syncingById[campaign.id] ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              {syncingById[campaign.id] ? "Syncing" : "Sync spend"}
            </button>
            {props.audience !== "affiliate" ? (
              <button
                type="button"
                onClick={() => props.onStopMeta(campaign.id)}
                disabled={stopped}
                className={darkButton + " disabled:cursor-not-allowed disabled:opacity-40"}
                title="Permanently stop Meta delivery and mark the campaign stopped"
              >Stop</button>
            ) : null}
          </>
        ) : props.audience !== "affiliate" ? (
          <button
            type="button"
            onClick={() => props.onPauseOrganic(campaign.id, campaign.status || "")}
            disabled={!isLive(campaign)}
            className={darkButton + " disabled:cursor-not-allowed disabled:opacity-40"}
          >
            <CirclePause className="h-3.5 w-3.5" />
            {isLive(campaign) ? "Pause" : campaignState(campaign) === "Stopped" ? "Stopped" : "Paused"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="business-manage-campaigns-theme min-h-screen bg-[var(--background)] text-slate-100">
      <div className="relative mx-auto w-full max-w-[1720px] px-3 pb-12 pt-7 sm:px-5 lg:px-7">
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-64 w-2/3 bg-[radial-gradient(ellipse_at_top_right,rgba(0,194,203,0.025),transparent_66%)]" />
        <div className="relative">
          <header className="flex flex-col gap-5 pb-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.21em] text-[var(--muted-foreground)]">Campaign management</p>
              <h1 className="text-[28px] font-bold leading-tight tracking-[-0.045em] text-white sm:text-[36px]">Manage Campaigns</h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                {audience === "affiliate"
                  ? "Track your paid ads and organic promotions, review submissions and monitor results."
                  : "Monitor every affiliate placement, track campaign performance, and manage delivery from one workspace."}
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
              {audience === "affiliate" ? (
                <>
                  <Link href="/affiliate/marketplace" className={darkButton + " flex-1 sm:flex-none"}>
                    <Plus className="h-4 w-4" /> Promote offer
                  </Link>
                  <Link href="/affiliate/dashboard" className={cyanButton + " flex-1 sm:flex-none"}>
                    <BarChart3 className="h-4 w-4" /> Affiliate dashboard <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <>
                <Link href="/business/my-business/create-offer" className={darkButton + " flex-1 sm:flex-none"}>
                  <Plus className="h-4 w-4" /> New offer
                </Link>
                <Link href="/business/dashboard" className={cyanButton + " flex-1 sm:flex-none"}>
                  <BarChart3 className="h-4 w-4" /> Business dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                </>
              )}
            </div>
          </header>

          {props.audience === "affiliate" ? props.notice : null}

          <section aria-label="Campaign overview" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="Live campaigns" value={loading ? "—" : String(live)} helper="Paid and organic" icon={<Activity className="h-5 w-5" />} />
            <MetricCard label="Meta spend" value={loading ? "—" : money(spend)} helper="Latest recorded Insights" icon={<Wallet className="h-5 w-5" />} />
            {props.audience === "affiliate" ? (
              <>
                <MetricCard label="Unsettled spend" value={loading ? "—" : money(props.unsettledSpend)} helper="Not yet deducted from wallet" icon={<Wallet className="h-5 w-5" />} />
                <MetricCard label="Pending proposals" value={loading ? "—" : String(props.pendingCount)} helper="Awaiting business review" icon={<Megaphone className="h-5 w-5" />} />
              </>
            ) : (
              <>
                <MetricCard label="Shop placements" value={loading ? "—" : String(shopPlacements.length)} helper="Approved shops" icon={<Store className="h-5 w-5" />} />
                <MetricCard label="Organic posts" value={loading ? "—" : String(organic.length)} helper="All organic campaigns" icon={<Megaphone className="h-5 w-5" />} />
              </>
            )}
            <div className="col-span-2 sm:col-span-1"><MetricCard label="Archived" value={loading ? "—" : String(archived.length)} helper="Paused and stopped" muted icon={<Archive className="h-5 w-5" />} /></div>
          </section>

          <section aria-label="Campaigns" className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.085] bg-[#151718] shadow-[0_22px_60px_rgba(0,0,0,0.22)]">
            <div className="flex flex-col gap-3 border-b border-white/[0.075] p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
              <div role="tablist" aria-label="Campaign type" className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin xl:pb-0">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    role="tab"
                    type="button"
                    aria-selected={tab === item.id}
                    onClick={() => setTab(item.id)}
                    className={"inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c2cb] " + (tab === item.id ? activeTab : inactiveTab)}
                  >
                    {item.title}
                    <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] text-[#63e8ee]">{loading ? "—" : item.count}</span>
                  </button>
                ))}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="relative min-w-[170px] flex-[2] xl:w-[210px] xl:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#94a3b8]/75" />
                  <span className="sr-only">Search campaigns</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search campaigns..."
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#101415] pl-9 pr-8 text-xs text-white placeholder:text-[#94a3b8]/75 focus:border-[#00c2cb]/60 focus:outline-none"
                  />
                  {search ? (
                    <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-2.5 text-[var(--muted-foreground)] hover:text-white"><X className="h-4 w-4" /></button>
                  ) : null}
                </label>
                <label className="relative flex-1 xl:w-[115px] xl:flex-none">
                  <span className="sr-only">Filter campaign status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-[#101415] pl-3 pr-8 text-xs text-slate-200 focus:border-[#00c2cb]/60 focus:outline-none">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="stopped">Stopped</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 h-3 w-3 text-[#94a3b8]/75" />
                </label>
                <label className="relative flex-1 xl:w-[120px] xl:flex-none">
                  <span className="sr-only">Sort campaigns</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-[#101415] pl-3 pr-7 text-xs text-slate-200 focus:border-[#00c2cb]/60 focus:outline-none">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="title">Name A–Z</option>
                    <option value="spend">Highest spend</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 h-3 w-3 text-[#94a3b8]/75" />
                </label>
                <button onClick={onRefresh} type="button" title="Refresh campaigns" aria-label="Refresh campaigns" className={darkButton + " px-3"}>
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {loadError ? <p role="alert" className="border-b border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-200">{loadError}</p> : null}
            {loading ? (
              <div role="status" className="space-y-2 p-5">
                {[0, 1, 2, 3].map((key) => <div key={key} className="h-16 animate-pulse rounded-xl bg-white/[0.045]" />)}
                <p className="pt-2 text-center text-xs text-[#94a3b8]/75">Loading campaign data…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex min-h-[210px] flex-col items-center justify-center px-4 py-10 text-center">
                <Search className="mb-4 h-6 w-6 text-[#00c2cb]" />
                <h2 className="text-sm font-semibold text-white">No campaigns match this view</h2>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{campaigns.length ? "Try another filter or search." : "Campaigns will appear here when an affiliate placement goes live."}</p>
                {campaigns.length ? <button type="button" onClick={() => { setTab("all"); setSearch(""); setStatusFilter("all"); }} className="mt-4 text-xs font-medium text-[#5fe6ec] hover:underline">Clear filters</button> : null}
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto xl:block">
                  <div className="min-w-[1140px]">
                    <div className={"grid " + gridColumns + " gap-x-2.5 border-b border-white/[0.065] bg-white/[0.035] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.10em] text-[#94a3b8]/75"}>
                      <span>Campaign</span><span>Type / platform</span><span>Started</span>
                      <span>Spend</span><span title="Meta clicks from last sync">Meta clicks</span><span>Conversions</span>
                      <span>Tracking / status</span><span className="text-right">Actions</span>
                    </div>
                    {filtered.map((item) => (
                      <div key={item.id} className={"grid " + gridColumns + " items-center gap-x-2.5 border-b border-white/[0.055] px-4 py-3 last:border-b-0 hover:bg-white/[0.035]"}>
                        <CampaignIdentity campaign={item} audience={audience} />
                        <Platform campaign={item} />
                        <span className="text-xs text-[var(--muted-foreground)]">{displayDate(item.created_at)}</span>
                        <span className="text-xs tabular-nums text-slate-300">{item._source === "meta" ? money(item.spend) : "—"}</span>
                        <span className="text-xs tabular-nums text-slate-300" title="Meta-reported clicks, as of last sync">{item._source === "meta" ? Number(item.clicks || 0).toLocaleString() : "—"}</span>
                        <span className="text-xs tabular-nums text-slate-300">{item._source === "meta" ? Number(item.conversions || 0).toLocaleString() : "—"}</span>
                        <div className="min-w-0">
                          <Status campaign={item} />
                          {item.tracking_link ? (
                            <a href={item.tracking_link} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-[10px] text-[#00c2cb] hover:text-[#63e8ee]">
                              View link <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : <span className="mt-1 block text-[10px] text-[#94a3b8]/65">Link in details</span>}
                        </div>
                        {renderActions(item)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-white/[0.07] xl:hidden">
                  {filtered.map((item) => (
                    <article key={item.id} className="p-3.5 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1"><CampaignIdentity campaign={item} /></div>
                        <Status campaign={item} />
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                        <Platform campaign={item} />
                        <span className="text-[11px] text-[#94a3b8]/75">{displayDate(item.created_at)}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div><p className="text-[10px] text-[#94a3b8]/75">Spend</p><p className="mt-1 text-xs font-semibold text-slate-200">{item._source === "meta" ? money(item.spend) : "—"}</p></div>
                        <div><p className="text-[10px] text-[#94a3b8]/75">Meta clicks</p><p className="mt-1 text-xs font-semibold text-slate-200">{item._source === "meta" ? Number(item.clicks || 0).toLocaleString() : "—"}</p></div>
                        <div><p className="text-[10px] text-[#94a3b8]/75">Conversions</p><p className="mt-1 text-xs font-semibold text-slate-200">{item._source === "meta" ? Number(item.conversions || 0).toLocaleString() : "—"}</p></div>
                      </div>
                      {item.tracking_link ? (
                        <a href={item.tracking_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#00c2cb] hover:text-[#63e8ee]">
                          View tracking link <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <div className="mt-4">{renderActions(item, true)}</div>
                    </article>
                  ))}
                </div>
                <div className="border-t border-white/[0.07] bg-white/[0.018] px-4 py-3 text-[11px] text-[#94a3b8]/75">
                  Showing {filtered.length} of {campaigns.length} campaigns. Meta spend and clicks reflect the latest stored Insights sync; no organic metrics are invented.
                </div>
              </>
            )}
          </section>

          {props.audience === "affiliate" ? (
            <section className="mt-4 overflow-hidden rounded-[20px] border border-white/[0.085] bg-[#151718]">
              <button
                type="button"
                aria-expanded={pendingOpen}
                onClick={() => setPendingOpen(!pendingOpen)}
                className="flex min-h-[68px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.035] sm:px-5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00c2cb]/10 text-[#00c2cb]"><Megaphone className="h-5 w-5" /></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold text-white">Pending proposals</span><span className="mt-0.5 block text-[11px] text-[#94a3b8]/75">{props.pendingCount} submissions awaiting business review</span></span>
                </span>
                <ChevronDown className={pendingOpen ? "h-4 w-4 shrink-0 rotate-180 text-[var(--muted-foreground)]" : "h-4 w-4 shrink-0 text-[var(--muted-foreground)]"} />
              </button>
              {pendingOpen ? <div className="space-y-2 border-t border-white/[0.07] p-3 sm:p-4">{props.pendingContent}</div> : null}
            </section>
          ) : (
          <section className="mt-4 overflow-hidden rounded-[20px] border border-white/[0.085] bg-[#151718]">
            <button
              type="button"
              aria-expanded={shopOpen}
              onClick={() => setShopOpen(!shopOpen)}
              className="flex min-h-[68px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.035] sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00c2cb]/10 text-[#00c2cb]"><Store className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold text-white">Shopfront placements</span><span className="mt-0.5 block text-[11px] text-[#94a3b8]/75">Approved affiliate shops · {shopPlacements.length} placements</span></span>
              </span>
              <ChevronDown className={shopOpen ? "h-4 w-4 shrink-0 rotate-180 text-[var(--muted-foreground)]" : "h-4 w-4 shrink-0 text-[var(--muted-foreground)]"} />
            </button>
            {shopOpen ? (
              <div className="grid gap-2 border-t border-white/[0.07] p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                {shopPlacements.length ? shopPlacements.map((shop) => (
                  <div key={shop.affiliate_email} className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="flex items-center gap-3">
                      {shop.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shop.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00c2cb]/10 text-xs font-bold text-[#00c2cb]">{(shop.displayHandle || "A").charAt(0).toUpperCase()}</span>}
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{shop.handle ? "@" + shop.displayHandle : shop.displayHandle || "Nettmark affiliate"}</p><p className="text-[10px] text-[#94a3b8]/75">{Number(shop.offers || 0)} approved offers</p></div>
                      {shop.handle ? <a href={"https://www.nettmark.com/shop/" + encodeURIComponent(shop.handle)} target="_blank" rel="noopener noreferrer" title="View shop" className="text-[#00c2cb] hover:text-white"><ExternalLink className="h-4 w-4" /></a> : null}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.055] pt-3 text-xs text-slate-300">
                      <span>Views (24h): <strong className="text-white">{Number(shop.views24h || 0).toLocaleString()}</strong></span>
                      <span>Clicks (24h): <strong className="text-white">{Number(shop.clicks24h || 0).toLocaleString()}</strong></span>
                    </div>
                  </div>
                )) : <p className="py-4 text-xs text-[#94a3b8]/75">No approved storefronts yet.</p>}
              </div>
            ) : null}
          </section>
          )}
        </div>
      </div>
    </div>
  );
}
