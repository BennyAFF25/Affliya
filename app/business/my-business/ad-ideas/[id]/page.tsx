"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import { BusinessSubscriptionActivationModal } from "@/components/business/BusinessSubscriptionActivationModal";
import {
  clearPaidCampaignResume,
  savePaidCampaignResume,
} from "@/components/business/PaidCampaignResumeBanner";

type Proposal = {
  id: string;
  offer_id: string;
  offer_title: string;
  offer_website?: string | null;
  affiliate_email: string;
  business_email?: string | null;
  status: string;
  created_at: string;
  campaign_name?: string | null;
  audience?: string | null;
  location?: string | null;
  objective?: string | null;
  caption?: string | null;
  file_url?: string | null;
  media_type?: string | null;
  call_to_action?: string | null;
  cta?: string | null;
  budget_amount?: number | null;
  budget_type?: string | null;
  daily_budget?: number | null;
  age_range?: [number, number] | null;
  gender?: string | null;
  performance_goal?: string | null;
  conversion_event?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

type CampaignReadiness = {
  ready: boolean;
  alreadyLive?: boolean;
  blockers?: string[];
  funding?: { ready: boolean; requiredAmount: number; deficit: number };
  meta?: { ready: boolean; pageReady: boolean; adAccountReady: boolean };
  tracking?: { ready: boolean; error?: string | null };
  pixel?: { required: boolean; ready: boolean };
  timing?: { ready: boolean; error?: string | null; message?: string | null };
};

type ReviewReadiness = {
  billing: { ready: boolean };
  subscription: {
    ready: boolean;
    required: boolean;
    grandfathered: boolean;
    status: string;
    businessId?: string | null;
  };
  campaigns: Record<string, CampaignReadiness>;
};

function formatBudget(proposal: Proposal) {
  const amount =
    typeof proposal.budget_amount === "number" && proposal.budget_amount > 0
      ? proposal.budget_amount / 100
      : typeof proposal.daily_budget === "number" && proposal.daily_budget > 0
        ? proposal.daily_budget
        : null;
  if (!amount) return "Not set";
  const suffix = String(proposal.budget_type || "DAILY").toUpperCase() === "LIFETIME"
    ? "lifetime"
    : "per day";
  return `$${amount.toLocaleString("en-AU", { maximumFractionDigits: 2 })} ${suffix}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdIdeaProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const proposalId = String(params?.id || "").trim();
  const router = useRouter();
  const session = useSession();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [readiness, setReadiness] = useState<ReviewReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const canonicalPath = useMemo(
    () => `/business/my-business/ad-ideas/${encodeURIComponent(proposalId)}`,
    [proposalId],
  );

  const campaignReadiness = proposalId ? readiness?.campaigns?.[proposalId] || null : null;
  const subscriptionReady = Boolean(
    readiness && (readiness.subscription.ready || !readiness.subscription.required),
  );
  const billingReady = Boolean(readiness?.billing.ready);
  const metaReady = Boolean(campaignReadiness?.meta?.ready);
  const trackingReady = Boolean(campaignReadiness?.tracking?.ready);
  const fundingReady = Boolean(campaignReadiness?.funding?.ready);
  const pixelReady = !campaignReadiness?.pixel?.required || Boolean(campaignReadiness.pixel.ready);
  const timingReady = campaignReadiness?.timing?.ready !== false;
  const allReady = Boolean(
    campaignReadiness?.ready && subscriptionReady && billingReady && metaReady && trackingReady && pixelReady && timingReady && fundingReady,
  );

  const load = useCallback(async () => {
    if (!proposalId || !session?.user?.email) return;
    setLoading(true);
    setError(null);
    try {
      const [proposalRes, readinessRes] = await Promise.all([
        fetch(`/api/business/ad-ideas/${encodeURIComponent(proposalId)}/review`, { cache: "no-store" }),
        fetch("/api/business/ad-ideas/review-readiness", { cache: "no-store" }),
      ]);

      if (proposalRes.status === 401 || readinessRes.status === 401) {
        router.replace(`/login/business?returnTo=${encodeURIComponent(canonicalPath)}`);
        return;
      }

      const proposalJson = await proposalRes.json().catch(() => null);
      const readinessJson = await readinessRes.json().catch(() => null);
      if (!proposalRes.ok || !proposalJson?.success || !proposalJson?.proposal) {
        throw new Error(proposalJson?.message || "This campaign proposal could not be loaded.");
      }
      if (!readinessRes.ok || !readinessJson?.success) {
        throw new Error(readinessJson?.message || "Launch requirements could not be checked.");
      }

      const loaded = proposalJson.proposal as Proposal;
      setProposal(loaded);
      setReadiness({
        billing: readinessJson.billing,
        subscription: readinessJson.subscription,
        campaigns: readinessJson.campaigns || {},
      });

      if (loaded.status === "pending") {
        savePaidCampaignResume({
          proposalId: loaded.id,
          path: `/business/my-business/ad-ideas?proposal=${encodeURIComponent(loaded.id)}`,
          offerTitle: loaded.offer_title,
          affiliateEmail: loaded.affiliate_email,
        });
      } else {
        clearPaidCampaignResume(loaded.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign proposal.");
    } finally {
      setLoading(false);
    }
  }, [canonicalPath, proposalId, router, session?.user?.email]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.replace(`/login/business?returnTo=${encodeURIComponent(canonicalPath)}`);
      return;
    }
    void load();
  }, [session, canonicalPath, load, router]);

  const launch = async () => {
    if (!proposal) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/ad-ideas/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adIdeaId: proposal.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        if (json?.subscriptionRequired) {
          setSubscriptionOpen(true);
          return;
        }
        throw new Error(json?.message || json?.error || "Campaign is not ready to launch.");
      }
      clearPaidCampaignResume(proposal.id);
      router.push("/business/manage-campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch this campaign.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!proposal || !window.confirm("Reject this campaign proposal?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/ad-ideas/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adIdeaId: proposal.id,
          status: "rejected",
          rejectionReason: "Rejected by business",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || json?.error || "Could not reject this proposal.");
      }

      void fetch("/api/emails/ad-rejected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ad_rejected",
          event: "ad_rejected",
          to: proposal.affiliate_email,
          affiliateEmail: proposal.affiliate_email,
          businessEmail: session?.user?.email,
          offerId: proposal.offer_id,
          offerTitle: proposal.offer_title,
          adIdeaId: proposal.id,
          reason: "Rejected by business",
        }),
      }).catch(() => undefined);

      clearPaidCampaignResume(proposal.id);
      setProposal((current) => current ? { ...current, status: "rejected" } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject this proposal.");
    } finally {
      setBusy(false);
    }
  };

  const businessNextAction = (() => {
    if (!proposal || proposal.status !== "pending") return null;
    if (!subscriptionReady) {
      return { label: "Start 14-day Growth trial", onClick: () => setSubscriptionOpen(true) };
    }
    if (!billingReady) {
      return {
        label: "Connect billing",
        onClick: () => router.push(`/business/my-business?billing=required&returnTo=${encodeURIComponent(canonicalPath)}`),
      };
    }
    if (!metaReady || !pixelReady) {
      return {
        label: "Connect Meta",
        onClick: () => router.push(`/business/my-business/connect-meta?offerId=${encodeURIComponent(proposal.offer_id)}&source=proposal&returnTo=${encodeURIComponent(canonicalPath)}`),
      };
    }
    if (!trackingReady) {
      return {
        label: "Connect tracking",
        onClick: () => router.push(`/business/setup-tracking?offerId=${encodeURIComponent(proposal.offer_id)}&source=proposal&returnTo=${encodeURIComponent(canonicalPath)}`),
      };
    }
    return null;
  })();

  const mediaIsVideo = Boolean(
    proposal?.media_type?.toUpperCase() === "VIDEO" || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(proposal?.file_url || ""),
  );

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 lg:px-10">
      <BusinessSubscriptionActivationModal
        open={subscriptionOpen}
        intent={proposal && readiness?.subscription.businessId ? {
          businessId: readiness.subscription.businessId,
          campaignId: proposal.id,
          submissionId: proposal.id,
          intendedAction: "approve_ad_idea",
          returnTo: canonicalPath,
          attribution: {
            source: "ad_idea_proposal_detail",
            offerId: proposal.offer_id,
            affiliateEmail: proposal.affiliate_email,
            campaignType: "paid_meta",
          },
        } : null}
        onClose={() => setSubscriptionOpen(false)}
      />

      <div className="mx-auto max-w-5xl space-y-5">
        <button
          type="button"
          onClick={() => router.push(`/business/my-business/ad-ideas?proposal=${encodeURIComponent(proposalId)}`)}
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to Ad Ideas
        </button>

        {loading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">Loading proposal…</div>
        ) : error && !proposal ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h1 className="font-semibold">Campaign could not be opened</h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{error}</p>
          </div>
        ) : proposal ? (
          <>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#00C2CB]">Paid campaign proposal</div>
              <h1 className="mt-2 text-2xl font-semibold">{proposal.offer_title}</h1>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {proposal.affiliate_email} wants to fund this campaign. You pay $0 in ad spend; existing commission terms still apply.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-[var(--border)] px-3 py-1">Affiliate budget: {formatBudget(proposal)}</span>
                <span className="rounded-full border border-[var(--border)] px-3 py-1">Your ad spend: $0</span>
                <span className="rounded-full border border-[var(--border)] px-3 py-1 capitalize">{proposal.status}</span>
              </div>
            </section>

            {proposal.file_url ? (
              <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                {mediaIsVideo ? (
                  <video src={proposal.file_url} controls className="max-h-[560px] w-full bg-black object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proposal.file_url} alt="Affiliate campaign creative" className="max-h-[560px] w-full bg-black object-contain" />
                )}
                {proposal.caption ? <p className="border-t border-[var(--border)] p-4 text-sm">{proposal.caption}</p> : null}
              </section>
            ) : null}

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
              <h2 className="font-semibold">What happens next</h2>
              {proposal.status !== "pending" ? (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">This proposal is {proposal.status}.</p>
              ) : businessNextAction ? (
                <div className="mt-3">
                  <p className="text-sm text-[var(--muted-foreground)]">Complete the next business setup step to keep this proposal moving.</p>
                  <button type="button" onClick={businessNextAction.onClick} className="mt-4 rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-[#061113]">
                    {businessNextAction.label}
                  </button>
                </div>
              ) : !timingReady ? (
                <p className="mt-2 text-sm text-amber-300">Campaign timing needs to be updated before launch. The proposal remains pending.</p>
              ) : !fundingReady ? (
                <div className="mt-2">
                  <p className="text-sm font-medium">Waiting on affiliate</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">Nettmark will prompt the affiliate to fund their campaign. No action is required from you.</p>
                </div>
              ) : allReady ? (
                <div className="mt-3">
                  <p className="text-sm text-[var(--muted-foreground)]">Your setup and the affiliate campaign are ready.</p>
                  <button type="button" onClick={() => void launch()} disabled={busy} className="mt-4 rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-[#061113] disabled:opacity-50">
                    {busy ? "Launching…" : "Approve & launch"}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">Nettmark is checking the remaining launch requirements. No launch will occur until all hard checks pass.</p>
              )}
            </section>

            <details className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
              <summary className="cursor-pointer font-semibold">Campaign details</summary>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-[var(--muted-foreground)]">Campaign</dt><dd>{proposal.campaign_name || "Not named"}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Objective</dt><dd>{proposal.objective || proposal.performance_goal || "Not set"}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Audience</dt><dd>{proposal.audience || "Not set"}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Location</dt><dd>{proposal.location || "Not set"}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Start</dt><dd>{formatDate(proposal.start_time)}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">End</dt><dd>{formatDate(proposal.end_time)}</dd></div>
              </dl>
            </details>

            {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

            {proposal.status === "pending" ? (
              <button type="button" onClick={() => void reject()} disabled={busy} className="text-sm text-red-300 hover:text-red-200 disabled:opacity-50">
                Reject proposal
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
