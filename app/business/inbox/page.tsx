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

  useEffect(() => {
    const fetchOffers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: offersData } = await supabase
        .from('offers')
        .select('id, title')
        .eq('business_email', user.email);

      setOffers(offersData || []);
    };
    fetchOffers();
  }, []);

  useEffect(() => {
    const fetchInboxData = async () => {
      if (!user?.email) return;

      const { data: reqs } = await supabase
        .from('affiliate_requests')
        .select('*')
        .eq('status', 'pending');

      setRequests(reqs || []);

      const { data: ads } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('status', 'pending');

      setAdIdeas(ads || []);
    };

    fetchInboxData();
  }, [user]);

  const getOfferName = (offerId: string) => {
    const offer = offers.find((o) => o.id === offerId);
    return offer?.title || 'Unknown Offer';
  };

  return (
    <div className="flex justify-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-[#00C2CB] mb-2 text-center">Inbox</h1>
        <p className="text-gray-500 mb-8 text-center">Review pending affiliate requests and ad submissions.</p>

        {/* Affiliate Requests */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-[#00C2CB] mb-4">Affiliate Requests</h2>

          {requests.length > 0 ? (
            requests.map((req) => (
              <div
                key={req.id}
                className="bg-white border-l-4 border-[#00C2CB] rounded-xl p-5 shadow-sm mb-5 transition hover:shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium text-[#00C2CB]">{req.affiliate_email}</span> wants to promote{' '}
                      <span className="underline">{getOfferName(req.offer_id)}</span>
                    </p>
                    {req.notes && (
                      <p className="text-sm italic text-gray-500">“{req.notes}”</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Requested on {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium">
                      Pending
                    </span>
                    <Link href="/business/my-business/affiliate-requests">
                      <button className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded text-sm">
                        View Request
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center">No pending affiliate requests.</p>
          )}
        </section>

        {/* Ad Idea Submissions */}
        <section>
          <h2 className="text-xl font-semibold text-green-600 mb-4">Ad Idea Submissions</h2>

          {adIdeas.length > 0 ? (
            adIdeas.map((ad) => (
              <div
                key={ad.id}
                className="bg-white border-l-4 border-green-400 rounded-xl p-5 shadow-sm mb-5 transition hover:shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-green-700 font-medium">
                      New ad submitted for <span className="underline">{getOfferName(ad.offer_id)}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      From: {ad.affiliate_email}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Submitted on {new Date(ad.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium h-fit mt-1">
                    Pending
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center">No new ad submissions.</p>
          )}
        </section>
      </div>
    </div>
  );
}