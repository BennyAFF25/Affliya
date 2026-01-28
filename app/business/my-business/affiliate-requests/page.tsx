'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from '@/../utils/supabase/pages-client';

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
  const session = useSession();
  const [requests, setRequests] = useState<AffiliateRequest[]>([]);

  useEffect(() => {
    if (!session) return;

    const fetchRequests = async () => {
      const userEmail = session.user?.email;
      if (!userEmail) return;

      const { data, error } = await supabase
        .from('affiliate_requests')
        .select(
          `
          id,
          affiliate_email,
          status,
          notes,
          created_at,
          offer:offer_id (
            id,
            title,
            description,
            commission,
            type,
            logo_url
          )
        `
        )
        .eq('business_email', userEmail)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[affiliate-requests] Error fetching requests:', error.message);
        return;
      }

      setRequests(data as AffiliateRequest[]);
    };

    fetchRequests();
  }, [session]);

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    // Gather current data before update for notifications
    const current = requests.find((r) => r.id === requestId);
    const currentAffiliateEmail = current?.affiliate_email;
    const currentOfferId = (current as any)?.offer?.id;
    const currentOfferTitle = (current as any)?.offer?.title || 'Your offer';
    const currentBusinessEmail = session?.user?.email;

    const { error } = await supabase
      .from('affiliate_requests')
      .update({ status: newStatus })
      .eq('id', requestId);

    if (error) {
      console.error('[affiliate-requests] Error updating status:', error.message);
      return;
    }

    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: newStatus } : r
      )
    );

    // Email notifications (non-blocking)
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        window.location.origin;

      const decisionEndpoint =
        newStatus === 'approved'
          ? '/api/emails/affiliate-request-approved'
          : newStatus === 'rejected'
          ? '/api/emails/affiliate-request-rejected'
          : null;

      // Notify the affiliate about the decision
      if (decisionEndpoint && currentAffiliateEmail && currentBusinessEmail) {
        fetch(`${baseUrl}${decisionEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: currentAffiliateEmail,
            affiliateEmail: currentAffiliateEmail,
            businessEmail: currentBusinessEmail,
            offerId: currentOfferId,
            offerTitle: currentOfferTitle,
            requestId,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const txt = await res.text().catch(() => '');
              console.error('[affiliate-requests] decision email failed', res.status, txt);
            }
          })
          .catch((err) => {
            console.error('[affiliate-requests] decision email error', err);
          });
      }
    } catch (e) {
      console.error('[affiliate-requests] Email notify failed', e);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const rejected = requests.filter((r) => r.status === 'rejected');

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] px-6 py-10">
      <h1 className="text-3xl font-bold mb-6 text-[#00C2CB]">
        Affiliate Promotion Requests
      </h1>

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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 text-[#00C2CB]"
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
                    <h2 className="text-lg font-semibold">{req.offer?.title}</h2>
                    <p className="text-sm text-gray-400">{req.offer?.description}</p>

                    <div className="mt-4 text-sm text-gray-400">
                      <p>
                        <span className="text-white font-medium">Commission:</span>{' '}
                        <span className="text-[#00C2CB]">{req.offer?.commission}%</span>{' '}
                        <span className="ml-2 px-2 py-1 text-xs bg-[#00C2CB]/10 text-[#00C2CB] rounded">
                          {req.offer?.type === 'recurring' ? 'Recurring' : 'One-time'}
                        </span>
                      </p>
                      <p className="mt-2">
                        <span className="text-white font-medium">Affiliate:</span>{' '}
                        {req.affiliate_email}
                      </p>
                      {req.notes && (
                        <p className="italic text-gray-500 mt-2">“{req.notes}”</p>
                      )}
                      <p className="mt-2">
                        Requested: {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => handleUpdateStatus(req.id, 'rejected')}
                    className="bg-[#2c2c2c] hover:bg-[#3a3a3a] text-gray-300 px-4 py-2 rounded-lg text-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(req.id, 'approved')}
                    className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rejected.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-12 mb-4 text-red-500">
            Rejected Requests
          </h2>
          <ul className="space-y-6">
            {rejected.map((req) => (
              <li
                key={req.id}
                className="border border-red-200 bg-[#1F1F1F] rounded-lg shadow-md p-6"
              >
                <h2 className="text-xl font-semibold text-red-600 mb-1">
                  {req.offer?.title}
                </h2>
                <p className="text-sm text-white">{req.offer?.description}</p>
                <div className="text-sm mt-2 text-white/80">
                  <p>Commission: {req.offer?.commission}%</p>
                  <p>Type: {req.offer?.type}</p>
                  <p>Affiliate: {req.affiliate_email}</p>
                  {req.notes && <p className="italic">“{req.notes}”</p>}
                  <p>
                    Status:{' '}
                    <span className="font-semibold text-red-500">{req.status}</span>
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