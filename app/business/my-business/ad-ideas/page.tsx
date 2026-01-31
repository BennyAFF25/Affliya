'use client';

import { useSession } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import { useRouter } from 'next/navigation';
import { nmToast } from "@/components/ui/toast";

// Email notifications (client -> server)
async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    type: 'ad_rejected',
    event: 'ad_rejected',
    ...params,
  };

  const res = await postJson('/api/emails/ad-rejected', payload);
  if (!res?.ok) {
    console.error('[email] /api/emails/ad-rejected failed', res);
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
    type: 'ad_approved',
    event: 'ad_approved',
    ...params,
  };

  const res = await postJson('/api/emails/ad-approved', payload);
  if (!res?.ok) {
    console.error('[email] /api/emails/ad-approved failed', res);
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
  const [showTargetingDetails, setShowTargetingDetails] = useState(false);
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

  const handleStatusChange = async (
    id: string,
    newStatus: string,
    rejectionReason?: string
  ): Promise<boolean> => {
    if (!user?.email) return false;

    const updateData: any = { status: newStatus };
    if (newStatus === 'rejected' && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { error } = await (supabase as any)
      .from('ad_ideas')
      .update(updateData)
      .eq('id', id)
      .eq('business_email', user.email);

    if (error) {
      console.error('[❌ Ad idea status update failed]', error.message);
      nmToast.error('Failed to update ad status');
      return false;
    }

    // Local UI update
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === id ? { ...idea, status: newStatus } : idea
      )
    );

    if (newStatus === 'rejected') {
      setShowRejectionInput(null);
      setSelectedReason('');
      setCustomReason('');

      const rejected = ideas.find((idea) => idea.id === id);
      if (rejected) {
        const offerTitle = offersMap[rejected.offer_id] || 'Unknown Offer';
        try {
          await notifyAdRejected({
            to: rejected.affiliate_email,
            affiliateEmail: rejected.affiliate_email,
            businessEmail: user.email,
            offerId: rejected.offer_id,
            offerTitle,
            adIdeaId: rejected.id,
            reason: rejectionReason || '',
          });
        } catch (e) {
          console.error('[email] notifyAdRejected crashed', e);
        }
      }

      return true;
    }

    if (newStatus === 'approved') {
      // We only mark the ad idea as approved here.
      // Meta upload + live_ads creation happens in sendToMeta().
      nmToast.success('Ad approved — launching on Meta…');
      return true;
    }

    return true;
  };

  // Internal API function to send full ad idea data to Meta
  const sendToMeta = async (adIdeaId: string) => {
    try {
      // Pull ad idea from Supabase
      const { data: adIdeaData, error } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('id', adIdeaId)
        .single();

      const adIdea = adIdeaData as AdIdea | null;

      if (error || !adIdea) {
        console.error('[❌ Fetch Ad Idea Error]', error?.message);
        return;
      }

      console.log('[🔍 Fetching Offer Details for Ad Idea]', adIdea.offer_id);

      // Pull offer details from Supabase
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('meta_ad_account_id, meta_page_id')
        .eq('id', adIdea.offer_id)
        .single();

      const offer = offerData as { meta_ad_account_id: string; meta_page_id: string } | null;

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
        display_link: `https://www.nettmark.com/go/${adIdea.offer_id}___${adIdea.affiliate_email}`,
        metaPageId: offer.meta_page_id,
        metaAdAccountId: offer.meta_ad_account_id,
        thumbnail_url: adIdea.thumbnail_url,
      };

      console.log('[📤 Sending ad idea payload to internal Meta API]', payload);
      const response = await fetch('/api/meta/callback/upload-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let data: any;
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
        nmToast.error("Meta upload failed");
        return;
      }

      console.log('[✅ Meta Upload Success]', data);

      // Your API returns: { success: true, campaignId, liveAdId }
      const hasMetaIds =
        data?.campaignId ||
        data?.liveAdId ||
        data?.meta_ad_id ||
        data?.metaAdId ||
        data?.campaign_id ||
        data?.meta_campaign_id;

      nmToast.success(
        hasMetaIds
          ? 'Campaign created ✅ (live on Meta)'
          : 'Sent to Meta ✅'
      );

      // Notify affiliate after Meta launch (best-effort)
      try {
        const offerTitle = offersMap[adIdea.offer_id] || 'Unknown Offer';
        await notifyAdApproved({
          to: adIdea.affiliate_email,
          affiliateEmail: adIdea.affiliate_email,
          businessEmail: adIdea.business_email || user?.email || '',
          offerId: adIdea.offer_id,
          offerTitle,
          adIdeaId: adIdea.id,
          campaignId: data?.campaignId || data?.campaign_id || data?.meta_campaign_id,
        });
      } catch (e) {
        console.error('[email] notifyAdApproved crashed', e);
      }

      // Redirect business to Manage Campaigns (live_ads record is created server-side)
      try {
        router.push('/business/manage-campaigns');
      } catch (e) {
        // ignore
      }

      const metaStatus = data?.status || data?.metaStatus || 'RUNNING';
      if (metaStatus && adIdea?.id) {
        await (supabase as any)
          .from('ad_ideas')
          .update({ meta_status: metaStatus })
          .eq('id', adIdea.id);
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
              {ideas.filter((i) => i.status === 'pending').map((idea) => (
                <div
                  key={idea.id}
                  className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl px-4 py-4 md:px-6 md:py-5 shadow-md flex flex-col md:flex-row md:justify-between md:items-center gap-4 hover:shadow-[0_0_8px_#00C2CB] transition-all"
                >
                  <div className="flex items-start gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 rounded-full bg-[#00C2CB]/20 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-6 h-6 text-[#00C2CB]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl font-semibold text-white">
                        {offersMap[idea.offer_id] || 'Unknown Offer'}
                      </h2>
                      <p className="text-sm text-gray-400">
                        {idea.audience} - {idea.location}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-sm text-gray-400">
                          <span className="font-semibold text-white">Affiliate:</span>{' '}
                          {idea.affiliate_email}
                        </p>
                        <button
                          onClick={() => {
                            setSelectedIdea(idea);
                            setShowTargetingDetails(false);
                          }}
                          className="text-sm text-[#00C2CB] hover:underline"
                        >
                          View Detail
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        idea.status === 'approved'
                          ? 'bg-green-500/20 text-green-300'
                          : idea.status === 'rejected'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-400/20 text-yellow-300'
                      }`}
                    >
                      {idea.status}
                    </span>
                    {idea.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button
                          onClick={async () => {
                            const ok = await handleStatusChange(idea.id, 'approved');
                            if (ok) {
                              await sendToMeta(idea.id);
                            }
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
                            const finalReason =
                              selectedReason === 'Other' ? customReason : selectedReason;
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
                  {ideas
                    .filter((i) => i.status !== 'pending')
                    .map((idea) => (
                      <div
                        key={idea.id}
                        className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl px-4 py-4 md:px-6 md:py-5 shadow-md flex flex-col md:flex-row md:justify-between md:items-center gap-4"
                      >
                        <div className="flex items-start gap-4 w-full md:w-auto">
                          <div className="w-12 h-12 rounded-full bg-[#00C2CB]/20 flex items-center justify-center">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-6 h-6 text-[#00C2CB]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                          </div>
                          <div className="flex flex-col">
                            <h2 className="text-xl font-semibold text-white">
                              {offersMap[idea.offer_id] || 'Unknown Offer'}
                            </h2>
                            <p className="text-sm text-gray-400">
                              {idea.audience} - {idea.location}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <p className="text-sm text-gray-400">
                                <span className="font-semibold text-white">Affiliate:</span>{' '}
                                {idea.affiliate_email}
                              </p>
                              <button
                                onClick={() => {
                                  setSelectedIdea(idea);
                                  setShowTargetingDetails(false);
                                }}
                                className="text-sm text-[#00C2CB] hover:underline"
                              >
                                View Detail
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              idea.status === 'approved'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
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

        {/* (rest of your modal UI remains unchanged below this point) */}
        {selectedIdea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

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
                        @{selectedIdea.affiliate_email.split('@')[0]}
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
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {(() => {
                  const url = selectedIdea.file_url || '';
                  const isVideoByType = selectedIdea.media_type?.toUpperCase() === 'VIDEO';
                  const isVideoByExtension = /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url);
                  const isVideo = isVideoByType || isVideoByExtension;

                  if (!url) {
                    return (
                      <div className="w-full h-64 flex items-center justify-center bg-[#111111] text-xs text-gray-400">
                        No creative attached
                      </div>
                    );
                  }

                  return isVideo ? (
                    <video src={url} controls className="w-full max-h-[320px] bg-black object-contain" />
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
                          target.src = '/fallback-organic-post.png';
                          (target as any).dataset.fallbackUsed = 'true';
                        }
                      }}
                    />
                  );
                })()}

                <div className="border-t border-white/5 mt-2 pt-2">
                  {selectedIdea.status === 'pending' && (
                    <div className="flex gap-2 px-3 pb-2 pt-1">
                      <button
                        onClick={async () => {
                          const ok = await handleStatusChange(selectedIdea.id, 'approved');
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
                          await handleStatusChange(selectedIdea.id, 'rejected', 'Rejected by business');
                          setSelectedIdea((prev) => (prev ? { ...prev, status: 'rejected' } : null));
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