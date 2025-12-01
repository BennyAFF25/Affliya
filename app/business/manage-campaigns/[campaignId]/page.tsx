'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import {
  CursorArrowRaysIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  PlayCircleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

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

type Campaign = {
  id: string;
  type: string | null;
  offer_id: string | null;
  business_email: string | null;
  affiliate_email: string | null;
  media_url: string | null;
  caption: string | null;
  platform: string | null;
  created_from: string | null;
  status: string | null;
  created_at: string | null;
};

type CampaignStats = {
  pageViews: number;
  addToCarts: number;
  conversions: number;
  revenue: number;
};

type CampaignSeries = {
  labels: string[];
  pageViews: number[];
  addToCarts: number[];
  conversions: number[];
};

export default function BusinessCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const session = useSession();
  const user = session?.user;

  const campaignId = params?.campaignId as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [series, setSeries] = useState<CampaignSeries>({
    labels: [],
    pageViews: [],
    addToCarts: [],
    conversions: [],
  });

  useEffect(() => {
    if (!user?.email || !campaignId) return;

    const fetchCampaign = async () => {
      setLoading(true);

      const { data, error } = await (supabase as any)
        .from('live_campaigns')
        .select(
          `
          id,
          type,
          offer_id,
          business_email,
          affiliate_email,
          media_url,
          caption,
          platform,
          created_from,
          status,
          created_at
        `
        )
        .eq('id', campaignId)
        .eq('business_email', user.email as string)
        .single();

      if (error) {
        console.error('[❌ Failed to fetch campaign detail]', error);
      } else {
        setCampaign(data || null);
        console.log('[✅ Business campaign detail]', data);
      }

      setLoading(false);
    };

    fetchCampaign();
  }, [campaignId, user?.email]);

  const buildLast7DaysLabels = () => {
    const labels: string[] = [];
    const today = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const base = startOfDay(today);
    for (let i = 6; i >= 0; i--) {
      const day = new Date(base);
      day.setDate(base.getDate() - i);
      labels.push(
        day.toLocaleDateString(undefined, {
          weekday: 'short',
        })
      );
    }
    return labels;
  };

  useEffect(() => {
    if (!campaignId || !user?.email) return;

    const fetchStats = async () => {
      setStatsLoading(true);

      const { data, error } = await (supabase as any)
        .from('campaign_tracking_events')
        .select('event_type, amount')
        .eq('campaign_id', campaignId);

      if (error) {
        console.error('[❌ Failed to fetch campaign stats]', error);
        setStats(null);
        setStatsLoading(false);
        setSeries({
          labels: [],
          pageViews: [],
          addToCarts: [],
          conversions: [],
        });
        return;
      }

      let pageViews = 0;
      let addToCarts = 0;
      let conversions = 0;
      let revenue = 0;

      for (const evt of data || []) {
        const t = (evt.event_type || '').toLowerCase();
        if (t === 'page_view' || t === 'view' || t === 'landing_view') {
          pageViews += 1;
        } else if (t === 'add_to_cart' || t === 'cart') {
          addToCarts += 1;
        } else if (t === 'conversion' || t === 'purchase' || t === 'order') {
          conversions += 1;
          if (typeof evt.amount === 'number') {
            revenue += Number(evt.amount);
          }
        }
      }

      setStats({ pageViews, addToCarts, conversions, revenue });

      // Build simple last-7-days series for chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const { data: recent, error: recentErr } = await (supabase as any)
        .from('campaign_tracking_events')
        .select('created_at, event_type')
        .eq('campaign_id', campaignId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (!recentErr && recent) {
        const labels = buildLast7DaysLabels();
        const pv = Array(labels.length).fill(0);
        const carts = Array(labels.length).fill(0);
        const conv = Array(labels.length).fill(0);

        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const today = startOfDay(new Date());

        for (const row of recent as { created_at: string; event_type: string }[]) {
          const d = new Date(row.created_at);
          const rowDay = startOfDay(d);
          const diffDays = Math.round(
            (rowDay.getTime() - today.getTime()) / 86400000
          );
          const idx = Math.min(6, Math.max(0, 6 + diffDays)); // map -6..0 to 0..6

          const t = (row.event_type || '').toLowerCase();
          if (t === 'page_view' || t === 'view' || t === 'landing_view') {
            pv[idx] += 1;
          } else if (t === 'add_to_cart' || t === 'cart') {
            carts[idx] += 1;
          } else if (t === 'conversion' || t === 'purchase' || t === 'order') {
            conv[idx] += 1;
          }
        }

        setSeries({
          labels,
          pageViews: pv,
          addToCarts: carts,
          conversions: conv,
        });
      } else {
        setSeries({
          labels: [],
          pageViews: [],
          addToCarts: [],
          conversions: [],
        });
      }
      setStatsLoading(false);
    };

    fetchStats();
  }, [campaignId, user?.email]);

  const formatDate = (d?: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleString();
  };

  const handleToggleStatus = async () => {
    if (!campaign) return;

    const current = (campaign.status || '').toUpperCase();
    const isCurrentlyLive = current === 'ACTIVE' || current === 'LIVE';
    const newStatus = isCurrentlyLive ? 'PAUSED' : 'ACTIVE';

    // If we're pausing a live campaign, warn the business about the impact first.
    if (isCurrentlyLive) {
      const confirmed = window.confirm(
        [
          'Pausing this campaign will temporarily disable its tracking link.',
          'Your affiliate will be notified and this may impact campaign performance and affiliate retention.',
          '',
          'Only pause if there is a real issue (offer updates, stock problems, compliance, or tracking errors).',
          '',
          'Do you still want to pause this campaign?'
        ].join('\n')
      );
      if (!confirmed) return;
    }

    try {
      setUpdating(true);

      const { error } = await (supabase as any)
        .from('live_campaigns')
        .update({ status: newStatus })
        .eq('id', campaign.id);

      if (error) throw error;

      setCampaign((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (err) {
      console.error('[❌ Failed to update campaign status]', err);
    } finally {
      setUpdating(false);
    }
  };

  const statusChipClasses = () => {
    const s = (campaign?.status || '').toLowerCase();
    if (s === 'live' || s === 'active') {
      return 'bg-emerald-500/15 text-emerald-300';
    }
    if (s === 'paused') {
      return 'bg-amber-500/15 text-amber-300';
    }
    if (s === 'deleted') {
      return 'bg-red-500/15 text-red-300';
    }
    return 'bg-slate-500/20 text-slate-200';
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white flex items-center justify-center">
        <p className="text-sm text-white/70">
          You need to be signed in to view this campaign.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 py-4 space-y-4">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white"
        >
          <span className="inline-block h-4 w-4 rotate-180 rounded-full border border-white/30 text-[10px] leading-4 text-center">
            →
          </span>
          Back to campaigns
        </button>

        {/* Header */}
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            Campaign
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#00C2CB]">
            Campaign overview
          </h1>
          <p className="text-sm text-white/70">
            See how this campaign is set up, who is running it, and control its
            status.
          </p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 sm:px-6 py-5 text-sm text-white/70">
            Loading campaign…
          </div>
        ) : !campaign ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 sm:px-6 py-5 text-sm text-red-100">
            Campaign not found for this business.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Layout for preview / stats */}
            <section className="space-y-3 mt-1 sm:mt-2">
              {/* Section meta heading */}
              <div className="flex items-center justify-between text-[11px] text-white/45">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#00C2CB]/10 text-[#00C2CB]">
                    ●
                  </span>
                  <span className="uppercase tracking-[0.18em]">
                    Creative &amp; performance
                  </span>
                </div>
                {campaign.platform && (
                  <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
                    {campaign.platform} • {campaign.type || 'Campaign'}
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)]">
                {/* LEFT: creative preview with iPhone mockup */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 sm:px-6 py-5 flex flex-col order-2 lg:order-1">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB]/10 text-[#00C2CB]">
                        <PlayCircleIcon className="h-4 w-4" />
                      </span>
                      Creative preview
                    </h2>
                    {campaign.platform && (
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/50">
                        {campaign.platform}
                      </span>
                    )}
                  </div>

                  {/* small context row */}
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-white/55">
                    <span>
                      Affiliate:{' '}
                      <span className="text-white">
                        {campaign.affiliate_email || 'N/A'}
                      </span>
                    </span>
                    {campaign.type && (
                      <span className="rounded-full border border-[#00C2CB40] bg-[#00C2CB1A] px-2 py-0.5 text-[10px] text-[#00C2CB]">
                        {campaign.type}
                      </span>
                    )}
                  </div>

                  {(() => {
                    const url = campaign.media_url || '';
                    const caption = campaign.caption || '';
                    const platform =
                      campaign.platform?.toLowerCase().trim() || '';

                    // EMAIL PREVIEW (keep as card)
                    if (platform === 'email') {
                      return (
                        <div className="bg-gradient-to-b from-[#181d22] to-[#101214] rounded-2xl border border-[#232931] shadow-xl w-full max-w-lg min-h-[320px] flex flex-col justify-between p-6 relative drop-shadow-[0_0_16px_rgba(0,194,203,0.11)] mx-auto">
                          <div>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="bg-[#222B34] w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-[#00C2CB] border border-[#28303a]">
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
                            <h2 className="text-[1.1rem] font-bold text-[#00C2CB] mb-2 leading-snug truncate">
                              {caption.split('\n')[0] || '[No Subject]'}
                            </h2>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                            <div
                              className="text-gray-300 text-[0.95rem] whitespace-pre-line leading-relaxed px-1 mb-2"
                              style={{ maxHeight: 170, minHeight: 64 }}
                            >
                              {caption || 'No content available.'}
                            </div>
                          </div>
                          <p className="mt-2 text-[10px] text-[#7e8a9a]">
                            Full email content is stored with this campaign’s
                            caption.
                          </p>
                        </div>
                      );
                    }

                    // NO MEDIA + NO CAPTION
                    if (!url && !caption) {
                      return (
                        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/40 px-6 py-10 text-center text-xs text-white/50">
                          <PhotoIcon className="h-8 w-8 mb-3 text-white/30" />
                          No media attached to this campaign yet.
                        </div>
                      );
                    }

                    // iPhone mockup wrapper
                    return (
                      <div className="mt-2 flex justify-center w-full">
                        <div className="relative w-full max-w-[18rem] sm:max-w-xs">
                          {/* Phone shell */}
                          <div className="relative mx-auto rounded-[2.5rem] border border-white/15 bg-[#050608] px-3 pt-4 pb-6 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
                            {/* Top notch */}
                            <div className="mx-auto mb-3 flex h-5 w-32 items-center justify-center gap-1 rounded-full bg-black/80">
                              <span className="h-2 w-10 rounded-full bg-gray-700/70" />
                              <span className="h-2 w-2 rounded-full bg-gray-500/80" />
                            </div>

                            {/* Side buttons */}
                            <div className="pointer-events-none absolute left-0 top-16 h-16 w-1 rounded-r-xl bg-white/10" />
                            <div className="pointer-events-none absolute right-0 top-24 h-10 w-1 rounded-l-xl bg-white/10" />

                            {/* Screen */}
                            <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-black aspect-[9/16]">
                              {url.match(/\.(mp4)$/i) ? (
                                <video
                                  controls
                                  className="h-full w-full object-cover bg-black"
                                >
                                  <source src={url} type="video/mp4" />
                                  Your browser does not support the video tag.
                                </video>
                              ) : url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <img
                                  src={url}
                                  alt="Campaign creative"
                                  className="h-full w-full object-cover bg-black"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-black text-xs text-white/50">
                                  Unsupported media format
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {campaign.caption &&
                    campaign.platform?.toLowerCase() !== 'email' && (
                      <p className="mt-4 text-[11px] text-white/55 border-t border-white/5 pt-3">
                        {campaign.caption}
                      </p>
                    )}

                  {/* subtle footer so column doesn't feel cut off */}
                  <p className="mt-3 text-[10px] text-white/35">
                    Creative shown as a vertical mobile preview. Final layout
                    may vary slightly on Meta / organic placement.
                  </p>
                </div>

                {/* RIGHT: performance stats */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 sm:px-6 py-5 flex flex-col order-1 lg:order-2">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                        <CursorArrowRaysIcon className="h-4 w-4" />
                      </span>
                      Performance
                    </h2>
                    <span className="rounded-full bg-black/40 px-3 py-1 text-[10px] text-white/50 uppercase tracking-[0.16em]">
                      Live tracking
                    </span>
                  </div>

                  {statsLoading ? (
                    <p className="text-xs text-white/60">Loading stats…</p>
                  ) : !stats ? (
                    <p className="text-xs text-white/60">
                      No tracking events recorded for this campaign yet.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">
                        <div className="rounded-2xl border border-white/10 bg-black/40 px-3 sm:px-4 py-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-white/60">
                              Page views
                            </p>
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5">
                              <CursorArrowRaysIcon className="h-4 w-4 text-[#00C2CB]" />
                            </span>
                          </div>
                          <p className="mt-2 text-xl font-semibold">
                            {stats.pageViews}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/40 px-3 sm:px-4 py-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-white/60">
                              Add to carts
                            </p>
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5">
                              <ShoppingCartIcon className="h-4 w-4 text-[#00C2CB]" />
                            </span>
                          </div>
                          <p className="mt-2 text-xl font-semibold">
                            {stats.addToCarts}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/40 px-3 sm:px-4 py-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-white/60">
                              Conversions
                            </p>
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5">
                              <CurrencyDollarIcon className="h-4 w-4 text-[#00C2CB]" />
                            </span>
                          </div>
                          <p className="mt-2 text-xl font-semibold">
                            {stats.conversions}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 sm:px-4 py-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-emerald-100">
                              Revenue
                            </p>
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
                              <CurrencyDollarIcon className="h-4 w-4 text-emerald-300" />
                            </span>
                          </div>
                          <p className="mt-2 text-xl font-semibold text-emerald-100">
                            {stats.revenue.toLocaleString(undefined, {
                              style: 'currency',
                              currency: 'USD',
                            })}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-white/50">
                        Events are calculated from{' '}
                        <code className="font-mono text-[10px]">
                          campaign_tracking_events
                        </code>{' '}
                        for this campaign.
                      </p>
                      {series.labels.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-3 sm:px-4 py-3">
                          <p className="mb-2 text-[11px] text-white/60">
                            7‑day trend
                          </p>
                          <Line
                            data={{
                              labels: series.labels,
                              datasets: [
                                {
                                  label: 'Page views',
                                  data: series.pageViews,
                                  borderColor: '#00C2CB',
                                  backgroundColor: 'rgba(0,194,203,0.15)',
                                  fill: true,
                                  tension: 0.35,
                                  borderWidth: 2,
                                  pointRadius: 2,
                                },
                                {
                                  label: 'Add to carts',
                                  data: series.addToCarts,
                                  borderColor: '#009aa2',
                                  backgroundColor: 'rgba(0,154,162,0.12)',
                                  fill: true,
                                  tension: 0.35,
                                  borderWidth: 1.5,
                                  pointRadius: 2,
                                },
                                {
                                  label: 'Conversions',
                                  data: series.conversions,
                                  borderColor: '#00787f',
                                  backgroundColor: 'rgba(0,120,127,0.1)',
                                  fill: true,
                                  tension: 0.35,
                                  borderWidth: 1.5,
                                  pointRadius: 2,
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              plugins: {
                                legend: {
                                  labels: {
                                    color: '#9CA3AF',
                                    font: { size: 10 },
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
                                  grid: { color: 'rgba(31,41,55,0.4)' },
                                },
                                y: {
                                  ticks: { color: '#9CA3AF', font: { size: 10 } },
                                  grid: { color: 'rgba(31,41,55,0.4)' },
                                  beginAtZero: true,
                                },
                              },
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* small footer hint */}
                  <p className="mt-3 text-[10px] text-white/35">
                    Stats update in near-real time as tracking events are
                    received from your website.
                  </p>
                </div>
              </div>
            </section>

            {/* Top summary card */}
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 sm:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.6)] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusChipClasses()}`}
                  >
                    {(campaign.status || 'LIVE').toUpperCase()}
                  </span>

                  {campaign.platform && (
                    <span className="rounded-full border border-[#00C2CB40] bg-[#00C2CB1A] px-3 py-1 text-[11px] text-[#00C2CB]">
                      {campaign.platform}
                    </span>
                  )}

                  {campaign.type && (
                    <span className="rounded-full border border-[#00C2CB40] bg-[#00C2CB1A] px-3 py-1 text-[11px] text-[#00C2CB]">
                      {campaign.type}
                    </span>
                  )}
                </div>

                <p className="text-xs text-white/60">
                  Affiliate:{' '}
                  <span className="text-white">
                    {campaign.affiliate_email || 'N/A'}
                  </span>
                </p>

                <p className="text-xs text-white/60">
                  Started: {formatDate(campaign.created_at)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={handleToggleStatus}
                  disabled={updating}
                  className="rounded-full bg-[#00C2CB] px-5 py-2 text-xs font-semibold text-black shadow hover:bg-[#00b0b8] disabled:opacity-60"
                >
                  {updating
                    ? 'Updating…'
                    : (campaign.status || '').toLowerCase() === 'live' ||
                      (campaign.status || '').toLowerCase() === 'active'
                    ? 'Pause campaign'
                    : 'Activate campaign'}
                </button>
                {(campaign.status || '').toLowerCase() === 'paused' ? (
                  <p className="mt-1 max-w-xs text-[11px] text-amber-200/80 text-right">
                    This campaign is currently paused. Its tracking link is temporarily disabled and
                    affiliates cannot send traffic until you reactivate it.
                  </p>
                ) : (
                  <p className="mt-1 max-w-xs text-[11px] text-white/50 text-right">
                    Pausing will temporarily disable the tracking link and notify the affiliate. Use this
                    only if there is a genuine issue with the offer, stock, or compliance.
                  </p>
                )}
                <Link href="/business/manage-campaigns">
                  <span className="text-[11px] text-white/60 hover:text-white cursor-pointer">
                    Back to campaign list
                  </span>
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}