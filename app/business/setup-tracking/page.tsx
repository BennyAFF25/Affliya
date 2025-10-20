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
  const [offerId, setOfferId] = useState<string>('');
  const [offerWebsite, setOfferWebsite] = useState<string>('');
  const [trackingCode, setTrackingCode] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (user) setIsReady(true);
  }, [user]);

  useEffect(() => {
    if (!isReady) return;

    const fetchOffers = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from('offers')
        .select('id, website')
        .eq('business_email', user.email);
      if (data && !error) {
        setOffers(data);
        if (data.length > 0) {
          setOfferId(data[0].id);
          setOfferWebsite(data[0].website);
        }
      }
    };

    fetchOffers();
  }, [isReady]);

  useEffect(() => {
    if (offerId && offerWebsite) {
      const domain = new URL(offerWebsite).hostname.replace(/^www\./, '');
      const baseUrl = process.env.NODE_ENV === 'development'
        ? 'http://nettmark.com'
        : 'https://nettmark.com';

      setTrackingCode(
        `<script src="${baseUrl}/tracker.js" data-business="${domain}" data-offer="${offerId}"></script>`
      );
    }
  }, [offerId, offerWebsite]);

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
              value={offerId}
              onChange={(e) => {
                const offer = offers.find((o) => o.id === e.target.value);
                setOfferId(offer.id);
                setOfferWebsite(offer.website);
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

        <pre className="bg-[#121212] text-[#00C2CB] p-4 rounded-lg border border-dashed border-[#00C2CB]/20 text-sm overflow-x-auto mb-6 transition-all duration-300 shadow-inner">{trackingCode}</pre>

        <button
          onClick={handleCopy}
          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black px-5 py-2 rounded-lg font-semibold shadow-md transition duration-200 mr-2 flex items-center gap-2"
        >
          <ClipboardDocumentIcon className="h-5 w-5" /> {copied ? 'Copied!' : 'Copy Code'}
        </button>

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