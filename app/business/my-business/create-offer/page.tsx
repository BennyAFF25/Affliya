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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, [supabase]);

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
    return () => {
      cancelled = true;
    };
  }, [isOnboard, userEmail, supabase]);

  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [commission, setCommission] = useState('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [price, setPrice] = useState('');
  const [commissionValue, setCommissionValue] = useState(0);
  const [currency, setCurrency] = useState('USD');

  // offer profile fields
  const [profileHeadline, setProfileHeadline] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [heroImageFiles, setHeroImageFiles] = useState<File[]>([]);
  const [heroImagePreviews, setHeroImagePreviews] = useState<string[]>([]);
  const [avgConversionRate, setAvgConversionRate] = useState('');
  const [avgEpc, setAvgEpc] = useState('');

  // payout structure fields
  const [payoutMode, setPayoutMode] = useState<'upfront' | 'spread'>('upfront');
  const [payoutInterval, setPayoutInterval] = useState<'monthly'>('monthly');
  const [payoutCycles, setPayoutCycles] = useState<number>(12);

  const [step, setStep] = useState(1);

  const [metaConnections, setMetaConnections] = useState<
    {
      page_id: string;
      page_name: string | null;
      ad_account_id: string;
      ad_account_name: string | null;
      pixel_id: string | null;
    }[]
  >([]);

  // --- De-duplicate Meta connections for pages and ad accounts ---
  const uniquePages = React.useMemo(() => {
    const map = new Map<string, any>();
    metaConnections.forEach((c) => {
      if (c.page_id && !map.has(c.page_id)) map.set(c.page_id, c);
    });
    return Array.from(map.values());
  }, [metaConnections]);

  const uniqueAdAccounts = React.useMemo(() => {
    const map = new Map<string, any>();
    metaConnections.forEach((c) => {
      if (c.ad_account_id && !map.has(c.ad_account_id)) map.set(c.ad_account_id, c);
    });
    return Array.from(map.values());
  }, [metaConnections]);

  const [availablePixels, setAvailablePixels] = useState<
    { id: string; name: string; ad_account_id: string }[]
  >([]);
  const [pixelsLoading, setPixelsLoading] = useState(false);

  const [pixelStatus, setPixelStatus] = useState<'idle' | 'loading' | 'ok' | 'empty' | 'error'>(
    'idle',
  );
  const [pixelStatusMsg, setPixelStatusMsg] = useState<string>('');
  const lastLoadedAdAccountRef = React.useRef<string>('');

  const [selectedPage, setSelectedPage] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');
  const [selectedPixel, setSelectedPixel] = useState<string>('');

  const hasMetaConnections = metaConnections.length > 0;

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Auto-calc commissionValue
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

      const { data } = await supabase
        .from('meta_connections')
        .select('page_id, page_name, ad_account_id, ad_account_name, pixel_id')
        .eq('business_email', userEmail);

      if (data) setMetaConnections(data);
    };

    fetchMetaConnections();
  }, [userEmail, supabase]);

  // Pixel loader with robust response handling + visible status
  const loadPixels = async (overrideAdAccountId?: string) => {
    const adAccountId = overrideAdAccountId || selectedAdAccount;

    console.log('[🧪 loadPixels() ENTERED]', {
      adAccountId,
      selectedAdAccount,
      userEmail,
    });

    if (!adAccountId || !userEmail) {
      const msg = 'Select an ad account first.';
      console.warn('[⚠️ Load Pixels] Missing ad account or user email', {
        adAccountId,
        userEmail,
      });
      setPixelStatus('error');
      setPixelStatusMsg(msg);
      return;
    }

    setPixelsLoading(true);
    setPixelStatus('loading');
    setPixelStatusMsg('Fetching pixels…');
    setAvailablePixels([]);

    const started = Date.now();

    try {
      const payload = {
        business_email: userEmail,
        ad_account_id: adAccountId,
      };

      console.log('[📡 Fetching Pixels] POST /api/meta/get-datasets', payload);

      // Primary: POST
      let res = await fetch('/api/meta/get-datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let raw = await res.text();
      console.log('[📥 Pixel API Raw Response]', { status: res.status, raw });

      // Fallback: GET with querystring if POST handler isn’t wired
      if (!res.ok) {
        const qs = new URLSearchParams({ ad_account_id: adAccountId }).toString();
        console.warn('[↩️ Pixel API POST failed, trying GET]', { status: res.status, qs });
        res = await fetch(`/api/meta/get-datasets?${qs}`, { method: 'GET' });
        raw = await res.text();
        console.log('[📥 Pixel API Raw Response (GET fallback)]', { status: res.status, raw });
      }

      if (!res.ok) {
        setPixelStatus('error');
        setPixelStatusMsg(`Pixel fetch failed (HTTP ${res.status}).`);
        return;
      }

      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error('[❌ Pixel API JSON parse failed]', e);
        setPixelStatus('error');
        setPixelStatusMsg('Pixel response was not valid JSON.');
        return;
      }

      console.log('[🧠 Pixel API Parsed JSON]', json);

      const pixels = (json?.pixels || json?.datasets || json?.data || []) as any[];
      console.log('[📊 Normalised pixels]', pixels);

      const normalised = (Array.isArray(pixels) ? pixels : [])
        .map((p: any) => ({
          id: String(p?.id || ''),
          name: String(p?.name || `Pixel ${p?.id || ''}`),
          ad_account_id: String(p?.ad_account_id || adAccountId),
        }))
        .filter((p) => p.id);

      setAvailablePixels(normalised);

      const tookMs = Date.now() - started;

      if (normalised.length === 0) {
        setPixelStatus('empty');
        setPixelStatusMsg(`No pixels found for this ad account. (${tookMs}ms)`);
        return;
      }

      // If user hasn't chosen one yet, auto-select first
      if (!selectedPixel) {
        setSelectedPixel(normalised[0].id);
      }

      setPixelStatus('ok');
      setPixelStatusMsg(`Loaded ${normalised.length} pixel(s). (${tookMs}ms)`);
    } catch (err) {
      console.error('[❌ Pixel Fetch Crash]', err);
      setPixelStatus('error');
      setPixelStatusMsg('Pixel fetch crashed. Check console.');
    } finally {
      setPixelsLoading(false);
    }
  };

  // Auto-load pixels whenever the ad account changes
  useEffect(() => {
    if (!userEmail) return;
    if (!selectedAdAccount) return;

    if (lastLoadedAdAccountRef.current === selectedAdAccount) return;
    lastLoadedAdAccountRef.current = selectedAdAccount;

    setSelectedPixel('');
    setAvailablePixels([]);
    setPixelStatus('idle');
    setPixelStatusMsg('');

    const t = setTimeout(() => {
      loadPixels(selectedAdAccount);
    }, 50);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdAccount, userEmail]);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault?.();

    if (!userEmail) return;
    if (!siteHost) {
      alert('Please select a Website Platform/Host.');
      return;
    }

    let uploadedLogoUrl: string | null = null;

    if (logoFile) {
      const filePath = `${Date.now()}_${logoFile.name}`;
      const { error } = await supabase.storage.from('offer-logos').upload(filePath, logoFile, {
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

    // multi-image upload for profile / carousel
    let uploadedHeroUrl: string | null = null;
    const uploadedImageUrls: string[] = [];

    if (heroImageFiles && heroImageFiles.length > 0) {
      for (const file of heroImageFiles) {
        const heroPath = `${Date.now()}_${file.name}`;
        const { error: heroError } = await supabase.storage.from('profile-images').upload(heroPath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

        if (!heroError) {
          const { data: heroUrlData } = supabase.storage.from('profile-images').getPublicUrl(heroPath);
          const publicUrl = heroUrlData?.publicUrl || null;
          if (publicUrl) {
            uploadedImageUrls.push(publicUrl);
            if (!uploadedHeroUrl) uploadedHeroUrl = publicUrl;
          }
        } else {
          console.error('[❌ Hero Image Upload Error]', heroError.message);
        }
      }
    }

    const metaPageId = selectedPage || null;
    const metaAdAccountId = selectedAdAccount || null;
    const metaPixelId = selectedPixel || null;

    const finalPayoutMode = type === 'recurring' ? payoutMode : 'upfront';
    const finalPayoutInterval = type === 'recurring' ? payoutInterval : 'monthly';
    const finalPayoutCycles = type === 'recurring' && payoutMode === 'spread' ? payoutCycles : null;

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
      meta_pixel_id: metaPixelId,
      price: Number(price),
      commission_value: commissionValue,
      currency,
      type,
      logo_url: uploadedLogoUrl,
      site_host: siteHost,
      profile_headline: profileHeadline || null,
      profile_bio: profileBio || null,
      hero_image_url: uploadedHeroUrl || null,
      image_urls: uploadedImageUrls.length ? uploadedImageUrls : null,
      avg_conversion_rate: avgConversionRate ? Number(avgConversionRate) : null,
      avg_epc: avgEpc ? Number(avgEpc) : null,
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

    setProfileHeadline('');
    setProfileBio('');
    setHeroImageFiles([]);
    setHeroImagePreviews([]);
    setAvgConversionRate('');
    setAvgEpc('');

    setPayoutMode('upfront');
    setPayoutInterval('monthly');
    setPayoutCycles(12);

    setSelectedPage('');
    setSelectedAdAccount('');
    setSelectedPixel('');

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
                After you save, we’ll take you straight to <span className="text-[#00C2CB]">Setup Tracking</span> for this
                offer.
              </p>
              <div className="mt-3 text-xs text-gray-400">
                Need help?{' '}
                <Link href="/business/setup-tracking" className="text-[#7ff5fb] underline">
                  View tracking instructions
                </Link>
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

              <div className="mt-8 border-t border-[#262626] pt-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#7ff5fb] uppercase tracking-wide">Offer profile (optional)</h3>

                <div>
                  <label className="block font-semibold text-white mb-1">Profile headline</label>
                  <input
                    value={profileHeadline}
                    onChange={(e) => setProfileHeadline(e.target.value)}
                    placeholder="Short hook affiliates will see first"
                    className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">Profile bio / story</label>
                  <textarea
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="Explain who you are, who this offer is for, and why it converts."
                    className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">Profile / brand images</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setHeroImageFiles(files);
                      const previews = files.map((file) => URL.createObjectURL(file));
                      setHeroImagePreviews(previews);
                    }}
                    className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    These images will be used on your offer profile page (e.g. product shots or brand hero images).
                  </p>

                  {heroImagePreviews.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-400 mb-1">Preview:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {heroImagePreviews.map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt={`Profile preview ${idx + 1}`}
                            className="w-full max-h-32 object-cover rounded-md border border-[#2a2a2a]"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Avg conversion rate (%) <span className="text-xs text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={avgConversionRate}
                      onChange={(e) => setAvgConversionRate(e.target.value)}
                      placeholder="e.g. 3.5"
                      className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Avg EPC ({currency}) <span className="text-xs text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={avgEpc}
                      onChange={(e) => setAvgEpc(e.target.value)}
                      placeholder="e.g. 1.20"
                      className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                    />
                  </div>
                </div>
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
                    <label className="block text-xs text-gray-400 mb-1">How do you want to pay affiliates?</label>
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
                          <label className="block text-xs text-gray-400 mb-1">Payout interval</label>
                          <select
                            value={payoutInterval}
                            onChange={(e) => setPayoutInterval(e.target.value as 'monthly')}
                            className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                          >
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Number of payout cycles</label>
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
                  onChange={(e) => {
                    console.log('[🧭 Page Selected]', e.target.value);
                    setSelectedPage(e.target.value);
                  }}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                >
                  <option value="">Select a page</option>
                  {uniquePages.map((conn) => (
                    <option key={conn.page_id} value={conn.page_id}>
                      {conn.page_name || conn.page_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Select Ad Account</label>
                <select
                  value={selectedAdAccount}
                  onChange={(e) => {
                    const next = e.target.value;
                    console.log('[🏦 Ad Account Selected]', next);
                    setSelectedAdAccount(next);
                    // Pixel loading + reset handled by effect
                  }}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                >
                  <option value="">Select an ad account</option>
                  {uniqueAdAccounts.map((conn) => (
                    <option key={conn.ad_account_id} value={conn.ad_account_id}>
                      {conn.ad_account_name || conn.ad_account_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-semibold text-white">Select Meta Pixel (required for Sales ads)</label>

                  {pixelStatus !== 'idle' && (
                    <span
                      className={
                        'text-[11px] px-2 py-1 rounded-full border ' +
                        (pixelStatus === 'ok'
                          ? 'bg-[#00C2CB]/10 text-[#7ff5fb] border-[#00C2CB]/25'
                          : pixelStatus === 'loading'
                            ? 'bg-[#222]/60 text-gray-200 border-[#2a2a2a]'
                            : pixelStatus === 'empty'
                              ? 'bg-[#f59e0b]/10 text-[#fbbf24] border-[#f59e0b]/25'
                              : 'bg-[#ef4444]/10 text-[#fecaca] border-[#ef4444]/25')
                      }
                    >
                      {pixelStatus === 'loading'
                        ? 'Loading'
                        : pixelStatus === 'ok'
                          ? 'Pixels found'
                          : pixelStatus === 'empty'
                            ? 'No pixels'
                            : 'Error'}
                    </span>
                  )}
                </div>

                <div className="flex gap-3 mb-3 items-center flex-wrap">
                  <button
                    type="button"
                    disabled={pixelsLoading || !selectedAdAccount || !userEmail}
                    onClick={() => {
                      console.log('[🔥 REFRESH PIXELS CLICKED]', {
                        selectedAdAccount,
                        userEmail,
                      });
                      lastLoadedAdAccountRef.current = '';
                      loadPixels(selectedAdAccount);
                    }}
                    className={
                      'px-4 py-2 rounded-md text-sm font-semibold shadow transition ' +
                      (pixelsLoading || !selectedAdAccount
                        ? 'opacity-50 cursor-not-allowed bg-[#1f1f1f] border border-[#2a2a2a] text-gray-300'
                        : 'bg-[#00C2CB] hover:bg-[#00b0b8] text-black')
                    }
                  >
                    {pixelsLoading ? 'Loading…' : 'Refresh Pixels'}
                  </button>

                  {!selectedAdAccount && <span className="text-xs text-gray-400">Select an ad account first</span>}

                  {pixelStatusMsg && <span className="text-xs text-gray-400">{pixelStatusMsg}</span>}
                </div>

                <select
                  value={selectedPixel}
                  onChange={(e) => setSelectedPixel(e.target.value)}
                  className="w-full p-3 border border-[#2a2a2a] bg-[#0e0e0e] text-white rounded-lg"
                  disabled={!selectedAdAccount}
                >
                  <option value="">Select a pixel</option>
                  {availablePixels.map((pixel) => (
                    <option key={pixel.id} value={pixel.id}>
                      {pixel.name}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-xs text-gray-400">Required only if affiliates will run Sales campaigns.</p>

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
                    if (!hasMetaConnections && prev === 4) return 2;
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
                    if (!hasMetaConnections && prev === 2) return 4;
                    return prev + 1;
                  });
                }}
                className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold py-2 px-6 rounded-lg shadow transition ml-auto"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
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