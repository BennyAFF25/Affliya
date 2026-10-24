"use client";
import { computeOfferMetaReady, type OfferMetaRow } from "../../../../utils/offerMetaReadiness";
import React from "react";
import { withProposalTimeout } from "../../../../utils/affiliate/proposalTimeout";
import { getSpendableWalletBalance } from "../../../../utils/wallet/spendableBalance";
import { type PauseNotice } from "../../../../utils/wallet/pauseNotice";

import { PendingProposalRow, type PendingProposal } from "./PendingProposalRow";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";
import { loadAffiliateSubmissions, loadAffiliatePaidCampaigns, isAwaitingProposalReview, type AffiliateSubmission } from "@/../utils/affiliate/portalData";
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
  terminated_by_business_at?: string | null;

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
  const [rejectedProposals, setRejectedProposals] = useState<AffiliateSubmission[]>([]);
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);

  // per-row spend sync loading (paid meta only)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [offerNameById, setOfferNameById] = useState<Record<string, string>>(
    {},
  );
  const [offerTitlesLoading, setOfferTitlesLoading] = useState(true);
  const [creativeByIdeaId, setCreativeByIdeaId] = useState<Record<string, { title: string; previewUrl: string | null }>>({});

  const [availableWalletBalance, setAvailableWalletBalance] = useState<number | null>(null);
  const [pauseNotices, setPauseNotices] = useState<Record<string, PauseNotice>>({});
  const loadGeneration = useRef(0);
  async function fetchAll() {
    const generation = ++loadGeneration.current;
    const current = () => loadGeneration.current === generation;
    setLoading(true);
    setOfferTitlesLoading(true);
    setError(null);
    setPendingError(null);
    setPendingLoading(true);
    try {
      const { data: { session } } = await withProposalTimeout(supabase.auth.getSession());
      const email = session?.user.email;
      if (!email) throw new Error("No authenticated user email found.");

      void getSpendableWalletBalance(supabase, email).then(balance => { if (current()) setAvailableWalletBalance(balance); }).catch(() => { if (current()) setAvailableWalletBalance(null); });
      // Independent data sources start together. Funding enrichment never blocks
      // stored campaign/proposal display and never performs a Meta request.
      void fetch("/api/affiliate/campaign-pause-notices", { cache: "no-store", signal: AbortSignal.timeout(8000) })
        .then(r => r.ok ? r.json() : null).then(payload => { if (current()) setPauseNotices(payload?.notices || {}); }).catch(() => {});
      const enrichment = fetch("/api/affiliate/pending-paid-proposals", {
        cache: "no-store", signal: AbortSignal.timeout(8000),
      }).then(async response => response.ok ? response.json() : null).catch(() => null);
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
      const campaignResults = Promise.allSettled([paidTask, organicTask]);
      const submissionsTask = (async () => {
        try {
          // Titles and campaigns are optional enrichment, never proposal prerequisites.
          const submissions = await withProposalTimeout(loadAffiliateSubmissions(supabase, email, async () => []));
          void campaignResults.then(async campaigns => {
            const ids = [...new Set([...submissions.map(row => row.offerId), ...campaigns.flatMap(result =>
              result.status === "fulfilled" ? result.value.map(row => row.offer_id).filter((id): id is string => Boolean(id)) : [])])];
            if (!ids.length || !current()) return;
            const { data, error } = await withProposalTimeout(supabase.from("offers").select("id,title,business_email,meta_page_id,meta_ad_account_id").in("id", ids));
            if (error) throw error;
            if (!current()) return;
            const titles = Object.fromEntries(((data || []) as { id: string; title: string }[]).map(row => [row.id, row.title]));
            const metaById = Object.fromEntries(((data || []) as (OfferMetaRow & { id: string })[]).map(offer => [offer.id, computeOfferMetaReady(offer).metaReady]));
            setOfferNameById(titles);
            setPendingProposals(rows => rows.map(row => ({ ...row, offerTitle: titles[row.offerId] || row.offerTitle, metaReady: metaById[row.offerId] })));
          }).catch(() => { /* Keep stored proposals and fallback titles available. */ })
            .finally(() => { if (current()) setOfferTitlesLoading(false); });
          if (!current()) return;
          setRejectedProposals(submissions.filter(row => row.kind === "paid" && row.status === "rejected"));
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
          if (current()) { setPendingError("Your proposals could not be loaded. Please try again."); setOfferTitlesLoading(false); }
        } finally {
          if (current()) setPendingLoading(false);
        }
      })();
      const [paid, organic] = await campaignResults;
      if (!current()) return;
      if (paid.status === "rejected" || organic.status === "rejected") setError("Some campaigns could not be loaded. Try refreshing.");
      setLoading(false);
      await submissionsTask;
    } catch (error) {
      if (current()) { setOfferTitlesLoading(false); setError(error instanceof Error ? error.message : "Failed to load campaigns."); setPendingError("Your proposals could not be loaded. Please try again."); setPendingLoading(false); }
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
    if (!newProposalId || pendingLoading || pendingError || submittedRetryDone.current) return;
    if (pendingProposals.some((item) => item.id === newProposalId)) return;
    submittedRetryDone.current = true;
    const retry = window.setTimeout(() => { void fetchAll(); }, 700);
    return () => window.clearTimeout(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newProposalId, pendingLoading, pendingError, pendingProposals]);

  // The same visual campaign model is used for both roles; the affiliate
  // loader still scopes all data to the signed-in affiliate.
  const campaigns = useMemo<Campaign[]>(() => [
    ...paidMeta.map((row) => {
      const creative = row.ad_idea_id ? creativeByIdeaId[row.ad_idea_id] : null;
      const offerTitle = row.offer_id ? offerNameById[row.offer_id] : null;
      return {
        id: row.id,
        _source: "meta" as const,
        titleLoading: Boolean(row.offer_id && !offerTitle && offerTitlesLoading),
        display_title: offerTitle || creative?.title || row.caption || row.ad_name || "Meta ad campaign",
        caption: row.caption,
        status: row.status,
        created_at: row.created_at,
        campaign_type: "paid_meta",
        billing_state: row.billing_state,
        terminated_by_business_at: row.terminated_by_business_at,
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
      titleLoading: Boolean(row.offer_id && !offerNameById[row.offer_id] && offerTitlesLoading),
      display_title: (row.offer_id ? offerNameById[row.offer_id] : null)
        || (row.platform ? row.platform + " organic post" : "Organic promotion"),
      caption: row.caption,
      media_url: row.media_url,
      created_at: row.created_at,
      platform: row.platform,
      type: row.type,
      status: row.status || "live",
    })),
  ], [pauseNotices, paidMeta, organic, offerNameById, offerTitlesLoading, creativeByIdeaId]);

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
      rejectedCount={pendingLoading || pendingError ? null : rejectedProposals.length}
      archivedContent={<section aria-label="Rejected proposals" className="mb-4 space-y-3">
        <h2 className="text-sm font-semibold">Rejected proposals</h2>
        {pendingError ? <p role="alert">{pendingError} <button onClick={() => void fetchAll()} className="underline">Try again</button></p>
          : pendingLoading ? <p role="status">Loading proposals…</p>
          : rejectedProposals.length ? rejectedProposals.map(proposal => (
            <article key={proposal.id} className="rounded-2xl border border-white/10 p-4">
              <span className="rounded-full bg-red-400/10 px-2 py-1 text-[10px] font-semibold text-red-300">REJECTED</span>
              <p className="mt-2 text-xs text-slate-400">Rejected{proposal.rejectedAt ? ` ${new Date(proposal.rejectedAt).toLocaleDateString("en-AU")}` : " — Date not recorded"}</p>
              <p className="mt-3 text-sm font-semibold">{proposal.campaignName || offerNameById[proposal.offerId] || proposal.offerTitle}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-400">{proposal.rejectionReason?.trim() || 'No reason given'}</p>
            </article>
          )) : <p className="text-xs text-slate-400">No rejected proposals.</p>}
      </section>}
      pendingLoading={pendingLoading}
      pendingCount={pendingError || pendingLoading ? null : pendingProposals.length}
      unsettledSpend={totalUnpaidSpend}
      availableWalletBalance={availableWalletBalance}
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
