'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from '@/../utils/supabase/pages-client';
import { Dialog } from '@headlessui/react';

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

export default function PostIdeasPage() {
  const [posts, setPosts] = useState<PostIdea[]>([]);
  const [offersMap, setOffersMap] = useState<Record<string, string>>({});
  const session = useSession();
  const user = session?.user;

  const [selectedPost, setSelectedPost] = useState<PostIdea | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const localOffers = localStorage.getItem('my-offers');
    if (localOffers) {
      const parsedOffers: Offer[] = JSON.parse(localOffers);
      const map: Record<string, string> = {};
      parsedOffers.forEach((o) => {
        map[o.id] = o.businessEmail;
      });
      setOffersMap(map);
    }
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user?.email || Object.keys(offersMap).length === 0) return;

      const { data, error } = await supabase
        .from('organic_posts')
        .select('*')
        .in('offer_id', Object.keys(offersMap))
        .order('created_at', { ascending: false });
      

      if (error) {
        console.error('[❌ Fetch Error]', error.message);
      } else {
        setPosts(data || []);
      }
    };

    fetchPosts();
  }, [offersMap]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('organic_posts')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === id ? { ...post, status: newStatus } : post
        )
      );
    } else {
      console.error(`[❌ Update Error] Failed to update status:`, error.message);
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-6">Submitted Organic Posts</h1>

      {posts.length === 0 ? (
        <p className="text-gray-600">No organic posts submitted yet.</p>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => {
            // [🖼 Image URL]: post.image_url
            return (
              <div
                key={post.id}
                className="bg-white border border-[#00C2CB]/20 shadow-md rounded-lg p-6 transition duration-300 hover:shadow-lg hover:border-[#00C2CB] hover:ring-2 hover:ring-[#00C2CB]/40"
              >
                {/* Header: flex row with affiliate email left, status badge right */}
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold text-gray-800 text-sm">
                    {post.affiliate_email}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      post.status === 'approved'
                        ? 'bg-green-100 text-green-600'
                        : post.status === 'rejected'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-yellow-100 text-yellow-600'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                {/* Main content: platform, caption, and offer */}
                <div className="text-sm text-gray-800">
                  <span className="inline text-[13px] text-gray-600 font-medium mr-2">
                    {post.platform}
                  </span>
                  {post.caption}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Offer: {offersMap[post.offer_id] || 'Unknown'}
                </div>
                {/* View Detail button */}
                <button
                  onClick={() => {
                    setSelectedPost(post);
                    setIsOpen(true);
                  }}
                  className="mt-3 text-[#00C2CB] hover:underline"
                >
                  View Detail
                </button>
                {/* Approve/Reject buttons */}
                {post.status === 'pending' && (
                  <div className="flex gap-4 mt-4">
                    <button
                      onClick={() => handleStatusChange(post.id, 'approved')}
                      className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusChange(post.id, 'rejected')}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="fixed z-50 inset-0 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="bg-gradient-to-b from-[#1f1f1f] to-[#111111] text-white p-0 rounded-lg shadow-lg z-50 max-w-sm w-full overflow-hidden border border-gray-800">
          {selectedPost && selectedPost.platform === 'Instagram' && (
            <div className="flex flex-col bg-gradient-to-b from-gray-800 to-gray-900 text-white">
              {/* Mocked Instagram header */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#ff5757] to-[#8c52ff] text-white flex items-center justify-center font-bold text-sm">
                  {selectedPost.affiliate_email.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm font-semibold">@{selectedPost.affiliate_email.split('@')[0]}</div>
              </div>
              {/* [🖼 Image/Video]: selectedPost.video_url or selectedPost.image_url */}
              {selectedPost.video_url ? (
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
                  data-testid="organic-post-image"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallbackUsed) {
                      console.warn('[🧨 Image Load Error]', target.src);
                      target.src = '/fallback-organic-post.png';
                      target.dataset.fallbackUsed = 'true';
                    }
                  }}
                />
              )}
              <div className="px-4 py-2 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 18.657l-6.828-6.829a4 4 0 010-5.656z" />
                  </svg>
                  <span>123 likes</span>
                </div>
                {/* Caption */}
                <p>
                  <span className="font-semibold">
                    @{selectedPost.affiliate_email.split('@')[0]}
                  </span>{' '}
                  {selectedPost.caption}
                </p>
                {/* Mock comments */}
                <div className="text-sm text-white/80">
                  <p className="mb-1">
                    <span className="font-semibold">@marketingguru</span> Great post! 🔥
                  </p>
                  <p>
                    <span className="font-semibold">@growthhacks</span> This will crush on reels.
                  </p>
                </div>
              </div>
              {/* Caption & Info */}
              <div className="px-4 py-3 text-sm space-y-1">
                <div className="text-xs text-white/60">
                  Platform: {selectedPost.platform}
                </div>
                <div className="text-xs">
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      selectedPost.status === 'approved'
                        ? 'text-green-600'
                        : selectedPost.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {selectedPost.status}
                  </span>
                </div>
              </div>

              {/* Approve / Reject Buttons */}
              {selectedPost?.status === 'pending' && (
                <div className="flex gap-4 px-4 pt-4 pb-2">
                  <button
                    onClick={async () => {
                      await handleStatusChange(selectedPost.id, 'approved');
                      setSelectedPost((prev) => prev ? { ...prev, status: 'approved' } : null);
                      setIsOpen(false);
                    }}
                    className="w-full py-2 rounded bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-medium text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await handleStatusChange(selectedPost.id, 'rejected');
                      setSelectedPost((prev) => prev ? { ...prev, status: 'rejected' } : null);
                      setIsOpen(false);
                    }}
                    className="w-full py-2 rounded bg-red-500 hover:bg-red-600 text-white font-medium text-sm"
                  >
                    Reject
                  </button>
                </div>
              )}
              {/* Close Button */}
              <div className="p-4 border-t border-gray-100">
                <button
                  className="w-full py-2 rounded bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-medium text-sm"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {selectedPost && selectedPost.platform === 'Facebook' && (
            <div className="flex flex-col bg-gradient-to-b from-gray-800 to-gray-900 text-white">
              <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-sm">
                  {selectedPost.affiliate_email.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm font-semibold">@{selectedPost.affiliate_email.split('@')[0]}</div>
              </div>
              {selectedPost.video_url ? (
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
                  data-testid="organic-post-image"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallbackUsed) {
                      target.src = '/fallback-organic-post.png';
                      target.dataset.fallbackUsed = 'true';
                    }
                  }}
                />
              )}
              <div className="px-4 py-2 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 18.657l-6.828-6.829a4 4 0 010-5.656z" />
                  </svg>
                  <span>89 likes</span>
                </div>
                <p>
                  <span className="font-semibold">@{selectedPost.affiliate_email.split('@')[0]}</span>{' '}
                  {selectedPost.caption}
                </p>
                <div className="text-sm text-white/80 mt-2">
                  <p className="mb-1">
                    <span className="font-semibold">@socialking</span> Looking good! 👍
                  </p>
                  <p>
                    <span className="font-semibold">@adexperts</span> This could convert well.
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 text-sm space-y-1">
                <div className="text-xs text-white/60">
                  Platform: {selectedPost.platform}
                </div>
                <div className="text-xs">
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      selectedPost.status === 'approved'
                        ? 'text-green-600'
                        : selectedPost.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {selectedPost.status}
                  </span>
                </div>
              </div>

              {selectedPost?.status === 'pending' && (
                <div className="flex gap-4 px-4 pt-4 pb-2">
                  <button
                    onClick={async () => {
                      await handleStatusChange(selectedPost.id, 'approved');
                      setSelectedPost((prev) => prev ? { ...prev, status: 'approved' } : null);
                      setIsOpen(false);
                    }}
                    className="w-full py-2 rounded bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-medium text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await handleStatusChange(selectedPost.id, 'rejected');
                      setSelectedPost((prev) => prev ? { ...prev, status: 'rejected' } : null);
                      setIsOpen(false);
                    }}
                    className="w-full py-2 rounded bg-red-500 hover:bg-red-600 text-white font-medium text-sm"
                  >
                    Reject
                  </button>
                </div>
              )}

              <div className="p-4 border-t border-gray-100">
                <button
                  className="w-full py-2 rounded bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-medium text-sm"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}