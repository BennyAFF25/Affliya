"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { formatMoney as formatCurrencyAmount } from "../../../../../utils/currency";
import { isTrackedLandingVisit } from "../../../../../utils/tracking/visitMetrics";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/../utils/supabase/pages-client";
import type { PostgrestError } from "@supabase/supabase-js";
import CampaignDetailWorkspace from "./CampaignDetailWorkspace";

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

  const formatMoney = useCallback((value: number) => formatCurrencyAmount(value, metaCurrency || "AUD"), [metaCurrency]);
  async function loadMetaCurrencyForBusiness(businessEmail?: string | null) {
    if (!businessEmail) return;

    const { data, error: connErr } = await supabase
      .from("meta_connections")
      .select("ad_account_currency, created_at")
      .eq("business_email", businessEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connErr) {
      console.warn("[⚠️ meta currency lookup failed]", connErr);
      return;
    }

    const cur = (data as { ad_account_currency?: string | null } | null)?.ad_account_currency;
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
          "id, event_type, amount, created_at, offer_id, affiliate_id, campaign_id, user_agent",
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

        // Previously emitted 'click' events were page-load telemetry.
        // Exclude obvious crawlers and never call these Meta ad clicks.
        if (isTrackedLandingVisit(evt)) {
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

  // Refresh the *stored* Meta totals while this page is open.
  // Never POST to Meta or invoke ad-spend settlement from a browser poll:
  // the scheduled server sync owns those operations.
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    let inFlight = false;
    const refreshRecordedSpend = async () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const { data, error: readError } = await supabase
          .from("live_ads")
          .select("id,spend,clicks,spend_transferred,status,billing_state")
          .eq("id", campaignId)
          .maybeSingle();
        if (!cancelled && !readError && data) {
          setCampaign((previous) =>
            previous?.id === campaignId
              ? { ...previous, ...data, spend: Number(data.spend ?? 0) }
              : previous,
          );
        }
      } catch (readError) {
        console.warn("[affiliate/campaign] Meta totals refresh failed", readError);
      } finally {
        inFlight = false;
      }
    };
    const refreshWhenVisible = () => { void refreshRecordedSpend(); };
    const timer = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [campaignId]);

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

  async function handleCopyTrackingLink() {
    if (!trackingUrl) return;
    await navigator.clipboard.writeText(trackingUrl);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  async function handleDeleteOrganic() {
    if (!campaign || !isOrganic) return;
    if (!window.confirm("Permanently delete this organic campaign? This cannot be undone.")) return;
    const { error: deleteError } = await supabase
      .from("live_campaigns")
      .delete()
      .eq("id", campaign.id);
    if (deleteError) {
      console.error("[affiliate/campaign] Delete failed", deleteError);
      alert("The organic campaign could not be deleted.");
      return;
    }
    router.replace("/affiliate/dashboard/manage-campaigns");
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-4 text-slate-100 sm:p-6">
        <div role="alert" className="mx-auto max-w-[1000px] rounded-[22px] border border-red-400/20 bg-[#151718] p-5 text-sm text-red-200">
          This campaign could not be loaded. {error.message}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-4 text-slate-100 sm:p-6">
        <div role="status" className="mx-auto max-w-[1000px] animate-pulse rounded-[22px] border border-white/[0.09] bg-[#151718] p-6 text-sm text-[#94a3b8]">
          Loading campaign details…
        </div>
      </div>
    );
  }

  return (
    <CampaignDetailWorkspace
      campaign={campaign}
      title={campaignTitle}
      offer={offer}
      isOrganic={isOrganic}
      isPaused={isPaused}
      stoppedByBusiness={isTerminatedByBusiness}
      canControlMeta={canAffiliateControlMeta}
      stats={stats}
      trend={chartSeries}
      pendingPayout={pendingPayout}
      loadingStats={loadingStats}
      trackingUrl={trackingUrl}
      affiliateReady={!!affiliateId}
      copied={copyState === "copied"}
      money={formatMoney}
      syncingSpend={syncingSpend}
      controllingMeta={metaControlLoading}
      onCopy={() => { void handleCopyTrackingLink(); }}
      onSyncSpend={() => { void handleSyncSpend(); }}
      onMetaControl={(action) => { void handleMetaControl(action); }}
      onDeleteOrganic={() => { void handleDeleteOrganic(); }}
      showEmailModal={showEmailModal}
      onEmailModalChange={setShowEmailModal}
    />
  );
}
