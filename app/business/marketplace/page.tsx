'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/../utils/supabase/pages-client';

interface Offer {
  id: string;
  businessName: string;
  description: string;
  commission: number;
  type: string;
  website: string;
}

export default function BusinessMarketplace() {
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase.from('offers').select('*');
      if (error) {
        console.error('[❌ Error fetching offers]', error.message);
      } else if (data) {
        setOffers(data);
      }
    };

    fetchOffers();
  }, []);

  return (
    <div className="p-8 bg-surface min-h-screen text-white">
      <h1 className="text-3xl font-extrabold mb-8 text-[#00C2CB] tracking-tight">Business Marketplace</h1>
      {offers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {offers.map((offer) => (
            <div key={offer.id} className="bg-[#1c1c1c] border border-gray-700 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-green-400 bg-green-900 px-2 py-1 rounded-full">Verified</span>
                <span className="text-xs text-white bg-gray-800 px-2 py-1 rounded">{offer.type === 'recurring' ? 'Recurring' : 'One-time'}</span>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">{offer.businessName}</h2>
              <p className="text-sm text-gray-300 mb-4">{offer.description}</p>
              <div className="flex items-center text-sm text-[#00C2CB] font-medium mb-4">
                <svg className="w-4 h-4 mr-1 text-[#00C2CB]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1C8.13 1 5 4.13 5 8c0 4.5 7 13 7 13s7-8.5 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 5.5 12 5.5 14.5 6.62 14.5 8 13.38 10.5 12 10.5z"/></svg>
                Commission: {offer.commission}%
              </div>
              <a
                href={offer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center w-full bg-[#00C2CB] hover:bg-[#00b0b8] text-white py-2 rounded-md transition-colors"
              >
                View Details
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 italic">No offers available yet.</p>
      )}
    </div>
  );
}