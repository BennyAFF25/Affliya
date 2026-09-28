"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Megaphone,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  BusinessSubscriptionActivationModal,
} from "@/components/business/BusinessSubscriptionActivationModal";
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
  timing?: { ready: boolean; message?: string | null };
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

function budgetLabel(proposal: Proposal | null) {
  if (!proposal) return "Budget not set";
  const amount =
    typeof proposal.budget_amount === "number" && proposal.budget_amount > 0
      ? proposal.budget_amount / 100
      : typeof proposal.daily_budget === "number" && proposal.daily_budget > 0
        ? proposal.daily_budget
        : null;
  if (!amount) return "Budget not set";
  const type = String(proposal.budget_type || "DAILY").toUpperCase() === "LIFETIME"
    ? "lifetime"
    : "per day";
  return `$${amount.toLocaleString("en-AU", { maximumFractionDigits: 2 })} ${type}`;
}

function blockerLabel(code: string) {
  const labels: Record<string, string> = {
    BUSINESS_GROWTH_REQUIRED: "Start your 14-day Growth trial",
    BUSINESS_BILLING_REQUIRED: "Connect business billing",
    AFFILIATE_CAMPAIGN_FUNDING_REQUIRED: "Waiting for the affiliate to fund the campaign",
    META_SETUP_REQUIRED: "Connect your Meta Page and Ad Account",
    META_PAGE_REQUIRED: "Connect a Facebook Page",
    META_AD_ACCOUNT_REQUIRED: "Connect a Meta Ad Account",
    OFFER_TRACKING_NOT_READY: "Connect and verify Nettmark tracking",
    TRACKING_REQUIRED: "Connect and verify Nettmark tracking",
    SALES_PIXEL_REQUIRED: "Select a Meta Pixel for this Sales campaign",
    CAMPAIGN_DATES_REQUIRE_UPDATE: "Campaign dates need updating",
    AFFILIATE_OFFER_NOT_APPROVED: "Affiliate access is no longer approved",
    OFFER_NOT_AVAILABLE: "This offer is no longer available",
    CAMPAIGN_PARTIAL_META_STATE: "A previous Meta launch needs recovery",
    READINESS_CHECK_FAILED: "Nettmark could not verify every launch requirement",
  };
  return labels[code] || code.replaceAll("_", " ").toLowerCase();
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

export default function ReviewCampaignPage() {
  const params = useParams<{ id: string }>();
  const proposalId = String(params?.id || "").trim();
  const router = useRouter();
  const session = useSession();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [readiness, setReadiness] = useState<ReviewReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const reviewPath = useMemo(
    () => `/business/review-campaign/${encodeURIComponent(proposalId)}`,
    [proposalId],
  );
  const campaignReadiness = proposalId ? readiness?.campaigns?.[proposalId] || null : null;
  const blockers = campaignReadiness?.blockers || [];
  const subscriptionReady = Boolean(
    readiness && (readiness.subscription.ready || !readiness.subscription.required),
  );
  const billingReady = Boolean(readiness?.billing.ready);
  const metaReady = Boolean(campaignReadiness?.meta?.ready);
  const trackingReady = Boolean(campaignReadiness?.tracking?.ready);
  const fundingReady = Boolean(campaignReadiness?.funding?.ready);

  const load = useCallback(async () => {
    if (!proposalId || !session?.user?.email) return;
    setLoading(true);
    setError(null);

    try {
      const [proposalRes, readinessRes] = await Promise.all([
        fetch(`/api/business/ad-ideas/${encodeURIComponent(proposalId)}/review`, {
          cache: "no-store",
        }),
        fetch("/api/business/ad-ideas/review-readiness", {
          cache: "no-store",
        }),
      ]);

      if (proposalRes.status === 401 || readinessRes.status === 401) {
        router.replace(`/login/business?returnTo=${encodeURIComponent(reviewPath)}`);
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

      const loadedProposal = proposalJson.proposal as Proposal;
      setProposal(loadedProposal);
      setReadiness({
        billing: readinessJson.billing,
        subscription: readinessJson.subscription,
        campaigns: readinessJson.campaigns || {},
      });

      if (loadedProposal.status === "pending") {
        savePaidCampaignResume({
          proposalId: loadedProposal.id,
          path: reviewPath,
          offerTitle: loadedProposal.offer_title,
          affiliateEmail: loadedProposal.affiliate_email,
        });
      } else {
        clearPaidCampaignResume(loadedProposal.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign proposal.");
    } finally {
      setLoading(false);
    }
  }, [proposalId, reviewPath, router, session?.user?.email]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.replace(`/login/business?returnTo=${encodeURIComponent(reviewPath)}`);
      return;
    }
    void load();
  }, [session, router, reviewPath, load]);

  const launch = async () => {
    if (!proposal) return;
    setActionBusy(true);
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
    } finally {
      setActionBusy(false);
    }
  };

  const reject = async () => {
    if (!proposal) return;
    setActionBusy(true);
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
      clearPaidCampaignResume(proposal.id);
      setProposal((current) => current ? { ...current, status: "rejected" } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject this proposal.");
    } finally {
      setActionBusy(false);
    }
  };

  const nextAction = (() => {
    if (!proposal || proposal.status !== "pending") return null;
    if (!subscriptionReady) {
      return {
        label: "Start 14-day Growth trial",
        action: () => setSubscriptionOpen(true),
      };
    }
    if (!billingReady) {
      return {
        label: "Connect billing",
        action: () => router.push(
          `/business/my-business?billing=required&returnTo=${encodeURIComponent(reviewPath)}`,
        ),
      };
    }
    if (!metaReady || blockers.includes("SALES_PIXEL_REQUIRED")) {
      return {
        label: "Connect Meta",
        action: () => router.push(
          `/business/my-business/connect-meta?offerId=${encodeURIComponent(proposal.offer_id)}&source=proposal&returnTo=${encodeURIComponent(reviewPath)}`,
        ),
      };
    }
    if (!trackingReady) {
      return {
        label: "Connect tracking",
        action: () => router.push(
          `/business/setup-tracking?offerId=${encodeURIComponent(proposal.offer_id)}&source=proposal&returnTo=${encodeURIComponent(reviewPath)}`,
        ),
      };
    }
    return null;
  })();

  const mediaIsVideo = Boolean(
    proposal?.media_type?.toUpperCase() === "VIDEO" ||
    /\.(mp4|mov|webm|ogg)(\?|$)/i.test(proposal?.file_url || ""),
  );

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-7 text-[var(--foreground)] sm:px-6 lg:px-10">
      <BusinessSubscriptionActivationModal
        open={subscriptionOpen}
        intent={proposal && readiness?.subscription.businessId ? {
          businessId: readiness.subscription.businessId,
          campaignId: proposal.id,
          submissionId: proposal.id,
          intendedAction: "approve_ad_idea",
          returnTo: reviewPath,
          attribution: {
            source: "focused_campaign_review",
            offerId: proposal.offer_id,
            affiliateEmail: proposal.affiliate_email,
            campaignType: "paid_meta",
          },
        } : null}
        onClose={() => setSubscriptionOpen(false)}
      />

      <div className="mx-auto max-w-6xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/business/my-business/ad-ideas")}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          All campaign proposals
        </button>

        {loading ? (
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-8">
            <div className="h-5 w-44 animate-pulse rounded bg-[var(--border)]" />
            <div className="mt-4 h-10 max-w-xl animate-pulse rounded bg-[var(--border)]" />
            <div className="mt-6 h-52 animate-pulse rounded-3xl bg-[var(--border)]" />
          </div>
        ) : error && !proposal ? (
          <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-200">
            <h1 className="text-xl font-semibold">Campaign could not be opened</h1>
            <p className="mt-2 text-sm text-red-100/80">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Try again
            </button>
          </div>
        ) : proposal ? (
          <>
            <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,194,203,0.13),rgba(255,255,255,0.035)_48%,rgba(255,255,255,0.02))] shadow-[0_24px_90px_rgba(0,0,0,0.25)]">
              <div className="h-1 bg-[#00C2CB]" />
              <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-1 text-xs font-semibold text-[#7ff5fb]">
                      Affiliate-funded campaign
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${proposal.status === "pending" ? "bg-amber-400/10 text-amber-200" : proposal.status === "approved" ? "bg-emerald-400/10 text-emerald-200" : "bg-red-400/10 text-red-200"}`}>
                      {proposal.status}
                    </span>
                  </div>

                  <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                    {proposal.offer_title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
                    <strong className="text-[var(--foreground)]">{proposal.affiliate_email}</strong> wants to fund this advertising campaign. Review the proposal and complete only the setup required to launch it.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <div className="text-xs text-[var(--muted-foreground)]">Affiliate budget</div>
                      <div className="mt-1 text-lg font-semibold">{budgetLabel(proposal)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <div className="text-xs text-[var(--muted-foreground)]">Your ad spend</div>
                      <div className="mt-1 text-lg font-semibold">$0</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <div className="text-xs text-[var(--muted-foreground)]">Submitted</div>
                      <div className="mt-1 text-sm font-semibold">{formatDate(proposal.created_at)}</div>
                    </div>
                  </div>

                  {proposal.offer_website && (
                    <a
                      href={proposal.offer_website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#00C2CB] hover:underline"
                    >
                      View offer website
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>

                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                  {proposal.file_url ? (
                    mediaIsVideo ? (
                      <video
                        src={proposal.file_url}
                        controls
                        className="h-full max-h-[420px] w-full bg-black object-contain"
                      />
                    ) : (
                      <img
                        src={proposal.file_url}
                        alt="Campaign creative"
                        className="h-full max-h-[420px] w-full bg-black object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )
                  ) : (
                    <div className="flex min-h-64 items-center justify-center p-8 text-center text-sm text-[var(--muted-foreground)]">
                      No creative was attached to this proposal.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#00C2CB]" />
                  <h2 className="text-lg font-semibold">Before this can launch</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  This is the only setup Nettmark needs for this real campaign. Completed steps stay completed.
                </p>

                <div className="mt-5 space-y-3">
                  {[
                    { label: "Growth plan", ready: subscriptionReady, icon: BadgeCheck },
                    { label: "Business billing", ready: billingReady, icon: WalletCards },
                    { label: "Meta Page + Ad Account", ready: metaReady, icon: Megaphone },
                    { label: "Nettmark tracking", ready: trackingReady, icon: ShieldCheck },
                    { label: "Affiliate funding", ready: fundingReady, icon: WalletCards },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--background)]/55 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${item.ready ? "text-emerald-400" : "text-amber-300"}`}>
                          {item.ready ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                          {item.ready ? "Ready" : "Required"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {blockers.length > 0 && proposal.status === "pending" && (
                  <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Still needed</div>
                    <div className="mt-2 space-y-1 text-sm text-amber-50/90">
                      {blockers.map((blocker) => (
                        <div key={blocker}>• {blockerLabel(blocker)}</div>
                      ))}
                    </div>
                  </div>
                )}

                {nextAction && (
                  <button
                    type="button"
                    onClick={nextAction.action}
                    className="mt-5 w-full rounded-full bg-[#00C2CB] px-5 py-3 text-sm font-bold text-[#061113] transition hover:brightness-110"
                  >
                    {nextAction.label}
                  </button>
                )}
              </section>

              <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Campaign proposal</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">Campaign</div>
                    <div className="mt-1 text-sm font-semibold">{proposal.campaign_name || proposal.offer_title}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">Objective</div>
                    <div className="mt-1 text-sm font-semibold">{proposal.objective || proposal.performance_goal || "Not set"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">Audience</div>
                    <div className="mt-1 text-sm font-semibold">{proposal.audience || "Not set"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">Location</div>
                    <div className="mt-1 text-sm font-semibold">{proposal.location || "Not set"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">Age</div>
                    <div className="mt-1 text-sm font-semibold">{proposal.age_range ? `${proposal.age_range[0]}–${proposal.age_range[1]}` : "Not set"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">CTA</div>
                    <div className="mt-1 text-sm font-semibold">{proposal.call_to_action || proposal.cta || "Not set"}</div>
                  </div>
                </div>

                {proposal.caption && (
                  <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--background)]/55 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Ad copy</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{proposal.caption}</p>
                  </div>
                )}

                {proposal.status === "pending" ? (
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={actionBusy || !campaignReadiness?.ready}
                      onClick={() => void launch()}
                      className="flex-1 rounded-full bg-[#00C2CB] px-5 py-3 text-sm font-bold text-[#061113] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {actionBusy ? "Working…" : campaignReadiness?.ready ? "Approve & launch" : "Complete setup to launch"}
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void reject()}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-red-400/25 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--background)]/55 p-4 text-sm text-[var(--muted-foreground)]">
                    This proposal has already been {proposal.status}.
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
