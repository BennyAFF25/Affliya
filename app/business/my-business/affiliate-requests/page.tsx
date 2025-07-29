'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';

interface Request {
  id: string;
  offer_id: string;
  affiliate_email: string;
  status: string;
  created_at: string;
  notes?: string;
}

interface Offer {
  id: string;
  title: string;
  description: string;
  commission: number;
  type: string;
}

export default function AffiliateRequestsPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/');
      return;
    }

    const fetchOffersAndRequests = async () => {
      if (!user?.email) return;

      const { data: offersData } = await supabase
        .from('offers')
        .select('*')
        .eq('business_email', user.email);

      setOffers(offersData || []);

      const { data: requestsData, error } = await supabase
        .from('affiliate_requests')
        .select('*');

      if (error) {
        console.error('Error loading requests:', error.message);
      } else {
        setRequests(requestsData || []);
      }
    };

    fetchOffersAndRequests();
  }, [session, user, router]);

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    console.log('Updating request:', requestId, 'to:', newStatus);
  
    const { data, error } = await supabase
      .from('affiliate_requests')
      .update({ status: newStatus })
      .eq('id', requestId)
      .select(); // Add this to force return of updated rows
  
    if (error) {
      console.error('Error updating status:', error.message);
    } else {
      console.log('Update successful:', data);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: newStatus } : r
        )
      );
    }
  };

  const matchedOffers = requests
    .map((req) => {
      const offer = offers.find((o) => o.id === req.offer_id);
      return offer
        ? {
            requestId: req.id, // FIXED: use requestId for Supabase updates
            offerId: offer.id,
            title: offer.title,
            description: offer.description,
            commission: offer.commission,
            type: offer.type,
            affiliate_email: req.affiliate_email,
            status: req.status,
            notes: req.notes,
          }
        : null;
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  const pending = matchedOffers.filter((o) => o.status === 'pending');
  const rejected = matchedOffers.filter((o) => o.status === 'rejected');

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] px-6 py-10">
      <h1 className="text-3xl font-bold mb-6 text-[#00C2CB]">Affiliate Promotion Requests</h1>

      {/* Pending Requests */}
      {pending.length === 0 ? (
        <p className="text-gray-600">No pending promotion requests.</p>
      ) : (
        <ul className="space-y-6">
          {pending.map((offer, index) => (
            <li
              key={index}
              className="rounded-xl bg-[#1F1F1F] text-white shadow-md border border-[#2c2c2c] px-6 py-5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start">
                  <div className="w-10 h-10 mr-4 flex items-center justify-center rounded-full bg-[#00C2CB]/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-lg font-semibold text-white">{offer.title}</h2>
                    <span className="text-sm text-gray-400">{offer.description}</span>

                    <div className="mt-4">
                      <p className="text-sm text-gray-400">
                        <span className="font-medium text-white">Commission:</span>{' '}
                        <span className="text-[#00C2CB]">{offer.commission}%</span>{' '}
                        <span className="inline-block ml-2 px-2 py-1 text-xs bg-[#00C2CB]/10 text-[#00C2CB] rounded">
                          {offer.type === 'recurring' ? 'Recurring' : 'One-time'}
                        </span>
                      </p>
                      <p className="text-sm mt-2">
                        <span className="text-gray-400">Affiliate Email:</span>{' '}
                        <span className="text-white font-medium">{offer.affiliate_email}</span>
                      </p>
                      {offer.notes && (
                        <p className="text-sm italic text-gray-500 mt-2">“{offer.notes}”</p>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-gray-400">Requested: 2 hours ago</p>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs bg-[#00C2CB]/20 text-[#00C2CB] px-2 py-1 rounded-full font-medium">
                      Trust Score: 9.2
                    </span>
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full font-medium">
                      New
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleUpdateStatus(offer.requestId, 'rejected')}
                      className="bg-[#2c2c2c] text-gray-300 hover:bg-[#3a3a3a] px-4 py-2 rounded-lg text-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(offer.requestId, 'approved')}
                      className="bg-[#00C2CB] text-black hover:bg-[#00b0b8] px-4 py-2 rounded-lg text-sm font-semibold"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Rejected Requests */}
      {rejected.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-12 mb-4 text-red-500">Rejected Requests</h2>
          <ul className="space-y-6">
            {rejected.map((offer, index) => (
              <li
                key={index}
                className="border border-red-200 bg-[#1F1F1F] rounded-lg shadow-md p-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-red-600">{offer.title}</h2>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <svg
                        key={i}
                        className="w-4 h-4 text-blue-400 fill-current"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-white mt-2">{offer.description}</p>
                <div className="text-sm mt-2">
                  <p>Commission: {offer.commission}%</p>
                  <p>Type: {offer.type}</p>
                  <p className="mt-1 text-white/70">Affiliate: {offer.affiliate_email}</p>
                  {offer.notes && (
                    <p className="mt-1 italic text-white/60">“{offer.notes}”</p>
                  )}
                  <p className="mt-1">
                    Status:{' '}
                    <span className="font-semibold text-red-600">{offer.status}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}