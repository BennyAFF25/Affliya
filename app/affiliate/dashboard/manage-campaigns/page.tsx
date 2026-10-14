"use client";
import React from "react";
import { type PauseNotice } from "../../../../utils/wallet/pauseNotice";

import { formatMoney } from "../../../../utils/currency";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";
import { loadAffiliateSubmissions, loadAffiliatePaidCampaigns, isAwaitingProposalReview, type SubmissionKind } from "@/../utils/affiliate/portalData";
import { Badge, Button } from "@/../components/ui";
import ManageCampaignsWorkspace, { type Campaign } from "../../../../components/business/ManageCampaignsWorkspace";

type LiveAdRow = {
  id: string;
  offer_id?: string | null;
  ad_name?: string | null;
  ad_idea_id?: string | null;
  caption?: string | null;
  clicks?: number | null;
  conversions?: number | null;
  tracking_link?: string | null;
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
  state: "loading" | "waiting_for_business" | "funding_required" | "funded_waiting_for_business" | "funding_unavailable" | "timing_update_required" | "meta_cleanup_required";
  timingMessage?: string | null;
  growthReady: boolean;
  funding: {
    ready: boolean;
    requiredAmount: number;
    deficit: number;
  } | null;
};

export default function AffiliateManageCampaignsPage() {
  const [newProposalId, setNewProposalId] = useState("");
  const submittedRetryDone = useRef(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("submitted") || "";
    if (/^[0-9a-f-]{36}$/i.test(id)) setNewProposalId(id);
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paidMeta, setPaidMeta] = useState<LiveAdRow[]>([]);
  const [organic, setOrganic] = useState<LiveCampaignRow[]>([]);
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);

  // per-row spend sync loading (paid meta only)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [offerNameById, setOfferNameById] = useState<Record<string, string>>(
    {},
  );
  const [creativeByIdeaId, setCreativeByIdeaId] = useState<Record<string, { title: string; previewUrl: string | null }>>({});

  const [pauseNotices, setPauseNotices] = useState<Record<string, PauseNotice>>({});
  const loadGeneration = useRef(0);
  async function fetchAll() {
    const generation = ++loadGeneration.current;
    const current = () => loadGeneration.current === generation;
    setLoading(true);
    setError(null);
    setPendingError(null);
    setPendingLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user.email;
      if (!email) throw new Error("No authenticated user email found.");

      // Independent data sources start together. Funding enrichment never blocks
      // stored campaign/proposal display and never performs a Meta request.
      void fetch("/api/affiliate/campaign-pause-notices", { cache: "no-store", signal: AbortSignal.timeout(8000) })
        .then(r => r.ok ? r.json() : null).then(payload => { if (current()) setPauseNotices(payload?.notices || {}); }).catch(() => {});
      const enrichment = fetch("/api/affiliate/pending-paid-proposals", {
        cache: "no-store", signal: AbortSignal.timeout(8000),
      }).then(async response => response.ok ? response.json() : null).catch(() => null);
      const submissionsTask = (async () => {
        try {
          const submissions = await loadAffiliateSubmissions(supabase, email);
          if (!current()) return;
          setCreativeByIdeaId(Object.fromEntries(submissions.filter(item => item.kind === "paid")
            .map(item => [item.id, { title: item.title, previewUrl: item.previewUrl }])));
          setPendingProposals(submissions.filter(row => isAwaitingProposalReview(row.status)).map(row => ({
            id: row.id, offerId: row.offerId, offerTitle: row.offerTitle, createdAt: row.createdAt,
            state: "loading" as const, growthReady: false, funding: null,
            kind: row.kind, businessViewedAt: row.businessViewedAt, title: row.title,
          })));
          void enrichment.then(payload => {
            if (!current()) return;
            const byId = new Map<string, PendingProposal>((payload?.proposals || []).map((row: PendingProposal) => [row.id, row]));
            setPendingProposals(rows => rows.map(row => row.kind === "paid" ? { ...row, state: "funding_unavailable", ...byId.get(row.id) } : row));
          });
        } catch {
          if (current()) setPendingError("Your proposals could not be loaded. Please try again.");
        } finally {
          if (current()) setPendingLoading(false);
        }
      })();
      const paidTask = loadAffiliatePaidCampaigns(supabase, email).then(rows => {
        if (current()) { setPaidMeta(rows as LiveAdRow[]); if (rows.length) setLoading(false); }
        return rows as LiveAdRow[];
      });
      const organicTask = fetch("/api/affiliate/live-campaigns", { cache: "no-store", signal: AbortSignal.timeout(8000) })
        .then(async response => {
          const payload = await response.json();
          if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load organic campaigns.");
          const rows = (payload.campaigns || []) as LiveCampaignRow[];
          if (current()) { setOrganic(rows); if (rows.length) setLoading(false); }
          return rows;
        });
      const [paid, organic] = await Promise.allSettled([paidTask, organicTask]);
      if (!current()) return;
      if (paid.status === "rejected" || organic.status === "rejected") setError("Some campaigns could not be loaded. Try refreshing.");
      setLoading(false);
      const ids = [...new Set([
        ...(paid.status === "fulfilled" ? paid.value : []),
        ...(organic.status === "fulfilled" ? organic.value : []),
      ].map(row => row.offer_id).filter((id): id is string => Boolean(id)))];
      if (ids.length) {
        const { data } = await supabase.from("offers").select("id,title").in("id", ids);
        if (current()) setOfferNameById(Object.fromEntries(((data || []) as { id: string; title: string }[]).map(row => [row.id, row.title])));
      } else setOfferNameById({});
      await submissionsTask;
    } catch (error) {
      if (current()) { setError(error instanceof Error ? error.message : "Failed to load campaigns."); setPendingLoading(false); }
    } finally {
      if (current()) setLoading(false);
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
    void fetchAll();
    return () => { loadGeneration.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep campaign spend and wallet settlement checkpoints current without
  // asking affiliates to run Meta Insights themselves. Reads Supabase only.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const refreshRecordedMetaTotals = async () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const { data: auth } = await supabase.auth.getUser();
        const email = auth.user?.email;
        if (!email || cancelled) return;
        const rows = await loadAffiliatePaidCampaigns(supabase, email) as LiveAdRow[];
        if (!cancelled) setPaidMeta(rows);
      } catch (refreshError) {
        // Keep last successfully loaded totals; never display a fake zero.
        console.warn("[affiliate/manage-campaigns] cached Meta totals refresh failed", refreshError);
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
  }, []);

  useEffect(() => {
    // Auth refresh / read-after-write visibility can race the redirect.
    // Refresh once when the newly created proposal is not yet in the list.
    if (!newProposalId || loading || submittedRetryDone.current) return;
    if (pendingProposals.some((item) => item.id === newProposalId)) return;
    submittedRetryDone.current = true;
    const retry = window.setTimeout(() => { void fetchAll(); }, 700);
    return () => window.clearTimeout(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newProposalId, loading, pendingProposals]);

  // The same visual campaign model is used for both roles; the affiliate
  // loader still scopes all data to the signed-in affiliate.
  const campaigns = useMemo<Campaign[]>(() => [
    ...paidMeta.map((row) => {
      const creative = row.ad_idea_id ? creativeByIdeaId[row.ad_idea_id] : null;
      const offerTitle = row.offer_id ? offerNameById[row.offer_id] : null;
      return {
        id: row.id,
        _source: "meta" as const,
        display_title: creative?.title || offerTitle || row.caption || row.ad_name || "Meta ad campaign",
        caption: row.caption,
        status: row.status,
        created_at: row.created_at,
        campaign_type: "paid_meta",
        billing_state: row.billing_state,
        pauseNotice: pauseNotices[row.id],
        spend: row.spend,
        clicks: row.clicks,
        conversions: row.conversions,
        tracking_link: row.tracking_link,
        ad_ideas: creative ? { headline: creative.title, file_url: creative.previewUrl } : null,
      };
    }),
    ...organic.map((row) => ({
      id: row.id,
      _source: "organic" as const,
      display_title: (row.offer_id ? offerNameById[row.offer_id] : null)
        || (row.platform ? row.platform + " organic post" : "Organic promotion"),
      caption: row.caption,
      media_url: row.media_url,
      created_at: row.created_at,
      platform: row.platform,
      type: row.type,
      status: row.status || "live",
    })),
  ], [pauseNotices, paidMeta, organic, offerNameById, creativeByIdeaId]);

  const totalUnpaidSpend = paidMeta.reduce((sum, row) =>
    sum + Math.max(0, Number(row.spend || 0) - Number(row.spend_transferred || 0)), 0);

  return (
    <ManageCampaignsWorkspace
      audience="affiliate"
      campaigns={campaigns}
      loading={loading}
      loadError={error}
      metaCurrency="AUD"
      syncingById={syncing}
      onRefresh={() => { void fetchAll(); }}
      onSyncSpend={(id) => {
        const row = paidMeta.find((item) => item.id === id);
        if (row) void syncSpendForPaidMeta(row);
      }}
      pendingCount={pendingError || pendingLoading ? null : pendingProposals.length}
      unsettledSpend={totalUnpaidSpend}
      notice={newProposalId ? (
        <div role="status" className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-3 text-xs text-emerald-100">
          <strong>Proposal submitted successfully.</strong> The business can now review it. No wallet funds have been reserved.
          <span className="ml-2 opacity-70">Reference: {newProposalId.slice(0, 8)}</span>
        </div>
      ) : null}
      pendingContent={pendingError ? (
        <div role="alert" className="px-2 py-3 text-sm text-amber-200">
          {pendingError}
          <button type="button" onClick={() => { void fetchAll(); }} className="ml-3 font-semibold text-[#63e8ee] underline">Try again</button>
        </div>
      ) : pendingLoading ? (
        <p role="status" className="p-3 text-xs text-[var(--muted-foreground)]">Loading proposals…</p>
      ) : pendingProposals.length ? (
        pendingProposals.map((proposal) => (
          <PendingProposalRow key={proposal.kind + ":" + proposal.id} proposal={proposal} />
        ))
      ) : (
        <p className="py-3 text-xs text-[var(--muted-foreground)]">
          No proposals awaiting review. New submissions will appear here.
        </p>
      )}
    />
  );
}

function PendingProposalRow({ proposal }: { proposal: PendingProposal }) {
  const fundingRequired = proposal.state === "funding_required";
  const funded = proposal.state === "funded_waiting_for_business";
  const timingUpdate = proposal.state === "timing_update_required";
  const metaCleanup = proposal.state === "meta_cleanup_required";
  const title = proposal.campaignName || proposal.title || proposal.offerTitle;

  const statusLabel = proposal.kind === "organic" ? proposal.businessViewedAt ? "VIEWED" : "PENDING REVIEW" : proposal.state === "loading" ? "CHECKING STATUS…" : metaCleanup ? "META RECOVERY NEEDED" : timingUpdate ? "SCHEDULE UPDATE NEEDED" : proposal.state === "funding_unavailable" ? "FUNDING NOT CHECKED" : fundingRequired
    ? "FUNDING REQUIRED"
    : funded
      ? "FUNDED"
      : "WAITING FOR BUSINESS";

  const description = proposal.kind === "organic" ? "Organic proposal sent for business review. No ad funding is required." : proposal.state === "loading" ? "Proposal saved. Checking campaign readiness…" : metaCleanup
    ? "This proposal has a saved Meta campaign from an earlier launch attempt. The brand needs to check that attempt and recover any incomplete setup in Nettmark before trying again. You do not need to resubmit or add funds to fix this. Contact the brand through your Nettmark inbox if it remains unresolved."
    : timingUpdate
      ? "The proposed campaign start or end date needs updating. The business can reschedule this proposal without changing your approved budget or creative."
    : proposal.state === "funding_unavailable" ? "Proposal saved. Funding could not be checked; it will be verified before launch." : fundingRequired
    ? `The business has enabled paid promotion. Add ${formatMoney(proposal.funding?.deficit || 0)} to prepare this campaign for launch.`
    : funded
      ? "Campaign funding is ready. Waiting for the business to finish setup and approve the campaign."
      : "Proposal sent. No deposit is required while the business decides whether to enable paid promotion.";

  return (
    <div className="rounded-[17px] border border-white/[0.08] bg-[#101415] p-3.5 sm:p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 truncate text-[13px] font-semibold text-white">{title}</div>
            <Badge variant={fundingRequired || timingUpdate || metaCleanup ? "warning" : funded ? "success" : "muted"}>
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--muted-foreground)]">
            {description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--muted-foreground)]">
            <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              {proposal.offerTitle}
            </span>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              {proposal.funding ? `Required at launch: ${formatMoney(proposal.funding.requiredAmount)}` : "Funding not checked"}
            </span>
            {proposal.createdAt ? (
              <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
                Submitted {new Date(proposal.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            ) : null}
          </div>
        </div>
        <Button href={`/affiliate/dashboard/reviews/${proposal.kind}/${proposal.id}`} variant="outline" className="min-h-10 shrink-0 rounded-xl text-xs">View proposal</Button>
        {fundingRequired ? (
          <Button href="/affiliate/wallet" className="min-h-10 shrink-0 rounded-xl text-xs">
            Top up wallet
          </Button>
        ) : null}
      </div>
    </div>
  );
}

