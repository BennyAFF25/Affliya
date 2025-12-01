interface OfferRow {
  id: string;
  title: string;
  business_email: string;
}

interface ProfileRow {
  email: string;
  avatar_url: string | null;
}
'use client';

import { useEffect, useState, Fragment } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from '@/../utils/supabase/pages-client';
import { Listbox, Transition, Dialog } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

interface PostIdea {
  id: string;
  affiliate_email: string;
  caption: string;
  platform: string;
  image_url: string;
  video_url?: string;
  status: string;
  created_at: string;
  offer_id: string;
  link?: string;
}

interface Offer {
  id: string;
  businessName: string;
  businessEmail: string;
}

type PostKind = 'social' | 'email' | 'forum';

function inferPostKind(p: { platform?: string; caption?: string }): PostKind {
  const plat = (p.platform || '').toLowerCase();
  const cap = (p.caption || '').trim();
  if (plat === 'email' || cap.startsWith('[EMAIL]')) return 'email';
  if (plat === 'forum' || cap.startsWith('[FORUM]')) return 'forum';
  return 'social';
}

function parseEmailFromCaption(caption?: string): { subject: string; body: string } {
  const cap = caption || '';
  if (cap.startsWith('[EMAIL]')) {
    const subjMatch = cap.match(/Subject:\s*(.*)/i);
    const bodyMatch = cap.split(/Body:\s*/i)[1];
    const subject = (subjMatch?.[1] || '').trim() || '(no subject)';
    const body = (bodyMatch || '').trim() || '(no body)';
    return { subject, body };
  }
  // Fallback: first line as subject, rest as body
  const [first, ...rest] = cap.split('\n');
  return { subject: (first || '(no subject)').trim(), body: rest.join('\n').trim() || '(no body)' };
}

function parseForumFromCaption(caption?: string): { titleOrUrl: string; body: string } {
  const cap = caption || '';
  if (cap.startsWith('[FORUM]')) {
    const titleMatch = cap.match(/URL\/Title:\s*(.*)/i);
    const bodyMatch = cap.split(/Post:\s*/i)[1];
    const titleOrUrl = (titleMatch?.[1] || '').trim() || '(no url/title)';
    const body = (bodyMatch || '').trim() || '(no content)';
    return { titleOrUrl, body };
  }
  // Fallback: first line as title/url, rest as body
  const [first, ...rest] = cap.split('\n');
  return { titleOrUrl: (first || '(no url/title)').trim(), body: rest.join('\n').trim() || '(no content)' };
}

export default function PostIdeasPage() {
  const [posts, setPosts] = useState<PostIdea[]>([]);
  const [offersMap, setOffersMap] = useState<Record<string, string>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const session = useSession();
  const user = session?.user;
 
  const [selectedPost, setSelectedPost] = useState<PostIdea | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPostInDropdown, setSelectedPostInDropdown] = useState<PostIdea | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    const fetchOffers = async () => {
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('offers')
        .select('id, title, business_email')
        .eq('business_email', user.email);

      const offers = data as OfferRow[];

      if (error) {
        console.error('[❌ Error fetching offers]', error.message);
        return;
      }

      const map: Record<string, string> = {};
      offers?.forEach((offer) => {
        map[offer.id] = offer.title;
      });
      setOffersMap(map);
    };

    fetchOffers();
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
        } else {
          const typedData = (data || []) as PostIdea[];
          setPosts(typedData);
          if (typedData.length > 0) {
            setSelectedPostInDropdown(typedData[0]);
          }

          // 🔹 Load avatar URLs for all unique affiliate emails
          if (typedData.length > 0) {
            const uniqueEmails = Array.from(
              new Set(
                typedData
                  .map((p) => p.affiliate_email)
                  .filter((email): email is string => !!email)
              )
            );

            if (uniqueEmails.length > 0) {
              const { data: profileRows, error: profileError } = await (supabase as any)
                .from('affiliate_profiles')
                .select('email, avatar_url')
                .in('email', uniqueEmails);

              if (profileError) {
                console.error('[❌ Error fetching profile avatars]', profileError);
              } else if (profileRows) {
                const map: Record<string, string | null> = {};
                (profileRows as ProfileRow[]).forEach((p) => {
                  map[p.email] = p.avatar_url;
                });
                setAvatarMap(map);
              }
            }
          }
        }
      } catch (err) {
        console.error("[❌ Unexpected error fetching posts]", err);
      }
    };

    fetchOrganicPosts();
  }, [session]);

  const statusColors = {
    approved: 'bg-green-600 text-green-100',
    rejected: 'bg-red-600 text-red-100',
    pending: 'bg-yellow-600 text-yellow-100',
  };

  // Handles status change for post approval/rejection and updates/inserts accordingly
  const handleStatusChange = async (
    postId: string,
    newStatus: "approved" | "rejected",
    post: any
  ) => {
    try {
      const { error: updateError } = await (supabase as any)
        .from("organic_posts")
        .update({ status: newStatus })
        .eq("id", postId);

      if (updateError) throw updateError;

      if (newStatus === "approved") {
        // Determine media_url: use video_url if it exists, otherwise fallback to image_url
        const media_url = post.video_url || post.image_url;

        // FIX: Ensure offer_id from the organic_posts row is always used when upserting to live_campaigns
        // This guarantees correct association between the campaign and the offer
        const correctOfferId = post.offer_id;

        const { error: insertError } = await (supabase as any)
          .from("live_campaigns")
          .insert([
            {
              type: "organic",
              offer_id: correctOfferId,
              business_email: post.business_email,
              affiliate_email: post.affiliate_email,
              media_url,
              caption: post.caption,
              platform: post.platform,
              created_from: "post-ideas",
              status: "live",
            },
          ] as any[]);

        if (insertError) throw insertError;
      }

      window.location.reload();
    } catch (err) {
      console.error("❌ handleStatusChange error:", err);
    }
  };

  // Arrays for pending and reviewed posts
  const pendingPosts = posts.filter((p) => p.status === 'pending');
  const reviewedPosts = posts.filter((p) => p.status !== 'pending');

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 sm:px-8 lg:px-10 text-white">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-6">Post Requests</h1>

      {posts.length === 0 ? (
        <p className="text-gray-600">New post ideas will appear here once affiliates submit them.</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-white mb-4">
            {pendingPosts.length > 0 ? 'New posts to review' : 'No new posts to review'}
          </h2>
          <div className="space-y-6">
            {pendingPosts.map((post) => (
              <div
                key={post.id}
                className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl px-4 py-4 sm:px-6 sm:py-5 shadow-md flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:shadow-[0_0_8px_#00C2CB] transition-all"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-8 h-8 flex items-center justify-center bg-[#00C2CB]/20 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#00C2CB]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.828a2 2 0 00-.586-1.414l-5.828-5.828A2 2 0 0013.172 1H5zm7 0v6h6l-6-6z" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-semibold text-white">{offersMap[post.offer_id] || 'Unknown Offer'}</h2>
                    <p className="text-sm text-gray-400">{post.platform}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-sm text-gray-400">
                        <span className="font-semibold text-white">Affiliate:</span> {post.affiliate_email}
                      </p>
                      <button
                        onClick={() => setSelectedPost(post)}
                        className="text-sm text-[#00C2CB] hover:underline"
                      >
                        View Detail
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      post.status === 'approved'
                        ? 'bg-green-500/20 text-green-300'
                        : post.status === 'rejected'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-400/20 text-yellow-300'
                    }`}
                  >
                    {post.status}
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleStatusChange(post.id, 'approved', post)}
                      className="w-full sm:w-auto bg-[#00C2CB] text-black hover:bg-[#00b0b8] px-4 py-2 rounded-lg text-sm font-semibold text-center"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusChange(post.id, 'rejected', post)}
                      className="w-full sm:w-auto bg-[#2c2c2c] text-gray-300 hover:bg-[#3a3a3a] px-4 py-2 rounded-lg text-sm text-center"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <div
              onClick={() => setShowRecent((prev) => !prev)}
              className="cursor-pointer mt-8 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#00C2CB] font-semibold px-4 py-3 rounded-lg text-center shadow transition-all w-full max-w-md mx-auto"
            >
              {showRecent ? 'Hide Recent Posts' : 'Show Recent Posts'}
            </div>
            {showRecent && (
              <div className="space-y-6 mt-4">
                {reviewedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl px-4 py-4 sm:px-6 sm:py-5 shadow-md flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 flex items-center justify-center bg-[#00C2CB]/20 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#00C2CB]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.828a2 2 0 00-.586-1.414l-5.828-5.828A2 2 0 0013.172 1H5zm7 0v6h6l-6-6z" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <h2 className="text-xl font-semibold text-white">{offersMap[post.offer_id] || 'Unknown Offer'}</h2>
                        <p className="text-sm text-gray-400">{post.platform}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-sm text-gray-400">
                            <span className="font-semibold text-white">Affiliate:</span> {post.affiliate_email}
                          </p>
                          <button
                            onClick={() => setSelectedPost(post)}
                            className="text-sm text-[#00C2CB] hover:underline"
                          >
                            View Detail
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          post.status === 'approved'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <section className="mt-12 text-center text-gray-500">
        {posts.length === 0 && (
          <p>No post ideas have been submitted yet. Once affiliates submit posts, they will appear here for review.</p>
        )}
      </section>

      {selectedPost && (() => {
        const kind = inferPostKind(selectedPost);
        const handle = selectedPost.affiliate_email.split("@")[0];
        const affiliateEmail = selectedPost.affiliate_email;
        const avatarUrl = avatarMap[affiliateEmail] || null;
        const submittedDate = new Date(selectedPost.created_at).toLocaleDateString();

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => setSelectedPost(null)}
            />

            {/* Card */}
            <div className="relative z-50 w-full max-w-sm rounded-3xl bg-[#05080a] border border-[#151b1f] shadow-[0_20px_60px_rgba(0,0,0,0.75)] overflow-hidden">
              {/* Top bar / header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#151b1f] bg-gradient-to-r from-[#050b0d] via-[#05080a] to-[#050b0d]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#00C2CB] via-[#7ff5fb] to-[#00C2CB] p-[2px]">
                    <div className="h-full w-full rounded-full bg-[#05080a] flex items-center justify-center overflow-hidden">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={handle}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-xs font-semibold text-[#7ff5fb]">
                          {handle.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">@{handle}</span>
                      <span className="h-1 w-1 rounded-full bg-white/30" />
                      <span className="text-[11px] text-white/60">
                        {kind === "email"
                          ? "Email draft"
                          : kind === "forum"
                          ? "Forum post"
                          : `${selectedPost.platform || "Social"}`}
                      </span>
                    </div>
                    <span className="text-[11px] text-white/40">
                      Submitted on {submittedDate}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPost(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Media / body */}
              {kind === "social" && (
                <>
                  {/* media */}
                  <div className="bg-black max-h-[460px]">
                    {selectedPost.video_url ? (
                      <video
                        src={selectedPost.video_url}
                        controls
                        className="w-full h-full max-h-[460px] object-contain bg-black"
                      />
                    ) : (
                      <img
                        src={selectedPost.image_url}
                        alt="Post media"
                        className="w-full h-full max-h-[460px] object-contain bg-black"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement & { dataset: any };
                          if (!target.dataset.fallbackUsed) {
                            target.src = "/fallback-organic-post.png";
                            target.dataset.fallbackUsed = "true";
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* fake actions row */}
                  <div className="flex items-center gap-5 px-4 pt-3 pb-1 text-white/70 text-[18px]">
                    <span>♡</span>
                    <span>💬</span>
                    <span>↗︎</span>
                  </div>

                  {/* caption */}
                  {selectedPost.caption && (
                    <div className="px-4 pb-3 text-sm text-gray-200 whitespace-pre-wrap">
                      <span className="font-semibold mr-1">@{handle}</span>
                      {selectedPost.caption}
                    </div>
                  )}
                </>
              )}

              {kind === "email" && (() => {
                const { subject, body } = parseEmailFromCaption(selectedPost.caption);
                return (
                  <div className="border-t border-[#151b1f] bg-[#05080a]">
                    <div className="px-4 pt-3 pb-2">
                      <div className="text-[11px] text-white/50 mb-1">Email draft</div>
                      <div className="text-sm font-semibold text-white mb-1">
                        {subject}
                      </div>
                      <div className="text-[11px] text-white/50">
                        From: {selectedPost.affiliate_email} • To: (audience segment)
                      </div>
                    </div>
                    <div className="px-4 pb-3 text-sm text-gray-200 whitespace-pre-wrap border-t border-[#151b1f]">
                      {body}
                    </div>
                  </div>
                );
              })()}

              {kind === "forum" && (() => {
                const { titleOrUrl, body } = parseForumFromCaption(selectedPost.caption);
                return (
                  <div className="border-t border-[#151b1f] bg-[#05080a]">
                    <div className="px-4 pt-3 pb-2">
                      <div className="text-[11px] text-white/50 mb-1">Forum post preview</div>
                      <div className="text-sm font-semibold text-white break-all mb-1">
                        {titleOrUrl}
                      </div>
                      <div className="text-[11px] text-white/50">
                        Posted by @{handle} • Platform: {selectedPost.platform}
                      </div>
                    </div>
                    <div className="px-4 pb-3 text-sm text-gray-200 whitespace-pre-wrap border-t border-[#151b1f]">
                      {body}
                    </div>
                  </div>
                );
              })()}

              {/* Meta + status */}
              <div className="px-4 py-3 border-t border-[#151b1f] bg-[#05080a] text-xs text-gray-300 space-y-1.5">
                {selectedPost.link && (
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-wide text-[10px] text-white/40">
                      Link
                    </span>
                    <span className="truncate text-[11px] text-[#7ff5fb]">
                      {selectedPost.link}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-wide text-[10px] text-white/40">
                    Status
                  </span>
                  <span
                    className={`
                      inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium
                      ${
                        selectedPost.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                          : selectedPost.status === "rejected"
                          ? "bg-red-500/15 text-red-300 border border-red-500/40"
                          : "bg-amber-400/10 text-amber-200 border border-amber-400/40"
                      }
                    `}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {selectedPost.status}
                  </span>
                </div>

                <p className="text-[11px] text-white/40">
                  Submitted on {submittedDate}
                </p>
              </div>

              {/* Close CTA */}
              <button
                className="w-full py-2.5 text-sm font-semibold bg-[#00C2CB] hover:bg-[#00b0b8] text-black transition-colors"
                onClick={() => setSelectedPost(null)}
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}