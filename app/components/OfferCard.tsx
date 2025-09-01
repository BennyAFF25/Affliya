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
  logoUrl?: string;
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
    <div className="relative bg-white/90 rounded-2xl border border-gray-200 p-6 shadow-[0_2px_12px_rgba(0,194,203,0.08)] ring-1 ring-[#00C2CB]/20 hover:ring-[#00C2CB] hover:shadow-xl transition duration-300 transform hover:scale-[1.02] flex flex-col justify-between h-full">
      {offer.logoUrl && (
        <div className="flex justify-center mb-4">
          <img
            src={offer.logoUrl}
            alt="Business Logo"
            className="h-20 object-contain"
            style={{ maxWidth: '100%' }}
          />
        </div>
      )}
      {offer.currency && (
        <div className="absolute top-4 right-4 text-xs bg-[#e0fafa] text-[#00C2CB] font-medium px-3 py-1 rounded-full">
          {offer.currency}
        </div>
      )}

      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
            Verified
          </span>
          {offer.isTopCommission && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-600 flex items-center gap-1">
              🏆 Top % <Info className="w-3 h-3" />
            </span>
          )}
        </div>

        <h2 className="text-lg font-bold text-[#00C2CB]">{offer.businessName}</h2>
        <p className="text-sm text-gray-600 mt-1 mb-4 line-clamp-3">{offer.description}</p>

        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4 text-[#00C2CB]" />
            <span>
              <strong>Commission:</strong> {offer.commission}%
            </span>
          </div>

          {offer.price && offer.commissionValue && (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span>
                <strong>Est. Earnings:</strong> {offer.currency} {offer.commissionValue.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-purple-500" />
            <span>
              <strong>Type:</strong> {offer.type}
            </span>
          </div>
        </div>

        {role === 'affiliate' && !requested && (
          <textarea
            placeholder="Write a note for the business..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full mt-4 p-2 border-2 border-[#00C2CB] rounded-lg text-sm focus:outline-none focus:ring-0"
            rows={2}
          />
        )}
      </div>

      <div className="mt-6">
        {role === 'affiliate' ? (
          <button
            onClick={handleRequest}
            disabled={requested}
            className={`w-full font-semibold px-4 py-2 rounded-lg transition text-sm ${
              requested
                ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                : 'bg-[#00C2CB] hover:bg-[#00b0b8] text-white'
            }`}
          >
            {requested ? 'Request Sent' : 'Request to Promote'}
          </button>
        ) : (
          <Link href={`/business/my-business/edit-offer/${offer.id}`}>
            <button className="w-full bg-white hover:bg-[#e0fafa] text-[#00C2CB] border border-gray-300 px-4 py-2 rounded-lg font-medium transition text-sm">
              View Details
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}