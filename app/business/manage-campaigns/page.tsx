"use client";

import Link from "next/link";
import { useSession } from "@supabase/auth-helpers-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "utils/supabase/pages-client";

const ManageCampaignsBusiness = () => {
  const session = useSession();
  const user = session?.user;

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [shopPlacements, setShopPlacements] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "paid" | "organic">(
    "all",
  );
  const [showArchived, setShowArchived] = useState(false);

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
      return {
        affiliate_email: email,
        handle: profile?.username || email?.split("@")[0] || "Unknown",
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

  const totalActive = activeCampaigns.length;
  const totalShopfronts = shopPlacements.length;
  const totalSpend = campaigns
    .filter((c) => c._source === "meta")
    .reduce((sum, c) => sum + Number((c as any).spend || 0), 0);

  const filteredActive = activeCampaigns.filter((campaign) => {
    if (activeFilter === "paid") return campaign._source === "meta";
    if (activeFilter === "organic") return campaign._source !== "meta";
    return true;
  });

  const hasData = campaigns.length > 0 || shopPlacements.length > 0;
  const heroStats = [
    {
      label: "Active campaigns",
      value: formatNumber(totalActive),
      hint: "tracking live",
    },
    {
      label: "Shopfronts live",
      value: formatNumber(totalShopfronts),
      hint: "approved storefronts",
    },
    {
      label: "Meta spend (all-time)",
      value: formatMoney(totalSpend),
      hint: "from live ads",
    },
  ];

  const formatDate = (d?: string) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString();
  };

  const renderCampaignCard = (campaign: any) => {
    const isMeta = campaign._source === "meta";
    return (
      <div className="min-h-screen bg-[#010508] text-white px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Campaigns
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold text-white">
                  Manage campaigns
                </h1>
                <p className="text-sm text-white/70">
                  Control paid + organic work in one view, including
                  NettmarkShop storefronts.
                </p>
              </div>
              <Link href="/business/my-business/create-offer">
                <button className="rounded-full bg-[#00C2CB] px-5 py-2 text-sm font-semibold text-black shadow hover:bg-[#00b0b8]">
                  Create campaign
                </button>
              </Link>
            </div>
          </header>

          {hasData ? (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#07111a] via-[#040a10] to-[#07111a] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {stat.value}
                    </p>
                    <p className="text-xs text-white/60">{stat.hint}</p>
                  </div>
                ))}
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Active campaigns</h2>
                    <p className="text-sm text-white/60">
                      Paid + organic placements currently driving traffic.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "all", label: "All" },
                      { id: "paid", label: "Paid" },
                      { id: "organic", label: "Organic" },
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() =>
                          setActiveFilter(
                            filter.id as "all" | "paid" | "organic",
                          )
                        }
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          activeFilter === filter.id
                            ? "bg-[#00C2CB] text-black"
                            : "bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredActive.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 text-sm text-white/60">
                    No campaigns in this filter yet.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredActive.map((campaign) =>
                      renderCampaignCard(campaign),
                    )}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] space-y-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Shopfront placements
                    </h2>
                    <p className="text-sm text-white/60">
                      Affiliates showing your offers on NettmarkShop.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    {shopPlacements.length} live
                  </span>
                </div>
                {shopPlacements.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 text-sm text-white/60">
                    No storefronts yet. Once affiliates are approved, their shop
                    metrics will show here.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {shopPlacements.map((placement) => (
                      <div
                        key={placement.affiliate_email}
                        className="rounded-2xl border border-white/10 bg-[#050b11] px-4 py-4 shadow-[0_15px_40px_rgba(0,0,0,0.45)]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-[#00C2CB]">
                            {(placement.handle || "-").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">
                              {placement.handle
                                ? `@${placement.handle}`
                                : placement.affiliate_email}
                            </p>
                            <p className="text-xs text-white/60">
                              {placement.affiliate_email}
                            </p>
                          </div>
                          <a
                            href={`https://www.nettmark.com/shop/${placement.handle}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#00C2CB] hover:text-white"
                          >
                            View
                          </a>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-white/70">
                          <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-white/40">
                              Views (24h)
                            </p>
                            <p className="text-base font-semibold text-white">
                              {formatNumber(placement.views24h)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-white/40">
                              Clicks (24h)
                            </p>
                            <p className="text-base font-semibold text-white">
                              {formatNumber(placement.clicks24h)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-white/40">
                              Approved offers
                            </p>
                            <p className="text-base font-semibold text-white">
                              {formatNumber(placement.offers)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.01] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] space-y-4">
                <button
                  type="button"
                  onClick={() => setShowArchived((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <h2 className="text-lg font-semibold">
                      Archived campaigns
                    </h2>
                    <p className="text-sm text-white/60">
                      Paused or stopped campaigns for reference.
                    </p>
                  </div>
                  <span className="text-2xl">{showArchived ? "-" : "+"}</span>
                </button>
                {showArchived &&
                  (archivedCampaigns.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 text-sm text-white/60">
                      Nothing archived yet.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {archivedCampaigns.map((campaign) =>
                        renderCampaignCard(campaign),
                      )}
                    </div>
                  ))}
              </section>
            </>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-white/70">
              No campaigns or storefront activity yet. Once affiliates start
              promoting your offers, this page will populate automatically.
            </div>
          )}
        </div>
      </div>
    );
  };
};

export default ManageCampaignsBusiness;
