'use client';

import axios from 'axios';
import { useSession } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';

interface AdIdea {
  meta_ad_id?: string;
  id: string;
  affiliate_email: string;
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
}

interface Offer {
  id: string;
  businessName: string;
}

export default function AdIdeasPage() {
  const [ideas, setIdeas] = useState<AdIdea[]>([]);
  const [offersMap, setOffersMap] = useState<Record<string, string>>({});
  const [selectedIdea, setSelectedIdea] = useState<AdIdea | null>(null);
  const session = useSession();
  const user = session?.user;

  useEffect(() => {
    const loadOffersMap = async () => {
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('offers')
        .select('id, title')
        .eq('business_email', user.email);

      if (error) {
        console.error('[❌ Supabase Fetch Offers Error]', error.message);
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
  }, [user]);

  useEffect(() => {
    const fetchIdeas = async () => {
      if (!user?.email) return;

      // Only fetch when offersMap is fully populated
      const offerIds = Object.keys(offersMap);
      if (offerIds.length === 0) return;

      const { data, error } = await supabase
        .from('ad_ideas')
        .select('*')
        .in('offer_id', offerIds)
        .eq('business_email', user.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching ad ideas:', error.message);
      } else {
        setIdeas(data || []);
      }
    };

    // Explicitly call only when offersMap is populated
    if (Object.keys(offersMap).length > 0) {
      fetchIdeas();
    }
  }, [offersMap, user]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!user?.email) return;

    const { error } = await supabase
      .from('ad_ideas')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('business_email', user.email);

    if (!error) {
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === id ? { ...idea, status: newStatus } : idea
        )
      );
    }
  };

  // Internal API function to send full ad idea data to Meta
  const sendToMeta = async (adIdeaId: string) => {
    try {
      // Pull ad idea from Supabase
      const { data: adIdea, error } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('id', adIdeaId)
        .single();

      if (error || !adIdea) {
        console.error('[❌ Fetch Ad Idea Error]', error?.message);
        return;
      }

      // Add log before fetching offer details
      console.log('[🔍 Fetching Offer Details for Ad Idea]', adIdea.offer_id);

      // Pull offer details from Supabase
      const { data: offer, error: offerError } = await supabase
        .from('offers')
        .select('meta_ad_account_id, meta_page_id')
        .eq('id', adIdea.offer_id)
        .single();

      if (offerError || !offer) {
        console.error('[❌ Fetch Offer Error]', offerError?.message);
        return;
      } else {
        console.log('[✅ Offer Details Fetched]', offer);
      }

      const payload = {
        offerId: adIdea.offer_id,
        adIdeaId,
        videoUrl: adIdea.file_url,
        caption: adIdea.caption,
        audience: adIdea.audience,
        location: adIdea.location,
        objective: adIdea.objective,
        cta: adIdea.cta,
        daily_budget: adIdea.daily_budget,
        age_range: adIdea.age_range,
        gender: adIdea.gender,
        interests: adIdea.interests,
        display_link: `https://affliya.com/go/${adIdea.offer_id}-${adIdea.affiliate_email}`,
        metaPageId: offer.meta_page_id,
        metaAdAccountId: offer.meta_ad_account_id,
        thumbnail_url: adIdea.thumbnail_url,
      };

      console.log("[📤 Sending ad idea payload to internal Meta API]", payload);
      const response = await fetch('/api/meta/callback/upload-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('[📉 Status Code]', response.status);
      console.log('[⚠️ Meta Upload Response]', data);

      if (!response.ok) {
        console.error('[❌ Meta Upload Failed]', data);
      } else {
        console.log('[✅ Meta Upload Success]', data);
      }
    } catch (err) {
      console.error('[❌ Meta Upload Error]', err);
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-6">Submitted Ad Ideas</h1>

      {ideas.length === 0 ? (
        <p className="text-gray-600">No ad ideas submitted yet.</p>
      ) : (
        <div className="space-y-6">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="bg-white border border-gray-200 shadow rounded-lg p-6 border border-[#00C2CB] hover:shadow-[0_0_8px_#00C2CB] transition-shadow"
            >
              <div className="flex justify-between items-center mb-2">
                <p className="text-[#00C2CB] font-semibold">
                  Affiliate: {idea.affiliate_email}
                </p>
                <span
                  className={`px-2 py-1 rounded text-sm font-medium ${
                    idea.status === 'approved'
                      ? 'bg-green-100 text-green-600'
                      : idea.status === 'rejected'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-yellow-100 text-yellow-600'
                  }`}
                >
                  {idea.status}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-1">
                <strong>Audience:</strong> {idea.audience}
              </p>
              <p className="text-sm text-gray-700 mb-1">
                <strong>Location:</strong> {idea.location}
              </p>
              <p className="text-xs text-gray-500 italic mt-2">
                Offer: {offersMap[idea.offer_id] || 'Unknown'}
              </p>

              <button
                onClick={() => setSelectedIdea(idea)}
                className="mt-3 text-[#00C2CB] hover:underline"
              >
                View Detail
              </button>

              {idea.status === 'pending' && (
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={async () => {
                      await handleStatusChange(idea.id, 'approved');
                      await sendToMeta(idea.id);
                    }}
                    className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusChange(idea.id, 'rejected')}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedIdea && (
        <div className="fixed z-50 inset-0 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="bg-gradient-to-b from-[#1f1f1f] to-[#111111] text-white p-0 rounded-lg shadow-lg z-50 max-w-sm w-full overflow-hidden border border-gray-800">
            <div className="flex flex-col bg-gradient-to-b from-gray-800 to-gray-900 text-white">
              {/* Mocked Header */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#ff5757] to-[#8c52ff] text-white flex items-center justify-center font-bold text-sm">
                  {selectedIdea.affiliate_email.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm font-semibold">@{selectedIdea.affiliate_email.split('@')[0]}</div>
              </div>

              {selectedIdea.file_url?.toLowerCase().endsWith('.mp4') ? (
                <video
                  src={selectedIdea.file_url}
                  controls
                  className="w-full h-auto max-h-[500px] object-cover bg-black"
                />
              ) : (
                <img
                  src={selectedIdea.file_url}
                  alt="Post Image"
                  className="w-full h-auto max-h-[500px] object-contain bg-gray-800"
                  referrerPolicy="no-referrer"
                  loading="lazy"
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
                <p>
                  <span className="font-semibold">@{selectedIdea.affiliate_email.split('@')[0]}</span>{' '}
                  {selectedIdea.location}
                </p>
              </div>

              <div className="px-4 py-3 text-sm space-y-1">
                <div className="text-xs text-white/60">Audience: {selectedIdea.audience}</div>
                <div className="text-xs">
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      selectedIdea.status === 'approved'
                        ? 'text-green-600'
                        : selectedIdea.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {selectedIdea.status}
                  </span>
                </div>
              </div>

              {selectedIdea.status === 'pending' && (
                <div className="flex gap-4 px-4 pt-4 pb-2">
                  <button
                    onClick={async () => {
                      await handleStatusChange(selectedIdea.id, 'approved');
                      setSelectedIdea((prev) => prev ? { ...prev, status: 'approved' } : null);
                      await sendToMeta(selectedIdea.id);
                    }}
                    className="w-full py-2 rounded bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-medium text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await handleStatusChange(selectedIdea.id, 'rejected');
                      setSelectedIdea((prev) => prev ? { ...prev, status: 'rejected' } : null);
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
                  onClick={() => setSelectedIdea(null)}
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
