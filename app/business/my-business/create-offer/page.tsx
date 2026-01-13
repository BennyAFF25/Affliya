'use client';

import '@/globals.css';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

type MetaConnection = {
  page_id: string;
  page_name: string;
  ad_account_id: string;
  ad_account_name: string;
};

function CreateOfferPageInner() {
  const router = useRouter();
  const supabase = createPagesBrowserClient();
  const searchParams = useSearchParams();

  const isOnboard = searchParams?.get('onboard') === 'tracking';

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [metaConnections, setMetaConnections] = useState<MetaConnection[]>([]);

  const [selectedPage, setSelectedPage] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');

  const hasMetaConnections = metaConnections.length > 0;

  // --- Deduplicated lists for dropdowns ---
  const uniquePages = Array.from(
    new Map(metaConnections.map(c => [c.page_id, c])).values()
  );

  const uniqueAdAccounts = Array.from(
    new Map(metaConnections.map(c => [c.ad_account_id, c])).values()
  );

  // --- Fetch user ---
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) setUserEmail(data.user.email);
    })();
  }, [supabase]);

  // --- Fetch Meta connections ---
  useEffect(() => {
    if (!userEmail) return;

    (async () => {
      const { data, error } = await supabase
        .from('meta_connections')
        .select('page_id, page_name, ad_account_id, ad_account_name')
        .eq('business_email', userEmail);

      if (!error && data) {
        setMetaConnections(data as MetaConnection[]);
      }
    })();
  }, [userEmail, supabase]);

  // --- Core offer fields ---
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [siteHost, setSiteHost] = useState('');

  const [price, setPrice] = useState('');
  const [commission, setCommission] = useState('');
  const [commissionValue, setCommissionValue] = useState(0);
  const [currency, setCurrency] = useState('USD');

  const [step, setStep] = useState(1);

  // --- Auto-calc commission ---
  useEffect(() => {
    const p = parseFloat(price);
    const c = parseFloat(commission);
    if (!isNaN(p) && !isNaN(c)) {
      setCommissionValue(Math.round((p * c) / 100));
    } else {
      setCommissionValue(0);
    }
  }, [price, commission]);

  const handleSubmit = async () => {
    if (!userEmail) return;

    const newOffer = {
      id: uuidv4(),
      title: businessName,
      description,
      website,
      site_host: siteHost,
      business_email: userEmail,

      price: Number(price),
      commission: Number(commission),
      commission_value: commissionValue,
      currency,

      meta_page_id: selectedPage || null,
      meta_ad_account_id: selectedAdAccount || null,

      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('offers').insert([newOffer]);

    if (error) {
      console.error('[❌ Offer insert error]', error.message);
      return;
    }

    if (isOnboard) {
      router.replace(`/business/setup-tracking?offerId=${newOffer.id}&onboard=1`);
    } else {
      router.push('/business/my-business');
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white py-12 px-6">
      <div className="max-w-3xl mx-auto">

        <h1 className="text-4xl font-extrabold text-[#00C2CB] mb-8">
          Upload Your Offer
        </h1>

        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-8 space-y-6">

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-[#00C2CB]">Business Info</h2>

              <input
                placeholder="Business name"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              />

              <textarea
                placeholder="Offer description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              />

              <input
                placeholder="Website"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              />

              <select
                value={siteHost}
                onChange={e => setSiteHost(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              >
                <option value="">Select platform</option>
                <option>Shopify</option>
                <option>Wix</option>
                <option>WooCommerce</option>
                <option>Custom</option>
              </select>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold text-[#00C2CB]">Pricing</h2>

              <input
                type="number"
                placeholder="Product price"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              />

              <input
                type="number"
                placeholder="Commission %"
                value={commission}
                onChange={e => setCommission(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              />

              <div className="text-sm text-gray-400">
                Est payout: <span className="text-[#00C2CB]">${commissionValue}</span>
              </div>

              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              >
                <option>USD</option>
                <option>AUD</option>
                <option>EUR</option>
              </select>
            </>
          )}

          {/* STEP 3 — META */}
          {step === 3 && hasMetaConnections && (
            <>
              <h2 className="text-xl font-semibold text-[#00C2CB]">
                Meta Assets
              </h2>

              <select
                value={selectedPage}
                onChange={e => setSelectedPage(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              >
                <option value="">Select Facebook Page</option>
                {uniquePages.map((conn) => (
                  <option key={conn.page_id} value={conn.page_id}>
                    {conn.page_name || conn.page_id}
                  </option>
                ))}
              </select>

              <select
                value={selectedAdAccount}
                onChange={e => setSelectedAdAccount(e.target.value)}
                className="w-full p-3 bg-black border border-[#2a2a2a] rounded"
              >
                <option value="">Select Ad Account</option>
                {uniqueAdAccounts.map((conn) => (
                  <option key={conn.ad_account_id} value={conn.ad_account_id}>
                    {conn.ad_account_name || conn.ad_account_id}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* NAV */}
          <div className="flex justify-between pt-6">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2 rounded bg-gray-700"
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="ml-auto px-6 py-2 rounded bg-[#00C2CB] text-black font-semibold"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="ml-auto px-6 py-2 rounded bg-[#00C2CB] text-black font-semibold"
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

export default function CreateOfferPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Loading…</div>}>
      <CreateOfferPageInner />
    </Suspense>
  );
}