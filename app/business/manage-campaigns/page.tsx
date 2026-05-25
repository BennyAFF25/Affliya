"use client";

import Link from "next/link";
import { useSession } from "@supabase/auth-helpers-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Sparkles,
  Activity,
  Archive,
  Store,
  Wallet,
  Megaphone,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

const ManageCampaignsBusiness = () => {
  const session = useSession();
  const user = session?.user;

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(true);
  const [shopPlacements, setShopPlacements] = useState<any[]>([]);

  const [metaCurrency, setMetaCurrency] = useState<string>("AUD");
  const [syncingById, setSyncingById] = useState<Record<string, boolean>>({});

  const formatMoney = (val: any) => {
    const n = Number(val);
    const safe = Number.isFinite(n) ? n : 0;
    try {
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: metaCurrency || "AUD",
      }).format(safe);
    } catch {
      return `A$${safe.toFixed(2)}`;
    }
  };

  const formatNumber = (val?: number) => Number(val || 0).toLocaleString();

  const fetchCampaigns = useCallback(async () => {
    if (!user?.email) return;

    // Pull currency from the latest meta connection (so UI matches the ad account)
    try {
      const { data: metaConn, error: metaConnErr } = await supabase
        .from("meta_connections")
        .select("*")
        .eq("business_email", user.email as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (metaConnErr) {
        console.warn(
          "[⚠️ meta_connections currency lookup failed]",
          metaConnErr,
        );
      } else {
        const cur =
          (metaConn as any)?.currency ||
          (metaConn as any)?.account_currency ||
          (metaConn as any)?.ad_account_currency ||
          null;
        if (cur && typeof cur === "string") {
          setMetaCurrency(cur.toUpperCase());
        } else {
          setMetaCurrency("AUD");
        }
      }
    } catch (e) {
      console.warn("[⚠️ meta_connections currency lookup threw]", e);
      setMetaCurrency("AUD");
    }

    // 1) Fetch organic campaigns
    const { data: organic, error: organicError } = await supabase
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
      .order("created_at", { ascending: false });

    if (organicError) {
      console.error(
        "[❌ Failed to fetch live_campaigns (organic)]",
        organicError,
      );
    }

    // 2) Fetch paid Meta ads
    const { data: metaAds, error: metaError } = await supabase
      .from("live_ads")
      .select(
        `
        id,
        ad_idea_id,
        business_email,
        affiliate_email,
        caption,
        status,
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
      .order("created_at", { ascending: false });

    if (metaError) {
      console.error("[❌ Failed to fetch live_ads (meta)]", metaError);
    }

    const merged = [
      ...(organic || []).map((c: any) => ({ ...c, _source: "organic" })),
      ...(metaAds || []).map((a: any) => ({ ...a, _source: "meta" })),
    ];

    setCampaigns(merged);
  }, [user]);

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
        displayHandle: rawHandle || email?.split("@")[0] || "Shop",
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
    const newStatus =
      (currentStatus || "").toUpperCase() === "ACTIVE" ? "PAUSED" : "ACTIVE";

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
      // 1) Pause at Meta level so it actually stops spending
      const res = await fetch("/api/meta/control-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveAdId: id, action: "PAUSE" }),
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

      // 2) Mark permanently stopped in Supabase so it moves to archived and cannot be restarted
      const { error } = await (supabase as any)
        .from("live_ads")
        .update({ status: "STOPPED" })
        .eq("id", id);

      if (error) {
        console.error(
          "[❌ Failed to mark Meta campaign STOPPED in Supabase]",
          error,
        );
        alert("Meta was paused, but Nettmark could not update the status.");
        return;
      }

      // 3) Update local state so UI reflects the change immediately
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "STOPPED" } : c)),
      );
    } catch (err) {
      console.error("[❌ Error in handlePermanentStop]", err);
      alert("Something went wrong while stopping this campaign.");
    }
  };

  const activeCampaigns = campaigns?.filter(
    (c) =>
      (c.status || "").toLowerCase() === "live" ||
      (c.status || "").toLowerCase() === "active",
  );

  const archivedCampaigns = campaigns?.filter(
    (c) =>
      (c.status || "").toLowerCase() !== "live" &&
      (c.status || "").toLowerCase() !== "active",
  );

  const formatDate = (d?: string) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString();
  };

  const isActiveStatus = (status?: string) => {
    const s = (status || "").toLowerCase();
    return s === "live" || s === "active";
  };

  const activeCount = activeCampaigns.length;
  const archivedCount = archivedCampaigns.length;
  const totalMetaSpend = campaigns
    .filter((c) => c._source === "meta")
    .reduce((sum, c) => sum + Number(c.spend || 0), 0);
  const organicCount = campaigns.filter((c) => c._source === "organic").length;
  const shopCount = shopPlacements.length;

  const metricCards = [
    {
      label: "Live campaigns",
      value: formatNumber(activeCount),
      tone: "cyan" as const,
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Shop placements",
      value: formatNumber(shopCount),
      tone: "cyan" as const,
      icon: <Store className="h-4 w-4" />,
    },
    {
      label: "Meta spend",
      value: formatMoney(totalMetaSpend),
      tone: "slate" as const,
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      label: "Organic posts",
      value: formatNumber(organicCount),
      tone: "slate" as const,
      icon: <Megaphone className="h-4 w-4" />,
    },
    {
      label: "Archived",
      value: formatNumber(archivedCount),
      tone: "slate" as const,
      icon: <Archive className="h-4 w-4" />,
    },
  ];

  const statusVisual = (status?: string) => {
    const key = (status || "pending").toLowerCase();
    if (key === "paused")
      return { label: "Paused", dot: "bg-amber-400", text: "text-amber-200" };
    if (key === "stopped" || key === "stopped permanently")
      return { label: "Stopped", dot: "bg-red-500", text: "text-red-200" };
    return { label: "Active", dot: "bg-emerald-400", text: "text-emerald-200" };
  };

  const renderCampaignCard = (campaign: any) => {
    const isMeta = campaign._source === "meta";
    const status = statusVisual(campaign.status);
    return (
      <div
        key={campaign.id}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div>
            <p className="text-base font-semibold text-white">
              {campaign.caption || "Untitled campaign"}
            </p>
            <p className="text-sm text-white/60">
              {campaign.affiliate_email || "Affiliate unknown"}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold ${status.text}`}
          >
            <span className={`h-2 w-2 rounded-full ${status.dot}`}></span>
            {status.label}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm text-white/80 2xl:grid-cols-4 2xl:gap-4">
          <StatCell
            label="Spend"
            value={isMeta ? formatMoney(campaign.spend || 0) : "—"}
          />
          <StatCell label="Clicks" value={formatNumber(campaign.clicks)} />
          <StatCell
            label="Conversions"
            value={formatNumber(campaign.conversions)}
          />
          <StatCell label="Started" value={formatDate(campaign.created_at)} />
        </div>

        <div className="mt-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:flex 2xl:flex-wrap">
            <Link href={`/business/manage-campaigns/${campaign.id}`}>
              <button className="w-full rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#00b0b8]">
                View campaign
              </button>
            </Link>
            {isMeta ? (
              <>
                <button
                  onClick={() => handleSyncSpend(campaign.id)}
                  disabled={!!syncingById[campaign.id]}
                  className="w-full rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
                >
                  {syncingById[campaign.id] ? "Syncing..." : "Sync spend"}
                </button>
                <button
                  onClick={() => handlePermanentStop(campaign.id)}
                  className="w-full rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
                >
                  Stop
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  handleToggleStatus(campaign.id, campaign.status || "")
                }
                className="w-full rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5"
              >
                {isActiveStatus(campaign.status) ? "Pause" : "Activate"}
              </button>
            )}
          </div>
          {campaign.tracking_link ? (
            <a
              href={campaign.tracking_link}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/60 hover:text-white 2xl:text-right"
            >
              Tracking link
            </a>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="business-manage-campaigns-theme min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-8 pt-4 sm:px-6 lg:px-6 2xl:max-w-7xl 2xl:px-0">
        <section className="relative overflow-hidden border-t border-white/10 bg-gradient-to-br from-[#061214] via-[#090d0e] to-black px-4 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:rounded-3xl sm:border">
          <div className="pointer-events-none absolute -top-12 right-0 h-52 w-52 rounded-full bg-[#00C2CB]/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Business Manage Campaigns
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted-foreground)] sm:text-base">
                Monitor every affiliate placement, sync Meta spend, and jump
                straight into campaign controls before performance drifts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/business/my-business/create-offer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                New offer
              </Link>
              <Link
                href="/business/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
              >
                Business dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-5">
          {metricCards.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        {campaigns.length === 0 && shopPlacements.length === 0 ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-center text-sm text-yellow-100">
            No campaign or shop activity yet. Approve affiliate requests or
            launch paid placements to see activity here.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Active campaigns</h2>
                  <p className="text-sm text-white/60">
                    Campaigns currently delivering or awaiting settlement.
                  </p>
                </div>
                <span className="rounded-full bg-[#00C2CB]/10 px-3 py-1 text-sm font-semibold text-[#00C2CB]">
                  {activeCount} live
                </span>
              </div>
              <div className="mt-5 space-y-4">
                {activeCount === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                    No live campaigns right now. When affiliates push new
                    placements they will appear here automatically.
                  </div>
                ) : (
                  activeCampaigns.map((campaign) =>
                    renderCampaignCard(campaign),
                  )
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    Shopfront placements
                  </h2>
                  <p className="text-sm text-white/60">
                    Affiliates driving traffic via NettmarkShop.
                  </p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-sm font-semibold text-white/70">
                  {shopCount} live
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {shopCount === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                    No approved storefronts yet. Once affiliates finish setup,
                    their stats land here.
                  </div>
                ) : (
                  shopPlacements.map((placement) => (
                    <div
                      key={placement.affiliate_email}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 2xl:flex-row 2xl:items-center 2xl:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-[#00C2CB]">
                          {(placement.displayHandle || "S")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {placement.handle
                              ? `@${placement.displayHandle}`
                              : placement.displayHandle}
                          </p>
                          <p className="text-xs text-white/60">
                            {placement.affiliate_email}
                          </p>
                        </div>
                      </div>
                      <div className="grid flex-1 grid-cols-1 gap-3 text-center text-sm text-white sm:grid-cols-3 lg:gap-4 2xl:max-w-xl">
                        <ShopStat
                          label="Views (24h)"
                          value={formatNumber(placement.views24h)}
                        />
                        <ShopStat
                          label="Clicks (24h)"
                          value={formatNumber(placement.clicks24h)}
                        />
                        <ShopStat
                          label="Approved offers"
                          value={formatNumber(placement.offers)}
                        />
                      </div>
                      {placement.handle ? (
                        <a
                          href={`https://www.nettmark.com/shop/${placement.handle}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[#00C2CB] hover:text-white"
                        >
                          View shop
                        </a>
                      ) : (
                        <span className="text-xs text-white/40">
                          Handle pending
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Archived campaigns</h2>
                  <p className="text-sm text-white/60">
                    Paused or completed placements stay here for historical
                    reference.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowArchived((prev) => !prev)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-xl text-white"
                  aria-label="Toggle archived campaigns"
                >
                  {showArchived ? "-" : "+"}
                </button>
              </div>
              {showArchived && (
                <div className="mt-5 space-y-4">
                  {archivedCount === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                      Nothing archived yet. Stopped campaigns roll in here
                      automatically.
                    </div>
                  ) : (
                    archivedCampaigns.map((campaign) =>
                      renderCampaignCard(campaign),
                    )
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "cyan" | "slate";
  icon: ReactNode;
}) {
  const toneClass =
    tone === "cyan"
      ? "border-[#00C2CB]/30 bg-[#00C2CB]/10 text-[#7ff5fb]"
      : "border-white/15 bg-white/5 text-white/80";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between text-xs text-white/55">
        <span>{label}</span>
        <div className={`rounded-lg border px-2 py-1 ${toneClass}`}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs uppercase tracking-wide text-white/45">{label}</p>
    </div>
  );
}

function ShopStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
        {label}
      </p>
    </div>
  );
}

export default ManageCampaignsBusiness;
