"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/../utils/supabase/pages-client";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  ArrowLeftIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  TrashIcon,
  ArrowPathIcon,
  CursorArrowRaysIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  RocketLaunchIcon,
  ArrowTopRightOnSquareIcon,
  FolderOpenIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ReadinessBanner,
  SectionHeader,
  StatCard,
} from "@/../components/ui";

type Campaign = {
  id: string;
  caption?: string;
  media_url?: string | null;
  file_url?: string | null;
  affiliate_id?: string | null;
  affiliate_email?: string | null;
  business_email?: string | null;
  type?: string;
  platform?: string;
  status?: string;
  offer_id?: string | null;

  // Paid Meta-only fields (live_ads)
  campaign_type?: string | null;
  spend?: number | null;
  conversions?: number | null;
  tracking_link?: string | null;

  billing_state?: string | null;
  terminated_by_business_at?: string | null;
  terminated_by_business_note?: string | null;
  billing_paused_at?: string | null;
  [key: string]: any;
};

type Stats = { clicks: number; carts: number; conversions: number };

type ChartSeries = {
  labels: string[];
  carts: number[];
  conversions: number[];
};

export default function ManageCampaignPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;
  const router = useRouter();

  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<PostgrestError | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [metaControlLoading, setMetaControlLoading] = useState(false);

  const [offer, setOffer] = useState<{
    website?: string;
    title?: string;
    commission?: number;
  } | null>(null);
  const [stats, setStats] = useState<Stats>({
    clicks: 0,
    carts: 0,
    conversions: 0,
  });
  const [chartSeries, setChartSeries] = useState<ChartSeries>({
    labels: [],
    carts: [],
    conversions: [],
  });
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [pendingPayout, setPendingPayout] = useState<number>(0);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  // Meta spend formatting
  const [metaCurrency, setMetaCurrency] = useState<string>("AUD");
  const [syncingSpend, setSyncingSpend] = useState(false);

  // --------------------
  // Helpers
  // --------------------
  function buildLast7DaysBuckets() {
    const labels: string[] = [];
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(new Date());
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      labels.push(day.toLocaleDateString(undefined, { weekday: "short" }));
    }
    return labels;
  }

  const formatMoney = useCallback(
    (val: any) => {
      const n = Number(val);
      const safe = Number.isFinite(n) ? n : 0;
      const currency = String(metaCurrency || "AUD").toUpperCase();
      try {
        return new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency,
        }).format(safe);
      } catch {
        return `A$${safe.toFixed(2)}`;
      }
    },
    [metaCurrency],
  );

  async function loadMetaCurrencyForBusiness(businessEmail?: string | null) {
    if (!businessEmail) return;

    const { data, error: connErr } = await supabase
      .from("meta_connections")
      .select("currency, account_currency, ad_account_currency, created_at")
      .eq("business_email", businessEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connErr) {
      console.warn("[⚠️ meta currency lookup failed]", connErr);
      return;
    }

    const cur =
      (data as any)?.currency ||
      (data as any)?.account_currency ||
      (data as any)?.ad_account_currency;
    if (cur) setMetaCurrency(String(cur).toUpperCase());
  }

  // --------------------
  // Stats loader
  // Tracking-system stats only (no Meta clicks to avoid crossing wires)
  // IMPORTANT: Clicks should match business-side logic.
  // Business counts "Clicks / Page views" as any of:
  // page_view, page_viewed, view, landing_view, click (case-insensitive).
  // --------------------
  async function loadCampaignStats(currentCampaignId: string) {
    try {
      setLoadingStats(true);

      // 🔑 Single source of truth: stats are always per campaign_id (same as business side)
      const resp = await (supabase as any)
        .from("campaign_tracking_events")
        .select(
          "id, event_type, amount, created_at, offer_id, affiliate_id, campaign_id",
        )
        .eq("campaign_id", currentCampaignId);

      let rows: any[] = resp?.data || [];
      const fetchErr: any = resp?.error;

      if (fetchErr) {
        console.error("[❌ Failed to fetch campaign stats]", fetchErr);
      }

      // 🚫 No fallback to offer_id/affiliate_id here.
      // This page must be campaign-scoped only.
      // If a campaign has no events yet, we show zeros (prevents cross-campaign data bleed).

      // If no events exist, reset UI cleanly.
      if (!rows || rows.length === 0) {
        setStats({ clicks: 0, carts: 0, conversions: 0 });
        const labels = buildLast7DaysBuckets();
        setChartSeries({
          labels,
          carts: Array(labels.length).fill(0),
          conversions: Array(labels.length).fill(0),
        });
        return;
      }

      // ✅ Aggregate totals (matches business logic)
      let pageViews = 0;
      let addToCarts = 0;
      let conversions = 0;

      for (const evt of rows) {
        const t = String(evt?.event_type || "").toLowerCase();

        // Business treats these as "Clicks" (meta) / "Page views" (organic)
        if (
          t === "page_view" ||
          t === "page_viewed" ||
          t === "view" ||
          t === "landing_view" ||
          t === "click"
        ) {
          pageViews += 1;
        } else if (
          t === "add_to_cart" ||
          t === "cart" ||
          t === "cart_updated"
        ) {
          addToCarts += 1;
        } else if (
          t === "conversion" ||
          t === "purchase" ||
          t === "order" ||
          t === "checkout_completed"
        ) {
          conversions += 1;
        }
      }

      setStats({
        clicks: pageViews,
        carts: addToCarts,
        conversions: conversions,
      });

      // ✅ Build last-7-days series for chart (we chart carts + conversions here)
      const labels = buildLast7DaysBuckets();
      const cartsSeries = Array(labels.length).fill(0);
      const conversionsSeries = Array(labels.length).fill(0);

      const startOfDay = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const today = startOfDay(new Date());

      for (const row of rows) {
        const createdAt = row?.created_at;
        if (!createdAt) continue;

        const d = new Date(createdAt);
        const rowDay = startOfDay(d);
        const diffDays = Math.round(
          (rowDay.getTime() - today.getTime()) / 86400000,
        );
        const idx = Math.min(
          labels.length - 1,
          Math.max(0, labels.length - 1 + diffDays),
        );

        const t = String(row?.event_type || "").toLowerCase();
        if (t === "add_to_cart" || t === "cart" || t === "cart_updated")
          cartsSeries[idx] += 1;
        else if (
          t === "conversion" ||
          t === "purchase" ||
          t === "order" ||
          t === "checkout_completed"
        )
          conversionsSeries[idx] += 1;
      }

      setChartSeries({
        labels,
        carts: cartsSeries,
        conversions: conversionsSeries,
      });
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await loadCampaignStats(String(campaignId));
    };

    run();
    const interval = setInterval(run, 10000); // refresh every 10s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId]);

  // --------------------
  // Load campaign (organic first, then paid meta from live_ads)
  // --------------------
  const reloadCampaign = useCallback(async () => {
    if (!campaignId) return;

    // 1) Organic / live_campaigns
    try {
      const organicRes = await fetch(
        `/api/affiliate/live-campaigns?campaignId=${encodeURIComponent(String(campaignId))}`,
        { cache: "no-store" },
      );
      const organicJson = await organicRes.json().catch(() => null);

      if (organicRes.ok && organicJson?.ok && organicJson?.campaign) {
        const organic = organicJson.campaign;
        let offerTitle = "";

        if ((organic as any)?.offer_id) {
          const { data: offerRow } = await (supabase as any)
            .from("offers")
            .select("id, title")
            .eq("id", (organic as any).offer_id)
            .maybeSingle();
          offerTitle = String(offerRow?.title || "");
        }

        const normalised: Campaign = {
          ...(organic as any),
          type: (organic as any).type || "organic",
          media_url:
            (organic as any).media_url || (organic as any).file_url || null,
          offers: (organic as any).offer_id
            ? { id: (organic as any).offer_id, title: offerTitle }
            : undefined,
        };
        setCampaign(normalised);
        return;
      }
    } catch (organicErr) {
      console.warn("[manage-campaigns/detail] organic server fetch failed", organicErr);
    }

    // 2) Paid Meta / live_ads
    const { data: paid, error: paidErr } = await supabase
      .from("live_ads")
      .select(
        `
          *,
          offers:offers (
            id,
            title
          )
        `,
      )
      .eq("id", campaignId)
      .maybeSingle();

    if (paid) {
      // Start with anything stored on live_ads
      let mediaUrl: string | null =
        (paid as any).media_url || (paid as any).file_url || null;
      let caption: string | undefined = (paid as any).caption;

      // If no media on live_ads, fall back to the original ad_idea (approved only)
      if ((!mediaUrl || mediaUrl === "") && (paid as any).ad_idea_id) {
        // NOTE: Some Supabase type setups infer `ad_ideas` as `never` if generated DB types are out of date.
        // We cast the query to `any` so TS doesn't error on `file_url` / `caption`.
        type AdIdeaMini = { file_url?: string | null; caption?: string | null };

        const { data: idea } = await (supabase as any)
          .from("ad_ideas")
          .select("file_url, caption")
          .eq("id", (paid as any).ad_idea_id)
          .eq("status", "approved")
          .maybeSingle();

        const typedIdea = (idea as AdIdeaMini | null) ?? null;
        if (typedIdea?.file_url) mediaUrl = typedIdea.file_url;
        if (!caption && typedIdea?.caption) caption = typedIdea.caption;
      }

      const normalised: Campaign = {
        ...(paid as any),
        type: (paid as any).campaign_type || "paid_meta",
        platform: (paid as any).platform || "Meta",
        media_url: mediaUrl,
        caption: caption,
        spend: Number((paid as any).spend ?? 0),
        tracking_link: (paid as any).tracking_link ?? null,
      };

      setCampaign(normalised);
      if (paidErr) setError(paidErr);

      // pull currency from latest meta_connections for this business
      await loadMetaCurrencyForBusiness((paid as any).business_email);
      return;
    }

    if (organicErr || paidErr) {
      setError((organicErr || paidErr) as PostgrestError);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    console.log("✅ CAMPAIGN ID FROM ROUTE:", campaignId);
    reloadCampaign();
  }, [campaignId, reloadCampaign]);

  // --------------------
  // Meta control (pause / resume)
  // --------------------
  async function handleMetaControl(action: "PAUSE" | "RESUME") {
    if (!campaign?.id) return;

    try {
      setMetaControlLoading(true);
      const res = await fetch("/api/meta/control-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveAdId: campaign.id,
          action,
          actor: "affiliate",
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !(json && json.success)) {
        console.error("[❌ Failed Meta control]", json);
        return;
      }

      const newStatus = json.newStatus as string | undefined;
      const newBillingState = json.billing_state as string | undefined;

      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus || prev.status,
              billing_state: newBillingState ?? prev.billing_state,
            }
          : prev,
      );
    } catch (err) {
      console.error("[❌ Meta control client error]", err);
    } finally {
      setMetaControlLoading(false);
    }
  }

  // --------------------
  // Sync Meta spend (paid only)
  // --------------------
  const handleSyncSpend = useCallback(async () => {
    if (!campaign?.id) return;

    try {
      setSyncingSpend(true);
      const res = await fetch("/api/meta/ad-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveAdId: campaign.id }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || (json && (json as any).error)) {
        console.error("[❌ Sync spend failed]", json);
        alert("Failed to sync spend. Check terminal logs.");
        return;
      }

      await reloadCampaign();
    } catch (err) {
      console.error("[❌ Sync spend threw]", err);
      alert("Failed to sync spend. Check terminal logs.");
    } finally {
      setSyncingSpend(false);
    }
  }, [campaign?.id, reloadCampaign]);

  // --------------------
  // Resolve affiliateId
  // --------------------
  useEffect(() => {
    let cancelled = false;

    async function resolveAffiliateId() {
      // Prefer campaign.affiliate_id
      if (campaign?.affiliate_id) {
        if (!cancelled) setAffiliateId(String(campaign.affiliate_id));
        return;
      }

      // Supabase auth
      try {
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email || null;
        if (email && !cancelled) {
          setAffiliateId(email);
          return;
        }
      } catch (_) {
        // ignore
      }

      // Fallback localStorage profile
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("affiliateProfile");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.email && !cancelled) {
              setAffiliateId(parsed.email);
              return;
            }
          }
        } catch (_) {
          // ignore
        }
      }

      if (!cancelled) setAffiliateId(null);
    }

    resolveAffiliateId();
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  // --------------------
  // Pending payout from campaign_tracking_events
  // --------------------
  useEffect(() => {
    if (!affiliateId || !campaignId) return;

    let cancelled = false;

    async function loadPendingFromEvents() {
      const { data, error } = await supabase
        .from("campaign_tracking_events")
        .select("amount, event_type")
        .eq("affiliate_id", affiliateId as string)
        .eq("campaign_id", campaignId)
        .eq("event_type", "conversion");

      if (error) {
        console.warn("pending payout (events) fetch error", error);
        if (!cancelled) setPendingPayout(0);
        return;
      }

      const commissionPct =
        offer &&
        typeof offer.commission !== "undefined" &&
        offer.commission !== null
          ? Number(offer.commission)
          : null;

      const total = (data || []).reduce((sum: number, row: any) => {
        const amt = Number(row.amount);
        if (Number.isNaN(amt)) return sum;
        if (commissionPct !== null && !Number.isNaN(commissionPct)) {
          const earned = amt * (commissionPct / 100);
          return sum + earned;
        }
        return sum + amt;
      }, 0);

      if (!cancelled) setPendingPayout(total);
    }

    loadPendingFromEvents();
    const iv = setInterval(loadPendingFromEvents, 15000);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [affiliateId, campaignId, offer?.commission]);

  // --------------------
  // Offer info
  // --------------------
  useEffect(() => {
    if (!campaign || !campaign.offer_id) {
      setOffer(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("offers")
      .select("website,title,commission")
      .eq("id", campaign.offer_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          if (data) setOffer(data);
          else setOffer(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  // --------------------
  // Derived flags / values
  // --------------------
  const rawStatus = campaign?.status
    ? String(campaign.status).toUpperCase()
    : "";
  const isPaused =
    rawStatus === "PAUSED" ||
    campaign?.billing_state === "PAUSED" ||
    !!campaign?.billing_paused_at;

  const isOrganic = campaign?.type === "organic";
  const isMetaPaid = !isOrganic;

  const isTerminatedByBusiness =
    campaign?.billing_state === "TERMINATED_BY_BUSINESS" ||
    !!campaign?.terminated_by_business_at;

  const canAffiliateControlMeta = isMetaPaid && !isTerminatedByBusiness;

  const trackingUrl = useMemo(() => {
    // Prefer the stored tracking_link on live_ads
    if (campaign?.tracking_link) return String(campaign.tracking_link);

    if (!campaignId || !affiliateId) return "";
    // fallback legacy format
    return `https://www.nettmark.com/go/${campaignId}-${affiliateId}`;
  }, [campaign?.tracking_link, campaignId, affiliateId]);

  const campaignTitle = useMemo(() => {
    const captionTitle = String(campaign?.caption || "")
      .split("\n")[0]
      .trim();

    return (
      offer?.title ||
      campaign?.ad_name ||
      campaign?.platform ||
      captionTitle ||
      "Campaign"
    );
  }, [offer?.title, campaign?.ad_name, campaign?.platform, campaign?.caption]);

  const promoteOfferPath = useMemo(() => {
    if (!campaign?.offer_id) return null;
    return `/affiliate/dashboard/promote/${campaign.offer_id}`;
  }, [campaign?.offer_id]);

  const organicContentPath = useMemo(() => {
    if (!campaign?.offer_id) return null;
    return `/affiliate/dashboard/promote/${campaign.offer_id}?mode=organic`;
  }, [campaign?.offer_id]);

  const organicGuideSteps = useMemo(
    () => [
      {
        title: "Post the creative where your audience already pays attention",
        body:
          "Use the supplied caption/media as a starting point, then tailor it to the platform so it still feels native.",
      },
      {
        title: "Always use your Nettmark tracking link",
        body:
          "That link is what attributes clicks, carts, and conversions back to this campaign. Without it, the post has no commercial trail.",
      },
      {
        title: "Let the campaign run and review the signals here",
        body:
          "This page is your control panel for traction. Check clicks first, then carts, then confirmed conversions and pending payout.",
      },
    ],
    [],
  );

  const campaignDetails = useMemo(
    () => [
      { label: "Offer", value: offer?.title || "No linked offer" },
      { label: "Campaign type", value: isOrganic ? "Organic" : "Paid Meta" },
      { label: "Platform", value: campaign?.platform || "Platform not set" },
      { label: "Status", value: campaign?.status || "Unknown status" },
      {
        label: "Commission",
        value: offer?.commission ? `${offer.commission}% per conversion` : "Not set",
      },
    ],
    [campaign?.platform, campaign?.status, isOrganic, offer?.commission, offer?.title],
  );

  const organicQuickActions = useMemo(
    () => [
      {
        title: "Create your first ad",
        body: "Take this organic campaign further by putting paid reach behind the same offer.",
        icon: RocketLaunchIcon,
        onClick: () => {
          if (promoteOfferPath) router.push(promoteOfferPath);
        },
        disabled: !promoteOfferPath,
      },
      {
        title: "View content setup",
        body: "Open the organic promotion flow again and reuse approved content for another placement.",
        icon: FolderOpenIcon,
        onClick: () => {
          if (organicContentPath) router.push(organicContentPath);
        },
        disabled: !organicContentPath,
      },
      {
        title: "Affiliate settings",
        body: "Jump to your affiliate profile and payout-related setup without leaving the product flow.",
        icon: Cog6ToothIcon,
        onClick: () => router.push("/affiliate/settings"),
        disabled: false,
      },
    ],
    [organicContentPath, promoteOfferPath, router],
  );

  async function handleCopyTrackingLink() {
    if (!trackingUrl) return;
    await navigator.clipboard.writeText(trackingUrl);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)]">
        <Card className="mx-auto max-w-3xl p-5 text-red-200">
          Error: {error.message}
        </Card>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)]">
        <Card className="mx-auto max-w-3xl p-5 text-sm text-[var(--muted-foreground)]">
          Loading campaign…
        </Card>
      </div>
    );
  }

  if (isOrganic) {
    return (
      <div className="min-h-screen bg-[#090b0c] text-white">
        <div className="mx-auto max-w-[1540px] px-6 py-7 lg:px-10">
          <button
            type="button"
            onClick={() => router.push("/affiliate/dashboard/manage-campaigns")}
            className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to campaigns
          </button>

          {(isTerminatedByBusiness || isPaused) && (
            <div className="mb-6 space-y-3">
              {isTerminatedByBusiness && (
                <ReadinessBanner
                  tone="danger"
                  title="Campaign permanently stopped by business"
                >
                  This campaign has been hard-stopped at the business level. Historical stats stay visible, but the link no longer accepts new tracked traffic.
                </ReadinessBanner>
              )}
              {!isTerminatedByBusiness && isPaused && (
                <ReadinessBanner tone="warning" title="Campaign paused">
                  Stats remain visible, but this organic tracking link is temporarily inactive until the campaign is reactivated.
                </ReadinessBanner>
              )}
            </div>
          )}

          <div className="grid gap-7 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-cyan-500/50 bg-cyan-500/5 px-3 py-1.5 text-xs text-cyan-300">
                  Organic Campaign
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs ${
                    isPaused || isTerminatedByBusiness
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                      : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {isTerminatedByBusiness
                    ? "Off (Stopped by Business)"
                    : isPaused
                      ? "Off (Paused)"
                      : "On (Active)"}
                </span>
              </div>

              <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1116] shadow-2xl shadow-black/30">
                <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
                  <div className="text-[10px] font-black tracking-tight">
                    <span className="text-zinc-300">N</span>
                    <span className="text-cyan-400">NETTMARK</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {campaign?.platform || "Organic"}
                  </div>
                </div>

                <div className="relative aspect-[9/16] min-h-[520px] bg-[radial-gradient(circle_at_50%_35%,rgba(6,182,212,0.08),transparent_40%),linear-gradient(180deg,#071018_0%,#081015_100%)]">
                  {campaign.media_url ? (
                    String(campaign.media_url).match(/\.(mp4|mov)$/i) ? (
                      <video
                        controls
                        className="h-full w-full object-cover"
                      >
                        <source src={String(campaign.media_url)} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : String(campaign.media_url).match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img
                        src={String(campaign.media_url)}
                        alt="Organic campaign preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-8 text-center text-zinc-500">
                        Unsupported media format
                      </div>
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center px-8 text-center text-zinc-500">
                      No preview asset available for this campaign yet.
                    </div>
                  )}
                </div>
              </section>

              <button
                type="button"
                onClick={() => promoteOfferPath && router.push(promoteOfferPath)}
                disabled={!promoteOfferPath}
                className="group w-full rounded-2xl border border-white/10 bg-[#111416] p-5 text-left transition hover:border-cyan-500/30 hover:bg-[#13191c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-start gap-3">
                  <RocketLaunchIcon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-100">
                      Nice start — this offer is live.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      Create an ad to reach more people and potentially drive more sales from the same offer.
                    </p>
                  </div>
                  <ArrowTopRightOnSquareIcon className="mt-1 h-4 w-4 text-cyan-300 transition group-hover:translate-x-0.5" />
                </div>
              </button>
            </aside>

            <section className="min-w-0 space-y-5">
              <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Campaign
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">
                    {campaignTitle}
                  </h1>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300">
                      Organic
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300">
                      {campaign?.platform || "Placement"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300">
                      {offer?.title || "Offer"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs ${
                        isPaused || isTerminatedByBusiness
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                          : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      {isTerminatedByBusiness
                        ? "Stopped"
                        : isPaused
                          ? "Paused"
                          : "Active"}
                    </span>
                  </div>
                </div>

                <div className="grid min-w-[330px] grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-[#111416] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      Pending payout
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {pendingPayout > 0 ? `$${pendingPayout.toFixed(2)}` : "$0.00"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#111416] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      Commission rate
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {offer?.commission ? `${offer.commission}%` : "—"}
                    </p>
                  </div>
                </div>
              </header>

              <section className="rounded-2xl border border-white/10 bg-[#111416]">
                <div className="grid md:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "Clicks",
                      value: stats.clicks.toLocaleString(),
                      icon: CursorArrowRaysIcon,
                    },
                    {
                      label: "Add to carts",
                      value: stats.carts.toLocaleString(),
                      icon: ShoppingCartIcon,
                    },
                    {
                      label: "Conversions",
                      value: stats.conversions.toLocaleString(),
                      icon: CheckCircleIcon,
                    },
                    {
                      label: "Earned",
                      value:
                        pendingPayout > 0 ? `$${pendingPayout.toFixed(2)}` : "$0.00",
                      icon: CurrencyDollarIcon,
                    },
                  ].map((stat, index, arr) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={stat.label}
                        className={`flex items-center gap-4 px-6 py-6 ${
                          index !== arr.length - 1
                            ? "xl:border-r xl:border-white/10"
                            : ""
                        }`}
                      >
                        <Icon className="h-7 w-7 text-cyan-300" strokeWidth={1.7 as never} />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
                            {stat.label}
                          </p>
                          <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col justify-between gap-3 border-t border-white/10 px-6 py-3.5 sm:flex-row sm:items-center">
                  <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                    <ShieldCheckIcon className="h-4 w-4 text-cyan-400" />
                    Tracked by Nettmark
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-zinc-300">
                    Last 7 days
                    <ChevronDownIcon className="h-4 w-4" />
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-[radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.10),transparent_30%),linear-gradient(135deg,rgba(6,182,212,0.12),rgba(17,20,22,0.95)_45%)] p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex max-w-3xl items-start gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cyan-400/10">
                      <RocketLaunchIcon className="h-7 w-7 text-cyan-300" />
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold">Ready to reach more people?</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                        Organic sharing is a great start. Create an ad and put your own budget behind it to reach a bigger audience and potentially generate more sales.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-left lg:text-right">
                    <button
                      type="button"
                      onClick={() => promoteOfferPath && router.push(promoteOfferPath)}
                      disabled={!promoteOfferPath}
                      className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-[#031013] shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Create Your First Ad
                    </button>
                    <button
                      type="button"
                      onClick={() => organicContentPath && router.push(organicContentPath)}
                      disabled={!organicContentPath}
                      className="mt-3 flex items-center gap-1 text-sm font-medium text-cyan-300 lg:ml-auto disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      View content setup
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-zinc-200">Quick actions</h2>
                <div className="grid gap-3 lg:grid-cols-3">
                  {organicQuickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.title}
                        type="button"
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className="group flex min-h-[110px] items-center gap-4 rounded-2xl border border-white/10 bg-[#111416] p-5 text-left transition hover:border-cyan-500/30 hover:bg-[#13181b] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400 text-[#041014]">
                          <Icon className="h-6 w-6" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-100">{action.title}</p>
                          <p className="mt-1 text-sm leading-5 text-zinc-500">{action.body}</p>
                        </div>

                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-cyan-300 transition group-hover:translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111416] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <DocumentDuplicateIcon className="h-4 w-4 text-cyan-300" />
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                        Tracking link
                      </p>
                    </div>

                    {!affiliateId ? (
                      <p className="text-sm text-red-300">
                        Missing affiliate ID. Please sign in again or complete your affiliate profile.
                      </p>
                    ) : (
                      <p className="truncate text-sm text-cyan-300">{trackingUrl}</p>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">
                      Share this link anywhere you&apos;re promoting the offer. Nettmark attaches attribution automatically.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyTrackingLink}
                    disabled={!trackingUrl || isPaused || isTerminatedByBusiness}
                    className="shrink-0 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-bold text-[#061114] hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {copyState === "copied"
                      ? "Copied"
                      : isPaused || isTerminatedByBusiness
                        ? "Copy (inactive)"
                        : "Copy Link"}
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111416] p-6">
                <div className="mb-8 flex items-center justify-between gap-4">
                  <h2 className="font-semibold">Performance overview</h2>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-zinc-300">
                    Last 7 days
                    <ChevronDownIcon className="h-4 w-4" />
                  </div>
                </div>
                <div className="h-[260px]">
                  <Line
                    data={{
                      labels: chartSeries.labels.length
                        ? chartSeries.labels
                        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                      datasets: [
                        {
                          label: "Add to Carts",
                          data: chartSeries.carts.length
                            ? chartSeries.carts
                            : [0, 0, 0, 0, 0, 0, 0],
                          fill: true,
                          backgroundColor: (context) => {
                            const gradient = context.chart.ctx.createLinearGradient(
                              0,
                              0,
                              0,
                              200,
                            );
                            gradient.addColorStop(0, "rgba(34,211,238,0.12)");
                            gradient.addColorStop(1, "rgba(34,211,238,0)");
                            return gradient;
                          },
                          borderColor: "#67e8f9",
                          borderWidth: 2,
                          tension: 0.35,
                          pointRadius: 2,
                          pointHoverRadius: 4,
                        },
                        {
                          label: "Conversions",
                          data: chartSeries.conversions.length
                            ? chartSeries.conversions
                            : [0, 0, 0, 0, 0, 0, 0],
                          fill: true,
                          backgroundColor: (context) => {
                            const gradient = context.chart.ctx.createLinearGradient(
                              0,
                              0,
                              0,
                              200,
                            );
                            gradient.addColorStop(0, "rgba(14,165,233,0.10)");
                            gradient.addColorStop(1, "rgba(14,165,233,0)");
                            return gradient;
                          },
                          borderColor: "#38bdf8",
                          borderWidth: 2,
                          tension: 0.35,
                          pointRadius: 2,
                          pointHoverRadius: 4,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          labels: {
                            color: "#a1a1aa",
                            font: { size: 11 },
                            boxWidth: 10,
                            usePointStyle: true,
                            pointStyle: "line",
                          },
                        },
                        tooltip: { mode: "index", intersect: false },
                      },
                      scales: {
                        x: {
                          ticks: { color: "#71717a", font: { size: 10 } },
                          grid: { color: "rgba(255,255,255,0.06)" },
                        },
                        y: {
                          ticks: { color: "#71717a", font: { size: 10 } },
                          grid: { color: "rgba(255,255,255,0.06)" },
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-white/10 bg-[#111416] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Campaign details
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {campaignDetails.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">
                          {item.label}
                        </p>
                        <p className="mt-2 text-sm font-medium text-zinc-100">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#111416] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Affiliate guide
                  </p>
                  <div className="mt-5 space-y-4">
                    {organicGuideSteps.map((step, index) => (
                      <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-semibold text-cyan-300">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">
                              {step.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-zinc-400">
                              {step.body}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-200/70">
                  Danger zone
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Delete this organic campaign
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Permanently remove this campaign if it was created by mistake or should no longer exist.
                </p>
                <button
                  onClick={async () => {
                    const confirmDelete = window.confirm(
                      `Permanently delete this organic campaign?\n\nThis action cannot be undone.`,
                    );
                    if (!confirmDelete) return;

                    const { error: delErr } = await supabase
                      .from("live_campaigns")
                      .delete()
                      .eq("id", campaign.id);
                    if (delErr) {
                      console.error("❌ Delete error:", delErr);
                      alert("Error deleting campaign.");
                    } else {
                      alert("Campaign deleted.");
                      router.replace("/affiliate/dashboard/manage-campaigns");
                    }
                  }}
                  className="mt-5 inline-flex items-center rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-2.5 font-medium text-red-300 transition hover:border-red-500/70 hover:bg-red-500/15"
                >
                  <TrashIcon className="mr-2 h-5 w-5 text-red-400" />
                  Delete Campaign
                </button>
              </section>
            </section>
          </div>
        </div>

        {showEmailModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowEmailModal(false)}
          >
            <div
              className="max-h-[80vh] w-[90%] max-w-2xl overflow-y-auto rounded-xl border border-[#00C2CB55] bg-[#1A1A1A] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Full Email Content</h2>
                <button onClick={() => setShowEmailModal(false)}>
                  <XMarkIcon className="h-6 w-6 text-gray-400 hover:text-white" />
                </button>
              </div>
              <div className="whitespace-pre-line text-sm leading-relaxed text-gray-200">
                {campaign.caption || "No email content available."}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] md:px-8 md:py-8">
      {isOrganic && (
        <div className="mx-auto mb-6 max-w-6xl">
          <button
            type="button"
            onClick={() => router.push("/affiliate/dashboard/manage-campaigns")}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to campaigns
          </button>
        </div>
      )}

      {/* Status banners */}
      {isTerminatedByBusiness && (
        <div className="mx-auto mb-4 max-w-6xl">
          <ReadinessBanner
            tone="danger"
            title="Campaign permanently stopped by business"
          >
            This Meta campaign has been hard-stopped at the business level. You
            can still view historical stats, but it cannot be reactivated from
            Nettmark.
            {campaign.terminated_by_business_note && (
              <p className="mt-2 italic">
                Business note: {campaign.terminated_by_business_note}
              </p>
            )}
          </ReadinessBanner>
        </div>
      )}

      {!isTerminatedByBusiness && isPaused && (
        <div className="mx-auto mb-4 max-w-6xl">
          <ReadinessBanner tone="warning" title="Campaign paused">
            Stats remain visible but won&apos;t increase until this campaign is
            reactivated.
          </ReadinessBanner>
        </div>
      )}

      {/* Meta / campaign status + control (for paid Meta campaigns) */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              {isOrganic ? "ORGANIC CAMPAIGN" : "META AD • PAID CAMPAIGN"}
            </Badge>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] md:text-[0.7rem] font-medium border ${
                isPaused || isTerminatedByBusiness
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {isTerminatedByBusiness
                ? "Off (Stopped by Business)"
                : isPaused
                  ? "Off (Paused)"
                  : "On (Active)"}
            </span>
          </div>

          {/* Affiliates can soft-control Meta (pause / resume), but not if business hard-stopped */}
          {canAffiliateControlMeta && (
            <Button
              type="button"
              variant={isPaused ? "primary" : "outline"}
              size="sm"
              onClick={() => handleMetaControl(isPaused ? "RESUME" : "PAUSE")}
              disabled={metaControlLoading}
            >
              {metaControlLoading
                ? "Updating..."
                : isPaused
                  ? "Activate campaign"
                  : "Pause campaign"}
            </Button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px,minmax(0,1fr)] gap-8 items-start justify-center max-w-6xl mx-auto">
        {/* Left side: media / email preview */}
        <div className="w-full flex justify-center items-start">
          <div className="w-full max-w-lg space-y-5">
          {isOrganic && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-cyan-500/50 bg-cyan-500/5 px-3 py-1.5 text-xs text-cyan-300">
                Organic Campaign
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs border ${
                  isPaused || isTerminatedByBusiness
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {isTerminatedByBusiness
                  ? "Off (Stopped by Business)"
                  : isPaused
                    ? "Off (Paused)"
                    : "On (Active)"}
              </span>
            </div>
          )}

          {campaign.platform &&
          String(campaign.platform).toLowerCase() === "email" ? (
            <div className="bg-gradient-to-b from-[#181d22] to-[#101214] rounded-2xl border border-[#232931] shadow-xl w-full max-w-lg min-h-[340px] flex flex-col justify-between p-12 relative drop-shadow-[0_0_16px_rgba(0,194,203,0.11)]">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-[#222B34] w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-[#00C2CB] border border-[#28303a]">
                    N
                  </div>
                  <div>
                    <div className="text-xs text-[#7e8a9a]">
                      From:{" "}
                      <span className="font-semibold text-gray-200">
                        Nettmark &lt;no-reply@nettmark.com&gt;
                      </span>
                    </div>
                  </div>
                </div>
                <h2 className="text-[1.2rem] font-bold text-[#00C2CB] mb-2 leading-snug truncate">
                  {campaign.caption?.split("\n")[0] || "[No Subject]"}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div
                  className="text-gray-300 text-[0.97rem] whitespace-pre-line leading-relaxed px-1 mb-4"
                  style={{ maxHeight: 170, minHeight: 64 }}
                >
                  {campaign.caption || "No content available."}
                </div>
              </div>
              <button
                className="mt-2 w-fit px-4 py-2 rounded-lg border border-[#00C2CB] text-[#00C2CB] font-medium hover:bg-[#00c2cb22] transition"
                onClick={() => setShowEmailModal(true)}
              >
                Open Full Email
              </button>
            </div>
          ) : campaign.media_url ? (
            <div
              className={
                isOrganic
                  ? "w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f1418] shadow-[0_35px_90px_rgba(0,0,0,0.35)]"
                  : "bg-black rounded-[2rem] border-[3px] border-[#2D2D2D] w-[320px] h-[640px] overflow-hidden shadow-lg relative"
              }
            >
              {isOrganic ? (
                <>
                  <div className="flex items-center justify-between border-b border-white/10 bg-[#131a1f] px-4 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#7ff5fb]/70">
                        Organic preview
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {campaign?.platform || "Content placement"}
                      </p>
                    </div>
                    <div className="rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium text-[#7ff5fb]">
                      Live link ready
                    </div>
                  </div>
                  <div className="aspect-[4/5] overflow-hidden bg-black">
                    {String(campaign.media_url).match(/\.(mp4|mov)$/i) ? (
                      <video controls className="h-full w-full object-cover bg-black">
                        <source src={String(campaign.media_url)} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : String(campaign.media_url).match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img
                        src={String(campaign.media_url)}
                        alt="Organic campaign preview"
                        className="h-full w-full object-cover bg-black"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-8 text-center text-gray-500">
                        Unsupported media format
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                        Suggested caption
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/78">
                        {campaign.caption || "No caption available for this campaign yet."}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#111111] flex items-center justify-center px-4 py-2 border-b border-gray-700">
                    <img
                      src="/nettmark-logo.png"
                      alt="Nettmark Logo"
                      className="h-10 w-auto opacity-95 transform scale-125"
                    />
                  </div>
                  <div className="h-[calc(100%-48px)] overflow-hidden">
                    {String(campaign.media_url).match(/\.(mp4|mov)$/i) ? (
                      <video controls className="w-full h-full object-cover bg-black">
                        <source src={String(campaign.media_url)} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : String(campaign.media_url).match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img
                        src={String(campaign.media_url)}
                        alt="Ad Preview"
                        className="w-full h-full object-cover bg-black"
                      />
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        Unsupported media format
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-[#1A1A1A] w-[90%] max-w-md rounded-xl border border-[#2A2A2A] p-8 shadow-lg flex items-center justify-center">
              <span className="text-gray-500 text-center">
                No content available for this campaign type
              </span>
            </div>
          )}

          {isOrganic && (
            <button
              type="button"
              onClick={() => promoteOfferPath && router.push(promoteOfferPath)}
              disabled={!promoteOfferPath}
              className="group w-full rounded-[1.6rem] border border-white/10 bg-[#111416] p-5 text-left transition hover:border-cyan-500/30 hover:bg-[#13191c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-start gap-3">
                <RocketLaunchIcon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-100">
                    Ready to reach more people?
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Organic sharing is live. Create an ad for this same offer when you want to add paid reach on top.
                  </p>
                </div>
                <ArrowTopRightOnSquareIcon className="mt-1 h-4 w-4 text-cyan-300 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          )}
          </div>
        </div>

        {/* Right side: summary + stats */}
        <div className="w-full min-w-0 flex flex-col gap-6">
          <Card
            variant="elevated"
            className={isOrganic ? "space-y-5 rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,rgba(16,22,27,0.98),rgba(10,14,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)]" : "space-y-4 p-5"}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <SectionHeader
                  eyebrow={isOrganic ? "Organic Campaign" : "Campaign Summary"}
                  title={campaignTitle}
                />

                {isOrganic && (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                    Keep this page as your campaign home base — copy the link, monitor traction, and use the preview as the single source of truth for what is live.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem] md:text-xs">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-200">
                    {offer?.title || "No linked offer"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300">
                    {isOrganic ? "Organic" : "Paid Meta"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300">
                    {campaign?.platform || "Platform not set"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300">
                    {campaign?.status || "Unknown status"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 min-w-[220px] lg:min-w-[260px]">
                <StatCard
                  label="Pending payout"
                  value={
                    pendingPayout > 0 ? `$${pendingPayout.toFixed(2)}` : "$0.00"
                  }
                />
                <StatCard
                  label="Commission"
                  value={offer?.commission ? `${offer.commission}%` : "—"}
                />
              </div>
            </div>

            <Card className={isOrganic ? "rounded-[1.5rem] border-white/8 bg-white/[0.03] p-4" : "p-4"}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.65rem] uppercase tracking-wide text-gray-500">
                    Tracking Link
                  </p>
                  {!affiliateId ? (
                    <p className="mt-2 text-sm text-red-300">
                      Missing affiliate ID. Please sign in again or complete
                      your affiliate profile.
                    </p>
                  ) : (
                    <p
                      className={`mt-2 break-all text-sm ${isPaused || isTerminatedByBusiness ? "text-[#00C2CB]/60" : "text-[#00C2CB]"}`}
                    >
                      {trackingUrl}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyTrackingLink}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00C2CB] hover:bg-[#00b0b8] text-white text-xs font-semibold disabled:opacity-60"
                    disabled={
                      !trackingUrl || isPaused || isTerminatedByBusiness
                    }
                  >
                    <DocumentDuplicateIcon className="h-4 w-4" />
                    {copyState === "copied"
                      ? "Copied"
                      : isPaused || isTerminatedByBusiness
                        ? "Copy (inactive)"
                        : "Copy Link"}
                  </button>
                </div>
              </div>

              {isTerminatedByBusiness ? (
                <p className="text-xs text-amber-200 mt-3">
                  This campaign has been permanently stopped by the business.
                  The tracking link is archived and no longer counts new
                  traffic.
                </p>
              ) : isPaused ? (
                <p className="text-xs text-amber-200 mt-3">
                  This campaign is currently paused. The tracking link is
                  temporarily disabled until it is reactivated.
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-3">
                  Share this link anywhere you’re promoting the offer. Nettmark
                  attaches <code>nm_aff</code> and <code>nm_camp</code>{" "}
                  automatically.
                </p>
              )}
            </Card>
          </Card>

          <div className={`grid grid-cols-1 gap-4 ${isOrganic ? "md:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}>
            {/* Spend (Meta) - Paid only */}
            {isMetaPaid && (
              <StatCard
                label="Spend (Meta)"
                value={formatMoney((campaign as any).spend ?? 0)}
                tone="primary"
                icon={<CurrencyDollarIcon className="h-5 w-5" />}
                helper={
                  <button
                    type="button"
                    onClick={handleSyncSpend}
                    disabled={syncingSpend}
                    className="inline-flex items-center gap-2 font-semibold text-[#00C2CB] hover:text-[#7ff5fb] disabled:opacity-60"
                  >
                    <ArrowPathIcon
                      className={`h-4 w-4 ${syncingSpend ? "animate-spin" : ""}`}
                    />
                    {syncingSpend ? "Syncing…" : "Sync spend"}
                  </button>
                }
              />
            )}

            {/* Clicks (Nettmark tracking) */}
            <div className="bg-[#171717] hover:bg-[#1C1C1C] transition-all duration-300 p-4 rounded-2xl shadow-md flex items-center justify-between h-24 border border-[#2A2A2A] drop-shadow-[0_0_10px_rgba(0,194,203,0.12)]">
              <div>
                <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                  Clicks{" "}
                  {loadingStats && (
                    <span className="text-xs text-gray-500">•</span>
                  )}
                </h2>
                <p className="text-2xl font-semibold text-white">
                  {stats.clicks.toLocaleString()}
                </p>
                <p className="text-[0.6rem] text-gray-500 mt-1">
                  Tracked by Nettmark
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
                <CursorArrowRaysIcon className="w-5 h-5 text-[#00C2CB]/80" />
              </div>
            </div>

            {isOrganic && (
              <div className="bg-[#171717] hover:bg-[#1C1C1C] transition-all duration-300 p-4 rounded-2xl shadow-md flex items-center justify-between h-24 border border-[#2A2A2A] drop-shadow-[0_0_10px_rgba(0,194,203,0.12)]">
                <div>
                  <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                    Link status
                  </h2>
                  <p className="text-2xl font-semibold text-white">
                    {isPaused || isTerminatedByBusiness ? "Inactive" : "Live"}
                  </p>
                  <p className="text-[0.6rem] text-gray-500 mt-1">
                    {campaign?.platform || "Organic placement"}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
                  <GlobeAltIcon className="w-5 h-5 text-[#00C2CB]/80" />
                </div>
              </div>
            )}

            {/* Add to carts */}
            <div className="bg-[#171717] hover:bg-[#1C1C1C] transition-all duration-300 p-4 rounded-2xl shadow-md flex items-center justify-between h-24 border border-[#2A2A2A] drop-shadow-[0_0_10px_rgba(0,194,203,0.12)]">
              <div>
                <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                  Add to Carts{" "}
                  {loadingStats && (
                    <span className="text-xs text-gray-500">•</span>
                  )}
                </h2>
                <p className="text-2xl font-semibold text-white">
                  {stats.carts.toLocaleString()}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
                <ShoppingCartIcon className="w-5 h-5 text-[#00C2CB]/80" />
              </div>
            </div>

            {/* Conversions */}
            <div className="bg-[#171717] hover:bg-[#1C1C1C] transition-all duration-300 p-4 rounded-2xl shadow-md flex items-center justify-between h-24 border border-[#2A2A2A] drop-shadow-[0_0_10px_rgba(0,194,203,0.12)]">
              <div>
                <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                  Conversions{" "}
                  {loadingStats && (
                    <span className="text-xs text-gray-500">•</span>
                  )}
                </h2>
                <p className="text-2xl font-semibold text-white">
                  {stats.conversions.toLocaleString()}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
                <CurrencyDollarIcon className="w-5 h-5 text-[#00C2CB]/80" />
              </div>
            </div>
          </div>

          {isOrganic && (
            <section className="overflow-hidden rounded-[1.8rem] border border-cyan-500/30 bg-[radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.10),transparent_30%),linear-gradient(135deg,rgba(6,182,212,0.12),rgba(17,20,22,0.95)_45%)] p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex max-w-3xl items-start gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cyan-400/10">
                    <RocketLaunchIcon className="h-7 w-7 text-cyan-300" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Ready to scale this campaign?
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                      Organic traction is a good signal. If you want to push this offer harder, create a paid ad using the same approved offer and start testing extra reach.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-left lg:text-right">
                  <button
                    type="button"
                    onClick={() => promoteOfferPath && router.push(promoteOfferPath)}
                    disabled={!promoteOfferPath}
                    className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-[#031013] shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Create Your First Ad
                  </button>
                  <button
                    type="button"
                    onClick={() => organicContentPath && router.push(organicContentPath)}
                    disabled={!organicContentPath}
                    className="mt-3 flex items-center gap-1 text-sm font-medium text-cyan-300 lg:ml-auto disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    View content setup
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {isOrganic && (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-200">Quick actions</h2>
                <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                  <ShieldCheckIcon className="h-4 w-4 text-cyan-400" />
                  Organic campaign tools
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {organicQuickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.title}
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="group flex min-h-[110px] items-center gap-4 rounded-2xl border border-white/10 bg-[#111416] p-5 text-left transition hover:border-cyan-500/30 hover:bg-[#13181b] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400 text-[#041014]">
                        <Icon className="h-6 w-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-zinc-100">{action.title}</p>
                        <p className="mt-1 text-sm leading-5 text-zinc-500">{action.body}</p>
                      </div>

                      <ArrowTopRightOnSquareIcon className="h-4 w-4 text-cyan-300 transition group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Line chart */}
          <Card className={isOrganic ? "min-h-[260px] rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,rgba(15,19,24,0.98),rgba(9,12,16,0.98))] p-5" : "min-h-[260px] p-4"}>
            <CardHeader className="p-0 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Performance overview</CardTitle>
                {isOrganic && (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-zinc-300">
                    Last 7 days
                    <ChevronDownIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
            </CardHeader>
            <div className="h-full">
              <Line
                data={{
                  labels: chartSeries.labels.length
                    ? chartSeries.labels
                    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                  datasets: [
                    {
                      label: "Add to Carts",
                      data: chartSeries.carts.length
                        ? chartSeries.carts
                        : [0, 0, 0, 0, 0, 0, 0],
                      fill: true,
                      backgroundColor: (context) => {
                        const gradient = context.chart.ctx.createLinearGradient(
                          0,
                          0,
                          0,
                          200,
                        );
                        gradient.addColorStop(0, "rgba(0,194,203,0.10)");
                        gradient.addColorStop(1, "rgba(0,194,203,0)");
                        return gradient;
                      },
                      borderColor: "#009aa2",
                      borderWidth: 1.5,
                      borderDash: [3, 4],
                      tension: 0.35,
                      pointRadius: 2,
                      pointHoverRadius: 4,
                    },
                    {
                      label: "Conversions",
                      data: chartSeries.conversions.length
                        ? chartSeries.conversions
                        : [0, 0, 0, 0, 0, 0, 0],
                      fill: true,
                      backgroundColor: (context) => {
                        const gradient = context.chart.ctx.createLinearGradient(
                          0,
                          0,
                          0,
                          200,
                        );
                        gradient.addColorStop(0, "rgba(0,194,203,0.08)");
                        gradient.addColorStop(1, "rgba(0,194,203,0)");
                        return gradient;
                      },
                      borderColor: "#00787f",
                      borderWidth: 1.5,
                      tension: 0.35,
                      pointRadius: 2,
                      pointHoverRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      labels: {
                        color: "#9CA3AF",
                        font: { size: 11 },
                        boxWidth: 10,
                        usePointStyle: true,
                        pointStyle: "line",
                      },
                    },
                    tooltip: { mode: "index", intersect: false },
                  },
                  scales: {
                    x: {
                      ticks: { color: "#9CA3AF", font: { size: 10 } },
                      grid: { color: "#1E293B20" },
                    },
                    y: {
                      ticks: { color: "#9CA3AF", font: { size: 10 } },
                      grid: { color: "#1E293B20" },
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Campaign Details */}
      <div className="mx-auto mt-10 mb-6 max-w-6xl">
        <div className="w-full">
          {isOrganic ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr),minmax(320px,0.9fr)]">
              <Card className="rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,rgba(16,22,27,0.98),rgba(11,15,19,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#7ff5fb]/65">
                      Campaign details
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      Clean handoff info for this live organic campaign
                    </h3>
                  </div>
                  <div className="rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/10 p-2 text-[#7ff5fb]">
                    <CheckCircleIcon className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {campaignDetails.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-medium text-white/88">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,rgba(16,22,27,0.98),rgba(11,15,19,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#7ff5fb]/65">
                  Affiliate guide
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  How to get the most from this placement
                </h3>
                <div className="mt-6 space-y-4">
                  {organicGuideSteps.map((step, index) => (
                    <div key={step.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 text-sm font-semibold text-[#7ff5fb]">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {step.title}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-white/68">
                            {step.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition-all duration-300">
            <summary className="flex cursor-pointer select-none items-center justify-between bg-[var(--secondary)] px-5 py-3 text-xs uppercase tracking-wide text-[var(--muted-foreground)] transition-all duration-300 hover:bg-[var(--accent)] md:text-sm">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-[#00C2CB] mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                <span className="group-open:text-[#00C2CB] transition">
                  Campaign Details
                </span>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-300"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="space-y-3 bg-[var(--card)] p-4 text-xs text-[var(--foreground)] md:text-sm">
              {Object.entries(campaign)
                .filter(([key]) =>
                  [
                    "caption",
                    "type",
                    "status",
                    "platform",
                    "billing_state",
                  ].includes(key),
                )
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between border-b border-[#1C1C1C] pb-2"
                  >
                    <span className="text-gray-400 capitalize">
                      {key.replace(/_/g, " ")}:
                    </span>
                    <span className="text-[#00C2CB]">{String(value)}</span>
                  </div>
                ))}
              {campaign.type === "Email Campaign" && (
                <div
                  className="cursor-pointer text-[#00C2CB] underline mt-2"
                  onClick={() => setShowEmailModal(true)}
                >
                  Open Full Email
                </div>
              )}
            </div>
            </details>
          )}
        </div>
      </div>

      {/* Affiliate Guide */}
      {!isOrganic && (
      <div className="mx-auto mt-6 max-w-6xl">
        <div className="w-full">
          <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition-all duration-300">
            <summary className="flex cursor-pointer select-none items-center justify-between bg-[var(--secondary)] px-5 py-3 text-xs uppercase tracking-wide text-[var(--muted-foreground)] transition-all duration-300 hover:bg-[var(--accent)] md:text-sm">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-[#00C2CB] mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 6v6l4 2m6 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="group-open:text-[#00C2CB] transition">
                  Affiliate Guide
                </span>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-300"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="space-y-3 bg-[var(--card)] p-4 text-xs leading-relaxed text-[var(--muted-foreground)] md:text-sm">
              {isOrganic ? (
                <>
                  <p>
                    This is an{" "}
                    <span className="text-[#00C2CB] font-medium">
                      organic campaign
                    </span>
                    . You’ll be promoting the brand using your own social posts,
                    stories, or reels. Your{" "}
                    <span className="text-[#00C2CB]">tracking link</span>{" "}
                    automatically monitors visits, signups, and purchases
                    generated from your post.
                  </p>
                  <p>
                    Organic campaigns remain{" "}
                    <span className="text-[#00C2CB] font-medium">
                      active indefinitely
                    </span>{" "}
                    unless misuse is detected. If your tracking link is shared
                    in misleading or inappropriate ways, it will be disabled,
                    and you’ll be notified.
                  </p>
                  <p>
                    All verified conversions tracked through your link trigger
                    an automatic{" "}
                    <span className="text-[#00C2CB]">Stripe payout</span> once
                    confirmed by the business.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This is a{" "}
                    <span className="text-[#00C2CB] font-medium">
                      paid ad campaign
                    </span>{" "}
                    managed via Meta. Spend is pulled from Meta insights, while
                    conversions are shown from Nettmark tracking.
                  </p>
                  <p>
                    You can{" "}
                    <span className="text-[#00C2CB] font-medium">
                      pause or re-activate
                    </span>{" "}
                    this campaign from here to manage your cashflow. If the
                    business permanently stops the campaign, it will be locked
                    and shown as stopped inside Nettmark.
                  </p>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
      )}

      {/* Delete Campaign – affiliates can only fully delete ORGANIC campaigns here */}
      {isOrganic && (
        <div className="mx-auto mt-10 max-w-6xl rounded-[2rem] border border-red-500/25 bg-[linear-gradient(180deg,rgba(68,16,16,0.18),rgba(32,8,8,0.16))] p-6 text-left shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.22em] text-red-200/70">
            Danger zone
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Delete this organic campaign
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/68">
            Use this only if the campaign was created by mistake or should be removed entirely. This permanently deletes the live organic record tied to this placement.
          </p>
          <button
            onClick={async () => {
              const confirmDelete = window.confirm(
                `Permanently delete this organic campaign?\n\nThis action cannot be undone.`,
              );
              if (!confirmDelete) return;

              const { error: delErr } = await supabase
                .from("live_campaigns")
                .delete()
                .eq("id", campaign.id);
              if (delErr) {
                console.error("❌ Delete error:", delErr);
                alert("Error deleting campaign.");
              } else {
                alert("Campaign deleted.");
                router.replace("/affiliate/dashboard/manage-campaigns");
              }
            }}
            className="relative inline-flex items-center rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-2.5 font-medium text-red-300 transition-all duration-300 hover:border-red-500/70 hover:bg-red-500/15"
          >
            <TrashIcon className="w-5 h-5 mr-2 text-red-400 group-hover:text-red-300 transition" />
            Delete Campaign
            <span className="absolute inset-0 rounded-xl bg-red-500/10 opacity-0 group-hover:opacity-100 transition" />
          </button>
          <p className="text-xs text-gray-500 mt-3">
            This will permanently remove all data linked to this organic
            campaign.
          </p>
        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50"
          onClick={() => setShowEmailModal(false)}
        >
          <div
            className="bg-[#1A1A1A] w-[90%] max-w-2xl max-h-[80vh] overflow-y-auto p-6 rounded-xl border border-[#00C2CB55]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#00C2CB]">
                Email Preview
              </h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-400 hover:text-white inline-flex items-center justify-center"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="text-gray-300 whitespace-pre-line">
              {campaign.caption}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
