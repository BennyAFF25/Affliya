"use client";

import { useSession } from "@supabase/auth-helpers-react";
import React, { useEffect, useState } from "react";
import { supabase } from "utils/supabase/pages-client";
import { useRouter } from "next/navigation";
import { nmToast } from "@/components/ui/toast";
import { ActionBar, Badge, Button, EmptyState, ReviewCard, ReviewMetaItem, ReviewQueue, StatCard, StatusBadge } from "@/../components/ui";

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
  const session = useSession();
  const user = session?.user;
  const router = useRouter();
  const pendingIdeas = ideas.filter((i) => i.status === "pending");
  const reviewedIdeas = ideas.filter((i) => i.status !== "pending");
  const approvedCount = ideas.filter((i) => i.status === "approved").length;

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
      } catch (e) {
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 rounded-[28px] border border-[var(--border)] bg-[radial-gradient(circle_at_top_right,rgba(0,194,203,0.16),transparent_32%),var(--card)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] md:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Review queue
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#00C2CB]">
                Affiliate Promotion Requests
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                Review paid ad ideas, inspect targeting details, and approve only the campaigns ready to launch.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Pending" value={pendingIdeas.length} tone="warning" />
              <StatCard label="Approved" value={approvedCount} tone="success" />
              <StatCard label="Reviewed" value={reviewedIdeas.length} tone="muted" className="col-span-2 sm:col-span-1" />
            </div>
          </div>
        </div>

        {ideas.length === 0 ? (
          <EmptyState
            title="No ad ideas submitted yet"
            description="Paid ad submissions from affiliates will appear here for review."
          />
        ) : (
          <>
            <ReviewQueue
              title="Pending ad ideas"
              description="New paid ad ideas waiting for a business decision."
              actions={<StatusBadge status="pending" label={`${pendingIdeas.length} pending`} />}
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
                        header={(
                          <>
                            <StatusBadge status={idea.status} />
                            <Badge variant="muted">Paid ad</Badge>
                            {idea.daily_budget || idea.budget_amount ? (
                              <Badge variant="primary">Budget ${idea.daily_budget || idea.budget_amount}</Badge>
                            ) : null}
                          </>
                        )}
                        title={offersMap[idea.offer_id] || "Unknown Offer"}
                        description={`${idea.audience || "Audience not set"} · ${idea.location || "Location not set"}`}
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
                                setSelectedIdea(idea);
                                setShowTargetingDetails(false);
                              }}
                            >
                              View details
                            </Button>
                            <Button
                              type="button"
                              className="w-full"
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

            <div className="mt-8">
              <Button
                type="button"
                onClick={() => setShowRecent((prev) => !prev)}
                variant="secondary"
                className="w-full justify-center"
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
  );
}
