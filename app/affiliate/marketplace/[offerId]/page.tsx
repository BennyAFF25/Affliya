'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

type Offer = {
  id: string;
  business_name?: string;
  title?: string;
  description?: string;
  commission?: number;
  type?: string;
  website?: string;
  profile_headline?: string;
  profile_bio?: string;
  hero_image_url?: string;
  avg_conversion_rate?: number | null;
  avg_epc?: number | null;
};

export default function AffiliateOfferProfilePage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params?.offerId as string | undefined;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  // Load current user email
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) {
        setUserEmail(data?.user?.email ?? null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load offer
  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;

    const fetchOffer = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await (supabase as any)
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('[❌ Error fetching offer profile]', error);
        setLoadError(error.message || 'Failed to load offer.');
        setOffer(null);
      } else {
        setOffer(data as Offer);
      }
      setLoading(false);
    };

    void fetchOffer();
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  // Check if already requested
  useEffect(() => {
    if (!offerId || !userEmail) return;
    let cancelled = false;

    const checkRequest = async () => {
      const { data, error } = await (supabase as any)
        .from('affiliate_requests')
        .select('id,status,notes')
        .eq('offer_id', offerId)
        .eq('affiliate_email', userEmail)
        .maybeSingle();

      if (cancelled) return;

      if (error && error.code !== 'PGRST116') {
        console.warn('[⚠️ Error checking affiliate request]', error);
        return;
      }

      if (data) {
        setRequested(true);
        if ((data as any).notes) {
          setRequestNotes((data as any).notes as string);
        }
      }
    };

    void checkRequest();
    return () => {
      cancelled = true;
    };
  }, [offerId, userEmail]);

  const handleRequestToPromote = async () => {
    if (!userEmail || !offerId || !offer) return;

    setRequestLoading(true);
    setRequestError(null);
    setRequestSuccess(null);

    try {
      const payload: any = {
        offer_id: offerId,
        affiliate_email: userEmail,
        status: 'pending',
        notes: requestNotes || null,
      };

      // If your table has these columns, this will populate them nicely
      if ((offer as any).business_email) {
        payload.business_email = (offer as any).business_email;
      }
      if (offer.business_name) {
        payload.business_name = offer.business_name;
      }

      const { error } = await (supabase as any)
        .from('affiliate_requests')
        .insert(payload);

      if (error) {
        console.error('[❌ Error inserting affiliate request]', error);
        setRequestError(error.message || 'Failed to send request.');
        return;
      }

      setRequested(true);
      setRequestSuccess('Request sent to the business for approval.');
    } finally {
      setRequestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading offer…</p>
      </div>
    );
  }

  if (loadError || !offer) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white flex items-center justify-center">
        <div className="max-w-md text-center px-4">
          <p className="text-lg font-semibold text-red-400 mb-2">
            Couldn&apos;t load offer
          </p>
          <p className="text-sm text-gray-400 mb-4">
            {loadError ?? 'This offer may be unavailable or has been removed.'}
          </p>
          <button
            onClick={() => router.push('/affiliate/marketplace')}
            className="px-4 py-2 rounded-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black text-sm font-medium"
          >
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  const displayBusinessName =
    offer.business_name || (offer as any).businessName || offer.title || 'Unnamed business';

  const commissionLabel =
    typeof offer.commission === 'number'
      ? `${offer.commission}% commission`
      : 'Commission rate set by business';

  const offerTypeLabel =
    offer.type === 'recurring'
      ? 'Recurring'
      : offer.type === 'one_time'
      ? 'One-time'
      : offer.type || 'Standard';

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top breadcrumb / back */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.push('/affiliate/marketplace')}
            className="text-xs sm:text-sm text-gray-400 hover:text-[#00C2CB] inline-flex items-center gap-2"
          >
            <span className="text-lg">←</span>
            Back to marketplace
          </button>
        </div>

        {/* Header + hero */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
          {/* Left: Hero + quick stats */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur shadow-[0_0_50px_rgba(0,194,203,0.18)] overflow-hidden">
              <div className="relative h-56 sm:h-72 md:h-80 bg-[#141414]">
                {offer.hero_image_url ? (
                  <img
                    src={offer.hero_image_url}
                    alt={displayBusinessName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm">
                    <span className="mb-2 text-2xl">🛍️</span>
                    Brand image not set yet
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                      Nettmark Partner
                    </p>
                    <h1 className="text-xl sm:text-2xl font-semibold text-white">
                      {displayBusinessName}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-[#00C2CB40] bg-black/40 px-3 py-1 text-[11px] text-[#7ff5fb] shadow-[0_0_14px_rgba(0,194,203,0.7)]">
                      {offerTypeLabel}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] text-white/80">
                      {commissionLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex justify-between items-center">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                    Avg conversion rate
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#7ff5fb]">
                    {offer.avg_conversion_rate != null
                      ? `${offer.avg_conversion_rate.toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-[#00C2CB] text-lg">
                  %
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex justify-between items-center">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                    Avg EPC
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#7ff5fb]">
                    {offer.avg_epc != null ? `$${offer.avg_epc.toFixed(2)}` : 'N/A'}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-[#00C2CB] text-lg">
                  $
                </div>
              </div>
            </div>
          </div>

          {/* Right: story + actions */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6">
              <h2 className="text-sm font-semibold text-[#00C2CB] mb-1">
                {offer.profile_headline || 'About this brand'}
              </h2>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                {offer.profile_bio ||
                  offer.description ||
                  'This business hasn’t added a full story yet, but you can still request to promote and chat through details once approved.'}
              </p>
            </div>

            {/* Website CTA */}
            {offer.website && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                      Destination
                    </p>
                    <p className="text-sm text-white/80 break-all">
                      {offer.website}
                    </p>
                  </div>
                  <a
                    href={offer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black text-xs font-medium px-4 py-2 whitespace-nowrap"
                  >
                    Preview site
                  </a>
                </div>
                <p className="text-[11px] text-white/50">
                  This is where your traffic lands when you promote this offer. Make sure
                  the landing page matches your audience and content style.
                </p>
              </div>
            )}

            {/* Request to promote */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#00C2CB]">
                    Request to promote
                  </h3>
                  <p className="text-xs text-white/60 mt-1">
                    This sends a request to the business. Once approved, the offer unlocks
                    in your dashboard so you can start running campaigns.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-[#00C2CB40] bg-black/40 px-3 py-1 text-[11px] text-[#7ff5fb]">
                  Approval required
                </span>
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Optional message to the business
                </label>
                <textarea
                  rows={4}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  disabled={requested}
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white/80 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#00C2CB] disabled:opacity-60"
                  placeholder="Share how you plan to promote, your audience, or any results you’ve had before."
                />
              </div>

              {requestError && (
                <p className="text-xs text-red-400">
                  {requestError}
                </p>
              )}
              {requestSuccess && (
                <p className="text-xs text-[#7ff5fb]">
                  {requestSuccess}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRequestToPromote}
                  disabled={requestLoading || requested || !userEmail}
                  className="inline-flex items-center rounded-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black text-xs font-medium px-5 py-2 disabled:opacity-60"
                >
                  {requested
                    ? 'Request sent'
                    : requestLoading
                    ? 'Sending…'
                    : 'Request to promote'}
                </button>
                {!userEmail && (
                  <p className="text-[11px] text-red-300">
                    You must be signed in as an affiliate to request this offer.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Small note at bottom */}
        <p className="text-[11px] text-white/40 text-center max-w-2xl mx-auto">
          Once approved, you&apos;ll see this offer appear in your{' '}
          <span className="text-[#7ff5fb]">Affiliate Dashboard</span> under active
          campaigns, with tracking links and full stats wired through Nettmark.
        </p>
      </div>
    </div>
  );
}