"use client";

import Link from "next/link";
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, Check, ChevronRight,
  CirclePause, CirclePlay, Copy, ExternalLink, FileImage,
  Globe2, MousePointerClick, RefreshCw, Rocket, ShoppingCart,
  ShieldCheck, Trash2, Wallet,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import MetaMark from "../brand/MetaMark";

type Campaign = {
  id: string;
  type?: string;
  platform?: string;
  caption?: string | null;
  media_url?: string | null;
  status?: string;
  created_at?: string | null;
  offer_id?: string | null;
  tracking_link?: string | null;
  billing_state?: string | null;
  clicks?: number | null;
  spend?: number | null;
  spend_transferred?: number | null;
  terminated_by_business_note?: string | null;
};

type Offer = { title?: string; commission?: number; website?: string } | null;
type Stats = { clicks: number; carts: number; conversions: number };
type Trend = { labels: string[]; carts: number[]; conversions: number[] };

type Props = {
  campaign: Campaign;
  title: string;
  offer: Offer;
  isOrganic: boolean;
  isPaused: boolean;
  stoppedByBusiness: boolean;
  canControlMeta: boolean;
  stats: Stats;
  trend: Trend;
  pendingPayout: number;
  loadingStats: boolean;
  trackingUrl: string;
  affiliateReady: boolean;
  copied: boolean;
  money: (value: number) => string;
  syncingSpend: boolean;
  controllingMeta: boolean;
  onCopy: () => void;
  onSyncSpend: () => void;
  onMetaControl: (action: "PAUSE" | "RESUME") => void;
  onDeleteOrganic: () => void;
  showEmailModal: boolean;
  onEmailModalChange: (value: boolean) => void;
  // Business-specific data and permissions. Affiliate defaults remain unchanged.
  audience?: "affiliate" | "business";
  businessAffiliate?: string | null;
  businessRevenue?: number;
  businessCanPause?: boolean;
  businessPauseLoading?: boolean;
  businessSyncMessage?: string | null;
  onBusinessPause?: () => void;
};

const panel = "rounded-[22px] border border-white/[0.09] bg-[#151718] shadow-[0_22px_60px_rgba(0,0,0,0.16)]";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.11] bg-white/[0.025] px-3.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB] disabled:cursor-not-allowed disabled:opacity-50";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#00C2CB] px-3.5 text-xs font-bold text-[#0f0f0f] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB] disabled:cursor-not-allowed disabled:opacity-50";

function dateLabel(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.valueOf())
    ? "—"
    : date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[17px] border border-white/[0.09] bg-[#101415] p-3.5 sm:p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C2CB]/[0.09] text-[#19d4dd]">{icon}</span>
      <p className="mt-3 text-[11px] text-[#94a3b8]">{label}</p>
      <p className="mt-1 truncate text-[23px] font-semibold leading-tight tracking-tight text-white" title={value}>{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-[#94a3b8]/80">{note}</p>
    </div>
  );
}

function CreativePreview({ campaign, isOrganic, title, onOpenEmail }: {
  campaign: Campaign; isOrganic: boolean; title: string; onOpenEmail: () => void;
}) {
  const media = String(campaign.media_url || "");
  const video = /\.(mp4|mov|webm)(?:\?|$)/i.test(media);
  const email = String(campaign.platform || "").toLowerCase() === "email";
  return (
    <section className={panel + " overflow-hidden"} aria-label="Campaign creative">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00C2CB]/[0.09] text-[#19d4dd]"><FileImage className="h-4 w-4" /></span>
          <div>
            <h2 className="text-[13px] font-semibold text-white">Creative preview</h2>
            <p className="mt-0.5 text-[10px] text-[#94a3b8]">{isOrganic ? "Organic placement" : "Approved Meta creative"}</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-300">{campaign.platform || (isOrganic ? "Organic" : "Meta Ads")}</span>
      </div>
      {email ? (
        <div className="flex min-h-[240px] flex-col justify-between bg-[#101415] p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Email creative</p>
            <h3 className="mt-3 text-[16px] font-semibold text-white">{title}</h3>
            <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-xs leading-6 text-slate-300">{campaign.caption || "No content available."}</p>
          </div>
          <button type="button" onClick={onOpenEmail} className={button + " mt-4 self-start"}>Read full email <ExternalLink className="h-3.5 w-3.5" /></button>
        </div>
      ) : media ? (
        <div className="flex max-h-[380px] min-h-[190px] items-center justify-center overflow-hidden bg-[#101415] sm:max-h-[470px]">
          {video ? (
            <video controls preload="metadata" className="max-h-[380px] w-full object-contain sm:max-h-[470px]">
              <source src={media} /> Your browser does not support this video.
            </video>
          ) : (
            // Business-supplied campaign assets may be served from remote domains.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media} alt="Campaign creative" loading="lazy" className="max-h-[380px] w-full object-contain sm:max-h-[470px]" />
          )}
        </div>
      ) : (
        <div className="flex min-h-[210px] flex-col items-center justify-center gap-3 bg-[#101415] px-6 text-center text-xs text-[#94a3b8]">
          {isOrganic ? <FileImage className="h-9 w-9 text-[#00C2CB]" /> : <MetaMark className="h-8 w-12" />}
          <p>The creative is not available for preview here.</p>
        </div>
      )}
      {campaign.caption && !email ? (
        <div className="border-t border-white/[0.07] p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">Campaign caption</p>
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{campaign.caption}</p>
        </div>
      ) : null}
    </section>
  );
}

export default function CampaignDetailWorkspace({
  campaign, title, offer, isOrganic, isPaused, stoppedByBusiness, canControlMeta,
  stats, trend, pendingPayout, loadingStats, trackingUrl, affiliateReady,
  copied, money, syncingSpend, controllingMeta, onCopy, onSyncSpend, onMetaControl,
  onDeleteOrganic, showEmailModal, onEmailModalChange,
  audience = "affiliate", businessAffiliate, businessRevenue = 0,
  businessCanPause = false, businessPauseLoading = false,
  businessSyncMessage, onBusinessPause,
}: Props) {
  const isBusiness = audience === "business";
  const state = stoppedByBusiness ? "Stopped by business" : isPaused ? "Paused"
    : ["active", "live"].includes(String(campaign.status || "").toLowerCase()) ? "Active"
    : String(campaign.status || "Pending");
  const inactive = stoppedByBusiness || isPaused;
  const outstanding = Math.max(0, Number(campaign.spend || 0) - Number(campaign.spend_transferred || 0));
  const series = trend.labels.map((date, index) => ({
    day: date,
    carts: Number(trend.carts[index] || 0),
    conversions: Number(trend.conversions[index] || 0),
  }));
  const hasTrend = series.some((point) => point.carts > 0 || point.conversions > 0);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 pb-12 pt-6 text-slate-100 sm:px-6 sm:pt-8">
      <div className="mx-auto w-full max-w-[1460px] space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={isBusiness ? "/business/manage-campaigns" : "/affiliate/dashboard/manage-campaigns"} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-[#63e8ee]">
            <ArrowLeft className="h-4 w-4" /> Manage campaigns
          </Link>
          <span className="text-[10px] text-[#94a3b8]">Started {dateLabel(campaign.created_at)}</span>
        </div>

        <header className={panel + " p-4 sm:p-5"}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.20em] text-[#63e8ee]">Campaign overview</p>
                <span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold " +
                  (inactive ? "border-amber-400/25 bg-amber-400/[0.07] text-amber-200" :
                    state === "Active" ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300" :
                    "border-white/10 bg-white/[0.04] text-slate-300")}>
                  <span className={"h-1.5 w-1.5 rounded-full " + (inactive ? "bg-amber-300" : state === "Active" ? "bg-emerald-400" : "bg-slate-400")} />
                  {state}
                </span>
              </div>
              <h1 className="mt-2 break-words text-[25px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]">{title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#94a3b8]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1 text-slate-200">
                  {isOrganic ? <Activity className="h-3.5 w-3.5 text-[#19d4dd]" /> : <MetaMark className="h-3.5 w-5" />}
                  {isOrganic ? "Organic promotion" : "Meta Ads"}
                </span>
                {offer?.title ? <span className="min-w-0 max-w-full truncate rounded-full border border-white/10 px-2.5 py-1">{offer.title}</span> : null}
                <span className="font-mono text-[10px] text-[#94a3b8]">#{campaign.id.slice(0, 8)}</span>
                {isBusiness && businessAffiliate ? <span className="min-w-0 max-w-full truncate">Affiliate: {businessAffiliate}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {!isOrganic && (
                <button type="button" onClick={onSyncSpend} disabled={syncingSpend} className={button}>
                  <RefreshCw className={"h-4 w-4 " + (syncingSpend ? "animate-spin" : "")} />
                  {syncingSpend ? "Syncing…" : "Sync spend"}
                </button>
              )}
              {isBusiness ? (
                businessCanPause && onBusinessPause ? (
                  <button type="button" onClick={onBusinessPause} disabled={businessPauseLoading}
                    className={button + " border-amber-400/20 text-amber-100"}>
                    <CirclePause className="h-4 w-4" /> {businessPauseLoading ? "Updating…" : "Pause campaign"}
                  </button>
                ) : null
              ) : !isOrganic ? (
                canControlMeta ? (
                  <button type="button" onClick={() => onMetaControl(isPaused ? "RESUME" : "PAUSE")}
                    disabled={controllingMeta} className={isPaused ? primary : button}>
                    {isPaused ? <CirclePlay className="h-4 w-4" /> : <CirclePause className="h-4 w-4" />}
                    {controllingMeta ? "Updating…" : isPaused ? "Resume ad" : "Pause ad"}
                  </button>
                ) : null
              ) : campaign.offer_id ? (
                <Link href={"/affiliate/dashboard/promote/" + campaign.offer_id} className={primary}>
                  <Rocket className="h-4 w-4" /> Promote again <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
          {isBusiness && businessSyncMessage ? (
            <div role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-200">{businessSyncMessage}</div>
          ) : null}
          {stoppedByBusiness ? (
            <div role="status" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-200">
              This campaign was permanently stopped by the business. Historical performance remains visible; it cannot be reactivated.
              {campaign.terminated_by_business_note ? <p className="mt-1">Business note: {campaign.terminated_by_business_note}</p> : null}
            </div>
          ) : isPaused ? (
            <div role="status" className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-amber-200">
              This campaign is paused. Its tracking link is temporarily inactive.
            </div>
          ) : null}
        </header>

        <section aria-label="Campaign performance" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          {isBusiness ? (
            <>
              {isOrganic ? (
                <>
                  <Metric label="Landing visits" value={stats.clicks.toLocaleString()} note="Unverified Nettmark visits" icon={<Globe2 className="h-[18px] w-[18px]" />} />
                  <Metric label="Add to carts" value={stats.carts.toLocaleString()} note="Nettmark tracked events" icon={<ShoppingCart className="h-[18px] w-[18px]" />} />
                  <Metric label="Conversions" value={stats.conversions.toLocaleString()} note="Nettmark attribution" icon={<Check className="h-[18px] w-[18px]" />} />
                  <Metric label="Tracked revenue" value={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(businessRevenue)} note="Tracked event amount (USD)" icon={<Wallet className="h-[18px] w-[18px]" />} />
                </>
              ) : (
                <>
                  <Metric label="Meta spend" value={money(Number(campaign.spend || 0))} note="Cumulative Meta Insights" icon={<Wallet className="h-[18px] w-[18px]" />} />
                  <Metric label="Meta clicks" value={Number(campaign.clicks || 0).toLocaleString()} note="Latest stored Meta sync" icon={<MousePointerClick className="h-[18px] w-[18px]" />} />
                  <Metric label="Landing visits" value={stats.clicks.toLocaleString()} note="Unverified Nettmark visits" icon={<Globe2 className="h-[18px] w-[18px]" />} />
                  <Metric label="Conversions" value={stats.conversions.toLocaleString()} note="Nettmark attribution" icon={<Check className="h-[18px] w-[18px]" />} />
                </>
              )}
            </>
          ) : (
            {isOrganic ? (
              <>
                <Metric label="Landing visits" value={stats.clicks.toLocaleString()} note="Unverified browser visits" icon={<Globe2 className="h-[18px] w-[18px]" />} />
                <Metric label="Add to carts" value={stats.carts.toLocaleString()} note="Nettmark tracking events" icon={<ShoppingCart className="h-[18px] w-[18px]" />} />
                <Metric label="Tracked conversions" value={stats.conversions.toLocaleString()} note="Nettmark attribution" icon={<Check className="h-[18px] w-[18px]" />} />
                <Metric label="Estimated commission" value={money(pendingPayout)} note="Unverified, not a payout" icon={<Wallet className="h-[18px] w-[18px]" />} />
              </>
            ) : (
              <>
                <Metric label="Meta spend" value={money(Number(campaign.spend || 0))} note="Cumulative Meta Insights" icon={<Wallet className="h-[18px] w-[18px]" />} />
                <Metric label="Meta clicks" value={Number(campaign.clicks || 0).toLocaleString()} note="Last stored Meta sync" icon={<MousePointerClick className="h-[18px] w-[18px]" />} />
                <Metric label="Landing visits" value={stats.clicks.toLocaleString()} note="Unverified Nettmark visits" icon={<Globe2 className="h-[18px] w-[18px]" />} />
                <Metric label="Tracked conversions" value={stats.conversions.toLocaleString()} note="Nettmark attribution" icon={<Check className="h-[18px] w-[18px]" />} />
              </>
            )}
          )}
        </section>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.90fr)_minmax(0,1.1fr)]">
          <CreativePreview campaign={campaign} title={title} isOrganic={isOrganic} onOpenEmail={() => onEmailModalChange(true)} />
          <div className="min-w-0 space-y-4">
            <section className={panel + " p-4 sm:p-5"} aria-labelledby="tracking-link-heading">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C2CB]/[0.09] text-[#19d4dd]"><Globe2 className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <h2 id="tracking-link-heading" className="text-[14px] font-semibold text-white">Tracking link</h2>
                  <p className="mt-0.5 text-[11px] text-[#94a3b8]">Use your campaign link to attribute activity.</p>
                </div>
              </div>
              <div className="mt-4 min-w-0 rounded-xl border border-white/[0.08] bg-[#101415] p-3 text-xs text-[#63e8ee]">
                <p className="break-all">{trackingUrl || "Your tracking link is unavailable."}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] leading-4 text-[#94a3b8]">{inactive ? "Link inactive while paused or stopped." : "Nettmark handles attribution when someone visits the link."}</p>
                <button type="button" disabled={!trackingUrl || inactive || !affiliateReady} onClick={onCopy} className={primary}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </section>

            <section className={panel + " p-4 sm:p-5"} aria-labelledby="campaign-details-heading">
              <h2 id="campaign-details-heading" className="text-[14px] font-semibold text-white">Campaign details</h2>
              <dl className="mt-3 divide-y divide-white/[0.07] text-xs">
                {[
                  ["Campaign type", isOrganic ? "Organic" : "Paid Meta"],
                  ["Platform", campaign.platform || (isOrganic ? "Organic" : "Meta Ads")],
                  ["Status", state],
                  ["Commission", offer?.commission ? String(offer.commission) + "%" : "Not set"],
                  ...(isBusiness && businessAffiliate ? [["Affiliate", businessAffiliate]] : []),
                  ...(isBusiness ? [["Add to carts", stats.carts.toLocaleString()],
                    ["Tracked revenue (USD)", new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(businessRevenue)]] : []),
                  ["Started", dateLabel(campaign.created_at)],
                  ...(!isOrganic ? (isBusiness
                    ? [["Awaiting settlement", money(outstanding)]]
                    : [["Add to carts", stats.carts.toLocaleString()], ["Estimated commission", money(pendingPayout)], ["Awaiting settlement", money(outstanding)]]) : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 py-2.5">
                    <dt className="shrink-0 text-[#94a3b8]">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-slate-200">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[10px] leading-4 text-[#94a3b8]">
                {isOrganic ? "Promote your offer using your approved content and tracking link." :
                  "Reported spend, wallet deductions and business transfers are separate stages."}
              </p>
            </section>
            {!isBusiness && isOrganic && campaign.offer_id ? (
              <Link href={"/affiliate/dashboard/promote/" + campaign.offer_id + "?mode=organic"}
                className={button + " w-full justify-between"}>
                <span className="inline-flex items-center gap-2"><Rocket className="h-4 w-4 text-[#00C2CB]" /> Organic content setup</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>

        <section className={panel + " p-4 sm:p-5"} aria-labelledby="performance-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="performance-heading" className="text-[14px] font-semibold text-white">Performance overview</h2>
              <p className="mt-1 text-[11px] text-[#94a3b8]">Nettmark-tracked carts and conversions · last 7 days</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-slate-400">
              {loadingStats ? "Updating…" : "Last 7 days"}
            </span>
          </div>
          <div className="mt-4 h-[185px] w-full sm:h-[235px]">
            {hasTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -26, bottom: 0 }} barCategoryGap="38%">
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ background: "#101415", border: "1px solid #303335", borderRadius: 12, fontSize: 12, color: "#fff" }} />
                  <Bar dataKey="carts" name="Add to carts" fill="#00C2CB" maxBarSize={19} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversions" name="Conversions" fill="#22c55e" maxBarSize={19} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#101415] text-center">
                <BarChart3 className="h-6 w-6 text-[#19d4dd]" />
                <p className="mt-3 text-xs font-semibold text-white">No carts or conversions recorded yet</p>
                <p className="mt-1 max-w-xs px-4 text-[11px] text-[#94a3b8]">Activity will appear here as Nettmark records attributable events.</p>
              </div>
            )}
          </div>
        </section>

        {!isBusiness && isOrganic ? (
          <details className={panel + " group p-4 sm:p-5"}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-white">
              How to get the most from organic promotion
              <ChevronRight className="h-4 w-4 text-[#19d4dd] transition group-open:rotate-90" />
            </summary>
            <div className="mt-3 space-y-2 text-xs leading-5 text-[#94a3b8]">
              <p>Adapt approved creative to the platform where your audience spends time.</p>
              <p>Always share your Nettmark tracking link so attributed activity stays connected to this campaign.</p>
              <p>Watch tracked visits, carts and conversions before deciding what to promote next.</p>
            </div>
          </details>
        ) : null}

        {!isBusiness && isOrganic ? (
          <section className={panel + " flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"}>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-white">Remove organic placement</h2>
              <p className="mt-1 max-w-lg text-[11px] leading-5 text-[#94a3b8]">Permanently deleting this placement cannot be undone.</p>
            </div>
            <button type="button" onClick={onDeleteOrganic} className={button + " border-red-400/25 text-red-200 hover:bg-red-400/[0.08]"}>
              <Trash2 className="h-4 w-4" /> Delete campaign
            </button>
          </section>
        ) : null}

        <p className="flex items-start gap-2 text-[11px] leading-5 text-[#94a3b8]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#19d4dd]" />
          Landing visits are unverified and may include repeat visits. Meta clicks and spend come from stored Meta Insights. {isBusiness
            ? "Tracked revenue is based on attribution events, not verified settlement."
            : "Estimated commission is not a confirmed payout."}
        </p>
      </div>
      {showEmailModal ? (
        <div role="presentation" onClick={() => onEmailModalChange(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" aria-label="Full email creative" onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-white/10 bg-[#151718] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-white">Email preview</h2>
              <button type="button" onClick={() => onEmailModalChange(false)} className={button}>Close</button>
            </div>
            <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{campaign.caption || "No email content available."}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
