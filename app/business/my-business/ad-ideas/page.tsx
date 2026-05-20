"use client";

import { useSession } from "@supabase/auth-helpers-react";
import React, { useEffect, useState } from "react";
import { supabase } from "utils/supabase/pages-client";
import { useRouter } from "next/navigation";
import { nmToast } from "@/components/ui/toast";

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

function formatBudget(amount?: number | null, budgetType?: string | null) {
  const dollars = Number(amount || 0) / 100;
  if (!Number.isFinite(dollars) || dollars <= 0) return "Budget not set";
  const cadence = budgetType === "LIFETIME" ? "lifetime" : "daily";
  return `$${dollars.toFixed(2)} ${cadence}`;
}

function normalizeList(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "number") return String(item);
        if (typeof item === "object" && item !== null) {
          return String(item.name || item.id || "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeList(parsed);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function statusPillClass(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20";
    case "rejected":
      return "bg-red-500/15 text-red-300 border border-red-400/20";
    default:
      return "bg-amber-500/15 text-amber-200 border border-amber-300/20";
  }
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
  const [showTargetingDetails, setShowTargetingDetails] = useState(false);
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push("/");
      return;
    }

    const loadOffersMap = async () => {
      if (!user?.email) return;

      const { data, error } = await supabase
        .from("offers")
        .select("id, title")
        .eq("business_email", user.email);

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
        setIdeas(data || []);
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

    const updateData: any = { status: newStatus };
    if (newStatus === "rejected" && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { error } = await (supabase as any)
      .from("ad_ideas")
      .update(updateData)
      .eq("id", id)
      .eq("business_email", user.email);

    if (error) {
      console.error("[❌ Ad idea status update failed]", error.message);
      nmToast.error("Failed to update ad status");
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

  const pendingIdeas = ideas.filter((idea) => idea.status === "pending");
  const recentIdeas = ideas.filter((idea) => idea.status !== "pending");
  const selectedInterests = normalizeList(selectedIdea?.interests);
  const selectedPlacements = normalizeList(selectedIdea?.manual_placements);
  const selectedAgeRange = Array.isArray(selectedIdea?.age_range)
    ? selectedIdea?.age_range.filter((value) => value !== null && value !== undefined)
    : [];

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

      // Pull offer details from Supabase
      const { data: offerData, error: offerError } = await supabase
        .from("offers")
        .select("meta_ad_account_id, meta_page_id, meta_pixel_id")
        .eq("id", adIdea.offer_id)
        .single();

      const offer = offerData as {
        meta_ad_account_id: string;
        meta_page_id: string;
        meta_pixel_id: string | null;
      } | null;

      if (offerError || !offer) {
        console.error("[❌ Fetch Offer Error]", offerError?.message);
        return;
      } else {
        console.log("[✅ Offer Details Fetched]", offer);
      }

      if (!offer.meta_page_id || !offer.meta_ad_account_id) {
        nmToast.error(
          "This offer is currently organic-only. Connect a Meta page and ad account on the offer before launching paid ads.",
        );
        return;
      }

      const isSalesObjective =
        String(adIdea.objective || "").trim() === "OUTCOME_SALES";

      if (isSalesObjective && !offer.meta_pixel_id) {
        nmToast.error(
          "This offer still needs a Meta pixel before Sales campaigns can launch.",
        );
        return;
      }

      const payload = {
        offerId: adIdea.offer_id,
        adIdeaId,
        videoUrl: adIdea.file_url,
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
        metaPageId: offer.meta_page_id,
        metaAdAccountId: offer.meta_ad_account_id,
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
        nmToast.error("Meta upload failed");
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
    <div className="ad-ideas-theme min-h-screen bg-[var(--background)] px-4 py-8 md:px-10 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(0,194,203,0.18),transparent_32%),linear-gradient(135deg,#11181a_0%,#0c1011_52%,#070808_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7ff5fb]">
                Review queue
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Affiliate Promotion Requests
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/65 md:text-base">
                Review incoming paid ad ideas, preview the creative cleanly, and expand targeting context before you approve launch.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Pending</div>
                <div className="mt-1 text-2xl font-bold text-white">{pendingIdeas.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Approved</div>
                <div className="mt-1 text-2xl font-bold text-white">{ideas.filter((idea) => idea.status === "approved").length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 col-span-2 sm:col-span-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Recently reviewed</div>
                <div className="mt-1 text-2xl font-bold text-white">{recentIdeas.length}</div>
              </div>
            </div>
          </div>
        </div>

        {ideas.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#111517] px-6 py-12 text-center shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 text-[#00C2CB]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">No ad ideas submitted yet</h2>
            <p className="mt-2 text-sm text-white/60">When affiliates submit paid promotion ideas they will appear here for review.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Pending review</h2>
                <p className="text-sm text-white/55">Clean previews up front, with targeting context one click away.</p>
              </div>
              <button
                onClick={() => setShowRecent((prev) => !prev)}
                className="rounded-full border border-white/10 bg-[#111517] px-4 py-2 text-sm font-medium text-[#00C2CB] transition hover:bg-[#161b1d]"
              >
                {showRecent ? "Hide recent reviews" : `Show recent reviews (${recentIdeas.length})`}
              </button>
            </div>

            {pendingIdeas.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-[#111517] px-6 py-10 text-center text-white/65 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                <p className="text-lg font-semibold text-white">No new ads to review</p>
                <p className="mt-2 text-sm">You’re caught up. Reviewed requests will stay in the recent section below.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {pendingIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className="rounded-3xl border border-white/10 bg-[#111517] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition hover:border-[#00C2CB]/30 hover:shadow-[0_0_0_1px_rgba(0,194,203,0.18),0_18px_50px_rgba(0,0,0,0.22)] md:p-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/10 text-[#00C2CB]">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-semibold text-white">
                              {offersMap[idea.offer_id] || "Unknown Offer"}
                            </h3>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusPillClass(idea.status)}`}>
                              {idea.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-white/60">
                            Submitted by <span className="font-medium text-white/80">{idea.affiliate_email}</span> · {formatIdeaDate(idea.created_at)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{idea.objective || "Traffic"}</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{formatBudget(idea.budget_amount || idea.daily_budget, idea.budget_type)}</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{idea.media_type || "Creative"}</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{idea.location || "Location not set"}</span>
                          </div>
                          {idea.caption && (
                            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72">
                              {idea.caption}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[250px]">
                        <button
                          onClick={() => {
                            setSelectedIdea(idea);
                            setShowTargetingDetails(false);
                          }}
                          className="rounded-xl border border-white/10 bg-[#151a1c] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-[#1a2022]"
                        >
                          Open preview
                        </button>
                        <div className="flex gap-3">
                          <button
                            onClick={async () => {
                              const ok = await handleStatusChange(idea.id, "approved");
                              if (ok) {
                                await sendToMeta(idea.id);
                              }
                            }}
                            className="flex-1 rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#00b0b8]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setShowRejectionInput(idea.id)}
                            className="flex-1 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-2.5 text-sm text-white/72 transition hover:bg-[#242424]"
                          >
                            Reject
                          </button>
                        </div>
                        {showRejectionInput === idea.id && (
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="flex flex-col gap-3">
                              <select
                                className="rounded-xl border border-white/10 bg-[#101214] px-3 py-2 text-sm text-white"
                                onChange={(e) => setSelectedReason(e.target.value)}
                                value={selectedReason}
                              >
                                <option value="">Select a reason</option>
                                <option value="Not aligned with brand">Not aligned with brand</option>
                                <option value="Inappropriate content">Inappropriate content</option>
                                <option value="Low quality creative">Low quality creative</option>
                                <option value="Other">Other</option>
                              </select>
                              {selectedReason === "Other" && (
                                <textarea
                                  className="rounded-xl border border-white/10 bg-[#101214] px-3 py-2 text-sm text-white"
                                  placeholder="Custom reason..."
                                  value={customReason}
                                  onChange={(e) => setCustomReason(e.target.value)}
                                />
                              )}
                              <button
                                onClick={async () => {
                                  const finalReason = selectedReason === "Other" ? customReason : selectedReason;
                                  await handleStatusChange(idea.id, "rejected", finalReason);
                                }}
                                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                              >
                                Confirm rejection
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showRecent && (
              <div className="mt-8 space-y-4">
                {recentIdeas.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#111517] px-6 py-8 text-center text-sm text-white/60">
                    No reviewed requests yet.
                  </div>
                ) : (
                  recentIdeas.map((idea) => (
                    <div
                      key={idea.id}
                      className="rounded-3xl border border-white/10 bg-[#111517] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] md:p-6"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">{offersMap[idea.offer_id] || "Unknown Offer"}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusPillClass(idea.status)}`}>
                              {idea.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-white/60">{idea.affiliate_email} · {formatIdeaDate(idea.created_at)}</p>
                          <p className="mt-2 text-sm text-white/55">{idea.location || "No location supplied"}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedIdea(idea);
                            setShowTargetingDetails(false);
                          }}
                          className="rounded-xl border border-white/10 bg-[#151a1c] px-4 py-2.5 text-sm font-medium text-[#00C2CB] transition hover:bg-[#1a2022]"
                        >
                          View detail
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {selectedIdea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

            <div className="relative z-50 mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[#232323] bg-gradient-to-b from-[#191919] via-[#111111] to-black shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
              <div className="h-1 w-full bg-gradient-to-r from-[#00C2CB] via-[#00ffbf] to-[#00C2CB]" />

              <div className="flex flex-col text-white">
                <div className="border-b border-white/5 px-5 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff5757] to-[#8c52ff] text-sm font-bold text-white shadow-md">
                        {selectedIdea.affiliate_email.charAt(0).toUpperCase()}
                      </div>
                      <div className="leading-tight">
                        <div className="text-sm font-semibold">@{selectedIdea.affiliate_email.split("@")[0]}</div>
                        <div className="mt-1 text-[11px] text-white/60">
                          {offersMap[selectedIdea.offer_id] || "Unknown Offer"} · {formatIdeaDate(selectedIdea.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/50">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusPillClass(selectedIdea.status)}`}>
                        {selectedIdea.status}
                      </span>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em]">
                        Preview
                      </span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const url = selectedIdea.file_url || "";
                  const isVideoByType = selectedIdea.media_type?.toUpperCase() === "VIDEO";
                  const isVideoByExtension = /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url);
                  const isVideo = isVideoByType || isVideoByExtension;

                  if (!url) {
                    return (
                      <div className="flex h-72 w-full items-center justify-center bg-[#111111] text-xs text-gray-400">
                        No creative attached
                      </div>
                    );
                  }

                  return isVideo ? (
                    <video src={url} controls className="w-full max-h-[420px] bg-black object-contain" />
                  ) : (
                    <img
                      src={url}
                      alt="Ad creative"
                      className="w-full max-h-[420px] bg-black object-contain"
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

                <div className="space-y-4 px-5 py-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Objective</div>
                      <div className="mt-2 text-sm font-medium text-white">{selectedIdea.objective || "Traffic"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Budget</div>
                      <div className="mt-2 text-sm font-medium text-white">{formatBudget(selectedIdea.budget_amount || selectedIdea.daily_budget, selectedIdea.budget_type)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Location</div>
                      <div className="mt-2 text-sm font-medium text-white">{selectedIdea.location || "Not set"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">CTA</div>
                      <div className="mt-2 text-sm font-medium text-white">{selectedIdea.call_to_action || selectedIdea.cta || "Not set"}</div>
                    </div>
                  </div>

                  {selectedIdea.caption && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Caption</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/80">{selectedIdea.caption}</p>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <button
                      onClick={() => setShowTargetingDetails((prev) => !prev)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">Targeting context</div>
                        <div className="mt-1 text-xs text-white/55">Expand to inspect who this ad is aimed at before launch.</div>
                      </div>
                      <span className="text-sm text-[#00C2CB]">{showTargetingDetails ? "Hide" : "Show"}</span>
                    </button>

                    {showTargetingDetails && (
                      <div className="grid gap-3 border-t border-white/10 px-4 py-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Audience summary</div>
                          <div className="mt-2 text-sm text-white/80">{selectedIdea.audience || "No audience summary provided"}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Age range</div>
                          <div className="mt-2 text-sm text-white/80">{selectedAgeRange.length === 2 ? `${selectedAgeRange[0]}–${selectedAgeRange[1]}` : "Not specified"}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Gender</div>
                          <div className="mt-2 text-sm text-white/80">{selectedIdea.gender || "All genders"}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Placement strategy</div>
                          <div className="mt-2 text-sm text-white/80">{selectedIdea.placements_type || "Automatic placements"}</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Interests</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedInterests.length > 0 ? selectedInterests.map((interest) => (
                              <span key={interest} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/75">
                                {interest}
                              </span>
                            )) : <span className="text-sm text-white/55">No interests supplied</span>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Manual placements</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedPlacements.length > 0 ? selectedPlacements.map((placement) => (
                              <span key={placement} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/75">
                                {placement}
                              </span>
                            )) : <span className="text-sm text-white/55">No manual placements supplied</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-white/5 px-5 pb-5 pt-2">
                  {selectedIdea.status === "pending" && (
                    <div className="mb-3 flex gap-2">
                      <button
                        onClick={async () => {
                          const ok = await handleStatusChange(selectedIdea.id, "approved");
                          if (ok) {
                            await sendToMeta(selectedIdea.id);
                          }
                        }}
                        className="w-full rounded-xl bg-[#00C2CB] py-2.5 text-sm font-semibold text-black shadow-[0_0_20px_rgba(0,194,203,0.35)] transition hover:bg-[#00b0b8]"
                      >
                        Approve &amp; Launch
                      </button>
                      <button
                        onClick={async () => {
                          await handleStatusChange(selectedIdea.id, "rejected", "Rejected by business");
                          setSelectedIdea((prev) => (prev ? { ...prev, status: "rejected" } : null));
                        }}
                        className="w-full rounded-xl border border-red-500/40 bg-[#2b1515] py-2.5 text-sm font-semibold text-red-300 transition hover:bg-[#3a1a1a]"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  <button
                    className="w-full rounded-xl bg-[#00C2CB]/10 py-2.5 text-sm font-medium text-[#00C2CB] transition hover:bg-[#00C2CB]/20"
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
        )}
      </div>
    </div>
  );
}
