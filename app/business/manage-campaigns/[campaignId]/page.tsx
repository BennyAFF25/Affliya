"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "utils/supabase/pages-client";
import { isTrackedLandingVisit } from "../../../../utils/tracking/visitMetrics";
import CampaignDetailWorkspace from "../../../../components/campaigns/CampaignDetailWorkspace";

type Campaign = {
  id: string;
  type: string | null;
  offer_id: string | null;
  business_email: string | null;
  affiliate_email: string | null;
  media_url: string | null;
  caption: string | null;
  platform: string | null;
  created_from: string | null;
  status: string | null;
  created_at: string | null;
  // Meta paid ads (live_ads) specific
  ad_idea_id?: string | null;
  spend?: number | null;
  spend_transferred?: number | null;
  clicks?: number | null;
  conversions?: number | null;
  tracking_link?: string | null;
  campaign_type?: string | null;
  // Indicates whether this came from live_campaigns (organic) or live_ads (meta)
  meta_source?: "organic" | "meta";
  meta_campaign_id?: string | null;
  billing_state?: string | null;
  billing_paused_at?: string | null;
  terminated_by_business_at?: string | null;
};

type CampaignStats = {
  pageViews: number;
  addToCarts: number;
  conversions: number;
  revenue: number;
};

type CampaignSeries = {
  labels: string[];
  pageViews: number[];
  addToCarts: number[];
  conversions: number[];
};

export default function BusinessCampaignDetailPage() {
  const params = useParams();
  const session = useSession();
  const user = session?.user;

  const campaignId = params?.campaignId as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [series, setSeries] = useState<CampaignSeries>({
    labels: [],
    pageViews: [],
    addToCarts: [],
    conversions: [],
  });
  // ✅ Currency shown for Meta spend (should match Meta account currency, usually AUD)
  const [metaCurrency, setMetaCurrency] = useState<string>("AUD");
  const [syncingSpend, setSyncingSpend] = useState(false);
  const [syncSpendMsg, setSyncSpendMsg] = useState<string | null>(null);
  const [offerInfo, setOfferInfo] = useState<{title?: string; commission?: number} | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.email || !campaignId) return;

    const fetchCampaign = async () => {
      setLoading(true);

      console.log("✅ CAMPAIGN ID FROM ROUTE:", campaignId);

      // 1) Try to load as a Meta paid ad from live_ads
      const { data: metaRow, error: metaError } = await (supabase as any)
        .from("live_ads")
        .select(
          `
          id,
          offer_id,
          ad_idea_id,
          business_email,
          affiliate_email,
          caption,
          status,
          spend,
          spend_transferred,
          clicks,
          conversions,
          tracking_link,
          campaign_type,
          created_from,
          created_at,
          billing_state,
          billing_paused_at,
          terminated_by_business_at,
          ad_ideas (
            file_url,
            caption
          )
        `,
        )
        .eq("id", campaignId)
        .eq("business_email", user.email as string)
        .single();

      if (metaRow && !metaError) {
        console.log("✅ META CAMPAIGN DATA (live_ads):", metaRow);

        const mapped: Campaign = {
          id: metaRow.id,
          type: metaRow.campaign_type || "Meta Ad",
          offer_id: metaRow.offer_id || null,
          business_email: metaRow.business_email,
          affiliate_email: metaRow.affiliate_email,
          media_url: (metaRow as any)?.ad_ideas?.file_url || null,
          caption:
            metaRow.caption ||
            ((metaRow as any)?.ad_ideas && (metaRow as any).ad_ideas.caption) ||
            null,
          platform: "Meta",
          created_from: metaRow.created_from,
          status: metaRow.status,
          created_at: metaRow.created_at,
          ad_idea_id: metaRow.ad_idea_id,
          spend: metaRow.spend,
          spend_transferred: metaRow.spend_transferred,
          clicks: metaRow.clicks,
          conversions: metaRow.conversions,
          tracking_link: metaRow.tracking_link,
          campaign_type: metaRow.campaign_type,
          meta_source: "meta",
          billing_state: (metaRow as any).billing_state || null,
          billing_paused_at: (metaRow as any).billing_paused_at || null,
          terminated_by_business_at:
            (metaRow as any).terminated_by_business_at || null,
        };

        setCampaign(mapped);

        // ✅ Pull the latest Meta ad account currency from meta_connections
        // Supports either `ad_account_currency` or `currency` (some older rows may use `currency`).
        const { data: metaConn, error: metaConnErr } = await (supabase as any)
          .from("meta_connections")
          .select("ad_account_currency, currency, created_at")
          .eq("business_email", user.email as string)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (metaConnErr) {
          console.warn(
            "[⚠️ meta_connections currency lookup failed]",
            metaConnErr,
          );
        }

        const cur =
          (metaConn?.ad_account_currency as string | undefined) ||
          (metaConn?.currency as string | undefined) ||
          "AUD";

        setMetaCurrency(String(cur).toUpperCase());

        console.log("[💱 Meta currency]", {
          business_email: user.email,
          ad_account_currency: metaConn?.ad_account_currency,
          currency: metaConn?.currency,
          selected: String(cur).toUpperCase(),
        });

        setLoading(false);
        return;
      }

      // 2) Fallback to organic campaign from live_campaigns
      const { data, error } = await (supabase as any)
        .from("live_campaigns")
        .select(
          `
          id,
          type,
          offer_id,
          business_email,
          affiliate_email,
          media_url,
          caption,
          platform,
          created_from,
          status,
          created_at
        `,
        )
        .eq("id", campaignId)
        .eq("business_email", user.email as string)
        .single();

      if (error) {
        console.error("[❌ Failed to fetch campaign detail]", error);
        setCampaign(null);
      } else {
        const mapped: Campaign = {
          ...(data as any),
          meta_source: "organic",
        };
        setCampaign(mapped);
        console.log("[✅ Business campaign detail]", mapped);
      }

      setLoading(false);
    };

    fetchCampaign();
  }, [campaignId, user?.email]);

  // The same details header as the affiliate page uses the linked offer name.
  // This is business-scoped, read-only; no new financial or control actions.
  useEffect(() => {
    if (!campaign?.offer_id || !user?.email) {
      setOfferInfo(null);
      return;
    }
    let mounted = true;
    (supabase as any).from("offers")
      .select("title,commission")
      .eq("id", campaign.offer_id)
      .eq("business_email", user.email)
      .maybeSingle()
      .then(({ data }: { data: {title?: string; commission?: number} | null }) => {
        if (mounted) setOfferInfo(data || null);
      });
    return () => { mounted = false; };
  }, [campaign?.offer_id, user?.email]);

  // Meta figures are synced by server processes; the open detail page only
  // reads their stored values, like the affiliate detail view.
  useEffect(() => {
    if (!campaignId || !user?.email || campaign?.meta_source !== "meta") return;
    let cancelled = false;
    let inFlight = false;
    const refreshStoredMeta = async () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const { data, error } = await (supabase as any).from("live_ads")
          .select("id,spend,spend_transferred,clicks,status,billing_state,terminated_by_business_at")
          .eq("id", campaignId)
          .eq("business_email", user.email)
          .maybeSingle();
        if (!cancelled && !error && data) {
          setCampaign((previous) => previous?.id === campaignId
            ? { ...previous, ...data } : previous);
        }
      } finally { inFlight = false; }
    };
    const resume = () => { void refreshStoredMeta(); };
    const timer = window.setInterval(resume, 30_000);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [campaignId, campaign?.meta_source, user?.email]);

  const buildLast7DaysLabels = () => {
    const labels: string[] = [];
    const today = new Date();
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const base = startOfDay(today);
    for (let i = 6; i >= 0; i--) {
      const day = new Date(base);
      day.setDate(base.getDate() - i);
      labels.push(
        day.toLocaleDateString(undefined, {
          weekday: "short",
        }),
      );
    }
    return labels;
  };

  useEffect(() => {
    if (!campaignId || !user?.email || !campaign) return;

    const fetchStats = async () => {
      setStatsLoading(true);

      try {
        console.log("[📡 Fetching campaign events]", {
          campaignId,
          source: campaign?.meta_source,
        });

        // 🔑 Single source of truth: stats are always per campaign_id.
        const resp = await (supabase as any)
          .from("campaign_tracking_events")
          .select(
            "id, event_type, amount, created_at, offer_id, affiliate_id, campaign_id, user_agent",
          )
          .eq("campaign_id", campaignId);

        const rows: any[] = resp.data || [];
        const error: any = resp.error;

        console.log("[📡 Events raw rows]", rows);
        console.log("[📡 Fetched events]", {
          campaignId,
          source: campaign?.meta_source,
          count: rows.length,
        });

        if (error) {
          console.error("[❌ Failed to fetch campaign stats]", error);
        }

        const mergedRows: {
          id: string;
          event_type: string | null;
          amount: number | null;
          created_at: string;
          offer_id: string | null;
          affiliate_id: string | null;
          campaign_id: string | null;
          user_agent?: string | null;
        }[] = rows || [];

        if (!mergedRows.length) {
          setStats({ pageViews: 0, addToCarts: 0, conversions: 0, revenue: 0 });
          setSeries({
            labels: [],
            pageViews: [],
            addToCarts: [],
            conversions: [],
          });
          setStatsLoading(false);
          return;
        }

        // 3) Aggregate totals
        let pageViews = 0;
        let addToCarts = 0;
        let conversions = 0;
        let revenue = 0;

        for (const evt of mergedRows) {
          const t = (evt.event_type || "").toLowerCase();
          // Pre-v2 'click' is a page load, not a Meta click.
          // Only ordinary browser visits appear in this *unverified* metric.
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
            if (typeof evt.amount === "number") {
              revenue += Number(evt.amount);
            }
          }
        }

        setStats({ pageViews, addToCarts, conversions, revenue });

        // 4) Build simple last-7-days series for chart from the same rows
        const labels = buildLast7DaysLabels();
        const pv = Array(labels.length).fill(0);
        const carts = Array(labels.length).fill(0);
        const conv = Array(labels.length).fill(0);

        const startOfDay = (d: Date) =>
          new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const today = startOfDay(new Date());

        for (const row of mergedRows) {
          const d = new Date(row.created_at);
          const rowDay = startOfDay(d);
          const diffDays = Math.round(
            (rowDay.getTime() - today.getTime()) / 86400000,
          );
          const idx = Math.min(6, Math.max(0, 6 + diffDays));

          const t = (row.event_type || "").toLowerCase();
          if (isTrackedLandingVisit(row)) {
            pv[idx] += 1;
          } else if (
            t === "add_to_cart" ||
            t === "cart" ||
            t === "cart_updated"
          ) {
            carts[idx] += 1;
          } else if (
            t === "conversion" ||
            t === "purchase" ||
            t === "order" ||
            t === "checkout_completed"
          ) {
            conv[idx] += 1;
          }
        }

        setSeries({
          labels,
          pageViews: pv,
          addToCarts: carts,
          conversions: conv,
        });
      } catch (err) {
        console.error("[❌ Error while building campaign stats]", err);
        setStats(null);
        setSeries({
          labels: [],
          pageViews: [],
          addToCarts: [],
          conversions: [],
        });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [campaignId, user?.email, campaign?.meta_source]);

  const handleSyncSpend = async () => {
    if (!campaign || campaign.meta_source !== "meta") return;

    try {
      setSyncingSpend(true);
      setSyncSpendMsg(null);

      console.log("[🔄 Sync Spend] Requesting Meta insights for live ad", {
        liveAdId: campaign.id,
        offerId: campaign.offer_id,
      });

      const res = await fetch("/api/meta/ad-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveAdId: campaign.id }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        console.error("[❌ Sync Spend] ad-insights failed", json);
        setSyncSpendMsg("Failed to sync spend. Check console logs.");
        return;
      }

      // Re-fetch from live_ads so we always reflect the DB source of truth
      const { data: refreshed, error: refreshErr } = await (supabase as any)
        .from("live_ads")
        .select("spend, clicks")
        .eq("id", campaign.id)
        .single();

      if (refreshErr) {
        console.error(
          "[❌ Sync Spend] Failed to re-fetch live_ads row",
          refreshErr,
        );
        setSyncSpendMsg("Spend synced, but failed to refresh UI.");
        return;
      }

      const nextSpend = Number(refreshed?.spend || 0);
      const nextClicks = Number(refreshed?.clicks || 0);

      console.log("[✅ Sync Spend] Updated values", {
        spend: nextSpend,
        clicks: nextClicks,
      });

      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              spend: nextSpend,
              clicks: nextClicks,
            }
          : prev,
      );

      setSyncSpendMsg("Spend updated from Meta insights.");
    } catch (err) {
      console.error("[❌ Sync Spend] Unhandled error", err);
      setSyncSpendMsg("Failed to sync spend. Check console logs.");
    } finally {
      setSyncingSpend(false);
    }
  };

  // Derived pause state: respects status, billing_state, and billing_paused_at
  const isBusinessStopped =
    campaign?.billing_state === "TERMINATED_BY_BUSINESS" ||
    !!campaign?.terminated_by_business_at;

  const isPaused =
    isBusinessStopped ||
    (campaign?.status || "").toUpperCase() === "PAUSED" ||
    (campaign as any)?.billing_state === "PAUSED" ||
    !!(campaign as any)?.billing_paused_at;

  const handleToggleStatus = async () => {
    if (!campaign) return;

    const isCurrentlyLive = !isPaused;
    if (isBusinessStopped) return;

    // Shared warning when pausing a live campaign
    if (isCurrentlyLive) {
      const confirmed = window.confirm(
        [
          "Pausing this campaign will temporarily disable its tracking link.",
          "Your affiliate will be notified and this may impact campaign performance and affiliate retention.",
          "",
          "Only pause if there is a real issue (offer updates, stock problems, compliance, or tracking errors).",
          "",
          "Do you still want to pause this campaign?",
        ].join("\n"),
      );
      if (!confirmed) return;
    }

    try {
      setUpdating(true);

      if (campaign.meta_source === "meta") {
        // Meta paid ads: control via backend route which talks to Meta + updates live_ads
        const action = isCurrentlyLive ? "PAUSE" : "RESUME";

        const res = await fetch("/api/meta/control-ad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liveAdId: campaign.id,
            action,
            actor: "business",
          }),
        });

        const json = await res.json();

        if (!res.ok || !json?.success) {
          console.error("[❌ Failed Meta control]", json);
          return;
        }

        const newStatus = json.newStatus as string;
        setCampaign((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                billing_state:
                  (json.billing_state as string | undefined) ??
                  prev.billing_state,
                terminated_by_business_at:
                  (json.terminated_by_business_at as
                    | string
                    | null
                    | undefined) ?? prev.terminated_by_business_at,
              }
            : prev,
        );
      } else {
        // Organic campaigns: still toggle status directly in live_campaigns
        const newStatus = isCurrentlyLive ? "PAUSED" : "ACTIVE";

        if (!isCurrentlyLive) return;

        const { error } = await (supabase as any)
          .from("live_campaigns")
          .update({ status: newStatus })
          .eq("id", campaign.id);

        if (error) throw error;

        setCampaign((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }
    } catch (err) {
      console.error("[❌ Failed to update campaign status]", err);
    } finally {
      setUpdating(false);
    }
  };

  const businessCanPause = !isBusinessStopped &&
    !isPaused &&
    ["live", "active"].includes(String(campaign?.status || "").toLowerCase());

  const campaignTitle = offerInfo?.title
    || String(campaign?.caption || "").split("\n")[0].trim()
    || (campaign?.meta_source === "meta" ? "Meta ad campaign" : "Organic campaign");

  if (!session) {
    return <div className="business-campaign-detail-theme min-h-screen bg-[var(--background)] px-4 py-8 text-slate-300">Sign in to view this campaign.</div>;
  }
  if (loading || !campaign) {
    return (
      <div className="business-campaign-detail-theme min-h-screen bg-[var(--background)] px-4 py-8 text-slate-200">
        <div role={loading ? "status" : "alert"} className="mx-auto max-w-5xl rounded-[22px] border border-white/[0.09] bg-[#151718] p-5 text-sm">
          {loading ? "Loading campaign…" : "Campaign not found for this business."}
        </div>
      </div>
    );
  }

  const businessDisplay = {
    id: campaign.id,
    type: campaign.type || undefined,
    status: campaign.status || undefined,
    platform: campaign.platform || undefined,
    caption: campaign.caption,
    media_url: campaign.media_url,
    offer_id: campaign.offer_id,
    created_at: campaign.created_at || undefined,
    tracking_link: campaign.tracking_link,
    billing_state: campaign.billing_state,
    spend: campaign.spend,
    spend_transferred: campaign.spend_transferred,
    clicks: campaign.clicks,
  };

  return (
    <div className="business-campaign-detail-theme">
      <CampaignDetailWorkspace
        audience="business"
        campaign={businessDisplay}
        title={campaignTitle}
        offer={offerInfo}
        isOrganic={campaign.meta_source === "organic"}
        isPaused={isPaused}
        stoppedByBusiness={isBusinessStopped}
        canControlMeta={false}
        stats={{ clicks: stats?.pageViews || 0, carts: stats?.addToCarts || 0, conversions: stats?.conversions || 0 }}
        trend={{ labels: series.labels, carts: series.addToCarts, conversions: series.conversions }}
        businessRevenue={stats?.revenue || 0}
        businessAffiliate={campaign.affiliate_email}
        businessCanPause={businessCanPause}
        businessPauseLoading={updating}
        businessSyncMessage={syncSpendMsg}
        onBusinessPause={() => { void handleToggleStatus(); }}
        pendingPayout={0}
        loadingStats={statsLoading}
        trackingUrl={campaign.tracking_link || ""}
        affiliateReady={true}
        copied={copied}
        money={(amount) => amount.toLocaleString("en-AU", { style: "currency", currency: metaCurrency })}
        syncingSpend={syncingSpend}
        controllingMeta={false}
        onCopy={() => {
          if (!campaign.tracking_link) return;
          void navigator.clipboard.writeText(campaign.tracking_link).then(() => setCopied(true));
        }}
        onSyncSpend={() => { void handleSyncSpend(); }}
        onMetaControl={() => {}}
        onDeleteOrganic={() => {}}
        showEmailModal={emailModalOpen}
        onEmailModalChange={setEmailModalOpen}
      />
    </div>
  );
}
