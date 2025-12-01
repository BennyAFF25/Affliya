'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import Link from 'next/link';

interface AffiliateRequest {
  id: string;
  offer_id: string;
  affiliate_email: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface AdIdea {
  id: string;
  offer_id: string;
  affiliate_email: string;
  status: string;
  created_at: string;
}

interface Offer {
  id: string;
  title: string;
}

export default function BusinessInbox() {
  const session = useSession();
  const user = session?.user;
  const [requests, setRequests] = useState<AffiliateRequest[]>([]);
  const [adIdeas, setAdIdeas] = useState<AdIdea[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showRequests, setShowRequests] = useState(true);
  const [showAdIdeas, setShowAdIdeas] = useState(true);

  // Load offers for this business (for display names)
  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('[❌ Error fetching auth user for offers]', error.message);
        return;
      }

      const authUser = data?.user;
      if (!authUser?.email) return;

      const { data: offersData, error: offersErr } = await supabase
        .from('offers')
        .select('id, title')
        .eq('business_email', authUser.email);

      if (offersErr) {
        console.error('[❌ Error fetching offers for inbox]', offersErr.message);
        return;
      }

      setOffers(offersData || []);
    };

    fetchOffers();
  }, []);

  // Load pending inbox items for THIS business
  useEffect(() => {
    const fetchInboxData = async () => {
      const businessEmail = user?.email;
      if (!businessEmail) {
        console.warn('[⚠️ BusinessInbox] No session user email, skipping inbox fetch.');
        return;
      }

      // Pending affiliate requests for this business
      const { data: reqs, error: reqErr } = await supabase
        .from('affiliate_requests')
        .select('*')
        .eq('business_email', businessEmail)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (reqErr) {
        console.error('[❌ Error fetching affiliate_requests for inbox]', reqErr.message);
      } else {
        setRequests((reqs || []) as AffiliateRequest[]);
      }

      // Pending ad ideas for this business
      const { data: ads, error: adsErr } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('business_email', businessEmail)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (adsErr) {
        console.error('[❌ Error fetching ad_ideas for inbox]', adsErr.message);
      } else {
        setAdIdeas((ads || []) as AdIdea[]);
      }
    };

    fetchInboxData();
  }, [user]);

  const getOfferName = (offerId: string) => {
    const offer = offers.find((o) => o.id === offerId);
    return offer?.title || 'Unknown Offer';
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white px-12 pt-12 pb-24 w-full">
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-extrabold text-[#00C2CB] tracking-tight">Inbox</h1>
          <p className="text-gray-400 mt-2 text-lg">
            Affiliate requests and ad idea submissions for your offers.
          </p>
        </div>

        {/* Affiliate Requests */}
        {requests.length > 0 && (
          <section className="mb-14">
            <div
              onClick={() => setShowRequests(!showRequests)}
              className="bg-[#121212] hover:bg-[#1c1c1c] px-6 py-4 rounded-md shadow border border-[#222] cursor-pointer flex items-center justify-between mb-4"
            >
              <h2 className="text-xl font-bold text-[#00C2CB]">Affiliate Requests</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#00C2CB] bg-[#00C2CB]/10 px-2 py-0.5 rounded-full font-medium">
                  {requests.length}
                </span>
                <span className="text-lg text-[#00C2CB]">{showRequests ? '−' : '+'}</span>
              </div>
            </div>
            {showRequests && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-[#121212] rounded-xl p-7 border-l-4 border-[#00C2CB] hover:ring-1 hover:ring-[#00C2CB] shadow-md transition"
                  >
                    <p className="text-sm text-gray-400 mb-1">
                      <span className="font-semibold text-[#00C2CB]">
                        {req.affiliate_email}
                      </span>{' '}
                      wants to promote{' '}
                      <span className="underline">{getOfferName(req.offer_id)}</span>
                    </p>
                    {req.notes && (
                      <p className="text-sm italic text-gray-500 mt-1">“{req.notes}”</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Requested on {new Date(req.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-4">
                      <Link href="/business/my-business/affiliate-requests">
                        <button className="px-4 py-1.5 bg-[#00C2CB] hover:bg-[#00b0b8] text-white rounded-md text-sm shadow-md transition">
                          Manage Requests
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Ad Idea Submissions */}
        {adIdeas.length > 0 && (
          <section className="mb-14">
            <div
              onClick={() => setShowAdIdeas(!showAdIdeas)}
              className="bg-[#121212] hover:bg-[#1c1c1c] px-6 py-4 rounded-md shadow border border-[#222] cursor-pointer flex items-center justify-between mb-4"
            >
              <h2 className="text-xl font-bold text-green-400">Ad Ideas</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full font-medium">
                  {adIdeas.length}
                </span>
                <span className="text-lg text-green-400">{showAdIdeas ? '−' : '+'}</span>
              </div>
            </div>
            {showAdIdeas && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {adIdeas.map((ad) => (
                  <div
                    key={ad.id}
                    className="bg-[#121212] rounded-xl p-7 border-l-4 border-green-500 hover:ring-1 hover:ring-green-500 shadow-md transition"
                  >
                    <p className="text-sm text-green-400 font-medium">
                      New ad submitted for{' '}
                      <span className="underline">{getOfferName(ad.offer_id)}</span>
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      From: {ad.affiliate_email}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Submitted on {new Date(ad.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-4">
                      <Link href="/business/my-business/ad-ideas">
                        <button className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm shadow-md transition">
                          Review Ads
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {requests.length === 0 && adIdeas.length === 0 && (
          <div className="text-center mt-32 text-gray-500">
            <h3 className="text-2xl font-bold">Nothing new yet</h3>
            <p className="mt-2 text-md">
              All affiliate and ad submissions will appear here once received.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}