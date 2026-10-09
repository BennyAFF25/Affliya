"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";
import { loadAffiliateSubmissions, loadAffiliatePaidCampaigns, isAwaitingProposalReview, isArchivedCampaignStatus, type SubmissionKind } from "@/../utils/affiliate/portalData";
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

type PendingProposal = {
  id: string;
  offerId: string;
  offerTitle: string;
  kind: SubmissionKind;
  businessViewedAt?: string | null;
  title?: string;
  campaignName?: string | null;
  objective?: string | null;
  createdAt?: string | null;
  state: "waiting_for_business" | "funding_required" | "funded_waiting_for_business" | "funding_unavailable";
  growthReady: boolean;
  funding: {
    ready: boolean;
    requiredAmount: number;
    deficit: number;
  } | null;
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
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);

  // per-row spend sync loading (paid meta only)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [offerNameById, setOfferNameById] = useState<Record<string, string>>(
    {},
  );
  const [archivedOpen, setArchivedOpen] = useState(true);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    setPendingError(null);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const email = userRes.user?.email;
      if (!email) {
        setPaidMeta([]);
        setOrganic([]);
        setPendingProposals([]);
        setError("No authenticated user email found.");
        return;
      }

      try {
        const [submissions, enrichment] = await Promise.all([
          loadAffiliateSubmissions(supabase,email),
          fetch("/api/affiliate/pending-paid-proposals",{cache:"no-store",signal:AbortSignal.timeout(8000)}).then(async res=>res.ok?await res.json():null).catch(()=>null)
        ]);
        const fundingById = new Map<string, PendingProposal>((enrichment?.success?enrichment.proposals || []:[]).map((row:PendingProposal)=>[row.id,row]));
        setPendingProposals(submissions.filter(row=>isAwaitingProposalReview(row.status)).map(row=>({
          id:row.id,offerId:row.offerId,offerTitle:row.offerTitle,createdAt:row.createdAt,state:"funding_unavailable" as const,growthReady:false,funding:null,
          ...(row.kind==="paid"?fundingById.get(row.id):{}),kind:row.kind,businessViewedAt:row.businessViewedAt,title:row.title
        })));

      } catch (pendingError) {
        console.warn("[affiliate/manage-campaigns] pending proposals unavailable", pendingError);
        setPendingError("Your proposals could not be loaded. Please try again.");
      }

      // ----------------------------
      // Paid Meta campaigns (live_ads)
      // ----------------------------
      const liveAdsData = await loadAffiliatePaidCampaigns(supabase,email) as unknown as LiveAdRow[];
      setPaidMeta(liveAdsData);

      // ----------------------------
      // Organic campaigns (live_campaigns)
      // ----------------------------
      let organicCampaignRows: LiveCampaignRow[] = [];

      try {
        const liveCampaignRes = await fetch("/api/affiliate/live-campaigns", {
          cache: "no-store",
        });
        const liveCampaignJson = await liveCampaignRes.json().catch(() => null);

        if (!liveCampaignRes.ok || !liveCampaignJson?.ok) {
          throw new Error(liveCampaignJson?.error || "Failed to load live campaigns");
        }
        organicCampaignRows = (((liveCampaignJson.campaigns || []) as LiveCampaignRow[]) ?? []).filter(Boolean);
        setOrganic(organicCampaignRows);
      } catch (liveCampaignsErr: any) {
        const msg = String(liveCampaignsErr?.message || "");
        if (
          !msg.toLowerCase().includes("does not exist") &&
          !msg.toLowerCase().includes("relation")
        ) {
          throw liveCampaignsErr;
        }
        setOrganic([]);
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
            ...(organicCampaignRows
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
    () => items.filter((i) => !isArchivedCampaignStatus(i.status)),
    [items],
  );
  const archivedItems = useMemo(
    () => items.filter((i) => isArchivedCampaignStatus(i.status)),
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
  const pendingCount = pendingProposals.length;

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

        <section className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Pending proposals" value={pendingError ? "—" : pendingCount.toString()} icon={<Megaphone className="h-4 w-4" />} tone="primary" />
          <StatCard label="Live campaigns" value={error ? "—" : activeCount.toString()} icon={<Activity className="h-4 w-4" />} tone="primary" />
          <StatCard label="Archived" value={error ? "—" : archivedCount.toString()} icon={<Archive className="h-4 w-4" />} tone="muted" />
          <StatCard label="Total paid spend" value={`$${fmtMoney(totalPaidSpend)}`} icon={<Wallet className="h-4 w-4" />} tone="primary" />
          <StatCard label="Unsettled spend" value={`$${fmtMoney(totalUnpaidSpend)}`} icon={<Wallet className="h-4 w-4" />} tone="muted" />
          <StatCard label="Organic campaigns" value={organicCount.toString()} icon={<Megaphone className="h-4 w-4" />} tone="muted" />
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {pendingError && <div role="alert" className="mb-4 rounded-2xl border border-amber-400/20 p-4 text-sm"><p>{pendingError}</p><button onClick={() => void fetchAll()} className="mt-2 text-[var(--primary)]">Try again</button></div>}
        {/* Pending proposals */}
        <Card className="mb-6 p-5 md:p-6" variant="elevated">
          <SectionHeader
            title="Pending proposals"
            description="Real campaigns you've submitted that have not launched yet."
            actions={<Badge variant="primary">{pendingCount} pending</Badge>}
          />
          <div className="mt-5">
            {loading ? (
              <LoadingSkeleton lines={2} />
            ) : pendingError ? (<p className="py-5 text-sm text-[var(--muted-foreground)]">Proposals unavailable. Please try again above.</p>) : pendingProposals.length === 0 ? (
              <EmptyState
                title="No pending proposals"
                description="Submit a paid or organic proposal from an offer to send it for business review."
                className="py-7"
              />
            ) : (
              <div className="space-y-3">
                {pendingProposals.map((proposal) => (
                  <PendingProposalRow key={proposal.kind + ":" + proposal.id} proposal={proposal} />
                ))}
              </div>
            )}
          </div>
        </Card>

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
            ) : error ? (<p className="py-5 text-sm text-[var(--muted-foreground)]">Campaigns could not be loaded.</p>) : activeItems.length === 0 ? (
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
              ) : error ? (<p className="py-5 text-sm text-[var(--muted-foreground)]">Campaigns could not be loaded.</p>) : archivedItems.length === 0 ? (
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

function PendingProposalRow({ proposal }: { proposal: PendingProposal }) {
  const fundingRequired = proposal.state === "funding_required";
  const funded = proposal.state === "funded_waiting_for_business";
  const title = proposal.campaignName || proposal.title || proposal.offerTitle;

  const statusLabel = proposal.kind === "organic" ? proposal.businessViewedAt ? "VIEWED" : "PENDING REVIEW" : proposal.state === "funding_unavailable" ? "FUNDING NOT CHECKED" : fundingRequired
    ? "FUNDING REQUIRED"
    : funded
      ? "FUNDED"
      : "WAITING FOR BUSINESS";

  const description = proposal.kind === "organic" ? "Organic proposal sent for business review. No ad funding is required." : proposal.state === "funding_unavailable" ? "Proposal saved. Funding could not be checked; it will be verified before launch." : fundingRequired
    ? `The business has enabled paid promotion. Add $${(proposal.funding?.deficit || 0).toFixed(2)} to prepare this campaign for launch.`
    : funded
      ? "Campaign funding is ready. Waiting for the business to finish setup and approve the campaign."
      : "Proposal sent. No deposit is required while the business decides whether to enable paid promotion.";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-lg font-semibold">{title}</div>
            <Badge variant={fundingRequired ? "warning" : funded ? "success" : "muted"}>
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
            <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">
              {proposal.offerTitle}
            </span>
            <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">
              {proposal.funding ? `Required at launch: ${proposal.funding.requiredAmount.toFixed(2)}` : "Funding not checked"}
            </span>
            {proposal.createdAt ? (
              <span className="rounded-full bg-[var(--card)]/60 px-3 py-1">
                Submitted {shortDate(proposal.createdAt)}
              </span>
            ) : null}
          </div>
        </div>
        {fundingRequired ? (
          <Button href="/affiliate/wallet" className="rounded-full">
            Top up wallet
          </Button>
        ) : null}
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
