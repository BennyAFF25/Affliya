'use client';

import axios from 'axios';
import { useSession } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import { useRouter } from 'next/navigation';

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
  const [showRejectionInput, setShowRejectionInput] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [showRecent, setShowRecent] = useState(false);
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/');
      return;
    }

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
  }, [session, user, router]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/');
      return;
    }

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
  }, [offersMap, session, user, router]);

  const handleStatusChange = async (id: string, newStatus: string, rejectionReason?: string) => {
    if (!user?.email) return;

    const updateData: any = { status: newStatus };
    if (newStatus === 'rejected' && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { error } = await supabase
      .from('ad_ideas')
      .update(updateData)
      .eq('id', id)
      .eq('business_email', user.email);

    if (!error) {
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === id ? { ...idea, status: newStatus } : idea
        )
      );
      if (newStatus === 'rejected') {
        setShowRejectionInput(null);
        setSelectedReason('');
        setCustomReason('');
      }
      if (newStatus === 'approved') {
        // Fetch the approved ad object from current state
        const ad = ideas.find((idea) => idea.id === id);
        if (ad) {
          // Insert into live_campaigns
          await supabase.from('live_campaigns').insert([
            {
              offer_id: ad.offer_id,
              affiliate_email: ad.affiliate_email,
              business_email: ad.business_email,
              type: 'ad',
              file_url: ad.file_url || null,
              audience: ad.audience || null,
              location: ad.location || null,
              objective: ad.objective || null,
              cta: ad.cta || null,
              daily_budget: ad.daily_budget || null,
              age_range: ad.age_range || null,
            }
          ]);
        }
        // Show confirmation toast
        alert('Ad approved and campaign created successfully!');

        // Redirect to the Manage Campaigns page with the correct offer ID
        router.push(`/business/manage-campaigns/${id}`);
      }
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

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('[❌ Failed to parse JSON response]', jsonError);
        data = null;
      }

      console.log('[📉 Status Code]', response.status);
      console.log('[⚠️ Meta Upload Response]', data);

      if (!response.ok) {
        console.error('[❌ Meta Upload Failed]', data);
      } else {
        console.log('[✅ Meta Upload Success]', data);
        // After successful Meta ad creation and response, update Supabase row with meta_status
        // Use status from Meta API response, e.g. data.status or data.metaStatus, fallback to 'RUNNING'
        let metaStatus = data?.status || data?.metaStatus || 'RUNNING';
        // Only update if we have a status and an ad idea id
        if (metaStatus && adIdea?.id) {
          await supabase
            .from('ad_ideas')
            .update({ meta_status: metaStatus })
            .eq('id', adIdea.id);
        }
      }
    } catch (err) {
      console.error('[❌ Meta Upload Error]', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 md:px-10 md:py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#00C2CB] mb-6">Affiliate Promotion Requests</h1>

        {ideas.length === 0 ? (
          <p className="text-gray-600">No ad ideas submitted yet.</p>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">No new ads to review</h2>
            <div className="space-y-6">
              {ideas.filter(i => i.status === 'pending').map((idea) => (
                <div
                  key={idea.id}
                  className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl px-4 py-4 md:px-6 md:py-5 shadow-md flex flex-col md:flex-row md:justify-between md:items-center gap-4 hover:shadow-[0_0_8px_#00C2CB] transition-all"
                >
                  <div className="flex items-start gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 rounded-full bg-[#00C2CB]/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl font-semibold text-white">{offersMap[idea.offer_id] || 'Unknown Offer'}</h2>
                      <p className="text-sm text-gray-400">{idea.audience} - {idea.location}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-sm text-gray-400">
                          <span className="font-semibold text-white">Affiliate:</span> {idea.affiliate_email}
                        </p>
                        <button
                          onClick={() => setSelectedIdea(idea)}
                          className="text-sm text-[#00C2CB] hover:underline"
                        >
                          View Detail
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      idea.status === 'approved' ? 'bg-green-500/20 text-green-300'
                      : idea.status === 'rejected' ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-400/20 text-yellow-300'
                    }`}>
                      {idea.status}
                    </span>
                    {idea.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button
                          onClick={async () => {
                            await handleStatusChange(idea.id, 'approved');
                            await sendToMeta(idea.id);
                          }}
                          className="flex-1 md:flex-none bg-[#00C2CB] text-black hover:bg-[#00b0b8] px-4 py-2 rounded-lg text-sm font-semibold text-center"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setShowRejectionInput(idea.id)}
                          className="flex-1 md:flex-none bg-[#2c2c2c] text-gray-300 hover:bg-[#3a3a3a] px-4 py-2 rounded-lg text-sm text-center"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {showRejectionInput === idea.id && (
                      <div className="flex flex-col gap-3 mt-2 w-full md:w-48">
                        <select
                          className="border border-gray-300 rounded px-3 py-2 text-sm bg-[#181818] text-white"
                          onChange={(e) => setSelectedReason(e.target.value)}
                          value={selectedReason}
                        >
                          <option value="">Select a reason</option>
                          <option value="Not aligned with brand">Not aligned with brand</option>
                          <option value="Inappropriate content">Inappropriate content</option>
                          <option value="Low quality creative">Low quality creative</option>
                          <option value="Other">Other</option>
                        </select>
                        {selectedReason === 'Other' && (
                          <textarea
                            className="border border-gray-300 rounded px-3 py-2 text-sm bg-[#181818] text-white"
                            placeholder="Custom reason..."
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                          />
                        )}
                        <button
                          onClick={async () => {
                            const finalReason = selectedReason === 'Other' ? customReason : selectedReason;
                            await handleStatusChange(idea.id, 'rejected', finalReason);
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Recent Ads dropdown */}
            <div className="mt-8">
              <div
                onClick={() => setShowRecent((prev) => !prev)}
                className="cursor-pointer mt-10 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#00C2CB] font-semibold px-6 py-3 rounded-lg text-center shadow transition-all"
              >
                {showRecent ? 'Hide Recent Ads' : 'Show Recent Ads'}
              </div>
              {showRecent && (
                <div className="space-y-6 mt-4">
                  {ideas.filter(i => i.status !== 'pending').map((idea) => (
                    <div
                      key={idea.id}
                      className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl px-4 py-4 md:px-6 md:py-5 shadow-md flex flex-col md:flex-row md:justify-between md:items-center gap-4"
                    >
                      <div className="flex items-start gap-4 w-full md:w-auto">
                        <div className="w-12 h-12 rounded-full bg-[#00C2CB]/20 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <h2 className="text-xl font-semibold text-white">{offersMap[idea.offer_id] || 'Unknown Offer'}</h2>
                          <p className="text-sm text-gray-400">{idea.audience} - {idea.location}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <p className="text-sm text-gray-400">
                              <span className="font-semibold text-white">Affiliate:</span> {idea.affiliate_email}
                            </p>
                            <button
                              onClick={() => setSelectedIdea(idea)}
                              className="text-sm text-[#00C2CB] hover:underline"
                            >
                              View Detail
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          idea.status === 'approved' ? 'bg-green-500/20 text-green-300'
                          : 'bg-red-500/20 text-red-400'
                        }`}>
                          {idea.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
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
                          ? 'text-red-500'
                          : 'text-yellow-600'
                      }`}
                    >
                      {selectedIdea.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400 italic">Requested recently</p>
                </div>

                {selectedIdea.status === 'pending' && (
                  <div className="flex gap-4 px-4 pt-4 pb-2">
                    <button
                      onClick={async () => {
                        await handleStatusChange(selectedIdea.id, 'approved');
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
    </div>
  );
}
