"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSession } from "@supabase/auth-helpers-react";
import React, { useEffect, useState } from "react";
import { supabase } from "utils/supabase/pages-client";
import { useRouter } from "next/navigation";
import { nmToast } from "@/components/ui/toast";
import { ActionBar, Badge, Button, EmptyState, ReviewCard, ReviewMetaItem, ReviewQueue, StatCard, StatusBadge } from "@/../components/ui";
import { BusinessSubscriptionActivationModal, readSubscriptionIntentFromResponse, trackBusinessSubscriptionClientEvent } from "@/../components/business/BusinessSubscriptionActivationModal";

// Email notifications (client -> server)
async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  return { ok: res.ok, status: res.status, json };
}

async function notifyAdRejected(params: {
  to: string;
  affiliateEmail: string;
  businessEmail: string;
  offerId: string;
  offerTitle?: string;
  adIdeaId: string;
  reason?: string;
}) {
  const payload = {
    type: "ad_rejected",
    event: "ad_rejected",
    ...params,
  };

  const res = await postJson("/api/emails/ad-rejected", payload);
  if (!res?.ok) {
    console.error("[email] /api/emails/ad-rejected failed", res);
  }
}

async function notifyAdApproved(params: {
  to: string;
  affiliateEmail: string;
  businessEmail: string;
  offerId: string;
  offerTitle?: string;
  adIdeaId: string;
  campaignId?: string;
}) {
  const payload = {
    type: "ad_approved",
    event: "ad_approved",
    ...params,
  };

  const res = await postJson("/api/emails/ad-approved", payload);
  if (!res?.ok) {
    console.error("[email] /api/emails/ad-approved failed", res);
  }
}

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
};

interface AdIdea {
  meta_ad_id?: string;
  id: string;
  affiliate_email: string;
  business_email: string;
  audience: string;
  location: string;
  status: string;
  created_at: string;
  offer_id: string;
  file_url?: string;
  objective?: string;
  cta?: string;
  daily_budget?: number;
  age_range?: [number, number];
  gender?: string;
  interests?: any;
  meta_video_id?: string;
  caption?: string;
  thumbnail_url?: string;
  media_type?: string;
  // extra targeting / budget fields from schema
  call_to_action?: string;
  budget_amount?: number;
  budget_type?: string;
  placements_type?: string;
  manual_placements?: any;
  conversion_event?: string;
  performance_goal?: string;
}

function RequirementCard({
  title,
  body,
  ready,
  cta,
}: {
  title: string;
  body: string;
  ready: boolean;
  cta?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 shadow-sm ${
        ready
          ? "border-emerald-400/25 bg-emerald-400/10"
          : "border-amber-400/30 bg-amber-400/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-300"}`} />
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ready ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/15 text-amber-100"}`}>
          {ready ? "Ready" : "Required"}
        </span>
      </div>
      {!ready && cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  );
}

function formatBudgetLabel(idea: Pick<AdIdea, "daily_budget" | "budget_amount" | "budget_type">) {
  const rawAmount = typeof idea.budget_amount === "number" && idea.budget_amount > 0
    ? idea.budget_amount / 100
    : typeof idea.daily_budget === "number" && idea.daily_budget > 0
      ? idea.daily_budget
      : null;

  if (!rawAmount) return null;

  const budgetType = String(idea.budget_type || "DAILY").toUpperCase() === "LIFETIME"
    ? "lifetime"
    : "daily";

  return `${budgetType} $${rawAmount.toLocaleString("en-AU", {
    minimumFractionDigits: rawAmount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatIdeaDate(value?: string) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdIdeasPage() {
  const [ideas, setIdeas] = useState<AdIdea[]>([]);
  const [offersMap, setOffersMap] = useState<Record<string, string>>({});
  const [selectedIdea, setSelectedIdea] = useState<AdIdea | null>(null);
  const [showRejectionInput, setShowRejectionInput] = useState<string | null>(
    null,
  );
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [showRecent, setShowRecent] = useState(false);
  const [, setShowTargetingDetails] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [reviewReadiness, setReviewReadiness] = useState<ReviewReadiness | null>(null);
  const [reviewReadinessLoading, setReviewReadinessLoading] = useState(false);
  const [subscriptionIntent, setSubscriptionIntent] = useState<ReturnType<typeof readSubscriptionIntentFromResponse>>(null);
  const session = useSession();
  const user = session?.user;
  const router = useRouter();
  const pendingIdeas = ideas.filter((i) => i.status === "pending");
  const reviewedIdeas = ideas.filter((i) => i.status !== "pending");
  const approvedCount = ideas.filter((i) => i.status === "approved").length;
  const billingReady = Boolean(reviewReadiness?.billing.ready);
  const subscriptionReady = Boolean(reviewReadiness?.subscription.ready);
  const subscriptionRequired = reviewReadiness?.subscription.required !== false;
  const launchRequirementsReady = billingReady && (subscriptionReady || !subscriptionRequired);

  const buildSubscriptionIntent = (idea?: AdIdea | null) => ({
    businessId: reviewReadiness?.subscription.businessId || businessId,
    campaignId: idea?.id || null,
    submissionId: idea?.id || null,
    intendedAction: "approve_ad_idea",
    returnTo: "/business/my-business/ad-ideas",
    attribution: {
      source: "ad_ideas_requirements_panel",
      offerId: idea?.offer_id || null,
      affiliateEmail: idea?.affiliate_email || null,
      campaignType: "paid_meta",
    },
  });

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push("/");
      return;
    }

    const loadOffersMap = async () => {
      if (!user?.email) return;

      const [{ data, error }, { data: profile }] = await Promise.all([
        supabase
          .from("offers")
          .select("id, title")
          .eq("business_email", user.email),
        (supabase as any)
          .from("business_profiles")
          .select("id")
          .eq("business_email", user.email)
          .maybeSingle(),
      ]);

      setBusinessId((profile as { id?: string | null } | null)?.id || null);

      if (error) {
        console.error("[❌ Supabase Fetch Offers Error]", error.message);
        return;
      }

      const map: Record<string, string> = {};
      data?.forEach((offer: { id: string; title: string }) => {
        map[offer.id] = offer.title;
      });

      setOffersMap(map);
    };

    if (user?.email) {
      loadOffersMap();
    }
  }, [session, user, router]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) return;
    if (!user?.email) return;

    const loadReviewReadiness = async () => {
      setReviewReadinessLoading(true);
      try {
        const res = await fetch("/api/business/ad-ideas/review-readiness", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setReviewReadiness({
            billing: json.billing,
            subscription: json.subscription,
          });
          if (json.subscription?.businessId) setBusinessId(json.subscription.businessId);
        } else {
          console.warn("[ad-ideas] review readiness failed", json);
        }
      } catch (error) {
        console.warn("[ad-ideas] review readiness error", error);
      } finally {
        setReviewReadinessLoading(false);
      }
    };

    void loadReviewReadiness();
  }, [session, user?.email]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push("/");
      return;
    }

    const fetchIdeas = async () => {
      if (!user?.email) return;

      // Only fetch when offersMap is fully populated
      const offerIds = Object.keys(offersMap);
      if (offerIds.length === 0) return;

      const { data, error } = await supabase
        .from("ad_ideas")
        .select("*")
        .in("offer_id", offerIds)
        .eq("business_email", user.email)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching ad ideas:", error.message);
      } else {
        const typedIdeas = (data || []) as AdIdea[];
        setIdeas(typedIdeas);

        typedIdeas.filter((idea) => idea.status === "pending").forEach((idea) => {
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
      }
    };

    // Explicitly call only when offersMap is populated
    if (Object.keys(offersMap).length > 0) {
      fetchIdeas();
    }
  }, [offersMap, session, user, router]);

  const handleStatusChange = async (
    id: string,
    newStatus: string,
    rejectionReason?: string,
  ): Promise<boolean> => {
    if (!user?.email) return false;

    const res = await fetch("/api/business/ad-ideas/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adIdeaId: id, status: newStatus, rejectionReason }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success) {
      const intent = readSubscriptionIntentFromResponse(json);
      if (intent) {
        setSubscriptionIntent({ ...intent, businessId: intent.businessId || businessId });
        return false;
      }
      console.error("[❌ Ad idea status update failed]", json?.message || json?.error || res.status);
      if (json?.error === "BUSINESS_PAYMENT_METHOD_REQUIRED" || json?.action === "connect_business_billing") {
        nmToast.error(json?.message || "Add business billing before approving this paid ad idea.");
        router.push("/business/my-business?billing=required&returnTo=/business/my-business/ad-ideas");
        return false;
      }
      nmToast.error(json?.message || "Failed to update ad status");
      return false;
    }

    // Local UI update
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === id ? { ...idea, status: newStatus } : idea,
      ),
    );

    if (newStatus === "rejected") {
      setShowRejectionInput(null);
      setSelectedReason("");
      setCustomReason("");

      const rejected = ideas.find((idea) => idea.id === id);
      if (rejected) {
        const offerTitle = offersMap[rejected.offer_id] || "Unknown Offer";
        try {
          await notifyAdRejected({
            to: rejected.affiliate_email,
            affiliateEmail: rejected.affiliate_email,
            businessEmail: user.email,
            offerId: rejected.offer_id,
            offerTitle,
            adIdeaId: rejected.id,
            reason: rejectionReason || "",
          });
        } catch (e) {
          console.error("[email] notifyAdRejected crashed", e);
        }
      }

      return true;
    }

    if (newStatus === "approved") {
      // We only mark the ad idea as approved here.
      // Meta upload + live_ads creation happens in sendToMeta().
      nmToast.success("Ad approved — launching on Meta…");
      return true;
    }

    return true;
  };

  // Internal API function to send full ad idea data to Meta
  const sendToMeta = async (adIdeaId: string) => {
    try {
      // Pull ad idea from Supabase
      const { data: adIdeaData, error } = await supabase
        .from("ad_ideas")
        .select("*")
        .eq("id", adIdeaId)
        .single();

      const adIdea = adIdeaData as AdIdea | null;

      if (error || !adIdea) {
        console.error("[❌ Fetch Ad Idea Error]", error?.message);
        return;
      }

      console.log("[🔍 Fetching Offer Details for Ad Idea]", adIdea.offer_id);

      const readinessRes = await fetch(`/api/offers/${encodeURIComponent(adIdea.offer_id)}/readiness`, {
        cache: "no-store",
      });
      const readinessJson = await readinessRes.json().catch(() => null);
      const readiness = readinessJson?.readiness;

      if (!readinessRes.ok || !readiness) {
        console.error("[❌ Offer readiness fetch error]", readinessJson);
        nmToast.error(readinessJson?.message || "Could not verify offer readiness.");
        return;
      }

      if (!readiness.resolvedMeta?.pageId || !readiness.resolvedMeta?.adAccountId) {
        nmToast.error(
          readiness.metaReason === "needs_offer_selection"
            ? "Meta is connected, but this offer needs a selected Page and Ad Account before launching paid ads."
            : "This offer is currently organic-only. Connect a Meta page and ad account before launching paid ads.",
        );
        return;
      }

      const isSalesObjective =
        String(adIdea.objective || "").trim() === "OUTCOME_SALES";

      if (isSalesObjective && !readiness.resolvedMeta?.pixelId) {
        nmToast.error(
          "This offer still needs a Meta pixel before Sales campaigns can launch.",
        );
        return;
      }

      const payload = {
        offerId: adIdea.offer_id,
        adIdeaId,
        videoUrl: adIdea.media_type?.toUpperCase() === "VIDEO" ? adIdea.file_url : null,
        file_url: adIdea.file_url,
        media_type: adIdea.media_type,
        caption: adIdea.caption,
        audience: adIdea.audience,
        location: adIdea.location,
        objective: adIdea.objective,
        cta: adIdea.cta,
        daily_budget: adIdea.daily_budget,
        age_range: adIdea.age_range,
        gender: adIdea.gender,
        interests: adIdea.interests,
        display_link: `https://www.nettmark.com/go/${adIdea.offer_id}___${adIdea.affiliate_email}`,
        metaPageId: readiness.resolvedMeta.pageId,
        metaAdAccountId: readiness.resolvedMeta.adAccountId,
        metaPixelId: readiness.resolvedMeta.pixelId || null,
        thumbnail_url: adIdea.thumbnail_url,
      };

      console.log("[📤 Sending ad idea payload to internal Meta API]", payload);
      const response = await fetch("/api/meta/callback/upload-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data: any;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("[❌ Failed to parse JSON response]", jsonError);
        data = null;
      }

      console.log("[📉 Status Code]", response.status);
      console.log("[⚠️ Meta Upload Response]", data);

      if (!response.ok) {
        console.error("[❌ Meta Upload Failed]", data);
        const intent = readSubscriptionIntentFromResponse(data);
        if (intent) {
          setSubscriptionIntent({ ...intent, businessId: intent.businessId || businessId });
          return;
        }
        nmToast.error(data?.message || data?.error || "Meta upload failed");
        return;
      }

      console.log("[✅ Meta Upload Success]", data);

      // Your API returns: { success: true, campaignId, liveAdId }
      const hasMetaIds =
        data?.campaignId ||
        data?.liveAdId ||
        data?.meta_ad_id ||
        data?.metaAdId ||
        data?.campaign_id ||
        data?.meta_campaign_id;

      nmToast.success(
        hasMetaIds ? "Campaign created ✅ (live on Meta)" : "Sent to Meta ✅",
      );

      // Notify affiliate after Meta launch (best-effort)
      try {
        const offerTitle = offersMap[adIdea.offer_id] || "Unknown Offer";
        await notifyAdApproved({
          to: adIdea.affiliate_email,
          affiliateEmail: adIdea.affiliate_email,
          businessEmail: adIdea.business_email || user?.email || "",
          offerId: adIdea.offer_id,
          offerTitle,
          adIdeaId: adIdea.id,
          campaignId:
            data?.campaignId || data?.campaign_id || data?.meta_campaign_id,
        });
      } catch (e) {
        console.error("[email] notifyAdApproved crashed", e);
      }

      // Redirect business to Manage Campaigns (live_ads record is created server-side)
      try {
        router.push("/business/manage-campaigns");
      } catch {
        // ignore
      }

      const metaStatus = data?.status || data?.metaStatus || "RUNNING";
      if (metaStatus && adIdea?.id) {
        await (supabase as any)
          .from("ad_ideas")
          .update({ meta_status: metaStatus })
          .eq("id", adIdea.id);
      }
    } catch (err) {
      console.error("[❌ Meta Upload Error]", err);
    }
  };

  return (
    <>
      <BusinessSubscriptionActivationModal
        open={Boolean(subscriptionIntent)}
        intent={subscriptionIntent ? { ...subscriptionIntent, businessId: subscriptionIntent.businessId || businessId } : null}
        onClose={() => setSubscriptionIntent(null)}
      />
      <div className="ad-ideas-theme min-h-screen bg-[#05080b] px-4 py-8 text-white md:px-10 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(0,194,203,0.22),transparent_34%),linear-gradient(135deg,#111819,#080b0d)] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)] md:p-8">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#7ff5fb]">
                Paid launch review
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
                Affiliate ad ideas
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Review paid campaign submissions from approved affiliates. Billing and Nettmark Business activate only when you approve real paid campaign activity.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 xl:min-w-[420px]">
              <StatCard label="Pending" value={pendingIdeas.length} tone="warning" className="border-white/10 bg-white/[0.04]" />
              <StatCard label="Approved" value={approvedCount} tone="success" className="border-white/10 bg-white/[0.04]" />
              <StatCard label="Reviewed" value={reviewedIdeas.length} tone="muted" className="border-white/10 bg-white/[0.04]" />
            </div>
          </div>
        </div>

        {pendingIdeas.length > 0 && (
          <section className="grid gap-4 lg:grid-cols-2">
            <RequirementCard
              title="Commission/ad-spend billing"
              ready={billingReady}
              body={billingReady
                ? "Payment method is connected for tracked affiliate commissions and campaign charges."
                : "Required before you approve. This is the existing commission/ad-spend billing path — not the Nettmark subscription."}
              cta={(
                <Button href="/business/my-business?billing=required&returnTo=/business/my-business/ad-ideas" className="w-full justify-center">
                  Connect billing
                </Button>
              )}
            />
            <RequirementCard
              title="Nettmark Business subscription"
              ready={subscriptionReady || !subscriptionRequired}
              body={!subscriptionRequired
                ? "This business is grandfathered or subscription is not required."
                : subscriptionReady
                  ? "Nettmark Business is active for paid affiliate ad approvals."
                  : "Required only when approving paid affiliate ad activity. Starts at $49 AUD/month."}
              cta={(
                <Button
                  type="button"
                  className="w-full justify-center"
                  onClick={() => setSubscriptionIntent(buildSubscriptionIntent(pendingIdeas[0]))}
                  disabled={!businessId && !reviewReadiness?.subscription.businessId}
                >
                  Start subscription
                </Button>
              )}
            />
            {reviewReadinessLoading && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300 lg:col-span-2">
                Checking launch requirements…
              </div>
            )}
          </section>
        )}

        {ideas.length === 0 ? (
          <EmptyState
            title="No ad ideas submitted yet"
            description="Paid ad submissions from affiliates will appear here for review."
          />
        ) : (
          <>
            <ReviewQueue
              title={<span className="text-white">Pending ad ideas</span>}
              description={<span className="text-slate-400">New paid ad ideas waiting for a business decision.</span>}
              actions={<StatusBadge status="pending" label={`${pendingIdeas.length} pending`} />}
              className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.25)]"
            >
              {pendingIdeas.length === 0 ? (
                <EmptyState
                  title="No new ads to review"
                  description="Recent approvals and rejections can be opened below."
                  className="py-8"
                />
              ) : (
                <ul className="space-y-4">
                  {pendingIdeas.map((idea) => (
                    <li key={idea.id}>
                      <ReviewCard
                        className="border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(0,194,203,0.05))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
                        header={(
                          <>
                            <StatusBadge status={idea.status} />
                            <Badge variant="muted">Paid ad</Badge>
                            {formatBudgetLabel(idea) ? (
                              <Badge variant="primary">Budget {formatBudgetLabel(idea)}</Badge>
                            ) : null}
                          </>
                        )}
                        title={<span className="text-xl text-white">{offersMap[idea.offer_id] || "Unknown Offer"}</span>}
                        description={<span className="text-slate-300">{`${idea.audience || "Audience not set"} · ${idea.location || "Location not set"}`}</span>}
                        meta={(
                          <>
                            <ReviewMetaItem label="Affiliate">{idea.affiliate_email}</ReviewMetaItem>
                            <ReviewMetaItem label="Submitted">{formatIdeaDate(idea.created_at)}</ReviewMetaItem>
                            <ReviewMetaItem label="Objective">{idea.objective || idea.performance_goal || "Not set"}</ReviewMetaItem>
                          </>
                        )}
                        actions={(
                          <ActionBar className="lg:flex-col">
                            <Button
                              type="button"
                              variant="secondary"
                              className="w-full"
                              onClick={() => {
                                void trackBusinessSubscriptionClientEvent("campaign_review_opened", {
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
                                setSelectedIdea(idea);
                                setShowTargetingDetails(false);
                              }}
                            >
                              View details
                            </Button>
                            {(!billingReady || (!subscriptionReady && subscriptionRequired)) && (
                              <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                                Finish billing and subscription above before this can launch.
                              </div>
                            )}
                            <Button
                              type="button"
                              className="w-full"
                              disabled={!launchRequirementsReady}
                              onClick={async () => {
                                const ok = await handleStatusChange(
                                  idea.id,
                                  "approved",
                                );
                                if (ok) {
                                  await sendToMeta(idea.id);
                                }
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="w-full"
                              onClick={() => setShowRejectionInput(idea.id)}
                            >
                              Reject
                            </Button>
                            {showRejectionInput === idea.id && (
                              <div className="mt-2 flex w-full flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 p-3">
                                <select
                                  className="rounded-lg border border-[var(--border)] bg-[#181818] px-3 py-2 text-sm text-white"
                                  onChange={(e) => setSelectedReason(e.target.value)}
                                  value={selectedReason}
                                >
                                  <option value="">Select a reason</option>
                                  <option value="Not aligned with brand">
                                    Not aligned with brand
                                  </option>
                                  <option value="Inappropriate content">
                                    Inappropriate content
                                  </option>
                                  <option value="Low quality creative">
                                    Low quality creative
                                  </option>
                                  <option value="Other">Other</option>
                                </select>
                                {selectedReason === "Other" && (
                                  <textarea
                                    className="rounded-lg border border-[var(--border)] bg-[#181818] px-3 py-2 text-sm text-white"
                                    placeholder="Custom reason..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                  />
                                )}
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={async () => {
                                    const finalReason =
                                      selectedReason === "Other"
                                        ? customReason
                                        : selectedReason;
                                    await handleStatusChange(
                                      idea.id,
                                      "rejected",
                                      finalReason,
                                    );
                                  }}
                                >
                                  Confirm rejection
                                </Button>
                              </div>
                            )}
                          </ActionBar>
                        )}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </ReviewQueue>

            <div className="mt-6">
              <Button
                type="button"
                onClick={() => setShowRecent((prev) => !prev)}
                variant="outline"
                className="w-full justify-center border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
              >
                {showRecent ? "Hide recent ads" : `Show recent ads (${reviewedIdeas.length})`}
              </Button>
              {showRecent && (
                <ReviewQueue
                  title="Recent ad decisions"
                  description="Previously approved or rejected ad ideas."
                  className="mt-5"
                >
                  {reviewedIdeas.length === 0 ? (
                    <EmptyState
                      title="No recent ad decisions"
                      description="Approved and rejected ad ideas will appear here."
                      className="py-8"
                    />
                  ) : (
                    <ul className="space-y-4">
                      {reviewedIdeas.map((idea) => (
                        <li key={idea.id}>
                          <ReviewCard
                            header={(
                              <>
                                <StatusBadge status={idea.status} />
                                <Badge variant="muted">Paid ad</Badge>
                              </>
                            )}
                            title={offersMap[idea.offer_id] || "Unknown Offer"}
                            description={`${idea.audience || "Audience not set"} · ${idea.location || "Location not set"}`}
                            meta={(
                              <>
                                <ReviewMetaItem label="Affiliate">{idea.affiliate_email}</ReviewMetaItem>
                                <ReviewMetaItem label="Submitted">{formatIdeaDate(idea.created_at)}</ReviewMetaItem>
                              </>
                            )}
                            actions={(
                              <Button
                                type="button"
                                variant="secondary"
                                className="w-full"
                                onClick={() => {
                                  void trackBusinessSubscriptionClientEvent("campaign_review_opened", {
                                    businessId,
                                    campaignId: idea.id,
                                    submissionId: idea.id,
                                    intendedAction: "approve_ad_idea",
                                    returnTo: "/business/my-business/ad-ideas",
                                    attribution: {
                                      source: "ad_ideas_recent_page",
                                      offerId: idea.offer_id,
                                      affiliateEmail: idea.affiliate_email,
                                      campaignType: "paid_meta",
                                    },
                                  });
                                  setSelectedIdea(idea);
                                  setShowTargetingDetails(false);
                                }}
                              >
                                View details
                              </Button>
                            )}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </ReviewQueue>
              )}
            </div>
          </>
        )}

        {/* (rest of your modal UI remains unchanged below this point) */}
        {selectedIdea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            <div className="relative z-50 w-full max-w-md mx-4 rounded-2xl border border-[#232323] bg-gradient-to-b from-[#191919] via-[#111111] to-black shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="h-1 w-full bg-gradient-to-r from-[#00C2CB] via-[#00ffbf] to-[#00C2CB]" />

              <div className="flex flex-col text-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#ff5757] to-[#8c52ff] text-white flex items-center justify-center font-bold text-sm shadow-md">
                      {selectedIdea.affiliate_email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col leading-tight">
                      <div className="text-sm font-semibold">
                        @{selectedIdea.affiliate_email.split("@")[0]}
                      </div>
                      <div className="text-[11px] text-white/60">
                        AU, US, GB • Ad submission
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-white/50">
                    <span className="rounded-full border border-white/10 px-2 py-[2px] text-[10px] uppercase tracking-[0.15em]">
                      Preview
                    </span>
                    <button className="p-1 rounded-full hover:bg-white/5 transition">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {(() => {
                  const url = selectedIdea.file_url || "";
                  const isVideoByType =
                    selectedIdea.media_type?.toUpperCase() === "VIDEO";
                  const isVideoByExtension = /\.(mp4|mov|webm|ogg)(\?|$)/i.test(
                    url,
                  );
                  const isVideo = isVideoByType || isVideoByExtension;

                  if (!url) {
                    return (
                      <div className="w-full h-64 flex items-center justify-center bg-[#111111] text-xs text-gray-400">
                        No creative attached
                      </div>
                    );
                  }

                  return isVideo ? (
                    <video
                      src={url}
                      controls
                      className="w-full max-h-[320px] bg-black object-contain"
                    />
                  ) : (
                    <img
                      src={url}
                      alt="Post Image"
                      className="w-full max-h-[320px] bg-black object-contain"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.fallbackUsed) {
                          target.src = "/fallback-organic-post.png";
                          (target as any).dataset.fallbackUsed = "true";
                        }
                      }}
                    />
                  );
                })()}

                <div className="border-t border-white/5 mt-2 pt-2">
                  {selectedIdea.status === "pending" && (
                    <div className="flex gap-2 px-3 pb-2 pt-1">
                      <button
                        onClick={async () => {
                          const ok = await handleStatusChange(
                            selectedIdea.id,
                            "approved",
                          );
                          if (ok) {
                            await sendToMeta(selectedIdea.id);
                          }
                        }}
                        className="w-full py-2 rounded-lg bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold text-sm shadow-[0_0_20px_rgba(0,194,203,0.35)] transition"
                      >
                        Approve &amp; Launch
                      </button>
                      <button
                        onClick={async () => {
                          await handleStatusChange(
                            selectedIdea.id,
                            "rejected",
                            "Rejected by business",
                          );
                          setSelectedIdea((prev) =>
                            prev ? { ...prev, status: "rejected" } : null,
                          );
                        }}
                        className="w-full py-2 rounded-lg bg-[#2b1515] hover:bg-[#3a1a1a] text-red-300 font-semibold text-sm border border-red-500/40 transition"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  <div className="sticky bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md px-4 pb-3 pt-2 z-10">
                    <button
                      className="w-full py-2 rounded-lg bg-[#00C2CB]/10 hover:bg-[#00C2CB]/20 text-[#00C2CB] font-medium text-sm"
                      onClick={() => {
                        setShowTargetingDetails(false);
                        setSelectedIdea(null);
                      }}
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
