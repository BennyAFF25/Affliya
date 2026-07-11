"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";
import { TRACKING_NOT_READY_MESSAGE } from "@/../utils/approvals/enforcement";
import { Button, EmptyState, StatCard, StatusBadge } from "@/../components/ui";

interface OfferRow {
  id: string;
  title: string;
  business_email: string;
}

interface ProfileRow {
  email: string;
  avatar_url: string | null;
}

interface PostIdea {
  id: string;
  affiliate_email: string;
  business_email?: string;
  caption: string;
  platform: string;
  image_url: string;
  video_url?: string;
  status: string;
  created_at: string;
  offer_id: string;
  link?: string;
}

type PostKind = "social" | "email" | "forum";

type PostStatus = "approved" | "rejected" | "pending";

function inferPostKind(p: { platform?: string; caption?: string }): PostKind {
  const plat = (p.platform || "").toLowerCase();
  const cap = (p.caption || "").trim();
  if (plat === "email" || cap.startsWith("[EMAIL]")) return "email";
  if (plat === "forum" || cap.startsWith("[FORUM]")) return "forum";
  return "social";
}

function parseEmailFromCaption(caption?: string): {
  subject: string;
  body: string;
} {
  const cap = caption || "";
  if (cap.startsWith("[EMAIL]")) {
    const subjMatch = cap.match(/Subject:\s*(.*)/i);
    const bodyMatch = cap.split(/Body:\s*/i)[1];
    const subject = (subjMatch?.[1] || "").trim() || "(no subject)";
    const body = (bodyMatch || "").trim() || "(no body)";
    return { subject, body };
  }

  const [first, ...rest] = cap.split("\n");
  return {
    subject: (first || "(no subject)").trim(),
    body: rest.join("\n").trim() || "(no body)",
  };
}

function parseForumFromCaption(caption?: string): {
  titleOrUrl: string;
  body: string;
} {
  const cap = caption || "";
  if (cap.startsWith("[FORUM]")) {
    const titleMatch = cap.match(/URL\/Title:\s*(.*)/i);
    const bodyMatch = cap.split(/Post:\s*/i)[1];
    const titleOrUrl = (titleMatch?.[1] || "").trim() || "(no url/title)";
    const body = (bodyMatch || "").trim() || "(no content)";
    return { titleOrUrl, body };
  }

  const [first, ...rest] = cap.split("\n");
  return {
    titleOrUrl: (first || "(no url/title)").trim(),
    body: rest.join("\n").trim() || "(no content)",
  };
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

function kindLabel(kind: PostKind, platform?: string) {
  if (kind === "email") return "Email draft";
  if (kind === "forum") return "Forum post";
  return platform || "Social post";
}

function captionSnippet(caption?: string) {
  const raw = (caption || "").replace(/^\[(EMAIL|FORUM)\]\s*/i, "").trim();
  if (!raw) return "No caption supplied";
  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
}

export default function PostIdeasPage() {
  const [posts, setPosts] = useState<PostIdea[]>([]);
  const [offersMap, setOffersMap] = useState<Record<string, string>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const [selectedPost, setSelectedPost] = useState<PostIdea | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const session = useSession();
  const user = session?.user;

  useEffect(() => {
    const fetchOffers = async () => {
      if (!user?.email) return;

      const { data, error } = await supabase
        .from("offers")
        .select("id, title, business_email")
        .eq("business_email", user.email);

      const offers = data as OfferRow[];

      if (error) {
        console.error("[❌ Error fetching offers]", error.message);
        return;
      }

      const map: Record<string, string> = {};
      offers?.forEach((offer) => {
        map[offer.id] = offer.title;
      });
      setOffersMap(map);
    };

    void fetchOffers();
  }, [user?.email]);

  useEffect(() => {
    const fetchOrganicPosts = async () => {
      try {
        if (!session?.user?.email) {
          console.warn("[⚠️ No session email]");
          return;
        }

        const { data, error } = await (supabase as any)
          .from("organic_posts")
          .select("*")
          .eq("business_email", session.user.email as string)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("[❌ Error fetching organic posts]", error);
          return;
        }

        const typedData = (data || []) as PostIdea[];
        setPosts(typedData);

        const uniqueEmails = Array.from(
          new Set(
            typedData
              .map((p) => p.affiliate_email)
              .filter((email): email is string => !!email),
          ),
        );

        if (uniqueEmails.length === 0) return;

        const { data: profileRows, error: profileError } = await (supabase as any)
          .from("affiliate_profiles")
          .select("email, avatar_url")
          .in("email", uniqueEmails);

        if (profileError) {
          console.error("[❌ Error fetching profile avatars]", profileError);
          return;
        }

        const map: Record<string, string | null> = {};
        (profileRows as ProfileRow[] | null)?.forEach((profile) => {
          map[profile.email] = profile.avatar_url;
        });
        setAvatarMap(map);
      } catch (err) {
        console.error("[❌ Unexpected error fetching posts]", err);
      }
    };

    void fetchOrganicPosts();
  }, [session]);

  const handleStatusChange = async (
    postId: string,
    newStatus: Extract<PostStatus, "approved" | "rejected">,
    post: PostIdea,
  ) => {
    try {
      if (newStatus === "approved") {
        const readinessRes = await fetch("/api/business/tracking-readiness", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offerIds: [post.offer_id] }),
        });
        const readinessJson = await readinessRes.json().catch(() => null);
        const trackingReady =
          readinessRes.ok &&
          Array.isArray(readinessJson?.verifiedOfferIds) &&
          readinessJson.verifiedOfferIds.includes(post.offer_id);

        if (!trackingReady) {
          window.alert(TRACKING_NOT_READY_MESSAGE);
          return;
        }
      }

      const { error: updateError } = await (supabase as any)
        .from("organic_posts")
        .update({ status: newStatus })
        .eq("id", postId);

      if (updateError) throw updateError;

      let notificationLink = "/affiliate/inbox";

      if (newStatus === "approved") {
        const media_url = post.video_url || post.image_url;
        const correctOfferId = post.offer_id;

        const campaignRes = await fetch("/api/business/organic-campaigns", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(session?.access_token
              ? { authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            offerId: correctOfferId,
            businessEmail: post.business_email,
            affiliateEmail: post.affiliate_email,
            mediaUrl: media_url,
            caption: post.caption,
            platform: post.platform,
          }),
        });
        const campaignJson = await campaignRes.json().catch(() => null);

        if (!campaignRes.ok || !campaignJson?.success) {
          throw new Error(
            campaignJson?.message ||
              "Failed to create the organic campaign after approval.",
          );
        }

        if (campaignJson?.campaignId) {
          notificationLink = `/affiliate/dashboard/manage-campaigns/${campaignJson.campaignId}`;
        }
      } else if (post.offer_id) {
        notificationLink = `/affiliate/dashboard/promote/${post.offer_id}`;
      }

      const offerTitle = offersMap[post.offer_id] || "your offer";
      const notificationTitle =
        newStatus === "approved"
          ? `Organic post approved: ${offerTitle}`
          : `Organic post needs changes: ${offerTitle}`;
      const notificationBody =
        newStatus === "approved"
          ? "Your post is now live. Open the campaign to see the tracked link, campaign stats, and the code attached to this placement."
          : "This post was not approved yet. Open it to review the feedback and update your draft.";

      const { error: notificationError } = await (supabase as any)
        .from("notifications")
        .insert([
          {
            user_email: post.affiliate_email,
            title: notificationTitle,
            body: notificationBody,
            link_url: notificationLink,
          },
        ] as any[]);

      if (notificationError) {
        console.warn("[organic post] notification insert failed", notificationError);
      }

      setPosts((prev) =>
        prev.map((item) =>
          item.id === postId ? { ...item, status: newStatus } : item,
        ),
      );
      setSelectedPost((prev) =>
        prev && prev.id === postId ? { ...prev, status: newStatus } : prev,
      );
    } catch (err) {
      console.error("❌ handleStatusChange error:", err);
    }
  };

  const pendingPosts = posts.filter((p) => p.status === "pending");
  const reviewedPosts = posts.filter((p) => p.status !== "pending");
  const approvedCount = posts.filter((p) => p.status === "approved").length;
  const selectedKind = selectedPost ? inferPostKind(selectedPost) : null;
  const selectedHandle = selectedPost?.affiliate_email.split("@")[0] || "";
  const selectedAvatarUrl = selectedPost
    ? avatarMap[selectedPost.affiliate_email] || null
    : null;

  return (
    <div className="post-ideas-theme min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(0,194,203,0.18),transparent_32%),linear-gradient(135deg,#11181a_0%,#0c1011_52%,#070808_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7ff5fb]">
                Organic review queue
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Post Requests
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/65 md:text-base">
                Review submitted posts, inspect how the affiliate plans to publish them, and approve the strongest placements without the clunky old modal flow.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Pending" value={pendingPosts.length} tone="warning" />
              <StatCard label="Approved" value={approvedCount} tone="success" />
              <StatCard label="Recently reviewed" value={reviewedPosts.length} tone="muted" className="col-span-2 sm:col-span-1" />
            </div>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#111517] px-6 py-12 text-center shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 text-[#00C2CB]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.828a2 2 0 00-.586-1.414l-5.828-5.828A2 2 0 0013.172 1H5zm7 0v6h6" />
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">No post ideas submitted yet</h2>
            <p className="mt-2 text-sm text-white/60">New organic post ideas will appear here once affiliates submit them.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Pending review</h2>
                <p className="text-sm text-white/55">Preview the post cleanly, then expand execution context if you need more detail.</p>
              </div>
              <button
                onClick={() => setShowRecent((prev) => !prev)}
                className="rounded-full border border-white/10 bg-[#111517] px-4 py-2 text-sm font-medium text-[#00C2CB] transition hover:bg-[#161b1d]"
              >
                {showRecent ? "Hide recent reviews" : `Show recent reviews (${reviewedPosts.length})`}
              </button>
            </div>

            {pendingPosts.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-[#111517] px-6 py-10 text-center text-white/65 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                <p className="text-lg font-semibold text-white">No new posts to review</p>
                <p className="mt-2 text-sm">You’re caught up. Reviewed requests stay available below.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {pendingPosts.map((post) => {
                  const kind = inferPostKind(post);
                  return (
                    <div
                      key={post.id}
                      className="rounded-3xl border border-white/10 bg-[#111517] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition hover:border-[#00C2CB]/30 hover:shadow-[0_0_0_1px_rgba(0,194,203,0.18),0_18px_50px_rgba(0,0,0,0.22)] md:p-6"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/10 text-[#00C2CB]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.828a2 2 0 00-.586-1.414l-5.828-5.828A2 2 0 0013.172 1H5zm7 0v6h6" />
                            </svg>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold text-white">
                                {offersMap[post.offer_id] || "Unknown Offer"}
                              </h3>
                              <StatusBadge status={post.status} />
                            </div>
                            <p className="mt-2 text-sm text-white/60">
                              Submitted by <span className="font-medium text-white/80">{post.affiliate_email}</span> · {formatIdeaDate(post.created_at)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{kindLabel(kind, post.platform)}</span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{post.platform || "Platform not set"}</span>
                              {post.link && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Tracked link attached</span>
                              )}
                            </div>
                            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72">
                              {captionSnippet(post.caption)}
                            </p>
                          </div>
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[250px]">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setSelectedPost(post);
                              setShowContextDetails(false);
                            }}
                          >
                            View details
                          </Button>
                          <div className="flex gap-3">
                            <Button
                              type="button"
                              onClick={() => void handleStatusChange(post.id, "approved", post)}
                              className="flex-1"
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void handleStatusChange(post.id, "rejected", post)}
                              className="flex-1"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showRecent && (
              <div className="mt-8 space-y-4">
                {reviewedPosts.length === 0 ? (
                  <EmptyState
                    title="No reviewed requests yet"
                    description="Approved and rejected organic submissions will appear here."
                    className="py-8"
                  />
                ) : (
                  reviewedPosts.map((post) => {
                    const kind = inferPostKind(post);
                    return (
                      <div
                        key={post.id}
                        className="rounded-3xl border border-white/10 bg-[#111517] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] md:p-6"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-white">
                                {offersMap[post.offer_id] || "Unknown Offer"}
                              </h3>
                              <StatusBadge status={post.status} />
                            </div>
                            <p className="mt-2 text-sm text-white/60">
                              {post.affiliate_email} · {formatIdeaDate(post.created_at)}
                            </p>
                            <p className="mt-2 text-sm text-white/55">{kindLabel(kind, post.platform)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setSelectedPost(post);
                              setShowContextDetails(false);
                            }}
                          >
                            View details
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {selectedPost && selectedKind && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => setSelectedPost(null)}
            />

            <div className="relative z-50 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[#151b1f] bg-[#05080a] shadow-[0_20px_60px_rgba(0,0,0,0.75)]">
              <div className="h-1 w-full bg-gradient-to-r from-[#00C2CB] via-[#7ff5fb] to-[#00C2CB]" />

              <div className="border-b border-[#151b1f] bg-gradient-to-r from-[#050b0d] via-[#05080a] to-[#050b0d] px-5 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#00C2CB] via-[#7ff5fb] to-[#00C2CB] p-[2px]">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-[#05080a]">
                        {selectedAvatarUrl ? (
                          <img
                            src={selectedAvatarUrl}
                            alt={selectedHandle}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-[#7ff5fb]">
                            {selectedHandle.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">@{selectedHandle}</div>
                      <div className="mt-1 text-[11px] text-white/60">
                        {offersMap[selectedPost.offer_id] || "Unknown Offer"} · {formatIdeaDate(selectedPost.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-white/50">
                    <StatusBadge status={selectedPost.status} className="text-[10px]" />
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em]">
                      {kindLabel(selectedKind, selectedPost.platform)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedKind === "social" && (
                <>
                  <div className="bg-black max-h-[460px]">
                    {selectedPost.video_url ? (
                      <video
                        src={selectedPost.video_url}
                        controls
                        className="h-full max-h-[460px] w-full bg-black object-contain"
                      />
                    ) : (
                      <img
                        src={selectedPost.image_url}
                        alt="Post media"
                        className="h-full max-h-[460px] w-full bg-black object-contain"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement & {
                            dataset: DOMStringMap;
                          };
                          if (!target.dataset.fallbackUsed) {
                            target.src = "/fallback-organic-post.png";
                            target.dataset.fallbackUsed = "true";
                          }
                        }}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-5 px-5 pb-1 pt-3 text-[18px] text-white/70">
                    <span>♡</span>
                    <span>💬</span>
                    <span>↗︎</span>
                  </div>

                  {selectedPost.caption && (
                    <div className="px-5 pb-4 text-sm whitespace-pre-wrap text-gray-200">
                      <span className="mr-1 font-semibold">@{selectedHandle}</span>
                      {selectedPost.caption}
                    </div>
                  )}
                </>
              )}

              {selectedKind === "email" && (() => {
                const { subject, body } = parseEmailFromCaption(selectedPost.caption);
                return (
                  <div className="border-t border-[#151b1f] bg-[#05080a]">
                    <div className="px-5 pb-2 pt-4">
                      <div className="mb-1 text-[11px] text-white/50">Email draft</div>
                      <div className="mb-1 text-sm font-semibold text-white">{subject}</div>
                      <div className="text-[11px] text-white/50">
                        From: {selectedPost.affiliate_email} • To: audience segment
                      </div>
                    </div>
                    <div className="border-t border-[#151b1f] px-5 pb-4 pt-3 text-sm whitespace-pre-wrap text-gray-200">
                      {body}
                    </div>
                  </div>
                );
              })()}

              {selectedKind === "forum" && (() => {
                const { titleOrUrl, body } = parseForumFromCaption(selectedPost.caption);
                return (
                  <div className="border-t border-[#151b1f] bg-[#05080a]">
                    <div className="px-5 pb-2 pt-4">
                      <div className="mb-1 text-[11px] text-white/50">Forum post preview</div>
                      <div className="mb-1 break-all text-sm font-semibold text-white">{titleOrUrl}</div>
                      <div className="text-[11px] text-white/50">
                        Posted by @{selectedHandle} • Platform: {selectedPost.platform}
                      </div>
                    </div>
                    <div className="border-t border-[#151b1f] px-5 pb-4 pt-3 text-sm whitespace-pre-wrap text-gray-200">
                      {body}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-4 px-5 py-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Format</div>
                    <div className="mt-2 text-sm font-medium text-white">{kindLabel(selectedKind, selectedPost.platform)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Platform</div>
                    <div className="mt-2 text-sm font-medium text-white">{selectedPost.platform || "Not set"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Tracking link</div>
                    <div className="mt-2 truncate text-sm font-medium text-white">
                      {selectedPost.link ? "Attached" : "Not supplied"}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <button
                    onClick={() => setShowContextDetails((prev) => !prev)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">Execution context</div>
                      <div className="mt-1 text-xs text-white/55">Expand to inspect the placement context the affiliate supplied.</div>
                    </div>
                    <span className="text-sm text-[#00C2CB]">{showContextDetails ? "Hide" : "Show"}</span>
                  </button>

                  {showContextDetails && (
                    <div className="grid gap-3 border-t border-white/10 px-4 py-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Affiliate</div>
                        <div className="mt-2 text-sm text-white/80">{selectedPost.affiliate_email}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Offer</div>
                        <div className="mt-2 text-sm text-white/80">{offersMap[selectedPost.offer_id] || "Unknown Offer"}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Publishing format</div>
                        <div className="mt-2 text-sm text-white/80">{kindLabel(selectedKind, selectedPost.platform)}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Destination link</div>
                        <div className="mt-2 break-all text-sm text-white/80">{selectedPost.link || "No tracked link supplied"}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Context supplied</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/80">{selectedPost.caption || "No execution notes supplied"}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-[#151b1f] px-5 pb-5 pt-2">
                {selectedPost.status === "pending" && (
                  <div className="mb-3 flex gap-2">
                    <button
                      onClick={() => void handleStatusChange(selectedPost.id, "approved", selectedPost)}
                      className="w-full rounded-xl bg-[#00C2CB] py-2.5 text-sm font-semibold text-black shadow-[0_0_20px_rgba(0,194,203,0.35)] transition hover:bg-[#00b0b8]"
                    >
                      Approve &amp; publish
                    </button>
                    <button
                      onClick={() => void handleStatusChange(selectedPost.id, "rejected", selectedPost)}
                      className="w-full rounded-xl border border-red-500/40 bg-[#2b1515] py-2.5 text-sm font-semibold text-red-300 transition hover:bg-[#3a1a1a]"
                    >
                      Reject
                    </button>
                  </div>
                )}

                <button
                  className="w-full rounded-xl bg-[#00C2CB]/10 py-2.5 text-sm font-medium text-[#00C2CB] transition hover:bg-[#00C2CB]/20"
                  onClick={() => {
                    setShowContextDetails(false);
                    setSelectedPost(null);
                  }}
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
