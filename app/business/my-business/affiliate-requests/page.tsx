'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';

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

  useEffect(() => {
    const fetchOffersAndRequests = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
  }, []);

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
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6 text-[#00C2CB]">Affiliate Promotion Requests</h1>

      {/* Pending Requests */}
      {pending.length === 0 ? (
        <p className="text-gray-600">No pending promotion requests.</p>
      ) : (
        <ul className="space-y-6">
          {pending.map((offer, index) => (
            <li
              key={index}
              className="border border-gray-200 rounded-lg shadow-md p-6 bg-white"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-[#00C2CB]">{offer.title}</h2>
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

              <p className="text-sm text-gray-700 mt-2">{offer.description}</p>
              <div className="text-sm mt-2">
                <p>Commission: {offer.commission}%</p>
                <p>Type: {offer.type}</p>
                <p className="mt-1 text-gray-600">Affiliate: {offer.affiliate_email}</p>
                {offer.notes && (
                  <p className="mt-1 italic text-gray-500">“{offer.notes}”</p>
                )}
                <p className="mt-1">
                  Status:{' '}
                  <span className="font-semibold">{offer.status}</span>
                </p>
              </div>

              <div className="mt-4 flex gap-4">
                <button
                  onClick={() => handleUpdateStatus(offer.requestId, 'approved')}
                  className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleUpdateStatus(offer.requestId, 'rejected')}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                >
                  Reject
                </button>
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
                className="border border-red-200 bg-red-50 rounded-lg shadow-md p-6"
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

                <p className="text-sm text-gray-700 mt-2">{offer.description}</p>
                <div className="text-sm mt-2">
                  <p>Commission: {offer.commission}%</p>
                  <p>Type: {offer.type}</p>
                  <p className="mt-1 text-gray-600">Affiliate: {offer.affiliate_email}</p>
                  {offer.notes && (
                    <p className="mt-1 italic text-gray-500">“{offer.notes}”</p>
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