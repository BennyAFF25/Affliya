'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';

type SourceType = 'organic' | 'meta';

interface BaseCampaign {
  id: string;
  offer_id: string | null;
  business_email: string | null;
  affiliate_email: string | null;
  caption: string | null;
  platform?: string | null;
  type?: string | null;
  campaign_type?: string | null;
  tracking_link?: string | null;
  status: string | null;
  created_at: string | null;
  _source: SourceType;
}

interface OfferRow {
  id: string;
  title: string | null;
  website: string | null;
}

interface StatSummary {
  clicks: number;
  addToCarts: number;
  conversions: number;
  revenue: number;
}

interface TrackingEventRow {
  event_type?: string | null;
  amount?: number | null;
}

const BusinessCampaignDetail = () => {
  const params = useParams();
  const router = useRouter();
  const session = useSession();
  const user = session?.user;

  const campaignId =
    typeof params?.campaignId === 'string'
      ? params.campaignId
      : Array.isArray(params?.campaignId)
      ? params.campaignId[0]
      : null;

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<BaseCampaign | null>(null);
  const [offer, setOffer] = useState<OfferRow | null>(null);
  const [stats, setStats] = useState<StatSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId || !user) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Try organic first
        const { data: organic, error: organicError } = await supabase
          .from('live_campaigns')
          .select(
            `
            id,
            offer_id,
            business_email,
            affiliate_email,
            caption,
            platform,
            type,
            status,
            created_at
          `
          )
          .eq('id', campaignId)
          .maybeSingle();

        let base: BaseCampaign | null = null;

        if (organic) {
          const organicRow = organic as Record<string, any>;

          const organicBase: BaseCampaign = {
            id: String(organicRow.id),
            offer_id: organicRow.offer_id ?? null,
            business_email: organicRow.business_email ?? null,
            affiliate_email: organicRow.affiliate_email ?? null,
            caption: organicRow.caption ?? null,
            platform: organicRow.platform ?? null,
            type: organicRow.type ?? null,
            campaign_type: 'organic',
            tracking_link: null,
            status: organicRow.status ?? null,
            created_at: organicRow.created_at ?? null,
            _source: 'organic',
          };

          base = organicBase;
        } else {
          // 2) Fallback to paid meta ads
          const { data: meta, error: metaError } = await supabase
            .from('live_ads')
            .select(
              `
              id,
              offer_id,
              business_email,
              affiliate_email,
              caption,
              campaign_type,
              tracking_link,
              status,
              created_at
            `
            )
            .eq('id', campaignId)
            .maybeSingle();

          if (!meta) {
            console.error(
              '[❌ Failed to load campaign detail]',
              organicError,
              metaError
            );
            setError('Campaign not found.');
            setLoading(false);
            return;
          }

          const metaRow = meta as Record<string, any>;

          const metaBase: BaseCampaign = {
            id: String(metaRow.id),
            offer_id: metaRow.offer_id ?? null,
            business_email: metaRow.business_email ?? null,
            affiliate_email: metaRow.affiliate_email ?? null,
            caption: metaRow.caption ?? null,
            platform: null,
            type: null,
            campaign_type: metaRow.campaign_type ?? null,
            tracking_link: metaRow.tracking_link ?? null,
            status: metaRow.status ?? null,
            created_at: metaRow.created_at ?? null,
            _source: 'meta',
          };

          base = metaBase;
        }

        if (!base) {
          setError('Campaign not found.');
          setLoading(false);
          return;
        }

        // Safety: ensure campaign belongs to this business
        if (base.business_email && base.business_email !== user.email) {
          setError('You do not have access to this campaign.');
          setLoading(false);
          return;
        }

        setCampaign(base);

        // 3) Load offer for title + website
        if (base.offer_id) {
          const { data: offerRow, error: offerError } = await supabase
            .from('offers')
            .select('id, title, website')
            .eq('id', base.offer_id)
            .maybeSingle();

          if (offerError) {
            console.error('[❌ Failed to fetch offer for campaign detail]', offerError);
          }

          if (offerRow) {
            setOffer(offerRow);
          }
        }

        // 4) Load stats from campaign_tracking_events by campaign_id
        const { data: events, error: eventsError } = await supabase
          .from('campaign_tracking_events')
          .select('event_type, amount')
          .eq('campaign_id', campaignId);

        if (eventsError) {
          console.error('[❌ Failed to fetch campaign_tracking_events]', eventsError);
        }

        const summary: StatSummary = {
          clicks: 0,
          addToCarts: 0,
          conversions: 0,
          revenue: 0,
        };

        const rows = (events ?? []) as TrackingEventRow[];

        for (const e of rows) {
          const type = (e.event_type || '').toLowerCase();

          if (type === 'page_view' || type === 'click') {
            summary.clicks += 1;
          }

          if (type === 'add_to_cart') {
            summary.addToCarts += 1;
          }

          if (type === 'conversion') {
            summary.conversions += 1;
            const amt = e.amount;
            if (amt !== null && amt !== undefined) {
              summary.revenue += Number(amt);
            }
          }
        }

        setStats(summary);
        setLoading(false);
      } catch (err) {
        console.error('[❌ Error loading campaign detail]', err);
        setError('Something went wrong loading this campaign.');
        setLoading(false);
      }
    };

    load();
  }, [campaignId, user]);

  const formatDate = (d?: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleString();
  };

  if (!campaignId) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-sm text-red-300">Missing campaign ID.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-sm text-white/70">
            You need to be logged in to view this campaign.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-sm text-white/60">Loading campaign…</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white">
        <div className="mx-auto max-w-5xl px-6 py-10 space-y-4">
          <p className="text-sm text-red-300">
            {error || 'Could not load this campaign.'}
          </p>
          <button
            onClick={() => router.push('/business/manage-campaigns')}
            className="rounded-full bg-[#00C2CB] px-4 py-2 text-xs font-semibold text-black hover:bg-[#00b0b8]"
          >
            Back to campaigns
          </button>
        </div>
      </div>
    );
  }

  const isMeta = campaign._source === 'meta';
  const title = offer?.title || 'Unknown offer';
  const website = offer?.website || '';
  const statusLabel = (campaign.status || 'LIVE').toUpperCase();

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
              Campaign overview
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#00C2CB]">
              {title}
            </h1>
            <p className="mt-1 text-xs text-white/60">
              {campaign.caption || 'No campaign caption provided.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/60">
              {isMeta ? (
                <>
                  <span className="rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/10 px-2 py-0.5">
                    Meta Ads
                  </span>
                  {campaign.campaign_type && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                      {campaign.campaign_type}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {campaign.platform && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                      {campaign.platform}
                    </span>
                  )}
                  {campaign.type && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                      {campaign.type}
                    </span>
                  )}
                </>
              )}

              {campaign.created_at && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  Started {formatDate(campaign.created_at)}
                </span>
              )}

              {campaign.affiliate_email && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  Affiliate: {campaign.affiliate_email}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold
                ${
                  statusLabel === 'LIVE' || statusLabel === 'ACTIVE'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : statusLabel === 'PAUSED'
                    ? 'bg-amber-500/15 text-amber-300'
                    : statusLabel === 'STOPPED'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-slate-500/20 text-slate-200'
                }`}
            >
              {statusLabel}
            </span>
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#7ff5fb] underline underline-offset-2 hover:text-[#a8fbff]"
              >
                View offer website
              </a>
            )}
            <button
              onClick={() => router.push('/business/manage-campaigns')}
              className="rounded-full border border-white/20 bg-transparent px-4 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5"
            >
              Back to campaigns
            </button>
          </div>
        </div>

        {/* Stats row */}
        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/50">
              Clicks
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {stats ? stats.clicks : 0}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/50">
              Add to carts
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {stats ? stats.addToCarts : 0}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-white/50">
              Conversions
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {stats ? stats.conversions : 0}
            </p>
          </div>
          <div className="rounded-2xl border border-[#00C2CB]/40 bg-[#00C2CB]/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-[#7ff5fb]">
              Conversion value
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#7ff5fb]">
              {stats ? `$${stats.revenue.toFixed(2)}` : '$0.00'}
            </p>
          </div>
        </section>

        {/* Tracking link (for Meta) */}
        {isMeta && campaign.tracking_link && (
          <section className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-white/80">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Tracking link
            </p>
            <p className="mt-1 break-all text-xs text-white/80">
              {campaign.tracking_link}
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default BusinessCampaignDetail;