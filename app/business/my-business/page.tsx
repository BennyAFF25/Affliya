'use client';

import '@/globals.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ConnectStripeButton from '@/../app/components/ConnectStripeButton';

interface Offer {
  id: string;
  title: string;
  description: string;
  commission: number;
  type: string;
}

export default function MyBusinessPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const session = useSession();
  const user = session?.user;
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!user?.email) return;

    const fetchOffers = async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('id,title,description,commission,type')
        .eq('business_email', user.email);

      if (error) {
        console.error('[❌ Error fetching business offers]', error.message);
      } else {
        setOffers(data ? (data as Offer[]) : []);
      }
    };

    fetchOffers();
  }, [user]);

  const handleDelete = async (id: string) => {
    console.log('[🗑 Attempting to delete offer]', id);
    setLoadingDeleteId(id);
    try {
      const { error: deleteError } = await supabase.from('offers').delete().eq('id', id);
      if (deleteError) throw deleteError;

      const { data: updated, error: refetchError } = await supabase
        .from('offers')
        .select('id,title,description,commission,type')
        .eq('business_email', user?.email);

      if (refetchError) throw refetchError;

      setOffers(updated ? updated : []);
      localStorage.setItem('my-offers', JSON.stringify(updated || []));
      localStorage.setItem('marketplace-offers', JSON.stringify(updated || []));
      console.log('[✅ Offer deleted and offers updated]');
    } catch (err: any) {
      console.error('[❌ Delete Error]', err.message || err);
    } finally {
      setLoadingDeleteId(null);
    }
  };

  return (
    <div className="p-10">
      {/* Stripe Connect Button */}
      {user?.email && (
        <div className="mb-6">
          <ConnectStripeButton businessEmail={user.email} />
        </div>
      )}
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mb-4" />
        <div className="flex items-center justify-center gap-2 text-gray-500 mb-6">
          <svg
            className="w-5 h-5 text-[#00C2CB]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8c-1.333-1.333-4-1-4 2s2.667 4 4 4 4-1.333 4-4-2.667-3.333-4-2zm0 0V6m0 10v2"
            />
          </svg>
          <span className="text-sm sm:text-base text-center">
            Manage your offers, creatives, and Meta integration — all in one place.
          </span>
        </div>
      </div>

      {/* Top Action Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <Link href="/business/my-business/affiliate-requests">
          <button className="flex items-center gap-2 bg-white border border-[#00C2CB] text-[#00C2CB] font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:bg-[#e0fafa] transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Affiliate Requests
          </button>
        </Link>

        <Link href="/business/my-business/connect-meta">
          <button className="flex items-center gap-2 bg-white border border-[#00C2CB] text-[#00C2CB] font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:bg-[#e0fafa] transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
            </svg>
            Connect Meta Ads
          </button>
        </Link>

        <Link href="/business/my-business/publish-creatives">
          <button className="flex items-center gap-2 bg-white border border-[#00C2CB] text-[#00C2CB] font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:bg-[#e0fafa] transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16h16" />
            </svg>
            Publish Creatives
          </button>
        </Link>

        <Link href="/business/my-business/ad-ideas">
          <button className="flex items-center gap-2 bg-white border border-[#00C2CB] text-[#00C2CB] font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:bg-[#e0fafa] transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16h8M8 12h8m-8-4h8" />
            </svg>
            View Ad Ideas
          </button>
        </Link>

        <Link href="/business/my-business/post-ideas">
          <button className="flex items-center gap-2 bg-white border border-[#00C2CB] text-[#00C2CB] font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:bg-[#e0fafa] transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h11M9 21V3m4 18V3" />
            </svg>
            View Post Ideas
          </button>
        </Link>

        <Link href="/business/setup-tracking">
          <button className="flex items-center gap-2 bg-white border border-[#00C2CB] text-[#00C2CB] font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:bg-[#e0fafa] transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3v1.5m0 15v1.5m9-9h1.5M3 12h1.5m12.364-6.364l1.061 1.061M4.636 17.364l1.061 1.061m12.364 0l-1.061 1.061M4.636 6.636L5.697 7.697" />
            </svg>
            Setup Tracking
          </button>
        </Link>
      </div>

      {/* Upload Offer Button */}
      <div className="text-center mb-10">
        <Link href="/business/my-business/create-offer">
          <button className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold py-2 px-6 rounded shadow-md transition">
            Upload New Offer
          </button>
        </Link>
      </div>

      {/* Offer Cards */}
      {offers.length === 0 ? (
        <p className="text-gray-700 text-center">You haven't uploaded any offers yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white border border-[#00C2CB] shadow-sm hover:shadow-md transition rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="text-[#00C2CB] bg-[#e0fafa] p-2 rounded-full">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 7v13h18V7M5 10h14M10 21V3h4v18"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-[#00C2CB]">{offer.title}</h2>
              </div>
              <p className="text-gray-700 mb-2">{offer.description}</p>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium text-gray-600">Commission:</span>
                <span className="text-sm font-semibold text-gray-800">{offer.commission}%</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    offer.type === 'recurring'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-yellow-100 text-yellow-600'
                  }`}
                >
                  {offer.type === 'recurring' ? 'Recurring' : 'One-Time'}
                </span>
              </div>

              <div className="flex gap-3">
                <Link href={`/business/my-business/edit-offer/${offer.id}`}>
                  <button className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold py-2 px-4 rounded shadow">
                    Edit Offer
                  </button>
                </Link>
                <button
                  onClick={() => handleDelete(offer.id)}
                  disabled={loadingDeleteId === offer.id}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded shadow"
                >
                  {loadingDeleteId === offer.id ? 'Deleting...' : 'Delete Offer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}