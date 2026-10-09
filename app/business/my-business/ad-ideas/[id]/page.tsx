"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Link2,
  Megaphone,
  Rocket,
  Target,
  WalletCards,
} from "lucide-react";
import { BusinessSubscriptionActivationModal } from "@/components/business/BusinessSubscriptionActivationModal";
import {
  clearPaidCampaignResume,
  savePaidCampaignResume,
} from "@/components/business/PaidCampaignResumeBanner";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

type Proposal = {
  id: string;
  offer_id: string;
  offer_title: string;
  offer_website?: string | null;
  affiliate_username: string;
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
    ? " total"
    : "/day";
  return `$${amount.toLocaleString("en-AU", { maximumFractionDigits: 2 })}${suffix}`;
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

function affiliateLabel(username: string) {
  const raw = String(username || "").trim().replace(/^@+/, "");
  return raw ? `@${raw}` : "Nettmark affiliate";
}

function affiliateInitials(username: string) {
  const raw = String(username || "").trim().replace(/^@+/, "").replace(/[^a-z0-9]/gi, "");
  return raw ? raw.slice(0, 2).toUpperCase() : "AF";
}

function SetupStep({
  label,
  ready,
  icon,
}: {
  label: string;
  ready: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ready ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.05] text-slate-400"}`}>
          {icon}
        </span>
        <span className="truncate text-sm font-medium text-slate-200">{label}</span>
      </div>
      <span className={`text-xs font-semibold ${ready ? "text-emerald-300" : "text-slate-500"}`}>
        {ready ? "Complete" : "Required"}
      </span>
    </div>
  );
}

function CommissionBillingForm({
  onComplete,
  onCancel,
}: {
  onComplete: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });

      if (result.error) {
        throw new Error(result.error.message || "Card setup failed.");
      }

      const checkRes = await fetch("/api/stripe/check-customer-card", {
        method: "POST",
        cache: "no-store",
      });
      const checkJson = await checkRes.json().catch(() => null);
      if (!checkRes.ok || !checkJson?.hasCard) {
        throw new Error("Card saved, but commission billing could not be confirmed yet.");
      }

      await onComplete();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save commission billing.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-white">Commission payment method</div>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          This card is only used when tracked affiliate commissions become payable. Affiliate ad spend is still $0 to you.
        </p>
      </div>
      <PaymentElement />
      {formError ? (
        <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {formError}
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="submit"
          disabled={submitting || !stripe || !elements}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#57c7d1] px-4 text-sm font-bold text-[#061113] disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save commission card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
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
  const [billingClientSecret, setBillingClientSecret] = useState<string | null>(null);
  const [billingSetupBusy, setBillingSetupBusy] = useState(false);

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
  const metaSetupReady = metaReady && pixelReady;
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

      clearPaidCampaignResume(proposal.id);
      setProposal((current) => current ? { ...current, status: "rejected" } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject this proposal.");
    } finally {
      setBusy(false);
    }
  };

  const beginCommissionBilling = async () => {
    if (billingSetupBusy) return;
    setBillingSetupBusy(true);
    setError(null);
    try {
      const profileRes = await fetch("/api/stripe/business-billing-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const profileJson = await profileRes.json().catch(() => null);
      const customerId = profileJson?.customerId || profileJson?.profile?.stripe_customer_id || null;
      if (!profileRes.ok || !customerId) {
        throw new Error(profileJson?.message || profileJson?.error || "Could not prepare commission billing.");
      }

      const setupRes = await fetch("/api/stripe/create-setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const setupJson = await setupRes.json().catch(() => null);
      if (!setupRes.ok || !setupJson?.clientSecret) {
        throw new Error(setupJson?.error || "Could not open the secure card form.");
      }

      setBillingClientSecret(setupJson.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare commission billing.");
    } finally {
      setBillingSetupBusy(false);
    }
  };

  const businessNextAction = (() => {
    if (!proposal || proposal.status !== "pending") return null;
    if (!subscriptionReady) {
      return {
        label: "Start free trial",
        title: "Start your 14-day Growth trial",
        description: "Enable paid affiliate campaigns for your business. You can continue reviewing this proposal before anything launches.",
        onClick: () => setSubscriptionOpen(true),
      };
    }
    if (!billingReady) {
      return {
        label: "Add commission card",
        title: "Add commission payment method",
        description: "Your Growth trial is active. Nettmark uses a separate Stripe account for tracked affiliate commissions, so save a commission card once before launch. Your ad spend remains $0.",
        onClick: () => void beginCommissionBilling(),
      };
    }
    if (!metaSetupReady) {
      return {
        label: "Connect Meta",
        title: "Connect Meta",
        description: "Connect the Facebook Page, Ad Account and any required Sales Pixel this campaign needs.",
        onClick: () => router.push(`/business/my-business/connect-meta?offerId=${encodeURIComponent(proposal.offer_id)}&source=proposal&returnTo=${encodeURIComponent(canonicalPath)}`),
      };
    }
    if (!trackingReady) {
      return {
        label: "Set up tracking",
        title: "Connect campaign tracking",
        description: "Verify Nettmark tracking for this offer so sales can be attributed correctly.",
        onClick: () => router.push(`/business/setup-tracking?offerId=${encodeURIComponent(proposal.offer_id)}&source=proposal&returnTo=${encodeURIComponent(canonicalPath)}`),
      };
    }
    return null;
  })();

  const mediaIsVideo = Boolean(
    proposal?.media_type?.toUpperCase() === "VIDEO" || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(proposal?.file_url || ""),
  );

  const statusState = (() => {
    if (!proposal) return { label: "Checking", className: "border-white/10 bg-white/[0.04] text-slate-300" };
    if (proposal.status !== "pending") {
      return { label: proposal.status, className: "border-white/10 bg-white/[0.04] text-slate-300" };
    }
    if (allReady) {
      return { label: "Ready to launch", className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" };
    }
    if (!subscriptionReady) {
      return { label: "Growth required", className: "border-amber-400/25 bg-amber-400/10 text-amber-300" };
    }
    if (!billingReady) {
      return { label: "Commission billing required", className: "border-amber-400/25 bg-amber-400/10 text-amber-300" };
    }
    if (!metaSetupReady) {
      return { label: "Meta setup required", className: "border-amber-400/25 bg-amber-400/10 text-amber-300" };
    }
    if (!trackingReady) {
      return { label: "Tracking required", className: "border-amber-400/25 bg-amber-400/10 text-amber-300" };
    }
    if (!timingReady) {
      return { label: "Timing update required", className: "border-amber-400/25 bg-amber-400/10 text-amber-300" };
    }
    if (!fundingReady) {
      return { label: "Waiting on affiliate", className: "border-[#57c7d1]/25 bg-[#57c7d1]/10 text-[#8ce5ed]" };
    }
    return { label: "Checking", className: "border-white/10 bg-white/[0.04] text-slate-300" };
  })();

  const affiliateStatus = (() => {
    if (fundingReady) {
      return {
        title: "Campaign funding ready",
        body: "The affiliate has enough eligible campaign funding available for launch.",
      };
    }
    if (!subscriptionReady) {
      return {
        title: "Funding not required yet",
        body: "Nettmark will prompt the affiliate once paid promotion is enabled. No action is required from you here.",
      };
    }
    return {
      title: "Funding campaign",
      body: "Nettmark is handling campaign funding with the affiliate. No action is required from you.",
    };
  })();

  return (
    <div className="min-h-screen bg-[#080b0d] px-4 py-5 text-white sm:px-6 lg:px-10 lg:py-8">
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
            campaignType: "paid_meta",
          },
        } : null}
        onClose={() => setSubscriptionOpen(false)}
      />

      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3 py-1">
          <button
            type="button"
            onClick={() => router.push(`/business/my-business/ad-ideas?proposal=${encodeURIComponent(proposalId)}`)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Back to Ad Ideas"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Campaign proposal</h1>
            <p className="mt-0.5 text-sm text-slate-400">Review the campaign and take the next step.</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[24px] border border-white/10 bg-[#101416] p-6 text-sm text-slate-400">Loading proposal…</div>
        ) : error && !proposal ? (
          <div className="rounded-[24px] border border-red-500/25 bg-red-500/10 p-6">
            <h2 className="font-semibold">Campaign could not be opened</h2>
            <p className="mt-2 text-sm text-red-100/70">{error}</p>
          </div>
        ) : proposal ? (
          <>
            <section className="rounded-[24px] border border-white/10 bg-[#101416] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#57c7d1] text-sm font-black text-[#061113] sm:h-14 sm:w-14 sm:text-base">
                    {affiliateInitials(proposal.affiliate_username)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold sm:text-lg">{affiliateLabel(proposal.affiliate_username)}</div>
                    <div className="truncate text-sm text-slate-400">Affiliate partner</div>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${statusState.className}`}>
                  {statusState.label}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 divide-x divide-white/8 border-t border-white/8 pt-4">
                <div className="pr-3">
                  <div className="text-xs text-slate-500">Offer</div>
                  <div className="mt-1 truncate text-sm font-semibold text-slate-100 sm:text-base">{proposal.offer_title}</div>
                </div>
                <div className="px-3">
                  <div className="text-xs text-slate-500">Affiliate budget</div>
                  <div className="mt-1 text-sm font-semibold text-white sm:text-base">{formatBudget(proposal)}</div>
                </div>
                <div className="pl-3">
                  <div className="text-xs text-slate-500">Your ad spend</div>
                  <div className="mt-1 text-sm font-semibold text-white sm:text-base">$0</div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#101416] p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-[#57c7d1]" />
                    <h2 className="text-lg font-semibold">Ad preview</h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">Here&apos;s the creative the affiliate wants to run for your business.</p>
                </div>
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">Preview</span>
              </div>

              <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#080b0d]">
                <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#57c7d1]/15 text-xs font-bold text-[#57c7d1]">
                    {proposal.offer_title.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{proposal.offer_title}</div>
                    <div className="text-xs text-slate-500">Sponsored</div>
                  </div>
                </div>

                {proposal.caption ? (
                  <p className="px-4 py-3 text-sm leading-6 text-slate-200">{proposal.caption}</p>
                ) : null}

                {proposal.file_url ? (
                  mediaIsVideo ? (
                    <video src={proposal.file_url} controls className="max-h-[560px] w-full bg-black object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={proposal.file_url} alt="Affiliate campaign creative" className="max-h-[560px] w-full bg-black object-contain" />
                  )
                ) : (
                  <div className="flex min-h-52 items-center justify-center px-4 text-sm text-slate-500">No creative attached</div>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-white/[0.025] px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs uppercase tracking-wide text-slate-500">{proposal.offer_website || "Affiliate campaign"}</div>
                    <div className="truncate text-sm font-semibold text-slate-200">{proposal.campaign_name || proposal.offer_title}</div>
                  </div>
                  <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
                    {proposal.call_to_action || proposal.cta || "Learn more"}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#57c7d1]/55 bg-[linear-gradient(135deg,rgba(87,199,209,0.08),rgba(16,20,22,0.96)_55%)] p-5 shadow-[0_0_40px_rgba(87,199,209,0.05)] sm:p-6">
              {proposal.status !== "pending" ? (
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-6 w-6 text-[#57c7d1]" />
                  <div>
                    <h2 className="text-lg font-semibold capitalize">Proposal {proposal.status}</h2>
                    <p className="mt-1 text-sm text-slate-400">This campaign proposal has already been reviewed.</p>
                  </div>
                </div>
              ) : businessNextAction ? (
                <>
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#57c7d1] text-[#061113]">
                      <Rocket className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ce5ed]">Next step</div>
                      <h2 className="mt-1 text-xl font-bold">{businessNextAction.title}</h2>
                      <p className="mt-1.5 text-sm leading-6 text-slate-400">{businessNextAction.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={businessNextAction.onClick}
                    disabled={billingSetupBusy}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#57c7d1] px-4 py-3.5 text-sm font-bold text-[#061113] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {billingSetupBusy ? "Preparing secure billing…" : businessNextAction.label}
                    {!billingSetupBusy ? <ArrowRight className="h-4 w-4" /> : null}
                  </button>
                  {billingClientSecret && !billingReady ? (
                    <Elements key={billingClientSecret} stripe={stripePromise} options={{ clientSecret: billingClientSecret }}>
                      <CommissionBillingForm
                        onComplete={async () => {
                          setBillingClientSecret(null);
                          await load();
                        }}
                        onCancel={() => setBillingClientSecret(null)}
                      />
                    </Elements>
                  ) : null}
                </>
              ) : !timingReady ? (
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Campaign update needed</div>
                    <h2 className="mt-1 text-xl font-bold">Campaign timing needs attention</h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-400">The current campaign dates are no longer launch-ready. The proposal will stay pending until they are corrected.</p>
                  </div>
                </div>
              ) : !fundingReady ? (
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#57c7d1]/12 text-[#57c7d1]">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ce5ed]">You&apos;re ready</div>
                    <h2 className="mt-1 text-xl font-bold">Waiting on the affiliate</h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-400">Your setup is complete. Nettmark is handling campaign funding with the affiliate, so there&apos;s nothing else you need to do right now.</p>
                  </div>
                </div>
              ) : allReady ? (
                <>
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Ready to launch</div>
                      <h2 className="mt-1 text-xl font-bold">Everything is ready</h2>
                      <p className="mt-1.5 text-sm leading-6 text-slate-400">Review the campaign above, then approve it when you&apos;re happy for Nettmark to launch it.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void launch()}
                    disabled={busy}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#57c7d1] px-4 py-3.5 text-sm font-bold text-[#061113] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Launching…" : "Approve & launch"}
                    {!busy ? <ArrowRight className="h-4 w-4" /> : null}
                  </button>
                </>
              ) : (
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-slate-400">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Checking campaign readiness</h2>
                    <p className="mt-1 text-sm text-slate-400">Nettmark is checking the remaining launch requirements.</p>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-[22px] border border-white/10 bg-[#101416] p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#57c7d1]/12 text-[#57c7d1]">
                  <WalletCards className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold">Affiliate status</div>
                  <div className="mt-1 text-sm font-medium text-slate-200">{affiliateStatus.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{affiliateStatus.body}</p>
                </div>
              </div>
            </section>

            <details className="group rounded-[22px] border border-white/10 bg-[#101416] p-4 sm:p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#57c7d1]/12 text-[#57c7d1]">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">Campaign details</div>
                    <div className="mt-0.5 text-sm text-slate-400">Campaign settings and setup progress.</div>
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180" />
              </summary>

              <div className="mt-5 space-y-5 border-t border-white/8 pt-5">
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Business setup</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SetupStep label="Growth" ready={subscriptionReady} icon={<Rocket className="h-4 w-4" />} />
                    <SetupStep label="Commission billing" ready={billingReady} icon={<CreditCard className="h-4 w-4" />} />
                    <SetupStep label="Meta" ready={metaSetupReady} icon={<Megaphone className="h-4 w-4" />} />
                    <SetupStep label="Tracking" ready={trackingReady} icon={<Link2 className="h-4 w-4" />} />
                  </div>
                </div>

                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Campaign</dt><dd className="mt-1 text-slate-200">{proposal.campaign_name || "Not named"}</dd></div>
                  <div><dt className="text-slate-500">Objective</dt><dd className="mt-1 text-slate-200">{proposal.objective || proposal.performance_goal || "Not set"}</dd></div>
                  <div><dt className="text-slate-500">Audience</dt><dd className="mt-1 text-slate-200">{proposal.audience || "Not set"}</dd></div>
                  <div><dt className="text-slate-500">Location</dt><dd className="mt-1 text-slate-200">{proposal.location || "Not set"}</dd></div>
                  <div><dt className="text-slate-500">Start</dt><dd className="mt-1 text-slate-200">{formatDate(proposal.start_time)}</dd></div>
                  <div><dt className="text-slate-500">End</dt><dd className="mt-1 text-slate-200">{formatDate(proposal.end_time)}</dd></div>
                  <div><dt className="text-slate-500">Conversion event</dt><dd className="mt-1 text-slate-200">{proposal.conversion_event || "Not set"}</dd></div>
                  <div><dt className="text-slate-500">Your ad spend</dt><dd className="mt-1 flex items-center gap-1.5 font-semibold text-slate-100"><CircleDollarSign className="h-4 w-4 text-[#57c7d1]" />$0</dd></div>
                </dl>
              </div>
            </details>

            {error ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
            ) : null}

            {proposal.status === "pending" ? (
              <button
                type="button"
                onClick={() => void reject()}
                disabled={busy}
                className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-medium text-slate-400 transition hover:border-red-400/30 hover:text-red-300 disabled:opacity-50"
              >
                Reject proposal
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
