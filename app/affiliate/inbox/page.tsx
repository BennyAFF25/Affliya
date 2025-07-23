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
  rejection_reason?: string;
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
  const [rejectedAds, setRejectedAds] = useState<AdIdea[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showPromote, setShowPromote] = useState(true);
  const [showAds, setShowAds] = useState(true);
  const [showRejected, setShowRejected] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

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

      const { data: rejected } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('affiliate_email', user.email)
        .eq('status', 'rejected');

      setApprovedRequests(requests || []);
      setApprovedAds(ads || []);
      setRejectedAds(rejected || []);
    };

    fetchNotifications();
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
          <p className="text-gray-400 mt-2 text-lg">Updates, approvals, and campaign actions live here.</p>
        </div>

        {/* Promotion Approvals */}
        {approvedRequests.length > 0 && (
          <section className="mb-14">
            <div
              onClick={() => setShowPromote(!showPromote)}
              className="bg-[#121212] hover:bg-[#1c1c1c] px-6 py-4 rounded-md shadow border border-[#222] cursor-pointer flex items-center justify-between mb-4"
            >
              <h2 className="text-xl font-bold text-[#00C2CB]">Promote Access</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#00C2CB] bg-[#00C2CB]/10 px-2 py-0.5 rounded-full font-medium">
                  {approvedRequests.length}
                </span>
                <span className="text-lg text-[#00C2CB]">{showPromote ? '−' : '+'}</span>
              </div>
            </div>
            {showPromote && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {approvedRequests.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[#121212] rounded-xl p-7 border-l-4 border-[#00C2CB] hover:ring-1 hover:ring-[#00C2CB] shadow-md transition flex justify-between items-center gap-4"
                  >
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Approved on {new Date(r.created_at).toLocaleDateString()}</p>
                      <p className="text-lg font-semibold text-white">
                        Promote <span className="text-[#00C2CB] underline">{getOfferName(r.offer_id)}</span>
                      </p>
                    </div>
                    <Link href={`/affiliate/dashboard/promote/${r.offer_id}`}>
                      <button className="px-4 py-1.5 bg-[#00C2CB] hover:bg-[#00b0b8] text-white rounded-md text-sm shadow-md transition">
                        Go
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Ad Approvals */}
        {approvedAds.length > 0 && (
          <section className="mb-14">
            <div
              onClick={() => setShowAds(!showAds)}
              className="bg-[#121212] hover:bg-[#1c1c1c] px-6 py-4 rounded-md shadow border border-[#222] cursor-pointer flex items-center justify-between mb-4"
            >
              <h2 className="text-xl font-bold text-green-500">Ad Ideas Approved</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full font-medium">
                  {approvedAds.length}
                </span>
                <span className="text-lg text-green-500">{showAds ? '−' : '+'}</span>
              </div>
            </div>
            {showAds && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {approvedAds.map((ad) => (
                  <div
                    key={ad.id}
                    className="bg-[#121212] rounded-xl p-7 border-l-4 border-green-500 hover:ring-1 hover:ring-[#00C2CB] shadow-md transition flex justify-between items-center gap-4"
                  >
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Approved on {new Date(ad.created_at).toLocaleDateString()}</p>
                      <p className="text-lg font-semibold text-white">
                        Ad for <span className="text-green-400 underline">{getOfferName(ad.offer_id)}</span>
                      </p>
                    </div>
                    <button
                      disabled
                      className="px-4 py-1.5 bg-[#2a2a2a] text-gray-500 rounded-md text-sm border border-gray-700 cursor-not-allowed"
                    >
                      Coming Soon
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Rejected Ad Ideas */}
        {rejectedAds.length > 0 && (
          <section className="mb-14">
            <div
              onClick={() => setShowRejected(!showRejected)}
              className="bg-[#121212] hover:bg-[#1c1c1c] px-6 py-4 rounded-md shadow border border-[#222] cursor-pointer flex items-center justify-between mb-4"
            >
              <h2 className="text-xl font-bold text-red-400">Ad Ideas Rejected</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full font-medium">
                  {rejectedAds.length}
                </span>
                <span className="text-lg text-red-400">{showRejected ? '−' : '+'}</span>
              </div>
            </div>
            {showRejected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {rejectedAds.map((ad) => (
                  <div
                    key={ad.id}
                    className="bg-[#121212] rounded-xl p-7 border-l-4 border-red-500 hover:ring-1 hover:ring-red-500 shadow-md transition flex flex-col gap-2"
                  >
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Rejected on {new Date(ad.created_at).toLocaleDateString()}</p>
                      <p className="text-lg font-semibold text-white">
                        Ad for <span className="text-red-400 underline">{getOfferName(ad.offer_id)}</span>
                      </p>
                      {ad.rejection_reason && (
                        <p className="text-sm text-gray-400 mt-2">
                          <span className="font-medium text-red-300">Reason:</span> {ad.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="mt-3">
                      <Link href={`/affiliate/dashboard/promote/${ad.offer_id}`}>
                        <button className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm shadow transition">
                          Revise & Resubmit
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* History Section */}
        <section className="mb-14">
          <div
            onClick={() => setShowHistory(!showHistory)}
            className="bg-[#121212] hover:bg-[#1c1c1c] px-6 py-4 rounded-md shadow border border-[#222] cursor-pointer flex items-center justify-between mb-4"
          >
            <h2 className="text-xl font-bold text-gray-400">History</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 bg-gray-400/10 px-2 py-0.5 rounded-full font-medium">
                0
              </span>
              <span className="text-lg text-gray-400">{showHistory ? '−' : '+'}</span>
            </div>
          </div>
          {showHistory && (
            <div className="text-gray-500 italic">No archived activity yet.</div>
          )}
        </section>

        {/* Empty State */}
        {approvedRequests.length === 0 && approvedAds.length === 0 && rejectedAds.length === 0 && (
          <div className="text-center mt-32 text-gray-500">
            <h3 className="text-2xl font-bold">Nothing here yet</h3>
            <p className="mt-2 text-md">Once you're approved or your ads are live, you’ll see it here.</p>
          </div>
        )}

        <div className="text-center mt-20 text-sm text-gray-500">
          <p>
            This inbox is your control center for approvals, ad submissions, and campaign readiness. As activity unfolds,
            you’ll see access updates, idea approvals, and important milestones all in one place.
          </p>
        </div>
      </div>
    </div>
  );
}