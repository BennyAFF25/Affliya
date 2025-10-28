'use client';

import { useEffect, useState } from 'react';
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
              // Define the three Shopify pixel snippets using only offer ID, no business_email or affiliate_email
              let shopifyViewPixel = `
<!-- Nettmark Shopify Pixel: Page Viewed -->
<script>
  analytics.subscribe('page_viewed', async (event) => {
    await fetch('https://www.nettmark.com/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id: '${selectedOffer.id}',
        event_type: 'click',
        event_data: {
          url: window.location.href,
          page_type: event?.data?.page_type
        }
      })
    });
  });
</script>
`.trim();

              let shopifyCartPixel = `
<!-- Nettmark Shopify Pixel: Add to Cart -->
<script>
  analytics.subscribe('cart_updated', async (event) => {
    await fetch('https://www.nettmark.com/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id: '${selectedOffer.id}',
        event_type: 'add_to_cart',
        event_data: {
          url: window.location.href,
          cart: event?.data
        }
      })
    });
  });
</script>
`.trim();

              let shopifyCheckoutPixel = `
<!-- Nettmark Shopify Pixel: Conversion/Purchase -->
<script>
  analytics.subscribe('checkout_completed', async (event) => {
    await fetch('https://www.nettmark.com/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id: '${selectedOffer.id}',
        event_type: 'conversion',
        event_data: event?.data
      })
    });
  });
</script>
`.trim();
              return (
                <div className="space-y-4">
                  {/* Page View Pixel */}
                  <div className="rounded-lg bg-[#121212] border border-[#00C2CB]/20">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-[#00C2CB] font-semibold hover:bg-[#1a1a1a] focus:outline-none"
                      onClick={() => setShowViewPixel(v => !v)}
                    >
                      Nettmark Shopify Pixel: Page Viewed
                      <span>{showViewPixel ? '▲' : '▼'}</span>
                    </button>
                    {showViewPixel && (
                      <div className="px-4 pb-4">
                        <pre className="bg-[#181818] p-3 rounded mb-2 overflow-x-auto text-xs border border-[#00C2CB]/10 whitespace-pre-wrap">{shopifyViewPixel}</pre>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shopifyViewPixel);
                            setCopiedView(true);
                            setTimeout(() => setCopiedView(false), 2000);
                          }}
                          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-4 py-1 rounded text-xs font-semibold"
                        >
                          {copiedView ? "Copied!" : "Copy Pixel"}
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Add to Cart Pixel */}
                  <div className="rounded-lg bg-[#121212] border border-[#00C2CB]/20">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-[#00C2CB] font-semibold hover:bg-[#1a1a1a] focus:outline-none"
                      onClick={() => setShowCartPixel(v => !v)}
                    >
                      Nettmark Shopify Pixel: Add to Cart
                      <span>{showCartPixel ? '▲' : '▼'}</span>
                    </button>
                    {showCartPixel && (
                      <div className="px-4 pb-4">
                        <pre className="bg-[#181818] p-3 rounded mb-2 overflow-x-auto text-xs border border-[#00C2CB]/10 whitespace-pre-wrap">{shopifyCartPixel}</pre>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shopifyCartPixel);
                            setCopiedCart(true);
                            setTimeout(() => setCopiedCart(false), 2000);
                          }}
                          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-4 py-1 rounded text-xs font-semibold"
                        >
                          {copiedCart ? "Copied!" : "Copy Pixel"}
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Checkout Pixel */}
                  <div className="rounded-lg bg-[#121212] border border-[#00C2CB]/20">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-[#00C2CB] font-semibold hover:bg-[#1a1a1a] focus:outline-none"
                      onClick={() => setShowCheckoutPixel(v => !v)}
                    >
                      Nettmark Shopify Pixel: Conversion/Purchase
                      <span>{showCheckoutPixel ? '▲' : '▼'}</span>
                    </button>
                    {showCheckoutPixel && (
                      <div className="px-4 pb-4">
                        <pre className="bg-[#181818] p-3 rounded mb-2 overflow-x-auto text-xs border border-[#00C2CB]/10 whitespace-pre-wrap">{shopifyCheckoutPixel}</pre>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shopifyCheckoutPixel);
                            setCopiedCheckout(true);
                            setTimeout(() => setCopiedCheckout(false), 2000);
                          }}
                          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-4 py-1 rounded text-xs font-semibold"
                        >
                          {copiedCheckout ? "Copied!" : "Copy Pixel"}
                        </button>
                      </div>
                    )}
                  </div>
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