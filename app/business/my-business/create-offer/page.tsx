'use client';

import '@/globals.css';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

function CreateOfferPageInner() {
  const router = useRouter();
  const supabase = createPagesBrowserClient();

  const searchParams = useSearchParams();
  const isOnboard = searchParams?.get('onboard') === 'tracking';
  const [showOnboard, setShowOnboard] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [siteHost, setSiteHost] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isOnboard || !userEmail) return;
      const { data, error } = await supabase
        .from('offers')
        .select('id')
        .eq('business_email', userEmail)
        .limit(1);
      if (!cancelled) setShowOnboard(!error && (!data || data.length === 0));
    })();
    return () => { cancelled = true; };
  }, [isOnboard, userEmail]);

  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [commission, setCommission] = useState('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [price, setPrice] = useState('');
  const [commissionValue, setCommissionValue] = useState(0);
  const [currency, setCurrency] = useState('USD');

  // NEW: payout structure fields
  const [payoutMode, setPayoutMode] = useState<'upfront' | 'spread'>('upfront');
  const [payoutInterval, setPayoutInterval] = useState<'monthly'>('monthly');
  const [payoutCycles, setPayoutCycles] = useState<number>(12);

  const [step, setStep] = useState(1);

  const [metaConnections, setMetaConnections] = useState<{ page_id: string; ad_account_id: string }[]>([]);
  const [selectedPage, setSelectedPage] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');

  const hasMetaConnections = metaConnections.length > 0;

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
    if (!siteHost) {
      alert('Please select a Website Platform/Host.');
      return;
    }

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

    // Determine payout structure to store
    const finalPayoutMode = type === 'recurring' ? payoutMode : 'upfront';
    const finalPayoutInterval = type === 'recurring' ? payoutInterval : 'monthly';
    const finalPayoutCycles =
      type === 'recurring' && payoutMode === 'spread'
        ? payoutCycles
        : null;

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
      site_host: siteHost,
      // NEW payout fields
      payout_mode: finalPayoutMode,
      payout_interval: finalPayoutInterval,
      payout_cycles: finalPayoutCycles,
    };

    const { error: insertError } = await supabase.from('offers').insert([newOffer]);
    if (insertError) {
      console.error('[❌ Offer Insert Error]', insertError.message);
      return;
    }

    if (isOnboard) {
      router.replace(`/business/setup-tracking?offerId=${newOffer.id}&onboard=1`);
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
    setSiteHost('');
    setPayoutMode('upfront');
    setPayoutInterval('monthly');
    setPayoutCycles(12);

    router.push('/business/my-business');
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold text-[#00C2CB] mb-10">Upload Your Offer</h1>

        <div className="bg-[#1a1a1a] rounded-lg shadow-lg border border-[#2a2a2a] p-8 space-y-6">
          {showOnboard && (
            <div className="mb-6 rounded-xl border border-[#1f2a2a] bg-[#0f1313] p-5">
              <div className="text-[#7ff5fb] text-xs tracking-wide">Onboarding • Step 2 of 3</div>
              <h2 className="mt-1 text-white text-lg font-semibold">Create your first offer</h2>
              <p className="mt-1 text-sm text-gray-400">
                After you save, we’ll take you straight to <span className="text-[#00C2CB]">Setup Tracking</span> for this offer.
              </p>
              <div className="mt-3 text-xs text-gray-400">
                Need help? <Link href="/business/setup-tracking" className="text-[#7ff5fb] underline">View tracking instructions</Link>
              </div>
            </div>
          )}

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
              <div>
                <label className="block font-semibold text-white mb-1">Website Platform/Host</label>
                <select
                  required
                  value={siteHost}
                  onChange={(e) => setSiteHost(e.target.value)}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                >
                  <option value="">Select platform/host</option>
                  <option value="Shopify">Shopify</option>
                  <option value="Wix">Wix</option>
                  <option value="WooCommerce">WooCommerce</option>
                  <option value="Squarespace">Squarespace</option>
                  <option value="Custom/Other">Custom/Other</option>
                </select>
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
                  onChange={(e) => setType(e.target.value as 'one-time' | 'recurring')}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                >
                  <option value="one-time">One-Time</option>
                  <option value="recurring">Recurring</option>
                </select>
              </div>

              {type === 'recurring' && (
                <div className="mt-4 space-y-4 border border-[#262626] rounded-lg p-4 bg-[#111111]">
                  <h3 className="text-sm font-semibold text-[#7ff5fb] uppercase tracking-wide">
                    Recurring payout structure
                  </h3>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      How do you want to pay affiliates?
                    </label>
                    <select
                      value={payoutMode}
                      onChange={(e) => setPayoutMode(e.target.value as 'upfront' | 'spread')}
                      className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                    >
                      <option value="upfront">Pay full commission upfront</option>
                      <option value="spread">Spread commission over time</option>
                    </select>
                  </div>

                  {payoutMode === 'spread' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Payout interval
                          </label>
                          <select
                            value={payoutInterval}
                            onChange={(e) => setPayoutInterval(e.target.value as 'monthly')}
                            className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                          >
                            <option value="monthly">Monthly</option>
                            {/* Future: weekly, quarterly, etc. */}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Number of payout cycles
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={payoutCycles}
                            onChange={(e) => setPayoutCycles(Number(e.target.value) || 1)}
                            className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Based on this offer and commission, each cycle would pay approximately{' '}
                        <span className="text-[#7ff5fb] font-semibold">
                          {commissionValue > 0 && payoutCycles > 0
                            ? `${currency} $${(commissionValue / payoutCycles).toFixed(2)}`
                            : '—'}
                        </span>{' '}
                        to the affiliate.
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {step === 3 && hasMetaConnections && (
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
                onClick={() => {
                  setStep((prev) => {
                    if (!hasMetaConnections && prev === 4) {
                      return 2;
                    }
                    return Math.max(prev - 1, 1);
                  });
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg shadow transition"
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  setStep((prev) => {
                    if (!hasMetaConnections && prev === 2) {
                      return 4;
                    }
                    return prev + 1;
                  });
                }}
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

export default function CreateOfferPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0e0e0e] text-white flex items-center justify-center">
          <span className="text-sm text-gray-400">Loading offer builder...</span>
        </div>
      }
    >
      <CreateOfferPageInner />
    </Suspense>
  );
}