'use client';
import { useSession } from '@supabase/auth-helpers-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/../utils/supabase/pages-client';

interface Offer {
  id: string;
  business_email: string;
  title: string;
  description: string;
  commission: number;
  type: string;
  price?: number | null;
  currency?: string | null;
  commission_value?: number | null;
}

export default function EditOfferPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = Array.isArray(params.offerId) ? params.offerId[0] : params.offerId;

  const session = useSession();
  const user = session?.user;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [commission, setCommission] = useState('');
  const [type, setType] = useState('one-time');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [commissionValue, setCommissionValue] = useState('');

  useEffect(() => {
    const fetchOffer = async () => {
      if (!offerId || !user?.email) return;

      setLoading(true);
      setError(null);

      const { data, error } = await (supabase as any)
        .from('offers')
        .select(
          'id,business_email,title,description,commission,type,price,currency,commission_value'
        )
        .eq('id', offerId as string)
        .eq('business_email', user.email as string)
        .single();

      if (error || !data) {
        console.error('[EditOffer] failed to load offer', error);
        setError('Offer not found.');
        setLoading(false);
        return;
      }

      setOffer(data as Offer);
      setBusinessName(data.title || '');
      setDescription(data.description || '');
      setCommission(data.commission?.toString() || '');
      setPrice(data.price != null ? data.price.toString() : '');
      setCurrency(data.currency || 'USD');
      setType(data.type || 'one-time');
      setCommissionValue(
        data.commission_value != null ? data.commission_value.toString() : ''
      );
      setLoading(false);
    };

    fetchOffer();
  }, [offerId, user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !offerId) return;

    const { error } = await (supabase as any)
      .from('offers')
      .update({
        title: businessName,
        description,
        commission: Number(commission),
        type,
        price: price ? Number(price) : null,
        currency,
        commission_value: commissionValue ? Number(commissionValue) : null,
      })
      .eq('id', offerId as string)
      .eq('business_email', user.email as string);

    if (error) {
      console.error('[EditOffer] failed to save offer', error);
      return;
    }

    router.push('/business/my-business');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2 text-[#e2f8f8]">Edit Offer</h1>
      <p className="text-slate-400 mb-8">Fine‑tune your offer details and keep everything up to date.</p>
      <div className="rounded-2xl bg-[#020617]/90 border border-[#111827] shadow-[0_0_40px_rgba(0,0,0,0.45)] p-8">
        {loading ? (
          <p className="text-gray-500">Loading offer…</p>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : offer ? (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
            {/* Business Name */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-300 tracking-wide">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg bg-[#020617] border border-[#1f2937] text-slate-100 px-3 py-2 focus:border-[#00C2CB] focus:outline-none"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-300 tracking-wide">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg bg-[#020617] border border-[#1f2937] text-slate-100 px-3 py-2 focus:border-[#00C2CB] focus:outline-none"
                required
              />
            </div>

            {/* Commission (%) */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-300 tracking-wide">Commission (%)</label>
              <input
                type="number"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="w-full rounded-lg bg-[#020617] border border-[#1f2937] text-slate-100 px-3 py-2 focus:border-[#00C2CB] focus:outline-none"
                required
              />
            </div>

            {/* Product Price */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-300 tracking-wide">Product Price (Optional)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg bg-[#020617] border border-[#1f2937] text-slate-100 px-3 py-2 focus:border-[#00C2CB] focus:outline-none"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-300 tracking-wide">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg bg-[#020617] border border-[#1f2937] text-slate-100 px-3 py-2 focus:border-[#00C2CB] focus:outline-none"
              >
                <option value="USD">USD</option>
                <option value="AUD">AUD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Commission Value */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-300 tracking-wide">Commission Value (Optional)</label>
              <input
                type="number"
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
                className="w-full rounded-lg bg-[#020617] border border-[#1f2937] text-slate-100 px-3 py-2 focus:border-[#00C2CB] focus:outline-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-300 tracking-wide">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg bg-[#020617] border border-[#1f2937] text-slate-100 px-3 py-2 focus:border-[#00C2CB] focus:outline-none"
              >
                <option value="one-time">One-Time</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>

            <button
              type="submit"
              className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold px-6 py-2 rounded-full shadow-[0_0_20px_rgba(0,194,203,0.45)] hover:shadow-[0_0_30px_rgba(0,194,203,0.6)] transition-all"
            >
              Save Changes
            </button>
          </form>
        ) : (
          <p className="text-gray-500">Offer not found.</p>
        )}
      </div>
    </div>
  );
}