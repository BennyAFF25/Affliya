'use client';

import { useEffect, useState } from 'react';
import OfferCard from '@/components/OfferCard';
import { supabase } from '@/../utils/supabase/pages-client';

interface Offer {
  id: string;
  businessName: string;
  description: string;
  commission: number;
  type: string;
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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Business Marketplace</h1>
      {offers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} role="business" />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No offers available yet.</p>
      )}
    </div>
  );
}