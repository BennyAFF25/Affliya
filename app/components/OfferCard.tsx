'use client';

import { useSession } from '@supabase/auth-helpers-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useState } from 'react';
import { BadgeDollarSign, ShoppingBag, TrendingUp, Info } from 'lucide-react';

interface Offer {
  id: string;
  businessName?: string;
  description: string;
  commission: number;
  type: string;
  price?: number;
  currency?: string;
  commissionValue?: number;
  isTopCommission?: boolean;
  businessEmail?: string;
  business_email?: string;
  logoUrl?: string;
  website?: string;
}

export default function OfferCard({
  offer,
  role,
  alreadyRequested = false,
}: {
  offer: Offer;
  role: 'business' | 'affiliate';
  alreadyRequested?: boolean;
}) {
  const session = useSession();
  const user = session?.user;
  const [notes, setNotes] = useState('');
  const [requested, setRequested] = useState(alreadyRequested);

  const handleRequest = async () => {
    const supabase = createClientComponentClient();

    const affiliateEmail = user?.email;

    if (!affiliateEmail) {
      console.error('[❌ No email found in session]');
      alert("You must be logged in to request.");
      return;
    }

    console.log('[👤 Affiliate Email]', affiliateEmail);
    console.log('[🧪 Offer Debug]', {
      id: offer.id,
      business_email: offer.businessEmail,
      businessName: offer.businessName,
    });

    // Normalize backend field naming (supports both camelCase and snake_case)
    if (!offer.businessEmail && offer.business_email) {
      offer.businessEmail = offer.business_email;
    }

    if (!offer.businessEmail) {
      console.error('[❌ Missing business email in offer]');
      alert('This offer is missing business information. Please contact support.');
      return;
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('email', affiliateEmail)
      .single();
    console.log('[🧠 User Role]', userProfile?.role);

    const payload = {
      offer_id: offer.id,
      affiliate_email: affiliateEmail,
      business_email: offer.businessEmail ?? '',
      status: 'pending',
      notes: notes || '',
    };

    console.log('[📩 Request Payload]', payload);

    const { error } = await supabase.from('affiliate_requests').upsert(payload, {
      onConflict: 'offer_id,affiliate_email',
    });

    if (error) {
      console.error('[❌ Request Error]', error);
      alert('Something went wrong. ' + error.message);
    } else {
      alert('Request sent!');
      // mark request as sent so the button disables
      setRequested(true);
    }
  };

  return (
    <div className="relative flex flex-col h-full rounded-2xl bg-[#101010] border border-[#1f2937] px-5 py-5 shadow-md hover:border-[#00C2CB]/80 hover:shadow-[0_0_35px_rgba(0,194,203,0.18)] transition-all duration-200">
      {/* Logo */}
      {offer.logoUrl && (
        <div className="flex justify-center mb-4">
          <img
            src={offer.logoUrl}
            alt="Business Logo"
            className="h-16 object-contain"
            style={{ maxWidth: '100%' }}
          />
        </div>
      )}

      {/* Currency badge */}
      {offer.currency && (
        <div className="absolute top-4 right-4 text-[11px] bg-[#0b1726] text-[#00C2CB] font-medium px-3 py-1 rounded-full border border-[#00C2CB]/40">
          {offer.currency}
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Offer</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {offer.businessName}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center rounded-full bg-emerald-900/40 text-emerald-300 text-[11px] px-2 py-0.5">
              ● Verified
            </span>
            {offer.isTopCommission && (
              <span className="inline-flex items-center rounded-full border border-amber-400/60 text-amber-200 text-[11px] px-2 py-0.5">
                ⭐ Top payout
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-1 mb-3 line-clamp-3">
          {offer.description}
        </p>
      </div>

      {/* Stats */}
      <div className="space-y-2 text-sm mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4 text-[#00C2CB]" />
            <span className="text-gray-400">Commission</span>
          </div>
          <span className="font-medium text-[#00C2CB]">{offer.commission}%</span>
        </div>

        {offer.price && offer.commissionValue && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-gray-400">Est. earnings</span>
            </div>
            <span className="font-medium text-white">
              {offer.currency} {offer.commissionValue.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-sky-400" />
            <span className="text-gray-400">Type</span>
          </div>
          <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-[#111827] text-gray-200">
            {offer.type}
          </span>
        </div>
      </div>

      {/* Affiliate note */}
      {role === 'affiliate' && !requested && (
        <textarea
          placeholder="Write a note for the business..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full mt-2 p-2 rounded-lg text-sm bg-black border border-[#0d0d0d] text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-[#00C2CB] focus:ring-0"
          rows={2}
        />
      )}

      {/* Footer buttons */}
      <div className="mt-5 flex gap-3">
        {role === 'affiliate' ? (
          <>
            <Link
              href={`/affiliate/marketplace/${offer.id}`}
              className="flex-1 text-center rounded-lg border border-[#00C2CB] px-4 py-2 text-xs sm:text-sm font-medium text-[#00C2CB] hover:bg-[#00C2CB]/10 transition-colors"
            >
              View offer
            </Link>
            <button
              onClick={handleRequest}
              disabled={requested}
              className={`flex-1 font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                requested
                  ? 'bg-zinc-700 text-gray-400 cursor-not-allowed'
                  : 'bg-[#00C2CB] hover:bg-[#00b0b8] text-black'
              }`}
            >
              {requested ? 'Request Sent' : 'Request to Promote'}
            </button>
          </>
        ) : (
          <Link href={`/business/my-business/edit-offer/${offer.id}`}>
            <button className="w-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-colors">
              View Details
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}