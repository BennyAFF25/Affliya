"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/../utils/supabase/pages-client";

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
  return ["paused", "archived", "stopped", "completed", "ended", "deleted"].includes(s);
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
  const [offerNameById, setOfferNameById] = useState<Record<string, string>>({});
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

      const runLiveAdsQuery = async (selectStr: string, withSourceFilter: boolean) => {
        let q = supabase.from("live_ads").select(selectStr).eq("affiliate_email", email);
        if (withSourceFilter) q = q.eq("source", "paid_meta");
        return q.order("created_at", { ascending: false });
      };

      // Attempt 1: with ad_name + offer_id + source filter
      let currentSelect = selectWithNameFull;
      let withSource = true;

      let { data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(currentSelect, withSource);

      // If ad_name doesn't exist, drop it
      if (liveAdsErr?.message?.includes("ad_name")) {
        currentSelect = currentSelect.includes("offer_id") ? selectNoNameFull : selectNoNameNoOffer;
        ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(currentSelect, withSource));
      }

      // If offer_id doesn't exist, drop it (keep whether we include ad_name or not)
      if (liveAdsErr?.message?.includes("offer_id")) {
        const wantsName = currentSelect.includes("ad_name");
        currentSelect = wantsName ? selectWithNameNoOffer : selectNoNameNoOffer;
        ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(currentSelect, withSource));

        // After dropping offer_id, if ad_name still errors, drop it too
        if (liveAdsErr?.message?.includes("ad_name")) {
          currentSelect = selectNoNameNoOffer;
          ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(currentSelect, withSource));
        }
      }

      // If source doesn't exist, retry without source filter (keep the currentSelect)
      if (liveAdsErr?.message?.includes("source")) {
        withSource = false;
        ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(currentSelect, withSource));

        // If offer_id errors now, drop it
        if (liveAdsErr?.message?.includes("offer_id")) {
          const wantsName = currentSelect.includes("ad_name");
          currentSelect = wantsName ? selectWithNameNoOffer : selectNoNameNoOffer;
          ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(currentSelect, withSource));
        }

        // If ad_name errors now, drop it
        if (liveAdsErr?.message?.includes("ad_name")) {
          currentSelect = selectNoNameNoOffer;
          ({ data: liveAdsData, error: liveAdsErr } = await runLiveAdsQuery(currentSelect, withSource));
        }
      }

      if (liveAdsErr) throw liveAdsErr;
      setPaidMeta(((liveAdsData as LiveAdRow[]) ?? []).filter(Boolean));

      // ----------------------------
      // Organic campaigns (live_campaigns)
      // ----------------------------
      const { data: liveCampaignsData, error: liveCampaignsErr } = await supabase
        .from("live_campaigns")
        .select("id, type, offer_id, business_email, affiliate_email, media_url, caption, platform, created_from, status, created_at")
        .eq("affiliate_email", email)
        .order("created_at", { ascending: false });

      // If the table doesn't exist in this project yet, don’t kill the page.
      if (liveCampaignsErr) {
        // Only surface the error if it’s NOT a missing table scenario
        const msg = String(liveCampaignsErr.message || "");
        if (!msg.toLowerCase().includes("does not exist") && !msg.toLowerCase().includes("relation")) {
          throw liveCampaignsErr;
        }
        setOrganic([]);
      } else {
        setOrganic(((liveCampaignsData as LiveCampaignRow[]) ?? []).filter(Boolean));
      }

      // ----------------------------
      // Offer name map (for nicer headlines)
      // ----------------------------
      const offerIds = Array.from(
        new Set(
          [
            ...(((liveAdsData as LiveAdRow[]) ?? []).map((r) => (r as any)?.offer_id).filter(Boolean) as string[]),
            ...(((liveCampaignsData as LiveCampaignRow[]) ?? []).map((r) => r.offer_id).filter(Boolean) as string[]),
          ].filter(Boolean)
        )
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
          ({ data: offersData, error: offersErr } = await supabase.from("offers").select(offersSelect).in("id", offerIds));
        }
        if (offersErr?.message?.includes("name")) {
          offersSelect = "id, title";
          ({ data: offersData, error: offersErr } = await supabase.from("offers").select(offersSelect).in("id", offerIds));
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
      if (!res.ok) throw new Error(json?.error || `Spend sync failed (${res.status})`);

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
        offerLabel || r.ad_name || (r.meta_campaign_id ? `Campaign ${r.meta_campaign_id}` : `Campaign ${r.id.slice(0, 8)}`);

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

  const activeItems = useMemo(() => items.filter((i) => !isArchivedStatus(i.status)), [items]);
  const archivedItems = useMemo(() => items.filter((i) => isArchivedStatus(i.status)), [items]);

  const activeCount = activeItems.length;
  const archivedCount = archivedItems.length;

  return (
    <div className="min-h-screen bg-surface p-6 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <div className="mb-2 text-xs tracking-[0.35em] text-gray-400">CAMPAIGNS</div>
          <h1 className="text-4xl font-semibold text-[#00C2CB]">Manage campaigns</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            See every campaign you’re running, sync Meta spend, and jump into a detailed view.
            Organic posts also appear here.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Active */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C2CB]/15 text-[#00C2CB]">
                ✓
              </div>
              <div>
                <div className="text-base font-semibold">Active campaigns</div>
                <div className="text-xs text-gray-400">Campaigns currently live or delivering.</div>
              </div>
            </div>

            <div className="rounded-full bg-[#00C2CB]/15 px-3 py-1 text-sm font-semibold text-[#00C2CB]">
              {activeCount} active
            </div>
          </div>

          <div className="mt-5">
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                Loading…
              </div>
            ) : activeItems.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                No active campaigns. When you launch a campaign, it will show here.
              </div>
            ) : (
              <div className="space-y-3">
                {activeItems.map((item) => (
                  <CampaignRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    syncing={item.kind === "paid_meta" ? !!syncing[item.id] : false}
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
        </div>

        {/* Archived */}
        <div className="rounded-2xl border border-[#00C2CB]/40 bg-white/5 p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
                ▣
              </div>
              <div>
                <div className="text-base font-semibold">Archived campaigns</div>
                <div className="text-xs text-gray-400">Paused, completed, or stopped campaigns stay here.</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                {archivedCount} archived
              </div>
              <button
                type="button"
                onClick={() => setArchivedOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                aria-label={archivedOpen ? "Collapse archived" : "Expand archived"}
              >
                {archivedOpen ? "–" : "+"}
              </button>
            </div>
          </div>

          {archivedOpen && (
            <div className="mt-5">
              {loading ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                  Loading…
                </div>
              ) : archivedItems.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                  No archived campaigns yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedItems.map((item) => (
                    <CampaignRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      syncing={item.kind === "paid_meta" ? !!syncing[item.id] : false}
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
        </div>
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
      return <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">LIVE</span>;
    }
    if (status === "paused") {
      return <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">PAUSED</span>;
    }
    return <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-200">{status.toUpperCase()}</span>;
  })();

  const typePills = (() => {
    if (item.kind === "paid_meta") {
      return (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">Meta Ads</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">paid_meta</span>
          {item.billingState ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">Billing {item.billingState}</span>
          ) : null}
          {typeof item.spend === "number" ? (
            <span className="rounded-full bg-[#00C2CB]/20 px-3 py-1 text-xs font-semibold text-[#00C2CB]">
              Spend ${fmtMoney(item.spend)}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">Organic</span>
        {item.platform ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">{item.platform}</span>
        ) : null}
        {item.createdFrom ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">{item.createdFrom}</span>
        ) : null}
      </div>
    );
  })();

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-lg font-semibold">{item.title}</div>
            {statusPill}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-300">
            {typePills}
            {item.createdAt ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200">Started {shortDate(item.createdAt)}</span>
            ) : null}
          </div>

          {item.kind === "organic" && item.caption ? (
            <div className="mt-3 line-clamp-2 max-w-3xl text-sm text-gray-300">{item.caption}</div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {item.kind === "paid_meta" ? (
            <>
              <Link
                href={`/affiliate/dashboard/manage-campaigns/${item.id}`}
                className="rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                View campaign
              </Link>
              <button
                onClick={onSync}
                disabled={syncing}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
              >
                {syncing ? "Syncing…" : "Sync spend"}
              </button>
            </>
          ) : (
            <>
              {item.mediaUrl ? (
                <button
                  onClick={() => window.open(item.mediaUrl!, "_blank", "noopener,noreferrer")}
                  className="rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                >
                  Open post
                </button>
              ) : (
                <button
                  disabled
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-gray-300 opacity-60"
                >
                  No media
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}