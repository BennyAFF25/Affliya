'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Globe2,
  ImageIcon,
  Link2,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Tag,
  Users,
} from 'lucide-react';
import { supabase } from '../../../../utils/supabase/pages-client';
import { getActivationSubsidyBadgeLabel, getActivationSubsidyRemaining } from '../../../../utils/activationSubsidies';

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
  meta_page_id?: string | null;
  meta_ad_account_id?: string | null;
  meta_pixel_id?: string | null;
  readyCreativeCount?: number;
  readyOrganicCreativeCount?: number;
  readyPaidCreativeCount?: number;
  participation_mode?: 'open' | 'approval_required' | 'private' | null;
};

function getPromotionMode(offer: Offer | null) {
  const adsEnabled = !!offer?.meta_page_id && !!offer?.meta_ad_account_id;
  if (adsEnabled) {
    return {
      label: 'Ads enabled',
      tone: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
      helper: offer?.meta_pixel_id
        ? 'Organic and paid promotion are available, including Meta sales campaigns.'
        : 'Organic and paid promotion are available. Sales campaigns still need a pixel.',
    };
  }

  return {
    label: 'Organic only',
    tone: 'border-white/10 bg-white/[0.04] text-white/70',
    helper: 'Paid ads stay locked until the business connects Meta.',
  };
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'N';
}

export default function AffiliateOfferProfilePage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params?.offerId as string | undefined;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<'approved' | 'pending' | 'rejected' | null>(null);
  const [starterSpendLabel, setStarterSpendLabel] = useState<string | null>(null);
  const [starterSpendRemaining, setStarterSpendRemaining] = useState<number>(0);
  const [currentSlide, setCurrentSlide] = useState(0);

  const images: string[] =
    offer
      ? Array.isArray((offer as any).image_urls) && (offer as any).image_urls.length > 0
        ? (offer as any).image_urls
        : offer.hero_image_url
          ? [offer.hero_image_url]
          : []
      : [];

  const promotionMode = getPromotionMode(offer);
  const readyCreativeLabel = offer?.readyCreativeCount
    ? `${offer.readyCreativeCount} ready creative${offer.readyCreativeCount === 1 ? '' : 's'}`
    : null;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setUserEmail(data?.user?.email ?? null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

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
        console.error('[Error fetching offer profile]', error);
        setLoadError(error.message || 'Failed to load offer.');
        setOffer(null);
      } else {
        const nextOffer = data as Offer;
        try {
          const readinessRes = await fetch(`/api/offers/content-readiness?offerIds=${offerId}`, { cache: 'no-store' });
          const readinessJson = await readinessRes.json().catch(() => null);
          const readiness = readinessJson?.ok ? readinessJson.readiness?.[offerId] : null;
          if (readiness) {
            nextOffer.readyCreativeCount = Number(readiness.total || 0);
            nextOffer.readyOrganicCreativeCount = Number(readiness.organic || 0);
            nextOffer.readyPaidCreativeCount = Number(readiness.paid || 0);
          }
        } catch {
          // Best effort only.
        }
        setOffer(nextOffer);
      }
      setLoading(false);
    };

    void fetchOffer();
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;

    const loadStarterSpend = async () => {
      const { data, error } = await (supabase as any)
        .from('business_activation_subsidies')
        .select('id, status, subsidy_amount, consumed_amount')
        .eq('offer_id', offerId)
        .eq('status', 'available')
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error && error.code !== 'PGRST116') {
        console.warn('[starter spend offer load warn]', error);
        return;
      }

      const remaining = getActivationSubsidyRemaining(data ?? null);
      setStarterSpendRemaining(remaining);
      setStarterSpendLabel(getActivationSubsidyBadgeLabel(data ?? null));
    };

    void loadStarterSpend();
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  useEffect(() => {
    if (!offerId || !userEmail) return;
    let cancelled = false;

    const checkRequest = async () => {
      const { data, error } = await (supabase as any)
        .from('affiliate_requests')
        .select('id,status,created_at')
        .eq('offer_id', offerId)
        .eq('affiliate_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error && error.code !== 'PGRST116') {
        console.warn('[Error checking affiliate request]', error);
        return;
      }

      if (data) {
        setRequested(true);
        const status = String((data as any).status || '').toLowerCase();
        if (status === 'approved' || status === 'pending' || status === 'rejected') {
          setRequestStatus(status);
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
      const response = await fetch(`/api/affiliate/offers/${offerId}/start`, { method: 'POST' });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        setRequestError(json?.message || json?.error || 'Failed to start promoting this offer.');
        return;
      }

      setRequested(true);
      setRequestStatus(json?.participation?.status || null);
      setRequestSuccess(json?.message || (json?.promotePath ? 'You can start promoting this offer now.' : 'Request sent.'));
      if (json?.promotePath) {
        router.push(json.promotePath || `/affiliate/dashboard/promote/${offerId}`);
      }
    } catch (err: any) {
      console.error('[Error starting offer participation]', err);
      setRequestError(err?.message || 'Failed to start promoting this offer.');
    } finally {
      setRequestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface text-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading offer…</p>
      </div>
    );
  }

  if (loadError || !offer) {
    return (
      <div className="min-h-screen bg-surface text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="mb-2 text-lg font-semibold text-red-400">Couldn&apos;t load offer</p>
          <p className="mb-4 text-sm text-gray-400">{loadError ?? 'This offer may be unavailable or has been removed.'}</p>
          <button
            onClick={() => router.push('/affiliate/marketplace')}
            className="rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-medium text-black hover:bg-[#00b0b8]"
          >
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  const displayBusinessName = offer.business_name || (offer as any).businessName || offer.title || 'Unnamed business';
  const commissionLabel = typeof offer.commission === 'number' ? `${offer.commission}% commission` : 'Commission set by business';
  const offerTypeLabel = offer.type === 'recurring' ? 'Recurring' : offer.type === 'one_time' ? 'One-time' : offer.type || 'Standard';
  const participationMode = offer.participation_mode || 'open';
  const isPrivate = participationMode === 'private';
  const isApprovalRequired = participationMode === 'approval_required';
  const isPending = requestStatus === 'pending';
  const brandCopy = offer.profile_bio || offer.description || 'This business has not added a full brand description yet.';
  const brandHeadline = offer.profile_headline || 'About this brand';
  const heroImage = images[currentSlide] || null;

  const participationLabel = isPrivate ? 'Private' : isApprovalRequired ? 'Approval required' : 'Instant access';
  const actionLabel = requestLoading
    ? 'Opening…'
    : isPrivate
      ? 'Private offer'
      : isPending
        ? 'Pending approval'
        : requested
          ? 'Continue promoting'
          : isApprovalRequired
            ? 'Request to promote'
            : 'Start promoting';

  return (
    <div className="min-h-screen bg-surface px-4 py-5 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <button
          onClick={() => router.push('/affiliate/marketplace')}
          className="mb-5 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-[#7ff5fb] sm:mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </button>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] xl:items-start">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-[28px] border border-[#00C2CB]/25 bg-[#111617] shadow-[0_20px_80px_rgba(0,194,203,0.08)]">
              <div className="relative aspect-[16/10] min-h-[240px] overflow-hidden bg-[#0d1112] sm:aspect-[16/8.7] lg:min-h-[400px]">
                {heroImage ? (
                  <img
                    key={heroImage}
                    src={heroImage}
                    alt={displayBusinessName}
                    className="h-full w-full object-cover transition duration-500"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,194,203,0.18),transparent_55%)]">
                    <div className="flex h-28 w-28 items-center justify-center rounded-[28px] border border-[#00C2CB]/35 bg-[#00C2CB]/10 text-4xl font-bold text-[#7ff5fb] shadow-[0_0_45px_rgba(0,194,203,0.12)]">
                      {getInitials(displayBusinessName)}
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/10" />

                <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 backdrop-blur-md sm:left-5 sm:top-5">
                  Nettmark Partner
                </div>

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() => setCurrentSlide((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 px-3 py-2 text-lg text-white/80 backdrop-blur transition hover:bg-black/70"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() => setCurrentSlide((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 px-3 py-2 text-lg text-white/80 backdrop-blur transition hover:bg-black/70"
                    >
                      ›
                    </button>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                      {images.map((_, index) => (
                        <span
                          key={index}
                          className={`h-1.5 rounded-full transition-all ${index === currentSlide ? 'w-5 bg-[#00C2CB]' : 'w-1.5 bg-white/35'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="p-5 sm:p-6 lg:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#00C2CB]/35 bg-[#071416] shadow-[0_0_30px_rgba(0,194,203,0.08)] sm:h-20 sm:w-20">
                    {heroImage ? (
                      <img src={heroImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-[#7ff5fb]">{getInitials(displayBusinessName)}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[34px]">
                      {displayBusinessName}
                    </h1>
                    <p className="mt-1 text-sm font-medium text-[#7ff5fb]/80 sm:text-base">{offer.title || offerTypeLabel}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${promotionMode.tone}`}>
                        <Megaphone className="h-3.5 w-3.5" />
                        {promotionMode.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/[0.07] px-3 py-1.5 text-xs font-medium text-[#7ff5fb]">
                        <RefreshCw className="h-3.5 w-3.5" />
                        {offerTypeLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80">
                        <Tag className="h-3.5 w-3.5" />
                        {commissionLabel}
                      </span>
                      {readyCreativeLabel && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/[0.08] px-3 py-1.5 text-xs font-medium text-emerald-200">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {readyCreativeLabel}
                        </span>
                      )}
                    </div>

                    <p className="mt-4 max-w-3xl text-sm leading-6 text-white/58 sm:text-[15px]">
                      {brandCopy}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#7ff5fb]">
                <ShieldCheck className="h-4 w-4" />
                Offer details
              </div>
              <p className="mt-1 text-xs text-white/40">What affiliates should know before promoting this offer.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="flex items-center gap-2 text-xs text-white/42">
                    <Tag className="h-4 w-4 text-[#00C2CB]" />
                    Commission
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white/85">{commissionLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="flex items-center gap-2 text-xs text-white/42">
                    <RefreshCw className="h-4 w-4 text-[#00C2CB]" />
                    Commission type
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white/85">{offerTypeLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="flex items-center gap-2 text-xs text-white/42">
                    <Users className="h-4 w-4 text-[#00C2CB]" />
                    Application
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white/85">{participationLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="flex items-center gap-2 text-xs text-white/42">
                    <Megaphone className="h-4 w-4 text-[#00C2CB]" />
                    Promotion
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white/85">{promotionMode.label}</p>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6">
            <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#7ff5fb]">
                <Building2 className="h-4 w-4" />
                {brandHeadline}
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/65">{brandCopy}</p>

              <div className="mt-5 space-y-3 border-t border-white/8 pt-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00C2CB]/10 text-[#7ff5fb]">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/78">Promotion mode</p>
                    <p className="mt-1 text-xs leading-5 text-white/42">{promotionMode.helper}</p>
                  </div>
                </div>
                {starterSpendLabel && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00C2CB]/10 text-[#7ff5fb]">
                      <Megaphone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/78">{starterSpendLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-white/42">
                        {starterSpendRemaining > 0
                          ? `$${starterSpendRemaining.toFixed(0)} of starter ad spend remains available for eligible affiliates.`
                          : 'Starter ad spend may be available when you begin promoting.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {offer.website && (
              <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#7ff5fb]">
                  <Link2 className="h-4 w-4" />
                  Destination
                </div>
                <p className="mt-2 text-xs leading-5 text-white/42">This is where your traffic lands when you promote this offer.</p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row xl:flex-col 2xl:flex-row">
                  <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-xs text-white/70">
                    <span className="block truncate">{offer.website}</span>
                  </div>
                  <a
                    href={offer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#00C2CB] px-4 py-3 text-xs font-bold text-[#061113] transition hover:bg-[#20d4df]"
                  >
                    Preview site
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </section>
            )}

            <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:flex-col 2xl:flex-row">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#7ff5fb]">
                    <Megaphone className="h-4 w-4" />
                    Start promoting
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/48">
                    {isPrivate
                      ? 'This offer is restricted and cannot be joined from the marketplace.'
                      : isApprovalRequired
                        ? 'Request access here, then start as soon as the business approves you.'
                        : 'Join immediately and use the promotion pathways the business has configured.'}
                  </p>
                </div>
                <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                  isPrivate
                    ? 'border-white/10 bg-white/[0.04] text-white/65'
                    : isApprovalRequired
                      ? 'border-amber-400/25 bg-amber-500/10 text-amber-200'
                      : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                }`}>
                  {participationLabel}
                </span>
              </div>

              {requestError && <p className="mt-4 text-xs text-red-400">{requestError}</p>}
              {requestSuccess && <p className="mt-4 text-xs text-[#7ff5fb]">{requestSuccess}</p>}

              <button
                type="button"
                onClick={handleRequestToPromote}
                disabled={requestLoading || !userEmail || isPrivate || isPending}
                className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  isPending
                    ? 'border border-[#00C2CB]/30 bg-[#00C2CB]/10 text-[#7ff5fb]'
                    : 'bg-[#00C2CB] text-[#061113] hover:bg-[#20d4df]'
                }`}
              >
                {isPending ? <ShieldCheck className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                {actionLabel}
              </button>

              {!userEmail && (
                <p className="mt-3 text-center text-[11px] text-red-300">Sign in as an affiliate to start promoting this offer.</p>
              )}
              {isPending && (
                <p className="mt-3 text-center text-[11px] text-white/38">You&apos;ll be notified once your application has been reviewed.</p>
              )}
            </section>

            <div className="hidden rounded-2xl border border-white/8 bg-black/10 p-4 text-xs leading-5 text-white/35 xl:flex xl:items-start xl:gap-3">
              <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00C2CB]" />
              Once you start, this offer will appear in your affiliate dashboard with its tracking and promotion tools.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
