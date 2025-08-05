'use client';

import '@/globals.css';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

export default function CreateOfferPage() {
  const router = useRouter();
  const supabase = createPagesBrowserClient();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [commission, setCommission] = useState('');
  const [type, setType] = useState('one-time');
  const [price, setPrice] = useState('');
  const [commissionValue, setCommissionValue] = useState(0);
  const [currency, setCurrency] = useState('USD');

  const [step, setStep] = useState(1);

  const [metaConnections, setMetaConnections] = useState<{ page_id: string; ad_account_id: string }[]>([]);
  const [selectedPage, setSelectedPage] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Auto-calculate commissionValue
  useEffect(() => {
    const parsedPrice = parseFloat(price);
    const parsedCommission = parseFloat(commission);
    if (!isNaN(parsedPrice) && !isNaN(parsedCommission)) {
      const calculated = (parsedPrice * parsedCommission) / 100;
      setCommissionValue(Math.round(calculated));
    } else {
      setCommissionValue(0);
    }
  }, [price, commission]);

  useEffect(() => {
    const fetchMetaConnections = async () => {
      if (!userEmail) return;
      const { data, error } = await supabase
        .from('meta_connections')
        .select('page_id, ad_account_id')
        .eq('business_email', userEmail);

      if (data) setMetaConnections(data);
    };

    fetchMetaConnections();
  }, [userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return;

    let uploadedLogoUrl = null;

    if (logoFile) {
      const filePath = `${Date.now()}_${logoFile.name}`;
      const { data, error } = await supabase.storage
        .from('offer-logos')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: logoFile.type,
        });

      if (!error) {
        const { data: urlData } = supabase.storage.from('offer-logos').getPublicUrl(filePath);
        uploadedLogoUrl = urlData?.publicUrl || null;
        setLogoUrl(uploadedLogoUrl);
      } else {
        console.error('[❌ Logo Upload Error]', error.message);
      }
    }

    const metaPageId = selectedPage || null;
    const metaAdAccountId = selectedAdAccount || null;

    const newOffer = {
      id: uuidv4(),
      title: businessName,
      description,
      business_email: userEmail,
      website,
      commission: Number(commission),
      created_at: new Date().toISOString(),
      meta_ad_account_id: metaAdAccountId,
      meta_page_id: metaPageId,
      price: Number(price),
      commission_value: commissionValue,
      currency,
      type,
      logo_url: uploadedLogoUrl,
    };

    // Insert offer into Supabase
    const { error: insertError } = await supabase.from('offers').insert([newOffer]);
    if (insertError) {
      console.error('[❌ Offer Insert Error]', insertError.message);
      return;
    }

    setBusinessName('');
    setDescription('');
    setWebsite('');
    setCommission('');
    setPrice('');
    setCurrency('USD');
    setType('one-time');
    setLogoFile(null);
    setLogoUrl(null);

    router.push('/business/my-business');
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold text-[#00C2CB] mb-10">Upload Your Offer</h1>

        <div className="bg-[#1a1a1a] rounded-lg shadow-lg border border-[#2a2a2a] p-8 space-y-6">
          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-[#00C2CB]">Business Info</h2>
              <div>
                <label className="block font-semibold text-white mb-1">Business Name</label>
                <input
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Business Name"
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Product/Service Description</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you offering?"
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold text-[#00C2CB]">Offer Pricing</h2>
              <div>
                <label className="block font-semibold text-white mb-1">Product Value ($)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="200"
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Commission (%)</label>
                <input
                  type="number"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="30"
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                />
              </div>
              <div className="text-sm text-white">
                Est. Commission Value:{' '}
                <span className="text-[#00C2CB] font-bold">
                  {commissionValue > 0 ? `${currency} $${commissionValue}` : '—'}
                </span>
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                >
                  <option value="USD">USD</option>
                  <option value="AUD">AUD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Offer Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                >
                  <option value="one-time">One-Time</option>
                  <option value="recurring">Recurring</option>
                </select>
              </div>
            </>
          )}

          {step === 3 && metaConnections.length > 0 && (
            <>
              <h2 className="text-2xl font-bold text-[#00C2CB]">Meta Connections</h2>
              <div>
                <label className="block font-semibold text-white mb-1">Select Facebook Page</label>
                <select
                  value={selectedPage}
                  onChange={(e) => setSelectedPage(e.target.value)}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                >
                  <option value="">Select a page</option>
                  {metaConnections.map((conn, idx) => (
                    <option key={idx} value={conn.page_id}>
                      {conn.page_id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Select Ad Account</label>
                <select
                  value={selectedAdAccount}
                  onChange={(e) => setSelectedAdAccount(e.target.value)}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                >
                  <option value="">Select an ad account</option>
                  {metaConnections.map((conn, idx) => (
                    <option key={idx} value={conn.ad_account_id}>
                      {conn.ad_account_id}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-2xl font-bold text-[#00C2CB]">Upload Logo or Product Image</h2>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
              />
            </>
          )}

          <div className="flex justify-between pt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg shadow transition"
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold py-2 px-6 rounded-lg shadow transition ml-auto"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                onClick={handleSubmit}
                className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold py-2 px-6 rounded-lg shadow transition ml-auto"
              >
                Submit Offer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}