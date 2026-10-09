"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSession } from "@supabase/auth-helpers-react";
import { ArrowRight, CheckCircle2, Clock3, ImageIcon, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { BusinessSubscriptionActivationModal, readSubscriptionIntentFromResponse, trackBusinessSubscriptionClientEvent } from "@/../components/business/BusinessSubscriptionActivationModal";
import { nmToast } from "@/components/ui/toast";
import { supabase } from "utils/supabase/pages-client";

type ReviewReadiness = {
  billing: {
    ready: boolean;
    reason?: string | null;
    customerId?: string | null;
  };
  subscription: {
    ready: boolean;
    required: boolean;
    grandfathered: boolean;
    status: string;
    businessId?: string | null;
  };
  campaigns?: Record<
    string,
    {
      ready: boolean;
      alreadyLive?: boolean;
      partialMetaState?: boolean;
      blockers?: string[];
      funding?: { ready: boolean; requiredAmount: number; deficit: number };
      meta?: { ready: boolean; pageReady: boolean; adAccountReady: boolean };
      tracking?: { ready: boolean; error?: string | null };
      pixel?: { required: boolean; ready: boolean };
      timing?: { ready: boolean; error?: string | null; message?: string | null };
      affiliate?: { ready: boolean };
      offer?: { ready: boolean };
      error?: string;
    }
  >;
};

interface AdIdea {
  id: string;
  affiliate_email: string;
  business_email: string;
  audience: string;
  location: string;
  status: string;
  created_at: string;
  offer_id: string;
  file_url?: string;
  thumbnail_url?: string;
  media_type?: string;
  objective?: string;
  performance_goal?: string;
  daily_budget?: number;
  budget_amount?: number;
  budget_type?: string;
}

type ProposalState = {
  label: string;
  tone: "ready" | "waiting" | "setup" | "neutral";
};

function currentAdIdeasReturnTo() {
  if (typeof window === "undefined") return "/business/my-business/ad-ideas";
  const proposalId = new URLSearchParams(window.location.search).get("proposal");
  return proposalId
    ? `/business/my-business/ad-ideas?proposal=${encodeURIComponent(proposalId)}`
    : "/business/my-business/ad-ideas";
}

function formatBudget(idea: AdIdea) {
  const amount = typeof idea.budget_amount === "number" && idea.budget_amount > 0
    ? idea.budget_amount / 100
    : typeof idea.daily_budget === "number" && idea.daily_budget > 0
      ? idea.daily_budget
      : null;

  if (!amount) return "Budget set";

  const formatted = amount.toLocaleString("en-AU", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const type = String(idea.budget_type || "DAILY").toUpperCase();
  return type === "LIFETIME" ? `$${formatted} total` : `$${formatted}/day`;
}

function formatReviewedDate(value?: string) {
  if (!value) return "Reviewed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Reviewed";
  return `Submitted ${date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  })}`;
}

function CreativeThumb({ idea }: { idea: AdIdea }) {
  const source = idea.thumbnail_url || idea.file_url || "";
  const isVideo = idea.media_type?.toUpperCase() === "VIDEO" || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(idea.file_url || "");

  if (!source || (isVideo && !idea.thumbnail_url)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0b1012] text-[#57c7d1]">
        <ImageIcon className="h-7 w-7" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt="Campaign creative"
      className="h-full w-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

function ProposalStatus({ state }: { state: ProposalState }) {
  const styles = {
    ready: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
    waiting: "border-[#57c7d1]/20 bg-[#57c7d1]/10 text-[#8ce5ed]",
    setup: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    neutral: "border-white/10 bg-white/[0.04] text-slate-300",
  }[state.tone];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${styles}`}>
      {state.tone === "ready" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {state.label}
    </span>
  );
}

export default function AdIdeasPage() {
  const [ideas, setIdeas] = useState<AdIdea[]>([]);
  const [offersMap, setOffersMap] = useState<Record<string, string>>({});
  const [affiliateNames, setAffiliateNames] = useState<Record<string, string>>({});
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [reviewReadiness, setReviewReadiness] = useState<ReviewReadiness | null>(null);
  const [reviewReadinessLoading, setReviewReadinessLoading] = useState(false);
  const [subscriptionIntent, setSubscriptionIntent] = useState<ReturnType<typeof readSubscriptionIntentFromResponse>>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");
  const [highlightedProposalId, setHighlightedProposalId] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const pendingIdeas = ideas.filter((idea) => idea.status === "pending");
  const reviewedIdeas = ideas.filter((idea) => idea.status !== "pending");
  const billingReady = Boolean(reviewReadiness?.billing.ready);
  const subscriptionReady = Boolean(reviewReadiness?.subscription.ready);
  const subscriptionRequired = reviewReadiness?.subscription.required !== false;
  const launchRequirementsReady = billingReady && (subscriptionReady || !subscriptionRequired);

  const campaignReadiness = (id: string) => reviewReadiness?.campaigns?.[id] || null;
  const isCampaignReady = (id: string) => Boolean(campaignReadiness(id)?.ready && launchRequirementsReady);

  const proposalState = (id: string): ProposalState => {
    if (reviewReadinessLoading || !reviewReadiness) return { label: "Checking", tone: "neutral" };
    if (isCampaignReady(id)) return { label: "Ready to launch", tone: "ready" };

    const blockers = campaignReadiness(id)?.blockers || [];
    if (blockers.length === 1 && blockers[0] === "AFFILIATE_CAMPAIGN_FUNDING_REQUIRED") {
      return { label: "Waiting on affiliate", tone: "waiting" };
    }
    if (blockers.includes("CAMPAIGN_DATES_REQUIRE_UPDATE")) {
      return { label: "Needs update", tone: "setup" };
    }
    return { label: "Setup required", tone: "setup" };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const proposalId = new URLSearchParams(window.location.search).get("proposal");
    setHighlightedProposalId(proposalId);
    if (proposalId) setActiveTab("pending");
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      const returnTo = currentAdIdeasReturnTo();
      router.push(`/login/business?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (!user?.email) return;

    const loadBusiness = async () => {
      const [{ data: offers, error: offersError }, { data: profile }] = await Promise.all([
        supabase.from("offers").select("id, title").eq("business_email", user.email),
        (supabase as any).from("business_profiles").select("id").eq("business_email", user.email).maybeSingle(),
      ]);

      if (offersError) {
        console.error("[ad-ideas] offers lookup failed", offersError.message);
        return;
      }

      const map: Record<string, string> = {};
      (offers || []).forEach((offer: { id: string; title: string }) => {
        map[offer.id] = offer.title;
      });
      setOffersMap(map);
      setBusinessId((profile as { id?: string | null } | null)?.id || null);
    };

    void loadBusiness();
  }, [session, user?.email, router]);

  useEffect(() => {
    if (!user?.email) return;

    const loadReadiness = async () => {
      setReviewReadinessLoading(true);
      try {
        const response = await fetch("/api/business/ad-ideas/review-readiness", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.success) {
          setReviewReadiness({
            billing: data.billing,
            subscription: data.subscription,
            campaigns: data.campaigns || {},
          });
          if (data.subscription?.businessId) setBusinessId(data.subscription.businessId);
        }
      } catch (error) {
        console.warn("[ad-ideas] readiness lookup failed", error);
      } finally {
        setReviewReadinessLoading(false);
      }
    };

    void loadReadiness();
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email || Object.keys(offersMap).length === 0) return;

    const loadIdeas = async () => {
      const { data, error } = await supabase
        .from("ad_ideas")
        .select("*")
        .in("offer_id", Object.keys(offersMap))
        .eq("business_email", user.email)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ad-ideas] proposals lookup failed", error.message);
        return;
      }

      const rows = (data || []) as AdIdea[];
      setIdeas(rows);

      // Only names belonging to this business's proposals are returned.
      // The underlying profiles table remains self-readable, not world-readable.
      try {
        const namesRes = await fetch("/api/business/ad-ideas/affiliate-names", { cache: "no-store" });
        const namesJson = await namesRes.json().catch(() => null);
        setAffiliateNames(namesRes.ok && namesJson?.success ? namesJson.names || {} : {});
      } catch {
        setAffiliateNames({});
      }

      rows.filter((idea) => idea.status === "pending").forEach((idea) => {
        const dedupeKey = `nettmark:analytics:campaign_received_by_business:${idea.id}`;
        if (typeof window !== "undefined" && window.sessionStorage.getItem(dedupeKey)) return;
        if (typeof window !== "undefined") window.sessionStorage.setItem(dedupeKey, "1");
        void trackBusinessSubscriptionClientEvent("campaign_received_by_business", {
          businessId,
          campaignId: idea.id,
          submissionId: idea.id,
          intendedAction: "approve_ad_idea",
          returnTo: "/business/my-business/ad-ideas",
          attribution: {
            source: "ad_ideas_page",
            offerId: idea.offer_id,
            affiliateEmail: idea.affiliate_email,
            campaignType: "paid_meta",
          },
        });
      });
    };

    void loadIdeas();
  }, [offersMap, user?.email, businessId]);

  useEffect(() => {
    if (!highlightedProposalId || ideas.length === 0) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`proposal-${highlightedProposalId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [highlightedProposalId, ideas]);

  const openProposal = (idea: AdIdea, source: string) => {
    void trackBusinessSubscriptionClientEvent("campaign_review_opened", {
      businessId,
      campaignId: idea.id,
      submissionId: idea.id,
      intendedAction: "approve_ad_idea",
      returnTo: "/business/my-business/ad-ideas",
      attribution: {
        source,
        offerId: idea.offer_id,
        affiliateEmail: idea.affiliate_email,
        campaignType: "paid_meta",
      },
    });
    router.push(`/business/my-business/ad-ideas/${encodeURIComponent(idea.id)}`);
  };

  const sendToMeta = async (adIdeaId: string) => {
    setLaunchingId(adIdeaId);
    try {
      const response = await fetch("/api/business/ad-ideas/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adIdeaId }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        const intent = readSubscriptionIntentFromResponse(data);
        if (intent) {
          setSubscriptionIntent({ ...intent, businessId: intent.businessId || businessId });
          return;
        }
        if (data?.error === "BUSINESS_PAYMENT_METHOD_REQUIRED" || data?.action === "connect_business_billing") {
          nmToast.error(data?.message || "Connect business billing before launch.");
          router.push("/business/my-business?billing=required&returnTo=/business/my-business/ad-ideas");
          return;
        }
        nmToast.error(data?.message || data?.error || "Campaign is not ready to launch.");
        return;
      }

      setIdeas((current) => current.map((idea) => idea.id === adIdeaId ? { ...idea, status: "approved" } : idea));
      nmToast.success(data?.alreadyLive ? "Campaign is already live." : "Campaign approved and launched on Meta ✅");
      router.push("/business/manage-campaigns");
    } catch (error) {
      console.error("[ad-ideas] launch failed", error);
      nmToast.error("Could not launch this campaign.");
    } finally {
      setLaunchingId(null);
    }
  };

  return (
    <>
      <BusinessSubscriptionActivationModal
        open={Boolean(subscriptionIntent)}
        intent={subscriptionIntent ? { ...subscriptionIntent, businessId: subscriptionIntent.businessId || businessId } : null}
        onClose={() => setSubscriptionIntent(null)}
      />

      <main className="min-h-screen bg-[#090b0c] px-4 py-5 text-white sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <section className="rounded-[28px] border border-white/10 bg-[#121516] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-7">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#57c7d1]">
                <Megaphone className="h-4 w-4" />
                Affiliate campaigns
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ad Ideas</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Review campaigns affiliates want to fund for your offers.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-[#0d1011] p-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === "pending" ? "bg-[#57c7d1] text-[#061113] shadow-[0_0_28px_rgba(87,199,209,0.2)]" : "text-slate-400 hover:text-white"}`}
              >
                Pending
                <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === "pending" ? "bg-[#0a5960]/35 text-[#061113]" : "bg-white/[0.06] text-slate-300"}`}>
                  {pendingIdeas.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("reviewed")}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === "reviewed" ? "bg-[#57c7d1] text-[#061113] shadow-[0_0_28px_rgba(87,199,209,0.2)]" : "text-slate-400 hover:text-white"}`}
              >
                Reviewed
                <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === "reviewed" ? "bg-[#0a5960]/35 text-[#061113]" : "bg-white/[0.06] text-slate-300"}`}>
                  {reviewedIdeas.length}
                </span>
              </button>
            </div>
          </section>

          {activeTab === "pending" ? (
            <section className="space-y-4">
              {pendingIdeas.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-[#121516] px-5 py-12 text-center">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-[#57c7d1]" />
                  <h2 className="mt-4 text-lg font-semibold">You’re all caught up</h2>
                  <p className="mt-2 text-sm text-slate-400">New affiliate-funded campaign proposals will appear here.</p>
                </div>
              ) : pendingIdeas.map((idea) => {
                const state = proposalState(idea.id);
                const ready = isCampaignReady(idea.id);
                const highlighted = highlightedProposalId === idea.id;

                return (
                  <article
                    key={idea.id}
                    id={`proposal-${idea.id}`}
                    className={`rounded-[28px] border bg-[#121516] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.25)] transition sm:p-5 ${highlighted ? "border-[#57c7d1]/60 ring-1 ring-[#57c7d1]/30" : "border-white/10"}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1012] sm:h-36 sm:w-32">
                        <CreativeThumb idea={idea} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                              {offersMap[idea.offer_id] || "Campaign proposal"}
                            </h2>
                            <p className="mt-1 truncate text-sm text-slate-400">From: {affiliateNames[idea.affiliate_email.toLowerCase()] || "Nettmark affiliate"}</p>
                          </div>
                          <ProposalStatus state={state} />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                          <div className="rounded-2xl border border-white/10 bg-[#0d1011] px-3 py-3">
                            <div className="text-xs text-slate-400">Affiliate budget</div>
                            <div className="mt-1 text-lg font-semibold text-white">{formatBudget(idea)}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-[#0d1011] px-3 py-3">
                            <div className="text-xs text-slate-400">Your ad spend</div>
                            <div className="mt-1 text-lg font-semibold text-white">$0</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`mt-4 grid gap-2.5 ${ready ? "sm:grid-cols-[1fr_auto]" : ""}`}>
                      <button
                        type="button"
                        onClick={() => openProposal(idea, "ad_ideas_page")}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#57c7d1] px-5 py-3 text-sm font-semibold text-[#061113] transition hover:brightness-110"
                      >
                        View proposal
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      {ready ? (
                        <button
                          type="button"
                          disabled={launchingId === idea.id}
                          onClick={() => void sendToMeta(idea.id)}
                          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {launchingId === idea.id ? "Launching…" : "Approve & launch"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="rounded-[28px] border border-white/10 bg-[#121516] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Recently reviewed</h2>
                  <p className="mt-1 text-sm text-slate-400">Previously approved or rejected proposals.</p>
                </div>
              </div>

              {reviewedIdeas.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">No reviewed proposals yet.</div>
              ) : (
                <div className="divide-y divide-white/[0.07]">
                  {reviewedIdeas.map((idea) => (
                    <button
                      key={idea.id}
                      type="button"
                      onClick={() => openProposal(idea, "ad_ideas_reviewed_page")}
                      className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-white/[0.02] sm:px-2"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d1011]">
                        <CreativeThumb idea={idea} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-white">{offersMap[idea.offer_id] || "Campaign proposal"}</div>
                        <div className="mt-1 text-sm text-slate-400">{formatReviewedDate(idea.created_at)}</div>
                      </div>
                      <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${idea.status === "approved" ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                        {idea.status}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
