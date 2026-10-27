"use client";

import { useSession } from "@supabase/auth-helpers-react";
import { useCallback, useEffect, useState } from "react";
import { supabase as browserClient } from "utils/supabase/pages-client";
import type { SupabaseClient } from "@supabase/supabase-js";
// The checked-in Database type contains only the sample users table.
const supabase = browserClient as unknown as SupabaseClient;
import ManageCampaignsWorkspace from "../../../components/business/ManageCampaignsWorkspace";

const ManageCampaignsBusiness = () => {
  const session = useSession();
  const user = session?.user;

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [shopPlacements, setShopPlacements] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [metaCurrency, setMetaCurrency] = useState<string>("AUD");
  const [syncingById, setSyncingById] = useState<Record<string, boolean>>({});

  const fetchCampaigns = useCallback(async () => {
    if (!user?.email) return;
    setLoadingCampaigns(true);
    setLoadError(null);

    const [{ data: organic, error: organicError }, { data: metaAds, error: metaError }] = await Promise.all([
      supabase
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
      .eq("business_email", user.email as string)
      .order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(8000)),
      supabase
      .from("live_ads")
      .select(
        `
        id,
        ad_idea_id,
        business_email,
        affiliate_email,
        caption,
        status,
        billing_state,
        terminated_by_business_at,
        spend,
        clicks,
        conversions,
        tracking_link,
        campaign_type,
        created_from,
        created_at
      `,
      )
      .eq("business_email", user.email as string)
      .order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(8000)),
    ]);
    if (organicError || metaError) setLoadError("Some campaigns could not be loaded. Please refresh to try again.");
    setCampaigns([
      ...(organic || []).map(c => ({ ...c, _source: "organic" })),
      ...(metaAds || []).map(ad => ({ ...ad, _source: "meta" })),
    ]);
    setLoadingCampaigns(false);
    // Optional currency lookup and previews do not hold the campaign list open.
    void supabase.from("meta_connections").select("ad_account_currency")
      .eq("business_email", user.email).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        const currency = data?.ad_account_currency;
        setMetaCurrency(typeof currency === "string" ? currency.toUpperCase() : "AUD");
      });

    // Separate optional creative lookup: a broken relation or an old proposal
    // must never hide the real paid Meta campaign from the management list.
    const proposalIds = (metaAds || [])
      .map((ad: any) => ad.ad_idea_id)
      .filter(Boolean);
    const creativeById = new Map<string, { headline?: string; file_url?: string; caption?: string }>();
    if (proposalIds.length) {
      const { data: proposalCreatives, error: proposalError } = await supabase
        .from("ad_ideas")
        .select("id,headline,file_url,caption")
        .in("id", proposalIds);
      if (proposalError) console.warn("[manage-campaigns] preview lookup failed", proposalError);
      for (const idea of proposalCreatives || []) creativeById.set(idea.id, idea);
    }

    const merged = [
      ...(organic || []).map((c: any) => ({ ...c, _source: "organic" })),
      ...(metaAds || []).map((a: any) => ({
        ...a,
        _source: "meta",
        ad_ideas: creativeById.get(a.ad_idea_id) || null,
      })),
    ];
    if (organicError || metaError) {
      setLoadError("Some campaigns could not be loaded. Please refresh to try again.");
    }
    setCampaigns(merged);
    setLoadingCampaigns(false);
  }, [user?.email]);

  const fetchShopPlacements = useCallback(async () => {
    if (!user?.email) return;

    const { data: approvals, error: approvalsError } = await supabase
      .from("affiliate_shop_requests")
      .select("affiliate_email")
      .eq("business_email", user.email as string)
      .eq("status", "approved");

    if (approvalsError || !approvals?.length) {
      if (approvalsError) {
        console.error(
          "[shop placements] approvals fetch failed",
          approvalsError.message,
        );
      }
      setShopPlacements([]);
      return;
    }

    const affiliateEmails = Array.from(
      new Set(approvals.map((row) => row.affiliate_email).filter(Boolean)),
    );
    if (affiliateEmails.length === 0) {
      setShopPlacements([]);
      return;
    }

    const { data: profilesRows } = await supabase
      .from("profiles")
      .select("email, username, avatar_url")
      .in("email", affiliateEmails);

    const profileMap = new Map(
      (profilesRows || []).map((row) => [row.email, row]),
    );

    const { data: approvedOffersRows } = await supabase
      .from("affiliate_requests")
      .select("affiliate_email")
      .eq("business_email", user.email as string)
      .eq("status", "approved")
      .in("affiliate_email", affiliateEmails);

    const offerCount: Record<string, number> = {};
    (approvedOffersRows || []).forEach((row) => {
      if (!row?.affiliate_email) return;
      offerCount[row.affiliate_email] =
        (offerCount[row.affiliate_email] || 0) + 1;
    });

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: hitsRows } = await supabase
      .from("shop_hits")
      .select("affiliate_email, views, clicks, event_date")
      .in("affiliate_email", affiliateEmails)
      .gte("event_date", dayAgo);

    const metrics: Record<string, { views: number; clicks: number }> = {};
    (hitsRows || []).forEach((hit) => {
      if (!hit?.affiliate_email) return;
      if (!metrics[hit.affiliate_email]) {
        metrics[hit.affiliate_email] = { views: 0, clicks: 0 };
      }
      metrics[hit.affiliate_email].views += hit.views || 0;
      metrics[hit.affiliate_email].clicks += hit.clicks || 0;
    });

    const placements = affiliateEmails.map((email) => {
      const profile = profileMap.get(email);
      const rawHandle = profile?.username?.trim() || "";
      const handleSlug = rawHandle ? rawHandle.toLowerCase() : null;
      return {
        affiliate_email: email,
        handle: handleSlug,
        displayHandle: rawHandle || "Nettmark affiliate",
        avatar_url: profile?.avatar_url || null,
        offers: offerCount[email] || 0,
        views24h: metrics[email]?.views || 0,
        clicks24h: metrics[email]?.clicks || 0,
      };
    });

    setShopPlacements(placements);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchCampaigns();
    fetchShopPlacements();
  }, [user, fetchCampaigns, fetchShopPlacements]);

  // Business totals follow the server's periodic Meta Insights sync.
  // Background browser refreshes only read stored rows: no wallet deductions,
  // Stripe transfers, ad state changes, or extra Meta API calls.
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    let inFlight = false;
    const refreshRecordedMetaTotals = async () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const { data, error } = await supabase
          .from("live_ads")
          .select("id,spend,clicks,conversions,status,spend_transferred,billing_state")
          .eq("business_email", user.email);
        if (error) throw error;
        if (!cancelled && data) {
          const currentById = new Map(data.map((row) => [row.id, row]));
          setCampaigns((existing) => existing.map((item) =>
            item._source === "meta" && currentById.has(item.id)
              ? { ...item, ...currentById.get(item.id) }
              : item,
          ));
        }
      } catch (error) {
        console.warn("[business/manage-campaigns] recorded Meta totals refresh failed", error);
      } finally {
        inFlight = false;
      }
    };
    const onResume = () => { void refreshRecordedMetaTotals(); };
    const interval = window.setInterval(onResume, 30_000);
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [user?.email]);

  console.log("[📢 useEffect Completed]");

  const handleSyncSpend = async (liveAdId: string) => {
    try {
      setSyncingById((prev) => ({ ...prev, [liveAdId]: true }));

      console.log("[🔄 Sync Spend] calling /api/meta/ad-insights", {
        liveAdId,
      });
      const res = await fetch("/api/meta/ad-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveAdId }),
      });

      const json = await res.json().catch(() => null);
      console.log("[🔄 Sync Spend] response", { ok: res.ok, json });

      if (!res.ok || (json && (json as any).error)) {
        alert("Failed to sync spend. Check terminal logs.");
        return;
      }

      // Re-fetch so the updated spend shows immediately in the list
      await fetchCampaigns();
    } catch (err) {
      console.error("[❌ Sync Spend failed]", err);
      alert("Failed to sync spend. Check terminal logs.");
    } finally {
      setSyncingById((prev) => ({ ...prev, [liveAdId]: false }));
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const isCurrentlyActive =
      (currentStatus || "").toUpperCase() === "ACTIVE" ||
      (currentStatus || "").toUpperCase() === "LIVE";
    if (!isCurrentlyActive) return;
    const newStatus = "PAUSED";

    const campaign = campaigns.find((c) => c.id === id);
    const source = campaign?._source === "meta" ? "live_ads" : "live_campaigns";

    const { error } = await (supabase as any)
      .from(source)
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      console.error("[❌ Failed to update campaign status]", error);
    } else {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
      );
    }
  };

  // 🔴 Permanent stop for paid Meta campaigns (business-only control)
  const handlePermanentStop = async (id: string) => {
    const campaign = campaigns.find((c) => c.id === id);

    // Only applies to paid Meta campaigns stored in live_ads
    if (!campaign || campaign._source !== "meta") return;

    const confirmed = window.confirm(
      "Permanently stop this ad campaign?\n\nThis will pause delivery in Meta Ads Manager and mark it as STOPPED in Nettmark. It cannot be reactivated from here.",
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/meta/control-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveAdId: id,
          action: "PAUSE",
          actor: "business",
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        console.error(
          "[❌ Failed Meta control from business manage-campaigns]",
          json,
        );
        alert("Could not stop the Meta campaign. Please try again.");
        return;
      }

      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: json?.newStatus || "STOPPED",
                billing_state: json?.billing_state || "TERMINATED_BY_BUSINESS",
                terminated_by_business_at:
                  json?.terminated_by_business_at || new Date().toISOString(),
              }
            : c,
        ),
      );
    } catch (err) {
      console.error("[❌ Error in handlePermanentStop]", err);
      alert("Something went wrong while stopping this campaign.");
    }
  };

  return (
    <ManageCampaignsWorkspace
      campaigns={campaigns}
      shopPlacements={shopPlacements}
      loading={loadingCampaigns}
      loadError={loadError}
      metaCurrency={metaCurrency}
      syncingById={syncingById}
      onRefresh={() => {
        void fetchCampaigns();
        void fetchShopPlacements();
      }}
      onSyncSpend={(id) => { void handleSyncSpend(id); }}
      onPauseOrganic={(id, status) => { void handleToggleStatus(id, status); }}
      onStopMeta={(id) => { void handlePermanentStop(id); }}
    />
  );
};

export default ManageCampaignsBusiness;
