interface OfferRow {
  id: string;
  title: string;
  business_email: string;
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

        const { data, error } = await supabase
          .from("organic_posts")
          .select("*")
          .eq("business_email", session.user.email)
          .order('created_at', { ascending: false });

        if (error) {
          console.error("[❌ Error fetching organic posts]", error);
        } else {
          setPosts(data);
          if (data && data.length > 0) {
            setSelectedPostInDropdown(data[0]);
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
      const { error: updateError } = await supabase
        .from("organic_posts")
        .update({ status: newStatus } as any)
        .eq("id", postId);

      if (updateError) throw updateError;

      if (newStatus === "approved") {
        // Determine media_url: use video_url if it exists, otherwise fallback to image_url
        const media_url = post.video_url || post.image_url;

        // FIX: Ensure offer_id from the organic_posts row is always used when upserting to live_campaigns
        // This guarantees correct association between the campaign and the offer
        const correctOfferId = post.offer_id;

        const { error: insertError } = await supabase
          .from("live_campaigns")
          .insert([
            {
              type: "organic",
              offer_id: correctOfferId,
              business_email: post.business_email,
              affiliate_email: post.affiliate_email,
              media_url: media_url,
              caption: post.caption,
              platform: post.platform,
              created_from: "post-ideas",
              status: "scheduled",
            } as any,
          ]);

        if (insertError) throw insertError;
      }

      window.location.reload();
    } catch (err) {
      console.error("❌ handleStatusChange error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-10 text-white">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-6">Post Requests</h1>

      {posts.length === 0 ? (
        <p className="text-gray-600">New post ideas.</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-white mb-4">No new posts to review</h2>
          <div className="space-y-6">
            {posts.filter(p => p.status === 'pending').map((post) => (
              <div
                key={post.id}
                className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl px-6 py-5 shadow-md flex justify-between items-center hover:shadow-[0_0_8px_#00C2CB] transition-all"
              >
                <div className="flex items-center gap-4">
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
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    post.status === 'approved' ? 'bg-green-500/20 text-green-300'
                    : post.status === 'rejected' ? 'bg-red-500/20 text-red-400'
                    : 'bg-yellow-400/20 text-yellow-300'
                  }`}>
                    {post.status}
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleStatusChange(post.id, 'approved', post)}
                      className="bg-[#00C2CB] text-black hover:bg-[#00b0b8] px-4 py-2 rounded-lg text-sm font-semibold"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusChange(post.id, 'rejected', post)}
                      className="bg-[#2c2c2c] text-gray-300 hover:bg-[#3a3a3a] px-4 py-2 rounded-lg text-sm"
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
              className="cursor-pointer mt-10 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#00C2CB] font-semibold px-6 py-3 rounded-lg text-center shadow transition-all"
            >
              {showRecent ? 'Hide Recent Posts' : 'Show Recent Posts'}
            </div>
            {showRecent && (
              <div className="space-y-6 mt-4">
                {posts.filter(p => p.status !== 'pending').map((post) => (
                  <div
                    key={post.id}
                    className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl px-6 py-5 shadow-md flex justify-between items-center"
                  >
                    <div className="flex items-center gap-4">
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
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        post.status === 'approved' ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-400'
                      }`}>
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

      {selectedPost && (
        <div className="fixed z-50 inset-0 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" onClick={() => setSelectedPost(null)} />
          <div className="bg-gradient-to-b from-[#1f1f1f] to-[#111111] text-white p-0 rounded-lg shadow-lg z-50 max-w-sm w-full overflow-hidden border border-gray-800">
            <div className="flex flex-col bg-gradient-to-b from-gray-800 to-gray-900 text-white">
              {/** determine post kind once for conditional rendering */}
              {/* kind is declared in the header block below */}
              {(() => {
                const kind = inferPostKind(selectedPost);
                if (kind === 'email') {
                  const { subject } = parseEmailFromCaption(selectedPost.caption);
                  return (
                    <div className="p-4 border-b border-gray-800 bg-[#111111]">
                      <div className="text-xs text-white/60 mb-1">Email</div>
                      <div className="text-lg font-semibold">{subject}</div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        From: {selectedPost.affiliate_email} • To: (audience segment)
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#ff5757] to-[#8c52ff] text-white flex items-center justify-center font-bold text-sm">
                      {selectedPost.affiliate_email.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-sm font-semibold">@{selectedPost.affiliate_email.split('@')[0]}</div>
                  </div>
                );
              })()}

              {(() => {
                const kind = inferPostKind(selectedPost);
                if (kind === 'social') {
                  return selectedPost.video_url ? (
                    <video
                      src={selectedPost.video_url}
                      controls
                      className="w-full h-auto max-h-[500px] object-cover bg-black"
                    />
                  ) : (
                    <img
                      src={selectedPost.image_url}
                      alt="Post Image"
                      className="w-full h-auto max-h-[500px] object-contain bg-gray-800"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement & { dataset: any };
                        if (!target.dataset.fallbackUsed) {
                          target.src = '/fallback-organic-post.png';
                          target.dataset.fallbackUsed = 'true';
                        }
                      }}
                    />
                  );
                }
                if (kind === 'email') {
                  const { body } = parseEmailFromCaption(selectedPost.caption);
                  return (
                    <div className="w-full bg-[#0f0f0f] border-t border-b border-gray-800">
                      <div className="px-4 py-4 text-sm whitespace-pre-wrap text-gray-200 leading-6">
                        {body}
                      </div>
                    </div>
                  );
                }
                if (kind === 'forum') {
                  const { titleOrUrl, body } = parseForumFromCaption(selectedPost.caption);
                  return (
                    <div className="w-full bg-[#0f0f0f] border-t border-b border-gray-800">
                      <div className="px-4 py-3 border-b border-gray-800">
                        <div className="text-xs text-white/60 mb-1">Forum Posting Preview</div>
                        <div className="text-base font-semibold break-all">{titleOrUrl}</div>
                        <div className="text-[11px] text-gray-400 mt-1">
                          Posted by: @{selectedPost.affiliate_email.split('@')[0]} • Platform: {selectedPost.platform}
                        </div>
                      </div>
                      <div className="px-4 py-4 text-sm whitespace-pre-wrap text-gray-200">
                        {body}
                      </div>
                    </div>
                  );
                }
                // Fallback
                return (
                  <div className="w-full bg-[#0f0f0f] border-t border-b border-gray-800 px-4 py-4 text-sm text-gray-300 whitespace-pre-wrap">
                    {selectedPost.caption || 'No preview available.'}
                  </div>
                );
              })()}

              {inferPostKind(selectedPost) !== 'email' && (
                <div className="px-4 py-2 text-sm bg-[#0f0f0f] border-t border-gray-800">
                  <p>
                    <span className="font-semibold">@{selectedPost.affiliate_email.split('@')[0]}</span>{' '}
                    posted on {selectedPost.platform}
                  </p>
                </div>
              )}

              {inferPostKind(selectedPost) === 'social' && selectedPost.caption && (
                <div className="px-4 py-2 text-sm text-gray-300 whitespace-pre-wrap bg-[#0f0f0f] border-t border-gray-800">
                  {selectedPost.caption}
                </div>
              )}

              <div className="px-4 py-3 text-sm space-y-1 bg-[#0f0f0f] border-t border-gray-800">
                <div className="text-xs text-white/60">Link: {selectedPost.link}</div>
                <div className="text-xs">Status: <span className={`font-semibold ${
                  selectedPost.status === 'approved'
                    ? 'text-green-600'
                    : selectedPost.status === 'rejected'
                    ? 'text-red-500'
                    : 'text-yellow-600'
                }`}>{selectedPost.status}</span></div>
                <p className="mt-2 text-sm text-gray-400 italic">Submitted on {new Date(selectedPost.created_at).toLocaleDateString()}</p>
              </div>

              <div className="p-4 bg-[#0f0f0f] border-t border-gray-800">
                <button
                  className="w-full py-2 rounded bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-medium text-sm"
                  onClick={() => setSelectedPost(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}