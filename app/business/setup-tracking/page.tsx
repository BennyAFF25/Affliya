'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { ClipboardDocumentIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

export default function SetupTrackingPage() {
  const session = useSession();
  const user = session?.user;
  const supabase = useSupabaseClient();
  const [copied, setCopied] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [isReady, setIsReady] = useState(false);

  // Collapsible sections for Shopify pixels
  const [showViewPixel, setShowViewPixel] = useState(false);
  const [showCartPixel, setShowCartPixel] = useState(false);
  const [showCheckoutPixel, setShowCheckoutPixel] = useState(false);
  const [copiedView, setCopiedView] = useState(false);
  const [copiedCart, setCopiedCart] = useState(false);
  const [copiedCheckout, setCopiedCheckout] = useState(false);

  // New state for live campaign
  const [liveCampaign, setLiveCampaign] = useState<any>(null);
  const [loadingLiveCampaign, setLoadingLiveCampaign] = useState(false);

  // New state for universal pixel collapsible and copied state
  const [showUniversalPixel, setShowUniversalPixel] = useState(false);
  const [copiedUniversal, setCopiedUniversal] = useState(false);

  // Tracking Test state
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState<string>('');
  const [testStartISO, setTestStartISO] = useState<string>('');

  const testUrl = useMemo(() => {
    try {
      if (!selectedOffer?.id) return '';
      if (!selectedOffer.website) return '';
      let website = selectedOffer.website;
      if (!/^https?:\/\//i.test(website)) {
        website = 'https://' + website;
      }
      const u = new URL(website);
      u.searchParams.set('nm_offer', String(selectedOffer.id));
      if (user?.email) u.searchParams.set('nm_aff', user.email);
      u.searchParams.set('nm_test', '1');
      return u.toString();
    } catch {
      return '';
    }
  }, [selectedOffer, user]);
  // Combined test: open link and listen for events
  async function startCombinedTest() {
    try {
      setTestStatus('idle');
      setTestMsg('');
      if (!selectedOffer) {
        setTestStatus('fail');
        setTestMsg('Select an offer first.');
        return;
      }
      if (!selectedOffer.website) {
        setTestStatus('fail');
        setTestMsg('This offer has no storefront URL set in “website”.');
        return;
      }

      setTesting(true);
      const startedAt = new Date().toISOString();
      setTestStartISO(startedAt);

      // Open the test link in a new tab (if available)
      if (testUrl) {
        // small timeout to ensure `startedAt` is committed before user navigates
        setTimeout(() => {
          try { window.open(testUrl, '_blank', 'noopener,noreferrer'); } catch {}
        }, 150);
      }

      const deadline = Date.now() + 60_000; // 60s for slower stores
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const liveCampaignId = liveCampaign?.id ?? null;
      const offerId = selectedOffer.id;
      const aff = user?.email ?? null;

      // Try to derive the storefront domain from the selected offer's website
      let domainHost: string | null = null;
      try {
        const urlObj = new URL(selectedOffer.website);
        domainHost = urlObj.hostname.replace(/^www\./, '');
      } catch {
        domainHost = null;
      }

      while (Date.now() < deadline) {
        // 1) Prefer: direct match on offer_id (+ affiliate, if we have it)
        let query = supabase
          .from('campaign_tracking_events')
          .select('id, created_at, event_type')
          .in('event_type', ['page_view', 'page_viewed'])
          .gte('created_at', startedAt)
          .eq('offer_id', offerId)
          .limit(1);

        if (aff) {
          query = query.eq('affiliate_id', aff);
        }

        const { data: direct, error: directErr } = await query;

        if (!directErr && direct && direct.length) {
          setTestStatus('ok');
          setTestMsg(`Pixel connected! Detected ${direct[0].event_type} tied to this offer.`);
          setTesting(false);
          return;
        }

        // 2) Fallback: match by storefront domain inside event_data->>url
        if (domainHost) {
          const { data: viaDomain, error: viaDomainErr } = await supabase
            .from('campaign_tracking_events')
            .select('id, created_at, event_type, event_data')
            .in('event_type', ['page_view', 'page_viewed'])
            .gte('created_at', startedAt)
            .ilike('event_data->>url', `%${domainHost}%`)
            .limit(1);

          if (!viaDomainErr && viaDomain && viaDomain.length) {
            setTestStatus('ok');
            setTestMsg(`Pixel connected via domain match (${viaDomain[0].event_type}).`);
            setTesting(false);
            return;
          }
        }

        // 3) Optional: match via live campaign id, if we know one
        if (liveCampaignId) {
          const { data: viaCamp } = await supabase
            .from('campaign_tracking_events')
            .select('id, created_at, event_type')
            .in('event_type', ['page_view', 'page_viewed'])
            .eq('campaign_id', liveCampaignId)
            .gte('created_at', startedAt)
            .limit(1);

          if (viaCamp && viaCamp.length) {
            setTestStatus('ok');
            setTestMsg(`Pixel connected via campaign (${viaCamp[0].event_type}).`);
            setTesting(false);
            return;
          }
        }

        await sleep(1500);
      }

      setTestStatus('fail');
      setTestMsg('No event detected. Click the button again, disable blockers, and ensure the pixel is installed.');
    } catch (e: any) {
      setTestStatus('fail');
      setTestMsg(e?.message || 'Unexpected error while testing.');
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    if (user) setIsReady(true);
  }, [user]);

  useEffect(() => {
    if (!isReady) return;

    const fetchOffers = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from('offers')
        .select('id, website, site_host')
        .eq('business_email', user.email);
      if (data && !error) {
        setOffers(data);
        if (data.length > 0) {
          setSelectedOffer(data[0]);
        }
      }
    };

    fetchOffers();
  }, [isReady]);

  // Fetch live campaign when selectedOffer changes
  useEffect(() => {
    if (!selectedOffer) {
      setLiveCampaign(null);
      return;
    }
    const fetchLiveCampaign = async () => {
      setLoadingLiveCampaign(true);
      const { data, error } = await supabase
        .from('live_campaigns')
        .select('id')
        .eq('offer_id', selectedOffer.id)
        .limit(1)
        .single();
      if (data && !error) {
        setLiveCampaign(data);
      } else {
        setLiveCampaign(null);
      }
      setLoadingLiveCampaign(false);
    };
    fetchLiveCampaign();
  }, [selectedOffer]);

  useEffect(() => {
    if (selectedOffer) {
      if (selectedOffer.site_host === 'Shopify') {
        // For Shopify, don't set trackingCode (handled in render), but set to empty string for copying fallback
        setTrackingCode('');
      } else {
        const domain = new URL(selectedOffer.website).hostname.replace(/^www\./, '');
        const baseUrl = process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000'
          : 'https://www.nettmark.com';
        setTrackingCode(
          `<script src="${baseUrl}/tracker.js" data-business="${domain}" data-offer="${selectedOffer.id}"></script>`
        );
      }
    }
  }, [selectedOffer, user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendEmail = async () => {
    if (!devEmail) return;
    await fetch('/api/send-tracking-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: devEmail,
        script: trackingCode,
        from: user?.email,
      }),
    });
    setEmailSent(true);
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] py-10 px-4">
      <div className="max-w-3xl mx-auto mt-12 p-8 bg-[#1a1a1a] text-white rounded-xl shadow-lg border border-gray-700 ring-2 ring-[#00C2CB]/10">
        <h1 className="text-4xl font-extrabold mb-6 text-[#00C2CB] tracking-tight text-center">
          Install Your Nettmark Tracking Code
        </h1>
        <p className="mb-6 text-gray-300 leading-relaxed text-center">
          <span className="font-semibold text-white">To track affiliate sales and automate payouts,</span> please install this code on your website’s <code className="bg-[#1f1f1f] px-1 py-0.5 rounded text-sm font-mono text-[#00C2CB]">&lt;head&gt;</code> tag:
        </p>

        {/* --- Quick Tracking Test ------------------------------------------------ */}
        <div className="rounded-xl border border-[#262626] bg-[#121212] p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold tracking-wide text-[#7ff5fb]">Test Your Pixel</h2>
          </div>

          {offers.length === 0 ? (
            <div className="text-sm text-gray-400">
              Create your first Offer to test tracking. Once an offer exists, we’ll open your storefront with Nettmark params and wait for a new <code className="px-1 py-0.5 bg-black/30 rounded">page_view</code>.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-xs text-gray-400 md:col-span-1">Offer</label>
                <select
                  className="md:col-span-2 bg-[#0f0f0f] border border-[#262626] rounded-md px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#00C2CB]/40"
                  value={selectedOffer?.id || ''}
                  onChange={(e) => {
                    const offer = offers.find((o) => o.id === e.target.value);
                    setSelectedOffer(offer || null);
                  }}
                >
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.website || o.id}
                    </option>
                  ))}
                </select>
              </div>


              {/* Single-button flow: starts listening AND opens the link */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={startCombinedTest}
                  disabled={testing || !selectedOffer || !testUrl}
                  className="px-4 py-2 rounded-md bg-[#00C2CB] hover:bg-[#00b0b8] text-black text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? 'Testing…' : (testStartISO ? 'Re‑Test Tracking' : 'Test Tracking')}
                </button>

                {testStatus === 'ok' && (
                  <span className="text-xs px-2 py-1 rounded-full bg-[#10b981]/15 text-[#bbf7d0] border border-[#10b981]/25">
                    Connected
                  </span>
                )}
                {testStatus === 'fail' && (
                  <span className="text-xs px-2 py-1 rounded-full bg-[#ef4444]/15 text-[#fecaca] border border-[#ef4444]/25">
                    No event
                  </span>
                )}
              </div>

              {testMsg && <p className="text-xs text-gray-400">{testMsg}</p>}

              <div className="text-[11px] text-gray-500 pt-1">
                Opens your site with Nettmark params, then polls for up to 60s for a new page view tied to the selected offer.
              </div>
            </div>
          )}
        </div>

        {offers.length > 0 && (
          <div className="mb-4">
            <label className="block font-semibold text-sm text-gray-400 mb-1">Select Offer:</label>
            <select
              value={selectedOffer?.id || ''}
              onChange={(e) => {
                const offer = offers.find((o) => o.id === e.target.value);
                setSelectedOffer(offer);
              }}
              className="border rounded px-3 py-2 w-full border-[#00C2CB]/20 bg-[#1a1a1a] text-white ring-2 ring-[#00C2CB]/10 focus:ring-[#00C2CB]/30 focus:outline-none transition"
            >
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.website}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedOffer?.site_host === 'Shopify' ? (
          <>
            {!loadingLiveCampaign && !liveCampaign && (
              <div className="mb-4 p-2 rounded bg-[#333333] text-[#00C2CB] font-semibold text-center text-sm">
                No affiliates are promoting this offer yet. Your tracking is ready!
              </div>
            )}
            {(() => {
              const apiUrl = 'https://www.nettmark.com/api/track-event';
              let shopifyUniversalPixel = `
<!-- Nettmark Shopify Universal Pixel -->
<script>
  analytics.subscribe('page_viewed', async (event) => {
    await fetch('${apiUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'page_viewed',
        event_data: event?.data
      })
    });
  });
  analytics.subscribe('cart_updated', async (event) => {
    await fetch('${apiUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'cart_updated',
        event_data: event?.data
      })
    });
  });
  analytics.subscribe('checkout_completed', async (event) => {
    await fetch('${apiUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'checkout_completed',
        event_data: event?.data
      })
    });
  });
</script>
`.trim();

              return (
                <div className="rounded-lg bg-[#121212] border border-[#00C2CB]/20">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left text-[#00C2CB] font-semibold hover:bg-[#1a1a1a] focus:outline-none"
                    onClick={() => setShowUniversalPixel(v => !v)}
                  >
                    Nettmark Shopify Universal Pixel (Install in Customer Events)
                    <span>{showUniversalPixel ? '▲' : '▼'}</span>
                  </button>
                  {showUniversalPixel && (
                    <div className="px-4 pb-4">
                      <pre className="bg-[#181818] p-3 rounded mb-2 overflow-x-auto text-xs border border-[#00C2CB]/10 whitespace-pre-wrap">{shopifyUniversalPixel}</pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shopifyUniversalPixel);
                          setCopiedUniversal(true);
                          setTimeout(() => setCopiedUniversal(false), 2000);
                        }}
                        className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-4 py-1 rounded text-xs font-semibold"
                      >
                        {copiedUniversal ? "Copied!" : "Copy Pixel"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <pre className="bg-[#121212] text-[#00C2CB] p-4 rounded-lg border border-dashed border-[#00C2CB]/20 text-sm overflow-x-auto mb-6 transition-all duration-300 shadow-inner whitespace-pre-wrap">{trackingCode}</pre>
            <button
              onClick={handleCopy}
              className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-5 py-2 rounded-lg font-semibold shadow-md transition duration-200 mr-2 flex items-center gap-2"
            >
              <ClipboardDocumentIcon className="h-5 w-5" /> {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </>
        )}

        {/* -------- Implementation Instructions -------- */}
        <div className="mt-8 rounded-xl bg-[#121212] border border-[#00C2CB]/20 p-5">
          <h2 className="text-lg font-semibold text-[#7ff5fb] mb-3">How to install tracking</h2>

          {selectedOffer?.site_host === 'Shopify' ? (
            <div className="space-y-3 text-sm text-gray-300">
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  In your Shopify admin go to <span className="text-white font-medium">Settings → Customer events</span>.
                </li>
                <li>
                  Click <span className="text-white font-medium">Add custom pixel</span>, name it <span className="text-white font-medium">Nettmark</span>, then paste the pixel shown above.
                </li>
                <li>
                  Click <span className="text-white font-medium">Connect</span> (to allow the pixel to run) and then <span className="text-white font-medium">Save</span>.
                </li>
              </ol>

              <div className="mt-3 rounded-lg bg-[#1a1a1a] border border-[#00C2CB]/15 p-3">
                <p className="text-[#7ff5fb] font-medium mb-1">Quick verify (optional)</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Open your storefront with a test link like:
                    <code className="ml-1 bg-[#181818] px-1 py-0.5 rounded text-xs">?nm_aff=you@example.com&amp;nm_camp=YOUR_CAMPAIGN_ID</code>
                  </li>
                  <li>Add to cart and complete a test checkout.</li>
                  <li>In Nettmark, you should see a <em>page_view</em>, <em>add_to_cart</em>, and <em>conversion</em> for that campaign.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-gray-300">
              <p className="mb-1">
                Add the script below to the <code className="bg-[#181818] px-1 py-0.5 rounded text-xs text-[#00C2CB]">&lt;head&gt;</code> of your site templates:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Home / global layout (loads on all pages)</li>
                <li>Product &amp; cart templates</li>
                <li>Checkout / thank‑you page template</li>
              </ul>
              <div className="rounded-lg bg-[#1a1a1a] border border-[#00C2CB]/15 p-3">
                <p className="text-[#7ff5fb] font-medium mb-1">Alternative (GTM)</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create a new <span className="text-white font-medium">Custom HTML</span> tag with the script.</li>
                  <li>Trigger on <span className="text-white font-medium">All Pages</span> and your purchase/thank‑you events.</li>
                  <li>Publish the container.</li>
                </ol>
              </div>
              <div className="mt-2 rounded-lg bg-[#1a1a1a] border border-[#00C2CB]/15 p-3">
                <p className="text-[#7ff5fb] font-medium mb-1">Quick verify (optional)</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Visit your site with <code className="bg-[#181818] px-1 py-0.5 rounded text-xs">?nm_aff=you@example.com&amp;nm_camp=YOUR_CAMPAIGN_ID</code>.</li>
                  <li>Perform a test purchase or completion flow; confirm events appear in Nettmark.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="font-medium mb-2">Or send to your developer:</h2>
          <input
            type="email"
            placeholder="developer@example.com"
            value={devEmail}
            onChange={(e) => setDevEmail(e.target.value)}
            className="border rounded-lg px-4 py-2 w-full mb-3 shadow-sm border-[#00C2CB]/20 bg-[#1a1a1a] text-white ring-2 ring-[#00C2CB]/10 focus:ring-[#00C2CB]/30 focus:outline-none transition"
          />
          <button
            onClick={handleSendEmail}
            className="bg-[#1a1a1a] hover:bg-[#00C2CB]/10 border border-[#00C2CB]/30 text-[#00C2CB] px-5 py-2 rounded-lg font-semibold transition flex items-center gap-2 ring-2 ring-[#00C2CB]/10"
          >
            <PaperAirplaneIcon className="h-5 w-5" /> {emailSent ? 'Sent' : 'Send Code'}
          </button>
        </div>
      </div>
    </div>
  );
}