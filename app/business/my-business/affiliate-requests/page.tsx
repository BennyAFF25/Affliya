'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';

interface AffiliateRequest {
  id: string;
  affiliate_email: string;
  status: string;
  notes?: string;
  created_at: string;
  offer: {
    id: string;
    title: string;
    description: string;
    commission: number;
    type: string;
    logo_url?: string;
  };
}

export default function AffiliateRequestsPage() {
  const [requests, setRequests] = useState<AffiliateRequest[]>([]);
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/');
      return;
    }

    const fetchRequests = async () => {
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('affiliate_requests')
        .select(
          `
          id,
          affiliate_email,
          status,
          notes,
          created_at,
          offers:offer_id (
            id,
            title,
            description,
            commission,
            type,
            logo_url
          )
        `
        )
        .eq('business_email', user.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading requests:', error.message);
      } else {
        setRequests(data as AffiliateRequest[] || []);
      }
    };

    fetchRequests();
  }, [session, user, router]);

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    console.log('Updating request:', requestId, 'to:', newStatus);

    const { data, error } = await supabase
      .from('affiliate_requests')
      .update({ status: newStatus })
      .eq('id', requestId)
      .select();

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

  const pending = requests.filter((r) => r.status === 'pending');
  const rejected = requests.filter((r) => r.status === 'rejected');

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] px-6 py-10">
      <h1 className="text-3xl font-bold mb-6 text-[#00C2CB]">Affiliate Promotion Requests</h1>

      {/* Pending Requests */}
      {pending.length === 0 ? (
        <p className="text-gray-600">No pending promotion requests.</p>
      ) : (
        <ul className="space-y-6">
          {pending.map((req) => (
            <li
              key={req.id}
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
                    <h2 className="text-lg font-semibold text-white">{req.offer?.title || 'Unknown Offer'}</h2>
                    <span className="text-sm text-gray-400">{req.offer?.description}</span>

                    <div className="mt-4">
                      <p className="text-sm text-gray-400">
                        <span className="font-medium text-white">Commission:</span>{' '}
                        <span className="text-[#00C2CB]">{req.offer?.commission}%</span>{' '}
                        <span className="inline-block ml-2 px-2 py-1 text-xs bg-[#00C2CB]/10 text-[#00C2CB] rounded">
                          {req.offer?.type === 'recurring' ? 'Recurring' : 'One-time'}
                        </span>
                      </p>
                      <p className="text-sm mt-2">
                        <span className="text-gray-400">Affiliate Email:</span>{' '}
                        <span className="text-white font-medium">{req.affiliate_email}</span>
                      </p>
                      {req.notes && (
                        <p className="text-sm italic text-gray-500 mt-2">“{req.notes}”</p>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-gray-400">Requested: {new Date(req.created_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'rejected')}
                      className="bg-[#2c2c2c] text-gray-300 hover:bg-[#3a3a3a] px-4 py-2 rounded-lg text-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(req.id, 'approved')}
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
            {rejected.map((req) => (
              <li
                key={req.id}
                className="border border-red-200 bg-[#1F1F1F] rounded-lg shadow-md p-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-red-600">{req.offer?.title || 'Unknown Offer'}</h2>
                </div>

                <p className="text-sm text-white mt-2">{req.offer?.description}</p>
                <div className="text-sm mt-2">
                  <p>Commission: {req.offer?.commission}%</p>
                  <p>Type: {req.offer?.type}</p>
                  <p className="mt-1 text-white/70">Affiliate: {req.affiliate_email}</p>
                  {req.notes && (
                    <p className="mt-1 italic text-white/60">“{req.notes}”</p>
                  )}
                  <p className="mt-1">
                    Status:{' '}
                    <span className="font-semibold text-red-600">{req.status}</span>
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