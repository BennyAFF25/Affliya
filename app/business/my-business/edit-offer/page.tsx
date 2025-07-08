'use client';
import { useSession } from '@supabase/auth-helpers-react';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const session = useSession();
  const user = session?.user;

  const [offerData, setOfferData] = useState({
    businessName: '',
    description: '',
    commission: '',
    type: 'one-time',
  });

  useEffect(() => {
    const savedOffers = JSON.parse(localStorage.getItem('my-offers') || '[]');
    const foundOffer = savedOffers.find((o: any) => o.id === id);

    if (foundOffer) {
      setOfferData(foundOffer);
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setOfferData({ ...offerData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    const updatedOffers = JSON.parse(localStorage.getItem('my-offers') || '[]').map((o: any) =>
      o.id === id ? offerData : o
    );

    localStorage.setItem('my-offers', JSON.stringify(updatedOffers));
    localStorage.setItem('marketplace-offers', JSON.stringify(updatedOffers));

    alert('Offer updated!');
    router.push('/business/my-business');
  };

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-6">Edit Offer</h1>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
        <div>
          <label className="block font-semibold mb-1">Business Name</label>
          <input
            required
            name="businessName"
            value={offerData.businessName}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Description</label>
          <textarea
            required
            name="description"
            value={offerData.description}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Commission (%)</label>
          <input
            required
            name="commission"
            type="number"
            value={offerData.commission}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Offer Type</label>
          <select
            name="type"
            value={offerData.type}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="one-time">One-Time</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold py-3 px-6 rounded-lg"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}