"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";
import { Badge, Button, Card, EmptyState, LoadingSkeleton, SectionHeader, StatCard } from "@/../components/ui";
import {
  Sparkles,
  ArrowRight,
  Activity,
  Archive,
  Wallet,
  Megaphone,
} from "lucide-react";

type LiveAdRow = {
  id: string;
  offer_id?: string | null;
  ad_name?: string | null;
  status?: string | null;
  billing_state?: string | null;

  // Meta identifiers
  meta_ad_id?: string | null;
  meta_campaign_id?: string | null;

  // Billing truth
  spend?: number | null;
  spend_transferred?: number | null;

  created_at?: string | null;
};

type LiveCampaignRow = {
  id: string;
  type?: string | null;
  offer_id?: string | null;
  business_email?: string | null;
  affiliate_email?: string | null;
  media_url?: string | null;
  caption?: string | null;
  platform?: string | null;
  created_from?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type CampaignItem =
  | {
      kind: "paid_meta";
      id: string;
      title: string;
      status: string;
      billingState?: string;
      createdAt?: string | null;
      spend?: number;
      unpaid?: number;
      metaAdId?: string | null;
      metaCampaignId?: string | null;
    }
  | {
      kind: "organic";
      id: string;
      title: string;
      status: string;
      createdAt?: string | null;
      platform?: string | null;
      caption?: string | null;
      mediaUrl?: string | null;
      createdFrom?: string | null;
    };

function normalizeStatus(s?: string | null) {
  return (s || "unknown").toLowerCase();
}

function isArchivedStatus(status: string) {
  const s = normalizeStatus(status);
  return [
    "paused",
    "archived",
    "stopped",
    "completed",
    "ended",
    "deleted",
  ].includes(s);
}

function fmtMoney(n?: number) {
  const v = Number(n ?? 0) || 0;
  return v.toFixed(2);
}

function shortDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

export default function AffiliateManageCampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paidMeta, setPaidMeta] = useState<LiveAdRow[]>([]);
  const [organic, setOrganic] = useState<LiveCampaignRow[]>([]);

  // per-row spend sync loading (paid meta only)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [offerNameById, setOfferNameById] = useState<Record<string, string>>(
    {},
  );
  const [archivedOpen, setArchivedOpen] = useState(true);

  async function fetchAll() {
    setLoading(true);
    setError(null);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const email = userRes.user?.email;
      if (!email) {
        setPaidMeta([]);
        setOrganic([]);
        setError("No authenticated user email found.");
        return;
      }

      // ----------------------------
      // Paid Meta campaigns (live_ads)
      // ----------------------------
      // NOTE: Your schema differs across environments (some don’t have `ad_name` or `source`).
      // We do a safe query with fallbacks so we don’t break what already works.
      const selectWithNameFull =
        "id, offer_id, ad_name, status, billing_state, meta_ad_id, meta_campaign_id, spend, spend_transferred, created_at";
      const selectNoNameFull =
        "id, offer_id, status, billing_state, meta_ad_id, meta_campaign_id, spend, spend_transferred, created_at";

      const selectWithNameNoOffer =
        "id, ad_name, status, billing_state, meta_ad_id, meta_campaign_id, spend, spend_transferred, created_at";
      const selectNoNameNoOffer =
        "id, status, billing_state, meta_ad_id, meta_campaign_id, spend, spend_transferred, created_at";

      const runLiveAdsQuery = async (
        selectStr: string,
        withSourceFilter: boolean,
      ) => {
        let q = supabase
          .from("live_ads")
          .select(selectStr)
          .eq("affiliate_email", email);
        if (withSourceFilter) q = q.eq("source", "paid_meta");
        return q.order("created_at", { ascending: false });
      };

      // Attempt 1: with ad_name + offer_id + source filter
      let currentSelect = selectWithNameFull;
      let withSource = true;

      let { data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(
        currentSelect,
        withSource,
      );

      // If ad_name doesn't exist, drop it
      if (liveAdsErr?.message?.includes("ad_name")) {
        currentSelect = currentSelect.includes("offer_id")
          ? selectNoNameFull
          : selectNoNameNoOffer;
        ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(
          currentSelect,
          withSource,
        ));
      }

      // If offer_id doesn't exist, drop it (keep whether we include ad_name or not)
      if (liveAdsErr?.message?.includes("offer_id")) {
        const wantsName = currentSelect.includes("ad_name");
        currentSelect = wantsName ? selectWithNameNoOffer : selectNoNameNoOffer;
        ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(
          currentSelect,
          withSource,
        ));

        // After dropping offer_id, if ad_name still errors, drop it too
        if (liveAdsErr?.message?.includes("ad_name")) {
          currentSelect = selectNoNameNoOffer;
          ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(
            currentSelect,
            withSource,
          ));
        }
      }

      // If source doesn't exist, retry without source filter (keep the currentSelect)
      if (liveAdsErr?.message?.includes("source")) {
        withSource = false;
        ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(
          currentSelect,
          withSource,
        ));

        // If offer_id errors now, drop it
        if (liveAdsErr?.message?.includes("offer_id")) {
          const wantsName = currentSelect.includes("ad_name");
          currentSelect = wantsName
            ? selectWithNameNoOffer
            : selectNoNameNoOffer;
          ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(
            currentSelect,
            withSource,
          ));
        }

        // If ad_name errors now, drop it
        if (liveAdsErr?.message?.includes("ad_name")) {
          currentSelect = selectNoNameNoOffer;
          ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(
            currentSelect,
            withSource,
          ));
        }
      }

      if (liveAdsErr) throw liveAdsErr;
      setPaidMeta(((liveAdsData as LiveAdRow[]) ?? []).filter(Boolean));

      // ----------------------------
      // Organic campaigns (live_campaigns)
      // ----------------------------
      const { data: liveCampaignsData, error: liveCampaignsErr } =
        await supabase
          .from("live_campaigns")
          .select(
            "id, type, offer_id, business_email, affiliate_email, media_url, caption, platform, created_from, status, created_at",
          )
          .eq("affiliate_email", email)
          .order("created_at", { ascending: false });

      // If the table doesn't exist in this project yet, don’t kill the page.
      if (liveCampaignsErr) {
        // Only surface the error if it’s NOT a missing table scenario
        const msg = String(liveCampaignsErr.message || "");
        if (
          !msg.toLowerCase().includes("does not exist") &&
          !msg.toLowerCase().includes("relation")
        ) {
          throw liveCampaignsErr;
        }
        setOrganic([]);
      } else {
        setOrganic(
          ((liveCampaignsData as LiveCampaignRow[]) ?? []).filter(Boolean),
        );
      }

      // ----------------------------
      // Offer name map (for nicer headlines)
      // ----------------------------
      const offerIds = Array.from(
        new Set(
          [
            ...(((liveAdsData as LiveAdRow[]) ?? [])
              .map((r) => (r as any)?.offer_id)
              .filter(Boolean) as string[]),
            ...(((liveCampaignsData as LiveCampaignRow[]) ?? [])
              .map((r) => r.offer_id)
              .filter(Boolean) as string[]),
          ].filter(Boolean),
        ),
      );

      if (offerIds.length === 0) {
        setOfferNameById({});
      } else {
        // Try common columns: title/name (schema may vary)
        let offersSelect = "id, title, name";
        let { data: offersData, error: offersErr } = await supabase
          .from("offers")
          .select(offersSelect)
          .in("id", offerIds);

        if (offersErr?.message?.includes("title")) {
          offersSelect = "id, name";
          ({ data: offersData, error: offersErr } = await supabase
            .from("offers")
            .select(offersSelect)
            .in("id", offerIds));
        }
        if (offersErr?.message?.includes("name")) {
          offersSelect = "id, title";
          ({ data: offersData, error: offersErr } = await supabase
            .from("offers")
            .select(offersSelect)
            .in("id", offerIds));
        }

        if (!offersErr && offersData) {
          const map: Record<string, string> = {};
          for (const o of offersData as any[]) {
            const label = (o?.title || o?.name || "").toString().trim();
            if (o?.id && label) map[o.id] = label;
          }
          setOfferNameById(map);
        } else {
          // Don’t break the page if offer lookup fails
          setOfferNameById({});
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load campaigns.");
      setPaidMeta([]);
      setOrganic([]);
    } finally {
      setLoading(false);
    }
  }

  async function syncSpendForPaidMeta(row: LiveAdRow) {
    setSyncing((prev) => ({ ...prev, [row.id]: true }));
    setError(null);

    try {
      const res = await fetch("/api/meta/ad-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveAdId: row.id,
          metaAdId: row.meta_ad_id,
          metaCampaignId: row.meta_campaign_id,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(json?.error || `Spend sync failed (${res.status})`);

      // critical: refetch so list updates
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? "Spend sync failed.");
    } finally {
      setSyncing((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: CampaignItem[] = useMemo(() => {
    const paid: CampaignItem[] = paidMeta.map((r) => {
      const spend = Number(r.spend ?? 0) || 0;
      const transferred = Number(r.spend_transferred ?? 0) || 0;
      const unpaid = Math.max(0, spend - transferred);

      const offerLabel = r.offer_id ? offerNameById[r.offer_id] : undefined;
      const title =
        offerLabel ||
        r.ad_name ||
        (r.meta_campaign_id
          ? `Campaign ${r.meta_campaign_id}`
          : `Campaign ${r.id.slice(0, 8)}`);

      return {
        kind: "paid_meta",
        id: r.id,
        title,
        status: r.status || "unknown",
        billingState: r.billing_state || "unknown",
        createdAt: r.created_at,
        spend,
        unpaid,
        metaAdId: r.meta_ad_id,
        metaCampaignId: r.meta_campaign_id,
      };
    });

    const org: CampaignItem[] = organic.map((r) => {
      const offerLabel = r.offer_id ? offerNameById[r.offer_id] : undefined;
      const platform = (r.platform || "").trim();
      const fallback = platform ? `${platform} Organic Post` : "Organic Post";
      const title = offerLabel || fallback;
      return {
        kind: "organic",
        id: r.id,
        title,
        status: r.status || "live",
        createdAt: r.created_at,
        platform: r.platform,
        caption: r.caption,
        mediaUrl: r.media_url,
        createdFrom: r.created_from,
      };
    });

    // Newest first across both types
    const combined = [...paid, ...org];
    combined.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    return combined;
  }, [paidMeta, organic, offerNameById]);

  const activeItems = useMemo(
    () => items.filter((i) => !isArchivedStatus(i.status)),
    [items],
  );
  const archivedItems = useMemo(
    () => items.filter((i) => isArchivedStatus(i.status)),
    [items],
  );

  const activeCount = activeItems.length;
  const archivedCount = archivedItems.length;
  const totalPaidSpend = paidMeta.reduce(
    (sum, r) => sum + (Number(r.spend ?? 0) || 0),
    0,
  );
  const totalUnpaidSpend = paidMeta.reduce((sum, r) => {
    const spend = Number(r.spend ?? 0) || 0;
    const transferred = Number(r.spend_transferred ?? 0) || 0;
    return sum + Math.max(0, spend - transferred);
  }, 0);
  const organicCount = organic.length;

  return (
    <div className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-6xl">
        <section className="relative mb-7 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[var(--primary)]/25 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Affiliate Manage Campaigns
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-[var(--muted-foreground)] sm:text-base">
                Track every campaign in one place, sync Meta spend, and jump
                straight into the actions that matter.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button href="/affiliate/marketplace" variant="secondary">
                Promote offer <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/affiliate/dashboard">
                Dashboard overview
              </Button>
            </div>
          </div>
        </section>

        <section className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Live campaigns" value={activeCount.toString()} icon={<Activity className="h-4 w-4" />} tone="primary" />
          <StatCard label="Archived" value={archivedCount.toString()} icon={<Archive className="h-4 w-4" />} tone="muted" />
          <StatCard label="Total paid spend" value={`$${fmtMoney(totalPaidSpend)}`} icon={<Wallet className="h-4 w-4" />} tone="primary" />
          <StatCard label="Unsettled spend" value={`$${fmtMoney(totalUnpaidSpend)}`} icon={<Wallet className="h-4 w-4" />} tone="muted" />
          <StatCard label="Organic campaigns" value={organicCount.toString()} icon={<Megaphone className="h-4 w-4" />} tone="muted" />
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Active */}
        <Card className="mb-6 p-5 md:p-6" variant="elevated">
          <SectionHeader
            title="Active campaigns"
            description="Campaigns currently live or delivering."
            actions={<Badge variant="primary">{activeCount} active</Badge>}
          />

          <div>
            {loading ? (
              <LoadingSkeleton lines={3} />
            ) : activeItems.length === 0 ? (
              <EmptyState
                title="No active campaigns"
                description="When you launch a campaign, it will show here."
                className="py-7"
              />
            ) : (
              <div className="space-y-3">
                {activeItems.map((item) => (
                  <CampaignRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    syncing={
                      item.kind === "paid_meta" ? !!syncing[item.id] : false
                    }
                    onSync={() => {
                      if (item.kind !== "paid_meta") return;
                      const row = paidMeta.find((r) => r.id === item.id);
                      if (row) syncSpendForPaidMeta(row);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Archived */}
        <Card className="p-5 md:p-6" variant="elevated">
          <SectionHeader
            title="Archived campaigns"
            description="Paused, completed, or stopped campaigns stay here."
            actions={(
              <>
                <Badge variant="muted">{archivedCount} archived</Badge>
                <Button
                  type="button"
                  onClick={() => setArchivedOpen((v) => !v)}
                  variant="secondary"
                  size="icon"
                  aria-label={archivedOpen ? "Collapse archived" : "Expand archived"}
                >
                  {archivedOpen ? "–" : "+"}
                </Button>
              </>
            )}
          />

          {archivedOpen && (
            <div className="mt-5">
              {loading ? (
                <LoadingSkeleton lines={3} />
              ) : archivedItems.length === 0 ? (
                <EmptyState
                  title="No archived campaigns yet"
                  description="Paused, completed, or stopped campaigns will stay here."
                  className="py-7"
                />
              ) : (
                <div className="space-y-3">
                  {archivedItems.map((item) => (
                    <CampaignRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      syncing={
                        item.kind === "paid_meta" ? !!syncing[item.id] : false
                      }
                      onSync={() => {
                        if (item.kind !== "paid_meta") return;
                        const row = paidMeta.find((r) => r.id === item.id);
                        if (row) syncSpendForPaidMeta(row);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function CampaignRow({
  item,
  syncing,
  onSync,
}: {
  item: CampaignItem;
  syncing: boolean;
  onSync: () => void;
}) {
  const status = normalizeStatus(item.status);

  const statusPill = (() => {
    if (status === "active" || status === "live") {
      return <Badge variant="success">LIVE</Badge>;
    }
    if (status === "paused") {
      return <Badge variant="warning">PAUSED</Badge>;
    }
    return <Badge variant="muted">{status.toUpperCase()}</Badge>;
  })();

  const typePills = (() => {
    if (item.kind === "paid_meta") {
      return (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--card)]/60 px-3 py-1 text-xs text-[var(--muted-foreground)]">
            Meta Ads
          </span>
          <span className="rounded-full bg-[var(--card)]/60 px-3 py-1 text-xs text-[var(--muted-foreground)]">
            paid_meta
          </span>
          {item.billingState ? (
            <span className="rounded-full bg-[var(--card)]/60 px-3 py-1 text-xs text-[var(--muted-foreground)]">
              Billing {item.billingState}
            </span>
          ) : null}
          {typeof item.spend === "number" ? (
            <span className="rounded-full bg-[var(--primary)]/20 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
              Spend ${fmtMoney(item.spend)}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--card)]/60 px-3 py-1 text-xs text-[var(--muted-foreground)]">
          Organic
        </span>
        {item.platform ? (
          <span className="rounded-full bg-[var(--card)]/60 px-3 py-1 text-xs text-[var(--muted-foreground)]">
            {item.platform}
          </span>
        ) : null}
        {item.createdFrom ? (
          <span className="rounded-full bg-[var(--card)]/60 px-3 py-1 text-xs text-[var(--muted-foreground)]">
            {item.createdFrom}
          </span>
        ) : null}
      </div>
    );
  })();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-lg font-semibold">{item.title}</div>
            {statusPill}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
            {typePills}
            {item.createdAt ? (
              <span className="rounded-full bg-[var(--card)]/60 px-3 py-1 text-xs text-[var(--muted-foreground)]">
                Started {shortDate(item.createdAt)}
              </span>
            ) : null}
          </div>

          {item.kind === "organic" && item.caption ? (
            <div className="mt-3 line-clamp-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
              {item.caption}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {item.kind === "paid_meta" ? (
            <>
              <Button href={`/affiliate/dashboard/manage-campaigns/${item.id}`} className="rounded-full">
                View campaign
              </Button>
              <Button
                type="button"
                onClick={onSync}
                disabled={syncing}
                variant="secondary"
                className="rounded-full"
              >
                {syncing ? "Syncing…" : "Sync spend"}
              </Button>
            </>
          ) : (
            <Button href={`/affiliate/dashboard/manage-campaigns/${item.id}`} className="rounded-full">
              Open post
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
