'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  ShoppingCartIcon,
  CurrencyDollarIcon,
  TrashIcon,
  ArrowPathIcon,
  CursorArrowRaysIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type Campaign = {
  id: string;
  caption?: string;
  media_url?: string | null;
  file_url?: string | null;
  affiliate_id?: string | null;
  affiliate_email?: string | null;
  business_email?: string | null;
  type?: string;
  platform?: string;
  status?: string;
  offer_id?: string | null;

  // Paid Meta-only fields (live_ads)
  campaign_type?: string | null;
  spend?: number | null;
  conversions?: number | null;
  tracking_link?: string | null;

  billing_state?: string | null;
  terminated_by_business_at?: string | null;
  terminated_by_business_note?: string | null;
  billing_paused_at?: string | null;
  [key: string]: any;
};

type Stats = { clicks: number; carts: number; conversions: number };

type ChartSeries = {
  labels: string[];
  carts: number[];
  conversions: number[];
};

export default function ManageCampaignPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;
  const router = useRouter();

  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<PostgrestError | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [metaControlLoading, setMetaControlLoading] = useState(false);

  const [offer, setOffer] = useState<{ website?: string; title?: string; commission?: number } | null>(null);
  const [stats, setStats] = useState<Stats>({ clicks: 0, carts: 0, conversions: 0 });
  const [chartSeries, setChartSeries] = useState<ChartSeries>({ labels: [], carts: [], conversions: [] });
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [pendingPayout, setPendingPayout] = useState<number>(0);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  // Meta spend formatting
  const [metaCurrency, setMetaCurrency] = useState<string>('AUD');
  const [syncingSpend, setSyncingSpend] = useState(false);

  // --------------------
  // Helpers
  // --------------------
  function buildLast7DaysBuckets() {
    const labels: string[] = [];
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(new Date());
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      labels.push(day.toLocaleDateString(undefined, { weekday: 'short' }));
    }
    return labels;
  }

  const formatMoney = useCallback(
    (val: any) => {
      const n = Number(val);
      const safe = Number.isFinite(n) ? n : 0;
      const currency = String(metaCurrency || 'AUD').toUpperCase();
      try {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(safe);
      } catch {
        return `A$${safe.toFixed(2)}`;
      }
    },
    [metaCurrency]
  );

  async function loadMetaCurrencyForBusiness(businessEmail?: string | null) {
    if (!businessEmail) return;

    const { data, error: connErr } = await supabase
      .from('meta_connections')
      .select('currency, account_currency, ad_account_currency, created_at')
      .eq('business_email', businessEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connErr) {
      console.warn('[⚠️ meta currency lookup failed]', connErr);
      return;
    }

    const cur = (data as any)?.currency || (data as any)?.account_currency || (data as any)?.ad_account_currency;
    if (cur) setMetaCurrency(String(cur).toUpperCase());
  }

  // --------------------
  // Stats loader
  // Tracking-system stats only (no Meta clicks to avoid crossing wires)
  // IMPORTANT: Clicks should match business-side logic.
      // Business counts "Clicks / Page views" as any of:
      // page_view, page_viewed, view, landing_view, click (case-insensitive).
  // --------------------
  async function loadCampaignStats(currentCampaignId: string) {
    try {
      setLoadingStats(true);

      // 🔑 Single source of truth: stats are always per campaign_id (same as business side)
      const resp = await (supabase as any)
        .from('campaign_tracking_events')
        .select('id, event_type, amount, created_at, offer_id, affiliate_id, campaign_id')
        .eq('campaign_id', currentCampaignId);

      let rows: any[] = resp?.data || [];
      const fetchErr: any = resp?.error;

      if (fetchErr) {
        console.error('[❌ Failed to fetch campaign stats]', fetchErr);
      }

      // 🚫 No fallback to offer_id/affiliate_id here.
      // This page must be campaign-scoped only.
      // If a campaign has no events yet, we show zeros (prevents cross-campaign data bleed).

      // If no events exist, reset UI cleanly.
      if (!rows || rows.length === 0) {
        setStats({ clicks: 0, carts: 0, conversions: 0 });
        const labels = buildLast7DaysBuckets();
        setChartSeries({ labels, carts: Array(labels.length).fill(0), conversions: Array(labels.length).fill(0) });
        return;
      }

      // ✅ Aggregate totals (matches business logic)
      let pageViews = 0;
      let addToCarts = 0;
      let conversions = 0;

      for (const evt of rows) {
        const t = String(evt?.event_type || '').toLowerCase();

        // Business treats these as "Clicks" (meta) / "Page views" (organic)
        if (t === 'page_view' || t === 'page_viewed' || t === 'view' || t === 'landing_view' || t === 'click') {
          pageViews += 1;
        } else if (t === 'add_to_cart' || t === 'cart' || t === 'cart_updated') {
          addToCarts += 1;
        } else if (t === 'conversion' || t === 'purchase' || t === 'order' || t === 'checkout_completed') {
          conversions += 1;
        }
      }

      setStats({
        clicks: pageViews,
        carts: addToCarts,
        conversions: conversions,
      });

      // ✅ Build last-7-days series for chart (we chart carts + conversions here)
      const labels = buildLast7DaysBuckets();
      const cartsSeries = Array(labels.length).fill(0);
      const conversionsSeries = Array(labels.length).fill(0);

      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const today = startOfDay(new Date());

      for (const row of rows) {
        const createdAt = row?.created_at;
        if (!createdAt) continue;

        const d = new Date(createdAt);
        const rowDay = startOfDay(d);
        const diffDays = Math.round((rowDay.getTime() - today.getTime()) / 86400000);
        const idx = Math.min(labels.length - 1, Math.max(0, (labels.length - 1) + diffDays));

        const t = String(row?.event_type || '').toLowerCase();
        if (t === 'add_to_cart' || t === 'cart' || t === 'cart_updated') cartsSeries[idx] += 1;
        else if (t === 'conversion' || t === 'purchase' || t === 'order' || t === 'checkout_completed') conversionsSeries[idx] += 1;
      }

      setChartSeries({ labels, carts: cartsSeries, conversions: conversionsSeries });
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await loadCampaignStats(String(campaignId));
    };

    run();
    const interval = setInterval(run, 10000); // refresh every 10s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId]);

  // --------------------
  // Load campaign (organic first, then paid meta from live_ads)
  // --------------------
  const reloadCampaign = useCallback(async () => {
    if (!campaignId) return;

    // 1) Organic / live_campaigns
    const { data: organic, error: organicErr } = await supabase
      .from('live_campaigns')
      .select(
        `
          *,
          offers:offers (
            id,
            title
          )
        `
      )
      .eq('id', campaignId)
      .maybeSingle();

    if (organic) {
      const normalised: Campaign = {
        ...(organic as any),
        type: (organic as any).type || 'organic',
        media_url: (organic as any).media_url || (organic as any).file_url || null,
      };
      setCampaign(normalised);
      if (organicErr) setError(organicErr);
      return;
    }

    // 2) Paid Meta / live_ads
    const { data: paid, error: paidErr } = await supabase
      .from('live_ads')
      .select(
        `
          *,
          offers:offers (
            id,
            title
          )
        `
      )
      .eq('id', campaignId)
      .maybeSingle();

    if (paid) {
      // Start with anything stored on live_ads
      let mediaUrl: string | null = (paid as any).media_url || (paid as any).file_url || null;
      let caption: string | undefined = (paid as any).caption;

      // If no media on live_ads, fall back to the original ad_idea (approved only)
      if ((!mediaUrl || mediaUrl === '') && (paid as any).ad_idea_id) {
        // NOTE: Some Supabase type setups infer `ad_ideas` as `never` if generated DB types are out of date.
        // We cast the query to `any` so TS doesn't error on `file_url` / `caption`.
        type AdIdeaMini = { file_url?: string | null; caption?: string | null };

        const { data: idea } = await (supabase as any)
          .from('ad_ideas')
          .select('file_url, caption')
          .eq('id', (paid as any).ad_idea_id)
          .eq('status', 'approved')
          .maybeSingle();

        const typedIdea = (idea as AdIdeaMini | null) ?? null;
        if (typedIdea?.file_url) mediaUrl = typedIdea.file_url;
        if (!caption && typedIdea?.caption) caption = typedIdea.caption;
      }

      const normalised: Campaign = {
        ...(paid as any),
        type: (paid as any).campaign_type || 'paid_meta',
        platform: (paid as any).platform || 'Meta',
        media_url: mediaUrl,
        caption: caption,
        spend: Number((paid as any).spend ?? 0),
        tracking_link: (paid as any).tracking_link ?? null,
      };

      setCampaign(normalised);
      if (paidErr) setError(paidErr);

      // pull currency from latest meta_connections for this business
      await loadMetaCurrencyForBusiness((paid as any).business_email);
      return;
    }

    if (organicErr || paidErr) {
      setError((organicErr || paidErr) as PostgrestError);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    console.log('✅ CAMPAIGN ID FROM ROUTE:', campaignId);
    reloadCampaign();
  }, [campaignId, reloadCampaign]);

  // --------------------
  // Meta control (pause / resume)
  // --------------------
  async function handleMetaControl(action: 'PAUSE' | 'RESUME') {
    if (!campaign?.id) return;

    try {
      setMetaControlLoading(true);
      const res = await fetch('/api/meta/control-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveAdId: campaign.id, action }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !(json && json.success)) {
        console.error('[❌ Failed Meta control]', json);
        return;
      }

      const newStatus = json.newStatus as string | undefined;
      const newBillingState = json.billing_state as string | undefined;

      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus || prev.status,
              billing_state: newBillingState ?? prev.billing_state,
            }
          : prev
      );
    } catch (err) {
      console.error('[❌ Meta control client error]', err);
    } finally {
      setMetaControlLoading(false);
    }
  }

  // --------------------
  // Sync Meta spend (paid only)
  // --------------------
  const handleSyncSpend = useCallback(async () => {
    if (!campaign?.id) return;

    try {
      setSyncingSpend(true);
      const res = await fetch('/api/meta/ad-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveAdId: campaign.id }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || (json && (json as any).error)) {
        console.error('[❌ Sync spend failed]', json);
        alert('Failed to sync spend. Check terminal logs.');
        return;
      }

      await reloadCampaign();
    } catch (err) {
      console.error('[❌ Sync spend threw]', err);
      alert('Failed to sync spend. Check terminal logs.');
    } finally {
      setSyncingSpend(false);
    }
  }, [campaign?.id, reloadCampaign]);

  // --------------------
  // Resolve affiliateId
  // --------------------
  useEffect(() => {
    let cancelled = false;

    async function resolveAffiliateId() {
      // Prefer campaign.affiliate_id
      if (campaign?.affiliate_id) {
        if (!cancelled) setAffiliateId(String(campaign.affiliate_id));
        return;
      }

      // Supabase auth
      try {
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email || null;
        if (email && !cancelled) {
          setAffiliateId(email);
          return;
        }
      } catch (_) {
        // ignore
      }

      // Fallback localStorage profile
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('affiliateProfile');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.email && !cancelled) {
              setAffiliateId(parsed.email);
              return;
            }
          }
        } catch (_) {
          // ignore
        }
      }

      if (!cancelled) setAffiliateId(null);
    }

    resolveAffiliateId();
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  // --------------------
  // Pending payout from campaign_tracking_events
  // --------------------
  useEffect(() => {
    if (!affiliateId || !campaignId) return;

    let cancelled = false;

    async function loadPendingFromEvents() {
      const { data, error } = await supabase
        .from('campaign_tracking_events')
        .select('amount, event_type')
        .eq('affiliate_id', affiliateId as string)
        .eq('campaign_id', campaignId)
        .eq('event_type', 'conversion');

      if (error) {
        console.warn('pending payout (events) fetch error', error);
        if (!cancelled) setPendingPayout(0);
        return;
      }

      const commissionPct =
        offer && typeof offer.commission !== 'undefined' && offer.commission !== null
          ? Number(offer.commission)
          : null;

      const total = (data || []).reduce((sum: number, row: any) => {
        const amt = Number(row.amount);
        if (Number.isNaN(amt)) return sum;
        if (commissionPct !== null && !Number.isNaN(commissionPct)) {
          const earned = amt * (commissionPct / 100);
          return sum + earned;
        }
        return sum + amt;
      }, 0);

      if (!cancelled) setPendingPayout(total);
    }

    loadPendingFromEvents();
    const iv = setInterval(loadPendingFromEvents, 15000);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [affiliateId, campaignId, offer?.commission]);

  // --------------------
  // Offer info
  // --------------------
  useEffect(() => {
    if (!campaign || !campaign.offer_id) {
      setOffer(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('offers')
      .select('website,title,commission')
      .eq('id', campaign.offer_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          if (data) setOffer(data);
          else setOffer(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  // --------------------
  // Derived flags / values
  // --------------------
  const rawStatus = campaign?.status ? String(campaign.status).toUpperCase() : '';
  const isPaused =
    rawStatus === 'PAUSED' ||
    campaign?.billing_state === 'PAUSED' ||
    !!campaign?.billing_paused_at;

  const isOrganic = campaign?.type === 'organic';
  const isMetaPaid = !isOrganic;

  const isTerminatedByBusiness =
    campaign?.billing_state === 'TERMINATED_BY_BUSINESS' ||
    !!campaign?.terminated_by_business_at;

  const canAffiliateControlMeta = isMetaPaid && !isTerminatedByBusiness;

  const trackingUrl = useMemo(() => {
    // Prefer the stored tracking_link on live_ads
    if (campaign?.tracking_link) return String(campaign.tracking_link);

    if (!campaignId || !affiliateId) return '';
    // fallback legacy format
    return `https://www.nettmark.com/go/${campaignId}-${affiliateId}`;
  }, [campaign?.tracking_link, campaignId, affiliateId]);

  const campaignTitle = useMemo(() => {
    const captionTitle = String(campaign?.caption || '')
      .split('\n')[0]
      .trim();

    return (
      offer?.title ||
      campaign?.ad_name ||
      campaign?.platform ||
      captionTitle ||
      'Campaign'
    );
  }, [offer?.title, campaign?.ad_name, campaign?.platform, campaign?.caption]);

  async function handleCopyTrackingLink() {
    if (!trackingUrl) return;
    await navigator.clipboard.writeText(trackingUrl);
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1800);
  }

  if (error) return <div>Error: {error.message}</div>;
  if (!campaign) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-surface text-gray-100 px-4 py-6 md:px-8 md:py-8">
      {/* Status banners */}
      {isTerminatedByBusiness && (
        <div className="max-w-6xl mx-auto mb-4">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-100 px-4 py-3 text-xs md:text-sm flex items-start gap-3">
            <div>
              <p className="font-semibold uppercase tracking-wide text-[0.7rem] md:text-[0.75rem] text-red-200">
                Campaign permanently stopped by business
              </p>
              <p className="mt-1 text-[0.75rem] md:text-xs text-red-100/80">
                This Meta campaign has been hard-stopped at the business level. You can still view historical stats, but
                it cannot be reactivated from Nettmark. Any further changes must be handled by the business owner.
              </p>
              {campaign.terminated_by_business_note && (
                <p className="mt-2 text-[0.7rem] md:text-xs text-red-100/80 italic">
                  Business note: {campaign.terminated_by_business_note}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!isTerminatedByBusiness && isPaused && (
        <div className="max-w-6xl mx-auto mb-4">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-100 px-4 py-3 text-xs md:text-sm flex items-start gap-3">
            <div>
              <p className="font-semibold uppercase tracking-wide text-[0.7rem] md:text-[0.75rem] text-amber-200">
                Campaign paused
              </p>
              <p className="mt-1 text-[0.75rem] md:text-xs text-amber-100/80">
                Stats remain visible but won&apos;t increase until this campaign is reactivated.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Meta / campaign status + control (for paid Meta campaigns) */}
      <div className="mx-auto mb-5 max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                <span className="inline-flex items-center rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[#00C2CB] md:text-[0.7rem]">
                  {isOrganic ? 'ORGANIC CAMPAIGN' : 'META AD • PAID CAMPAIGN'}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium md:text-[0.7rem] ${
                    isPaused || isTerminatedByBusiness
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  }`}
                >
                  {isTerminatedByBusiness
                    ? 'Off (Stopped by Business)'
                    : isPaused
                    ? 'Off (Paused)'
                    : 'On (Active)'}
                </span>
              </div>

              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.22em] text-white/40">
                  Campaign detail
                </p>
                <h1 className="mt-2 break-words text-2xl font-semibold text-white sm:text-[1.9rem]">
                  {campaignTitle}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-white/60">
                  Performance, tracking, and creative for this campaign in one place.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-white/55">
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Offer: <span className="text-white">{offer?.title || 'No linked offer'}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Platform: <span className="text-white">{campaign?.platform || 'Not set'}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Status: <span className="text-white">{campaign?.status || 'Unknown'}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              {canAffiliateControlMeta && (
                <button
                  onClick={() => handleMetaControl(isPaused ? 'RESUME' : 'PAUSE')}
                  disabled={metaControlLoading}
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {metaControlLoading
                    ? 'Updating...'
                    : isPaused
                    ? 'Activate campaign'
                    : 'Pause campaign'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-[340px,minmax(0,1fr)]">
        {/* Left side: media / email preview */}
        <div className="flex w-full items-start justify-center">
          {campaign.platform && String(campaign.platform).toLowerCase() === 'email' ? (
            <div className="relative flex min-h-[340px] w-full max-w-lg flex-col justify-between rounded-3xl border border-[#232931] bg-gradient-to-b from-[#181d22] to-[#101214] p-8 shadow-xl drop-shadow-[0_0_16px_rgba(0,194,203,0.11)]">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#28303a] bg-[#222B34] text-lg font-bold text-[#00C2CB]">
                    N
                  </div>
                  <div>
                    <div className="text-xs text-[#7e8a9a]">
                      From:{' '}
                      <span className="font-semibold text-gray-200">
                        Nettmark &lt;no-reply@nettmark.com&gt;
                      </span>
                    </div>
                  </div>
                </div>
                <h2 className="mb-2 truncate text-[1.2rem] font-bold leading-snug text-[#00C2CB]">
                  {campaign.caption?.split('\n')[0] || '[No Subject]'}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div
                  className="mb-4 whitespace-pre-line px-1 text-[0.97rem] leading-relaxed text-gray-300"
                  style={{ maxHeight: 170, minHeight: 64 }}
                >
                  {campaign.caption || 'No content available.'}
                </div>
              </div>
              <button
                className="mt-2 w-fit rounded-full border border-[#00C2CB]/40 px-4 py-2 text-sm font-medium text-[#00C2CB] transition hover:bg-[#00c2cb22]"
                onClick={() => setShowEmailModal(true)}
              >
                Open Full Email
              </button>
            </div>
          ) : campaign.media_url ? (
            <div className="relative h-[640px] w-[320px] overflow-hidden rounded-[2rem] border-[3px] border-[#2D2D2D] bg-black shadow-lg">
              <div className="flex items-center justify-center border-b border-gray-700 bg-[#111111] px-4 py-2">
                <img
                  src="/nettmark-logo.png"
                  alt="Nettmark Logo"
                  className="h-10 w-auto scale-125 transform opacity-95"
                />
              </div>
              <div className="h-[calc(100%-48px)] overflow-hidden">
                {String(campaign.media_url).match(/\.(mp4|mov)$/i) ? (
                  <video controls className="h-full w-full object-cover bg-black">
                    <source src={String(campaign.media_url)} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : String(campaign.media_url).match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={String(campaign.media_url)}
                    alt="Ad Preview"
                    className="h-full w-full object-cover bg-black"
                  />
                ) : (
                  <div className="p-8 text-center text-gray-500">Unsupported media format</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex w-[90%] max-w-md items-center justify-center rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-8 shadow-lg">
              <span className="text-gray-500 text-center">No content available for this campaign type</span>
            </div>
          )}
        </div>

        {/* Right side: summary + stats */}
        <div className="flex w-full min-w-0 flex-col gap-5">
          <div className="rounded-3xl border border-[#2A2A2A] bg-[#171717] p-5 shadow-md drop-shadow-[0_0_10px_rgba(0,194,203,0.10)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#00C2CB]">Campaign Summary</p>
                <h1 className="mt-2 text-2xl font-semibold text-white break-words">{campaignTitle}</h1>
                <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem] md:text-xs">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-200">
                    {offer?.title || 'No linked offer'}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300">
                    {isOrganic ? 'Organic' : 'Paid Meta'}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300">
                    {campaign?.platform || 'Platform not set'}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-gray-300">
                    {campaign?.status || 'Unknown status'}
                  </span>
                </div>
              </div>

              <div className="grid min-w-[220px] grid-cols-2 gap-3 lg:min-w-[260px]">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[0.65rem] uppercase tracking-wide text-gray-500">Pending payout</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {pendingPayout > 0 ? `$${pendingPayout.toFixed(2)}` : '$0.00'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[0.65rem] uppercase tracking-wide text-gray-500">Commission</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {offer?.commission ? `${offer.commission}%` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#00C2CB]/20 bg-[#0F0F0F] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.65rem] uppercase tracking-wide text-gray-500">Tracking Link</p>
                  {!affiliateId ? (
                    <p className="mt-2 text-sm text-red-300">
                      Missing affiliate ID. Please sign in again or complete your affiliate profile.
                    </p>
                  ) : (
                    <p className={`mt-2 break-all text-sm ${isPaused || isTerminatedByBusiness ? 'text-[#00C2CB]/60' : 'text-[#00C2CB]'}`}>
                      {trackingUrl}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyTrackingLink}
                    className="rounded-full bg-[#00C2CB] px-3 py-2 text-xs font-semibold text-white hover:bg-[#00b0b8] disabled:opacity-60"
                    disabled={!trackingUrl || isPaused || isTerminatedByBusiness}
                  >
                    {copyState === 'copied' ? 'Copied' : isPaused || isTerminatedByBusiness ? 'Copy (inactive)' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {isTerminatedByBusiness ? (
                <p className="text-xs text-amber-200 mt-3">
                  This campaign has been permanently stopped by the business. The tracking link is archived and no longer counts new traffic.
                </p>
              ) : isPaused ? (
                <p className="text-xs text-amber-200 mt-3">
                  This campaign is currently paused. The tracking link is temporarily disabled until it is reactivated.
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-3">
                  Share this link anywhere you’re promoting the offer. Nettmark attaches <code>nm_aff</code> and <code>nm_camp</code> automatically.
                </p>
              )}
            </div>
          </div>

          <div className="grid flex-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Spend (Meta) - Paid only */}
            {isMetaPaid && (
              <div className="flex h-28 items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#171717] p-4 shadow-md transition-all duration-300 hover:bg-[#1C1C1C] drop-shadow-[0_0_10px_rgba(0,194,203,0.12)]">
                <div>
                  <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                    Spend (Meta)
                  </h2>
                  <p className="text-2xl font-semibold text-white">
                    {formatMoney((campaign as any).spend ?? 0)}
                  </p>
                  <button
                    onClick={handleSyncSpend}
                    disabled={syncingSpend}
                    className="mt-2 inline-flex items-center gap-2 text-[0.7rem] font-semibold text-[#7ff5fb] hover:text-white disabled:opacity-60"
                  >
                    <ArrowPathIcon className={`w-4 h-4 ${syncingSpend ? 'animate-spin' : ''}`} />
                    {syncingSpend ? 'Syncing…' : 'Sync spend'}
                  </button>
                </div>
                <div className="w-9 h-9 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
                  <CurrencyDollarIcon className="w-5 h-5 text-[#00C2CB]/80" />
                </div>
              </div>
            )}

            {/* Clicks (Nettmark tracking) */}
            <div className="flex h-28 items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#171717] p-4 shadow-md transition-all duration-300 hover:bg-[#1C1C1C] drop-shadow-[0_0_10px_rgba(0,194,203,0.12)]">
              <div>
                <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-gray-300">
                  Clicks {loadingStats && <span className="text-xs text-gray-500">•</span>}
                </h2>
                <p className="text-2xl font-semibold text-white">
                  {stats.clicks.toLocaleString()}
                </p>
                <p className="text-[0.6rem] text-gray-500 mt-1">Tracked by Nettmark</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
                <CursorArrowRaysIcon className="w-5 h-5 text-[#00C2CB]/80" />
              </div>
            </div>

            {/* Add to carts */}
            <div className="flex h-28 items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#171717] p-4 shadow-md transition-all duration-300 hover:bg-[#1C1C1C] drop-shadow-[0_0_10px_rgba(0,194,203,0.12)]">
              <div>
                <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-gray-300">
                  Add to Carts {loadingStats && <span className="text-xs text-gray-500">•</span>}
                </h2>
                <p className="text-2xl font-semibold text-white">
                  {stats.carts.toLocaleString()}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
                <ShoppingCartIcon className="w-5 h-5 text-[#00C2CB]/80" />
              </div>
            </div>

            {/* Conversions */}
            <div className="flex h-28 items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#171717] p-4 shadow-md transition-all duration-300 hover:bg-[#1C1C1C] drop-shadow-[0_0_10px_rgba(0,194,203,0.12)]">
              <div>
                <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-gray-300">
                  Conversions {loadingStats && <span className="text-xs text-gray-500">•</span>}
                </h2>
                <p className="text-2xl font-semibold text-white">
                  {stats.conversions.toLocaleString()}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
                <CurrencyDollarIcon className="w-5 h-5 text-[#00C2CB]/80" />
              </div>
            </div>

          </div>

          {/* Line chart */}
          <div className="min-h-[220px] flex-1 rounded-3xl border border-[#2A2A2A] bg-[#171717] p-4 shadow-md">
            <h3 className="text-gray-300 text-sm font-medium mb-3 tracking-wide uppercase">
              Performance Overview
            </h3>
            <div className="h-full">
              <Line
                data={{
                  labels: chartSeries.labels.length
                    ? chartSeries.labels
                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                  datasets: [
                    {
                      label: 'Add to Carts',
                      data: chartSeries.carts.length ? chartSeries.carts : [0, 0, 0, 0, 0, 0, 0],
                      fill: true,
                      backgroundColor: (context) => {
                        const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(0,194,203,0.10)');
                        gradient.addColorStop(1, 'rgba(0,194,203,0)');
                        return gradient;
                      },
                      borderColor: '#009aa2',
                      borderWidth: 1.5,
                      borderDash: [3, 4],
                      tension: 0.35,
                      pointRadius: 2,
                      pointHoverRadius: 4,
                    },
                    {
                      label: 'Conversions',
                      data: chartSeries.conversions.length
                        ? chartSeries.conversions
                        : [0, 0, 0, 0, 0, 0, 0],
                      fill: true,
                      backgroundColor: (context) => {
                        const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(0,194,203,0.08)');
                        gradient.addColorStop(1, 'rgba(0,194,203,0)');
                        return gradient;
                      },
                      borderColor: '#00787f',
                      borderWidth: 1.5,
                      tension: 0.35,
                      pointRadius: 2,
                      pointHoverRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      labels: {
                        color: '#9CA3AF',
                        font: { size: 11 },
                        boxWidth: 10,
                        usePointStyle: true,
                        pointStyle: 'line',
                      },
                    },
                    tooltip: { mode: 'index', intersect: false },
                  },
                  scales: {
                    x: {
                      ticks: { color: '#9CA3AF', font: { size: 10 } },
                      grid: { color: '#1E293B20' },
                    },
                    y: {
                      ticks: { color: '#9CA3AF', font: { size: 10 } },
                      grid: { color: '#1E293B20' },
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Details */}
      <div className="mt-12 mb-6 flex w-full justify-center">
        <div className="w-[92%] max-w-6xl">
          <details className="group overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#171717] shadow-md transition-all duration-300 drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <summary className="flex cursor-pointer items-center justify-between bg-[#1C1C1C] px-5 py-3 text-xs uppercase tracking-wide text-gray-300 transition-all duration-300 hover:bg-[#1F1F1F] md:text-sm">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-[#00C2CB] mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="group-open:text-[#00C2CB] transition">Campaign Details</span>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-300"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="p-4 space-y-3 text-gray-200 text-xs md:text-sm bg-[#0F0F0F]">
              {Object.entries(campaign)
                .filter(([key]) => ['caption', 'type', 'status', 'platform', 'billing_state'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between border-b border-[#1C1C1C] pb-2">
                    <span className="text-gray-400 capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <span className="text-[#00C2CB]">{String(value)}</span>
                  </div>
                ))}
              {campaign.type === 'Email Campaign' && (
                <div
                  className="cursor-pointer text-[#00C2CB] underline mt-2"
                  onClick={() => setShowEmailModal(true)}
                >
                  Open Full Email
                </div>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Affiliate Guide */}
      <div className="mt-6 flex w-full justify-center">
        <div className="w-[92%] max-w-6xl">
          <details className="group overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#171717] shadow-md transition-all duration-300 drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <summary className="flex cursor-pointer items-center justify-between bg-[#1C1C1C] px-5 py-3 text-xs uppercase tracking-wide text-gray-300 transition-all duration-300 hover:bg-[#1F1F1F] md:text-sm">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-[#00C2CB] mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6l4 2m6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="group-open:text-[#00C2CB] transition">Affiliate Guide</span>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform duration-300"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="p-4 bg-[#0F0F0F] text-gray-300 text-xs md:text-sm leading-relaxed space-y-3">
              {isOrganic ? (
                <>
                  <p>
                    This is an <span className="text-[#00C2CB] font-medium">organic campaign</span>. You’ll be
                    promoting the brand using your own social posts, stories, or reels. Your{' '}
                    <span className="text-[#00C2CB]">tracking link</span> automatically monitors visits, signups, and
                    purchases generated from your post.
                  </p>
                  <p>
                    Organic campaigns remain <span className="text-[#00C2CB] font-medium">active indefinitely</span>{' '}
                    unless misuse is detected. If your tracking link is shared in misleading or inappropriate ways, it
                    will be disabled, and you’ll be notified.
                  </p>
                  <p>
                    All verified conversions tracked through your link trigger an automatic{' '}
                    <span className="text-[#00C2CB]">Stripe payout</span> once confirmed by the business.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This is a <span className="text-[#00C2CB] font-medium">paid ad campaign</span> managed via Meta.
                    Spend is pulled from Meta insights, while conversions are shown from Nettmark tracking.
                  </p>
                  <p>
                    You can <span className="text-[#00C2CB] font-medium">pause or re-activate</span> this campaign from
                    here to manage your cashflow. If the business permanently stops the campaign, it will be locked and
                    shown as stopped inside Nettmark.
                  </p>
                </>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Delete Campaign – affiliates can only fully delete ORGANIC campaigns here */}
      {isOrganic && (
        <div className="mx-auto mt-10 max-w-5xl">
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 px-6 py-5 text-center shadow-[0_0_20px_rgba(255,0,0,0.04)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-red-300">
              Dangerous action
            </p>
            <p className="mt-2 text-sm text-red-100/80">
              Deleting an organic campaign permanently removes its live campaign record and linked data.
            </p>
            <button
              onClick={async () => {
                const confirmDelete = window.confirm(
                  `Permanently delete this organic campaign?\n\nThis action cannot be undone.`
                );
                if (!confirmDelete) return;

                const { error: delErr } = await supabase.from('live_campaigns').delete().eq('id', campaign.id);
                if (delErr) {
                  console.error('❌ Delete error:', delErr);
                  alert('Error deleting campaign.');
                } else {
                  alert('Campaign deleted.');
                  router.replace('/affiliate/dashboard/manage-campaigns');
                }
              }}
              className="group relative mt-4 inline-flex items-center rounded-2xl border border-red-500/40 bg-[#1A1A1A] px-6 py-2.5 font-medium text-red-400 shadow-[0_0_10px_rgba(255,0,0,0.05)] transition-all duration-300 hover:border-red-500/70 hover:bg-[#2A2A2A] hover:text-red-300"
            >
              <TrashIcon className="w-5 h-5 mr-2 text-red-400 group-hover:text-red-300 transition" />
              Delete Campaign
              <span className="absolute inset-0 rounded-xl bg-red-500/10 opacity-0 group-hover:opacity-100 transition" />
            </button>
            <p className="mt-2 text-xs text-gray-500">
              This will permanently remove all data linked to this organic campaign.
            </p>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50"
          onClick={() => setShowEmailModal(false)}
        >
          <div
            className="bg-[#1A1A1A] w-[90%] max-w-2xl max-h-[80vh] overflow-y-auto p-6 rounded-xl border border-[#00C2CB55]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#00C2CB]">Email Preview</h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-400 hover:text-white inline-flex items-center justify-center"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="text-gray-300 whitespace-pre-line">{campaign.caption}</div>
          </div>
        </div>
      )}
    </div>
  );
}
