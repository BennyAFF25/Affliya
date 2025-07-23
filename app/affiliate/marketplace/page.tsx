'use client';

import { useEffect, useState } from 'react';
import OfferCard from '@/components/OfferCard';
import { supabase } from '../../../utils/supabase/pages-client';
import { Search } from 'lucide-react';

interface Offer {
  id: string;
  title: string;
  businessName: string;
  description: string;
  commission: number;
  type: string;
  currency?: string;
  price?: number;
  commissionValue?: number;
  isTopCommission?: boolean;
  business_email?: string;
}

export default function AffiliateMarketplace() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [sortOrder, setSortOrder] = useState('None');

  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          id,
          title,
          business_email,
          description,
          commission,
          type,
          currency,
          price,
          commission_value,
          logo_url,
          website
        `);

      if (error) {
        console.error('[❌ Error fetching offers]', error.message);
        return;
      }

      const commissions = data.map(o => o.commission);
      const threshold = commissions.length ? Math.max(...commissions) * 0.9 : 0;

      const formatted = data.map(o => ({
        ...o,
        businessEmail: o.business_email,
        commissionValue: o.commission_value,
        logoUrl: o.logo_url,
        isTopCommission: o.commission >= threshold,
        businessName: o.title,
      }));
      setOffers(formatted);
    };

    fetchOffers();
  }, []);

  useEffect(() => {
    const fetchRequests = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user || !user.email) {
        console.warn('[❌ No email found in session]');
        return;
      }

      console.log('[📩 Fetching affiliate requests for]', user.email);
      const { data, error: reqError } = await supabase
        .from('affiliate_requests')
        .select('offer_id, status')
        .eq('affiliate_email', user.email);

      if (!reqError && data) {
        const pending = data.filter((r) => r.status === 'pending');
        const ids = Array.from(new Set(pending.map((r) => r.offer_id)));
        setRequestedIds(ids);
      }
    };

    fetchRequests();
  }, []);

  const filtered = offers.filter((offer) => {
    const matchesSearch = offer.title?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'All' || offer.type === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'Highest Commission') return b.commission - a.commission;
    if (sortOrder === 'Business Name') return a.title?.localeCompare(b.title || '') || 0;
    return 0;
  });

  return (
    <div className="flex justify-center px-6 py-10 bg-[#121212] text-white min-h-screen">
      <div className="w-full max-w-7xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#00C2CB] mb-2">Affiliate Marketplace</h1>
          <p className="text-sm text-gray-400">
            Choose offers aligned with your strengths and audience. Send a note to stand out.
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
          <div className="relative w-full sm:w-80">
            <Search className="absolute top-3.5 left-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by business name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-lg border border-[#333] bg-[#1a1a1a] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="p-2 rounded-lg border border-[#333] bg-[#1a1a1a] text-white focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
          >
            <option value="All">All</option>
            <option value="Recurring">Recurring</option>
            <option value="One-Time">One-Time</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="p-2 rounded-lg border border-[#333] bg-[#1a1a1a] text-white focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
          >
            <option value="None">None</option>
            <option value="Highest Commission">Highest Commission</option>
            <option value="Business Name">Business Name</option>
          </select>
        </div>

        {sorted.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                role="affiliate"
                alreadyRequested={requestedIds.includes(offer.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-20">
            No matching offers. Try adjusting your filters or search.
          </div>
        )}
      </div>
    </div>
  );
}