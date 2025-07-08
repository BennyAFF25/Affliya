'use client';
import { useSession } from '@supabase/auth-helpers-react';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Offer {
  id: string;
  businessName: string;
  description: string;
  commission: number;
  type: string;
  price?: number;
  currency?: string;
  commissionValue?: number;
}

export default function EditOfferPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = Array.isArray(params.offerId) ? params.offerId[0] : params.offerId;

  const session = useSession();
  const user = session?.user;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [commission, setCommission] = useState('');
  const [type, setType] = useState('one-time');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [commissionValue, setCommissionValue] = useState('');

  useEffect(() => {
    const savedOffers = localStorage.getItem('my-offers');
    if (savedOffers && offerId) {
      const parsedOffers: Offer[] = JSON.parse(savedOffers);
      const foundOffer = parsedOffers.find((o) => o.id === offerId);
      if (foundOffer) {
        setOffer(foundOffer);
        setBusinessName(foundOffer.businessName);
        setDescription(foundOffer.description);
        setCommission(foundOffer.commission.toString());
        setPrice(foundOffer.price?.toString() || '');
        setCurrency(foundOffer.currency || 'USD');
        setType(foundOffer.type);
        setCommissionValue(foundOffer.commissionValue?.toString() || '');
      }
    }
  }, [offerId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    const savedOffers = localStorage.getItem('my-offers');
    if (savedOffers && offerId) {
      const parsedOffers: Offer[] = JSON.parse(savedOffers);
      const updatedOffers = parsedOffers.map((offer) =>
        offer.id === offerId
          ? {
              ...offer,
              businessName,
              description,
              commission: Number(commission),
              type,
              price: price ? Number(price) : undefined,
              currency,
              commissionValue: commissionValue ? Number(commissionValue) : undefined,
            }
          : offer
      );
      localStorage.setItem('my-offers', JSON.stringify(updatedOffers));
    }

    router.push('/business/my-business');
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Edit Offer</h1>
      {offer ? (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
          <div>
            <label className="block text-sm font-medium mb-1">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Commission (%)</label>
            <input
              type="number"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Product Price (Optional)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="USD">USD</option>
              <option value="AUD">AUD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Commission Value (Optional)</label>
            <input
              type="number"
              value={commissionValue}
              onChange={(e) => setCommissionValue(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="one-time">One-Time</option>
              <option value="recurring">Recurring</option>
            </select>
          </div>

          <button
            type="submit"
            className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded"
          >
            Save Changes
          </button>
        </form>
      ) : (
        <p className="text-gray-500">Loading offer or offer not found...</p>
      )}
    </div>
  );
}