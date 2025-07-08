'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import { supabase } from '@/../utils/supabase/pages-client';

interface AffiliateRequest {
  id: string;
  offer_id: string;
  status: string;
  created_at: string;
}

interface AdIdea {
  id: string;
  offer_id: string;
  status: string;
  created_at: string;
}

interface Offer {
  id: string;
  title: string;
}

export default function AffiliateInbox() {
  const session = useSession();
  const user = session?.user;
  const [approvedRequests, setApprovedRequests] = useState<AffiliateRequest[]>([]);
  const [approvedAds, setApprovedAds] = useState<AdIdea[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase.from('offers').select('id, title');
      if (error) {
        console.error('[❌ Error fetching offers]', error.message);
        return;
      }
      setOffers(data || []);
    };

    fetchOffers();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.email) return;

      const { data: requests } = await supabase
        .from('affiliate_requests')
        .select('*')
        .eq('affiliate_email', user.email)
        .eq('status', 'approved');

      const { data: ads } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('affiliate_email', user.email)
        .eq('status', 'approved');

      setApprovedRequests(requests || []);
      setApprovedAds(ads || []);
    };

    fetchNotifications();
  }, [user]);

  const getOfferName = (offerId: string) => {
    const offer = offers.find((o) => o.id === offerId);
    return offer?.title || 'Unknown Offer';
  };

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-2">Inbox</h1>
      <p className="text-gray-500 mb-6">Here’s what’s been happening with your campaigns.</p>

      {/* Promotion Approvals */}
      {approvedRequests.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-[#00C2CB] mb-4">Promote Access Approved</h2>
          {approvedRequests.map((r) => (
            <div key={r.id} className="bg-white border border-[#00C2CB]/30 rounded-xl p-5 shadow-sm mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-[#00C2CB]">
                    You’ve been approved to promote <span className="underline">{getOfferName(r.offer_id)}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Approved on {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <Link href={`/affiliate/dashboard/promote/${r.offer_id}`}>
                  <button className="bg-[#00C2CB] text-white px-4 py-2 rounded text-sm hover:bg-[#00b0b8] transition">
                    Promote
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ad Approvals */}
      {approvedAds.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-green-600 mb-4">Ad Idea Approved</h2>
          {approvedAds.map((ad) => (
            <div key={ad.id} className="bg-white border border-green-300 rounded-xl p-5 shadow-sm mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-green-600">
                    Your ad was approved for <span className="underline">{getOfferName(ad.offer_id)}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Approved on {new Date(ad.created_at).toLocaleDateString()}</p>
                </div>
                <button disabled className="bg-gray-300 text-gray-600 px-4 py-2 rounded text-sm cursor-not-allowed">
                  Run Ads
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {approvedRequests.length === 0 && approvedAds.length === 0 && (
        <p className="text-gray-500 mt-10">No new updates just yet. Check back soon!</p>
      )}
    </div>
  );
}