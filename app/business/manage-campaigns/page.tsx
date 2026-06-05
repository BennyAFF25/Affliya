"use client";

import { useSession } from "@supabase/auth-helpers-react";
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeader,
  StatCard,
} from "@/../components/ui";
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

  const statusVisual = (campaign: any) => {
    const key = (campaign?.status || "pending").toLowerCase();
    const businessStopped =
      campaign?.billing_state === "TERMINATED_BY_BUSINESS" ||
      !!campaign?.terminated_by_business_at;
    if (businessStopped || key === "stopped" || key === "stopped permanently")
      return { label: "Stopped", dot: "bg-red-500", text: "text-red-200" };
    if (key === "paused")
      return { label: "Paused", dot: "bg-amber-400", text: "text-amber-200" };
    return { label: "Active", dot: "bg-emerald-400", text: "text-emerald-200" };
  };

  const renderCampaignCard = (campaign: any) => {
    const isMeta = campaign._source === "meta";
    const status = statusVisual(campaign);
    const title =
      campaign.caption || (isMeta ? "Meta campaign" : "Organic campaign");

    return (
      <div
        key={campaign.id}
        className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="line-clamp-1 text-lg font-semibold text-[var(--foreground)]">
                {title}
              </div>
              <Badge
                variant={
                  status.label === "Active"
                    ? "success"
                    : status.label === "Paused"
                      ? "warning"
                      : "danger"
                }
                className="normal-case tracking-normal"
              >
                <span className={`mr-1.5 h-2 w-2 rounded-full ${status.dot}`} />
                {status.label}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">
                {isMeta ? "Meta Ads" : "Organic"}
              </span>
              {isMeta ? (
                <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">
                  paid_meta
                </span>
              ) : campaign.platform ? (
                <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">
                  {campaign.platform}
                </span>
              ) : null}
              {isMeta && campaign.billing_state ? (
                <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">
                  Billing {campaign.billing_state}
                </span>
              ) : null}
              {isMeta ? (
                <span className="rounded-full bg-[var(--primary)]/20 px-3 py-1 font-semibold text-[var(--primary)]">
                  Spend {formatMoney(campaign.spend || 0)}
                </span>
              ) : null}
              {campaign.created_at ? (
                <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">
                  Started {formatDate(campaign.created_at)}
                </span>
              ) : null}
              {campaign.tracking_link ? (
                <a
                  href={campaign.tracking_link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[var(--card)]/60 px-3 py-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Tracking link
                </a>
              ) : null}
            </div>

            {!isMeta && campaign.caption ? (
              <div className="mt-3 line-clamp-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
                {campaign.caption}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              href={`/business/manage-campaigns/${campaign.id}`}
              className="rounded-full"
            >
              View campaign
            </Button>
            {isMeta ? (
              <>
                <Button
                  type="button"
                  onClick={() => handleSyncSpend(campaign.id)}
                  disabled={!!syncingById[campaign.id]}
                  variant="secondary"
                  className="rounded-full"
                >
                  {syncingById[campaign.id] ? "Syncing..." : "Sync spend"}
                </Button>
                <Button
                  type="button"
                  onClick={() => handlePermanentStop(campaign.id)}
                  variant="outline"
                  className="rounded-full border-red-500/40 text-red-400 hover:bg-red-500/10"
                >
                  Stop
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() =>
                  handleToggleStatus(campaign.id, campaign.status || "")
                }
                disabled={!isActiveStatus(campaign.status)}
                variant="secondary"
                className="rounded-full disabled:cursor-not-allowed"
              >
                {isActiveStatus(campaign.status) ? "Pause" : "Paused"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="business-manage-campaigns-theme min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-6xl space-y-7 p-6">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute -top-12 right-0 h-52 w-52 rounded-full bg-[#00C2CB]/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Business Manage Campaigns
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-[var(--muted-foreground)] sm:text-base">
                Monitor every affiliate placement, sync Meta spend, and jump
                straight into campaign controls before performance drifts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                href="/business/my-business/create-offer"
                variant="secondary"
              >
                New offer
              </Button>
              <Button href="/business/dashboard">Business dashboard</Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metricCards.map((metric) => (
            <StatCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              icon={metric.icon}
              tone={metric.tone === "cyan" ? "primary" : "muted"}
            />
          ))}
        </section>

        {campaigns.length === 0 && shopPlacements.length === 0 ? (
          <EmptyState
            title="No campaign or shop activity yet"
            description="Approve affiliate requests or launch paid placements to see activity here."
            className="border-yellow-500/20 bg-yellow-500/10 text-yellow-100"
          />
        ) : (
          <>
            <Card className="p-5 md:p-6" variant="elevated">
              <SectionHeader
                title="Active campaigns"
                description="Campaigns currently delivering or awaiting settlement."
                actions={<Badge variant="primary">{activeCount} live</Badge>}
              />
              <div className="mt-5 space-y-4">
                {activeCount === 0 ? (
                  <EmptyState
                    title="No live campaigns right now"
                    description="When affiliates push new placements they will appear here automatically."
                    className="bg-black/20 py-7"
                  />
                ) : (
                  activeCampaigns.map((campaign) =>
                    renderCampaignCard(campaign),
                  )
                )}
              </div>
            </Card>

            <Card className="p-5 md:p-6" variant="elevated">
              <SectionHeader
                title="Shopfront placements"
                description="Affiliates driving traffic via NettmarkShop."
                actions={<Badge variant="muted">{shopCount} live</Badge>}
              />

              <div className="mt-5 space-y-4">
                {shopCount === 0 ? (
                  <EmptyState
                    title="No approved storefronts yet"
                    description="Once affiliates finish setup, their stats land here."
                    className="bg-black/20 py-7"
                  />
                ) : (
                  shopPlacements.map((placement) => (
                    <div
                      key={placement.affiliate_email}
                      className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-4 lg:flex-row lg:items-center lg:justify-between"
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
                      <div className="grid flex-1 grid-cols-1 gap-3 text-center text-sm text-[var(--foreground)] sm:grid-cols-3 lg:max-w-xl">
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
            </Card>

            <Card className="p-5 md:p-6" variant="elevated">
              <SectionHeader
                title="Archived campaigns"
                description="Paused or completed placements stay here for historical reference."
                actions={
                  <Button
                    type="button"
                    onClick={() => setShowArchived((prev) => !prev)}
                    variant="secondary"
                    size="icon"
                    aria-label="Toggle archived campaigns"
                  >
                    {showArchived ? "-" : "+"}
                  </Button>
                }
              />
              {showArchived && (
                <div className="mt-5 space-y-4">
                  {archivedCount === 0 ? (
                    <EmptyState
                      title="Nothing archived yet"
                      description="Stopped campaigns roll in here automatically."
                      className="bg-black/20 py-7"
                    />
                  ) : (
                    archivedCampaigns.map((campaign) =>
                      renderCampaignCard(campaign),
                    )
                  )}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

function ShopStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-semibold text-[var(--foreground)]">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        {label}
      </p>
    </div>
  );
}

export default ManageCampaignsBusiness;
