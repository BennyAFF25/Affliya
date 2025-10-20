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

interface Notification {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  created_at: string;
}

export default function AffiliateInbox() {
  const session = useSession();
  const user = session?.user;
  const [approvedRequests, setApprovedRequests] = useState<AffiliateRequest[]>([]);
  const [approvedAds, setApprovedAds] = useState<AdIdea[]>([]);
  const [rejectedAds, setRejectedAds] = useState<AdIdea[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false });

      setApprovedRequests(requests || []);
      setApprovedAds(ads || []);
      setRejectedAds(rejected || []);
      setNotifications(notifs || []);
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

        {/* Promote Access */}
        {approvedRequests.length > 0 && (
          <section className="mb-14">
            <div onClick={() => setShowPromote(!showPromote)} className="cursor-pointer bg-[#121212] px-6 py-4 rounded-md border border-[#222] flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#00C2CB]">Promote Access</h2>
              <span className="text-sm text-[#00C2CB]">{showPromote ? '−' : '+'}</span>
            </div>
            {showPromote && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {approvedRequests.map((r) => (
                  <div key={r.id} className="bg-[#121212] rounded-xl p-7 border-l-4 border-[#00C2CB] shadow-md flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Approved on {new Date(r.created_at).toLocaleDateString()}</p>
                      <p className="text-lg font-semibold">Promote <span className="text-[#00C2CB] underline">{getOfferName(r.offer_id)}</span></p>
                    </div>
                    <Link href={`/affiliate/dashboard/promote/${r.offer_id}`}>
                      <button className="bg-[#00C2CB] text-white px-4 py-1.5 rounded shadow-md text-sm hover:bg-[#00b0b8] transition">Go</button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Organic Post Approvals from Notifications */}
        {notifications.length > 0 && (
          <section className="mb-14">
            <div className="bg-[#121212] px-6 py-4 rounded-md shadow border border-[#222] mb-4">
              <h2 className="text-xl font-bold text-yellow-400">Organic Post Approvals</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {notifications.map((n) => (
                <div key={n.id} className="bg-[#121212] rounded-xl p-7 border-l-4 border-yellow-500 shadow-md transition flex flex-col gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Approved on {new Date(n.created_at).toLocaleDateString()}</p>
                    <p className="text-lg font-semibold text-white">{n.title}</p>
                    <p className="text-sm text-gray-400 mt-2">{n.body}</p>
                  </div>
                  {n.link_url && (
                    <div className="mt-3">
                      <Link href={n.link_url}>
                        <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-1.5 rounded text-sm shadow transition">Get Tracking Link</button>
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* History */}
        <section className="mb-14">
          <div onClick={() => setShowHistory(!showHistory)} className="cursor-pointer bg-[#121212] px-6 py-4 rounded-md border border-[#222] flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-400">History</h2>
            <span className="text-sm text-gray-400">{showHistory ? '−' : '+'}</span>
          </div>
          {showHistory && <div className="text-gray-500 italic">No archived activity yet.</div>}
        </section>

        {/* Empty State */}
        {approvedRequests.length === 0 && approvedAds.length === 0 && rejectedAds.length === 0 && notifications.length === 0 && (
          <div className="text-center mt-32 text-gray-500">
            <h3 className="text-2xl font-bold">Nothing here yet</h3>
            <p className="mt-2 text-md">Once you're approved or your ads are live, you’ll see it here.</p>
          </div>
        )}

        <div className="text-center mt-20 text-sm text-gray-500">
          <p>This inbox is your control center for approvals, ad submissions, and campaign readiness. As activity unfolds, you’ll see access updates, idea approvals, and important milestones all in one place.</p>
        </div>
      </div>
    </div>
  );
}