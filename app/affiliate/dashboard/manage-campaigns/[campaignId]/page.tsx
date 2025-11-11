'use client';

import { useEffect, useMemo, useState } from 'react';
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
// Register Chart.js components
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
import { useParams } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
import type { PostgrestError } from '@supabase/supabase-js';
// If it exists, import currency formatter
// import { formatCurrency } from '@/utils/formatters';
import { CursorArrowRaysIcon, ShoppingCartIcon, CurrencyDollarIcon, TrashIcon } from '@heroicons/react/24/outline';

type Campaign = {
  id: string;
  caption?: string;
  media_url?: string;
  affiliate_id?: string;
  [key: string]: any;
};

type Stats = { clicks: number; carts: number; conversions: number };

export default function ManageCampaignPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [affiliateId, setAffiliateId] = useState<string | null>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<PostgrestError | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  // Offer state
  const [offer, setOffer] = useState<{ website?: string; title?: string; commission?: number } | null>(null);
  const [stats, setStats] = useState<Stats>({ clicks: 0, carts: 0, conversions: 0 });
  const [chartSeries, setChartSeries] = useState<{ labels: string[]; clicks: number[]; carts: number[]; conversions: number[] }>({ labels: [], clicks: [], carts: [], conversions: [] });
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [pendingPayout, setPendingPayout] = useState<number>(0);
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

  async function loadCampaignStats(currentCampaignId: string) {
    try {
      setLoadingStats(true);
      // Efficient exact counts without fetching rows
      const [clicksRes, cartsRes, convRes] = await Promise.all([
        supabase.from('campaign_tracking_events').select('id', { count: 'exact', head: true }).eq('campaign_id', currentCampaignId).eq('event_type', 'page_view'),
        supabase.from('campaign_tracking_events').select('id', { count: 'exact', head: true }).eq('campaign_id', currentCampaignId).eq('event_type', 'add_to_cart'),
        supabase.from('campaign_tracking_events').select('id', { count: 'exact', head: true }).eq('campaign_id', currentCampaignId).eq('event_type', 'conversion'),
      ]);

      setStats({
        clicks: clicksRes.count || 0,
        carts: cartsRes.count || 0,
        conversions: convRes.count || 0,
      });

      // Last 7 days series (fetch minimal fields and bin client-side)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // include today
      const { data: recent, error: recentErr } = await supabase
        .from('campaign_tracking_events')
        .select('created_at, event_type')
        .eq('campaign_id', currentCampaignId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (!recentErr) {
        const labels = buildLast7DaysBuckets();
        const clicks = Array(labels.length).fill(0);
        const carts = Array(labels.length).fill(0);
        const conversions = Array(labels.length).fill(0);

        recent?.forEach((row: { created_at: string; event_type: string }) => {
          const d = new Date(row.created_at);
          const idx = (() => {
            const base = new Date();
            const baseStart = new Date(base.getFullYear(), base.getMonth(), base.getDate());
            const rowStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diffDays = Math.round((rowStart.getTime() - baseStart.getTime()) / 86400000);
            const pos = 6 + diffDays; // map -6..0 to 0..6
            return Math.min(6, Math.max(0, pos));
          })();
          if (row.event_type === 'page_view') clicks[idx] += 1;
          else if (row.event_type === 'add_to_cart') carts[idx] += 1;
          else if (row.event_type === 'conversion') conversions[idx] += 1;
        });

        setChartSeries({ labels, clicks, carts, conversions });
      }
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
    return () => { cancelled = true; clearInterval(interval); };
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    console.log("✅ CAMPAIGN ID FROM ROUTE:", campaignId);

    supabase
      .from('live_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle()
      .then(({ data, error }: { data: Campaign | null; error: PostgrestError | null }) => {
        console.log("✅ CAMPAIGN DATA:", data);
        console.log("🖼️ media_url:", data?.media_url);
        console.log("❌ FETCH ERROR:", error);
        if (data) setCampaign(data);
        if (error) setError(error);
      });
  }, [campaignId]);

  // Resolve affiliateId: prefer campaign.affiliate_id, else current user email, else localStorage fallback
  useEffect(() => {
    let cancelled = false;

    async function resolveAffiliateId() {
      // 1) If campaign carries the affiliate id, use it
      if (campaign?.affiliate_id) {
        if (!cancelled) setAffiliateId(String(campaign.affiliate_id));
        return;
      }

      // 2) Try Supabase auth user email
      try {
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email || null;
        if (email && !cancelled) {
          setAffiliateId(email);
          return;
        }
      } catch (_) {}

      // 3) Fallback to localStorage profile pattern used elsewhere
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
        } catch (_) {}
      }

      if (!cancelled) setAffiliateId(null);
    }

    resolveAffiliateId();
    return () => { cancelled = true; };
  }, [campaign]);

  // Fetch pending payout (for now) straight from campaign_tracking_events
  // We only count conversions for THIS affiliate and THIS campaign where amount is present
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

  // Fetch offer info when campaign is loaded
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
      .then(({ data, error }) => {
        if (!cancelled) {
          if (data) setOffer(data);
          else setOffer(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  const trackingUrl = useMemo(() => {
    if (!campaignId || !affiliateId) return '';
    return `https://nettmark.com/go/${campaignId}-${affiliateId}`;
  }, [campaignId, affiliateId]);

  if (error) return <div>Error: {error.message}</div>;
  if (!campaign) return <div>Loading...</div>;
  return (
    <div className="min-h-screen bg-[#111111] text-gray-100 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center justify-center max-w-4xl mx-auto">
        {/* Left side: media preview */}
        {/* Dynamic Preview */}
        <div className="w-full flex justify-center items-center h-full">
          {/* Email Preview: If platform is "email" */}
          {campaign.platform && campaign.platform.toLowerCase() === 'email' ? (
            <div className="bg-gradient-to-b from-[#181d22] to-[#101214] rounded-2xl border border-[#232931] shadow-xl w-full max-w-lg min-h-[340px] flex flex-col justify-between p-12 relative drop-shadow-[0_0_16px_rgba(0,194,203,0.11)]">
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  {/* Avatar */}
                  <div className="bg-[#222B34] w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-[#00C2CB] border border-[#28303a]">
                    N
                  </div>
                  <div>
                    <div className="text-xs text-[#7e8a9a]">From: <span className="font-semibold text-gray-200">Nettmark &lt;no-reply@nettmark.com&gt;</span></div>
                  </div>
                </div>
                {/* Subject */}
                <h2 className="text-[1.2rem] font-bold text-[#00C2CB] mb-2 leading-snug truncate">
                  {campaign.caption?.split('\n')[0] || '[No Subject]'}
                </h2>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                <div className="text-gray-300 text-[0.97rem] whitespace-pre-line leading-relaxed px-1 mb-4" style={{maxHeight: 170, minHeight: 64}}>
                  {campaign.caption || 'No content available.'}
                </div>
              </div>
              {/* Button */}
              <button
                className="mt-2 w-fit px-4 py-2 rounded-lg border border-[#00C2CB] text-[#00C2CB] font-medium hover:bg-[#00c2cb22] transition"
                onClick={() => setShowEmailModal(true)}
              >
                Open Full Email
              </button>
            </div>
          ) : campaign.media_url ? (
            <div className="bg-black rounded-[2rem] border-4 border-[#2D2D2D] w-[340px] h-[680px] overflow-hidden shadow-lg relative">
              <div className="bg-[#111111] flex items-center justify-center px-4 py-2 border-b border-gray-700">
                <img
                  src="/nettmark-logo.png"
                  alt="Nettmark Logo"
                  className="h-14 w-auto opacity-95 transform scale-150"
                />
              </div>
              <div className="h-[calc(100%-48px)] overflow-hidden">
                {campaign.media_url.match(/\.(mp4)$/i) ? (
                  <video controls className="w-full h-full object-cover bg-black">
                    <source src={campaign.media_url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : campaign.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={campaign.media_url}
                    alt="Ad Preview"
                    className="w-full h-full object-cover bg-black"
                  />
                ) : (
                  <div className="p-8 text-center text-gray-500">Unsupported media format</div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#1A1A1A] w-[90%] max-w-md rounded-xl border border-[#2A2A2A] p-8 shadow-lg flex items-center justify-center">
              <span className="text-gray-500 text-center">No content available for this campaign type</span>
            </div>
          )}
        </div>

        {/* Right side: stat cards */}
        <div className="w-full min-w-[340px] grid grid-cols-1 gap-6 content-between h-full -ml-4">
          <div className="bg-[#171717] hover:bg-[#1C1C1C] transition-all duration-300 p-5 rounded-2xl shadow-md flex items-center justify-between h-24 border border-[#2A2A2A] drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <div>
              <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                Clicks {loadingStats && <span className="text-xs text-gray-500">•</span>}
              </h2>
              <p className="text-3xl font-semibold text-white">{stats.clicks.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
              <CursorArrowRaysIcon className="w-6 h-6 text-[#00C2CB]/80" />
            </div>
          </div>
          <div className="bg-[#171717] hover:bg-[#1C1C1C] transition-all duration-300 p-5 rounded-2xl shadow-md flex items-center justify-between h-24 border border-[#2A2A2A] drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <div>
              <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                Add to Carts {loadingStats && <span className="text-xs text-gray-500">•</span>}
              </h2>
              <p className="text-3xl font-semibold text-white">{stats.carts.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
              <ShoppingCartIcon className="w-6 h-6 text-[#00C2CB]/80" />
            </div>
          </div>
          <div className="bg-[#171717] hover:bg-[#1C1C1C] transition-all duration-300 p-5 rounded-2xl shadow-md flex items-center justify-between h-24 border border-[#2A2A2A] drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <div>
              <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                Conversions {loadingStats && <span className="text-xs text-gray-500">•</span>}
              </h2>
              <p className="text-3xl font-semibold text-white">{stats.conversions.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
              <CurrencyDollarIcon className="w-6 h-6 text-[#00C2CB]/80" />
            </div>
          </div>
          {/* Pending Payout Card */}
          <div className="bg-[#171717] hover:bg-[#1C1C1C] transition-all duration-300 p-5 rounded-2xl shadow-md flex items-center justify-between h-24 border border-[#2A2A2A] drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <div>
              <h2 className="text-gray-300 text-sm font-medium mb-1 tracking-wide uppercase">
                Pending Payout
              </h2>
              <p className="text-3xl font-semibold text-white">
                {pendingPayout > 0 ? `$${pendingPayout.toFixed(2)}` : '$0.00'}
              </p>
              <p className="text-[0.6rem] text-gray-500 mt-1">
                {offer?.commission ? `This offer pays ${offer.commission}%` : 'No commission set → showing full amount'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#0F0F0F] flex items-center justify-center shadow-inner">
              <CurrencyDollarIcon className="w-6 h-6 text-[#00C2CB]/80" />
            </div>
          </div>
          <div className="bg-[#171717] rounded-2xl border border-[#2A2A2A] shadow-md p-5">
            <h3 className="text-gray-300 text-sm font-medium mb-3 tracking-wide uppercase">Performance Overview</h3>
            <Line
              data={{
                labels: chartSeries.labels.length ? chartSeries.labels : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
                datasets: [
                  {
                    label: 'Clicks',
                    data: chartSeries.clicks.length ? chartSeries.clicks : [0,0,0,0,0,0,0],
                    fill: true,
                    backgroundColor: (context) => {
                      const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 200);
                      gradient.addColorStop(0, 'rgba(0,194,203,0.15)');
                      gradient.addColorStop(1, 'rgba(0,194,203,0)');
                      return gradient;
                    },
                    borderColor: '#00C2CB',
                    borderWidth: 2,
                    tension: 0.35,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                  },
                  {
                    label: 'Add to Carts',
                    data: chartSeries.carts.length ? chartSeries.carts : [0,0,0,0,0,0,0],
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
                    data: chartSeries.conversions.length ? chartSeries.conversions : [0,0,0,0,0,0,0],
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
                    ticks: { color: '#9CA3AF', font: { size: 10 }, stepSize: 10 },
                    grid: { color: '#1E293B20' },
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
      {/* Campaign Details Dropdown - moved to directly above tracking link */}
      <div className="flex justify-center w-full mt-16 mb-6">
        <div className="w-[92%] max-w-6xl">
          <details className="group bg-[#171717] rounded-2xl border border-[#2A2A2A] shadow-md overflow-hidden transition-all duration-300 drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <summary className="cursor-pointer select-none px-6 py-4 text-gray-300 text-sm tracking-wide uppercase bg-[#1C1C1C] hover:bg-[#1F1F1F] transition-all duration-300 flex justify-between items-center">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#00C2CB] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div className="p-6 space-y-3 text-gray-200 text-sm bg-[#0F0F0F]">
              {Object.entries(campaign)
                .filter(([key]) => ['caption', 'type', 'status', 'platform'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between border-b border-[#1C1C1C] pb-2">
                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-[#00C2CB]">{String(value)}</span>
                  </div>
                ))}
              {/* Email preview trigger */}
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
      <div className="flex justify-center w-full mb-6">
        <div className="w-[92%] max-w-6xl">
          {/* Offer destination website section */}
          <div className="mb-4">
            {offer?.website ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 font-medium">Destination Website:</span>
                <a
                  href={offer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00C2CB] underline break-all hover:text-[#00e9f4] transition"
                  style={{ wordBreak: 'break-all' }}
                >
                  {offer.website}
                </a>
                <a
                  href={offer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 px-2 py-1 rounded bg-[#00C2CB22] text-[#00C2CB] hover:bg-[#00C2CB33] font-medium transition text-xs"
                >
                  Test Destination
                </a>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No destination set.</div>
            )}
          </div>
          <details className="group bg-[#171717] rounded-2xl border border-[#2A2A2A] shadow-md overflow-hidden transition-all duration-300 drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <summary className="cursor-pointer select-none px-6 py-4 text-gray-300 text-sm tracking-wide uppercase bg-[#1C1C1C] hover:bg-[#1F1F1F] transition-all duration-300 flex justify-between items-center">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#00C2CB] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="group-open:text-[#00C2CB] transition">Tracking Link <span className="text-gray-500 ml-1">(Campaign: {String(campaignId)})</span></span>
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
            <div className="p-6 bg-[#0F0F0F] rounded-b-2xl">
              {(!affiliateId) ? (
                <div className="text-sm text-red-300">
                  Missing affiliate ID. Please sign in again or complete your affiliate profile.
                </div>
              ) : (
                <div className="text-sm">
                  <div className="text-[#00C2CB] break-all">{trackingUrl}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={async () => { if (trackingUrl) { await navigator.clipboard.writeText(trackingUrl); } }}
                      className="px-3 py-1.5 rounded bg-[#00C2CB] hover:bg-[#00b0b8] text-white text-xs"
                    >Copy Link</button>
                    {offer?.website && (
                      <a
                        href={trackingUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded bg-white hover:bg-[#e0fafa] border border-gray-300 text-[#00C2CB] text-xs"
                      >Open Test</a>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Clicking this redirects to the merchant with <code>nm_aff</code> and <code>nm_camp</code> query parameters. The on-site pixel sets first-party cookies and sends events to Nettmark.
                  </p>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
      {/* Affiliate Guide Dropdown */}
      <div className="flex justify-center w-full mt-6">
        <div className="w-[92%] max-w-6xl">
          <details className="group bg-[#171717] rounded-2xl border border-[#2A2A2A] shadow-md overflow-hidden transition-all duration-300 drop-shadow-[0_0_12px_rgba(0,194,203,0.15)]">
            <summary className="cursor-pointer select-none px-6 py-4 text-gray-300 text-sm tracking-wide uppercase bg-[#1C1C1C] hover:bg-[#1F1F1F] transition-all duration-300 flex justify-between items-center">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#00C2CB] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div className="p-6 bg-[#0F0F0F] text-gray-300 text-sm leading-relaxed space-y-4">
              {campaign.type === 'organic' ? (
                <>
                  <p>
                    This is an <span className="text-[#00C2CB] font-medium">organic campaign</span>. You’ll be promoting the brand using your own social posts, stories, or reels.
                    Your <span className="text-[#00C2CB]">tracking link</span> automatically monitors visits, signups, and purchases generated from your post.
                  </p>
                  <p>
                    Organic campaigns remain <span className="text-[#00C2CB] font-medium">active indefinitely</span> unless misuse is detected.
                    If your tracking link is shared in misleading or inappropriate ways, it will be disabled, and you’ll be notified.
                  </p>
                  <p>
                    All verified conversions tracked through your link trigger an automatic <span className="text-[#00C2CB]">Stripe payout</span> once confirmed by the business.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This is a <span className="text-[#00C2CB] font-medium">paid ad campaign</span> managed via Meta.
                    Your ad creative, targeting, and spend are handled within Nettmark’s ad automation system.
                  </p>
                  <p>
                    While your tracking link still exists for record-keeping, all conversions, spend, and payouts are tracked automatically through Meta’s integration and do not rely on manual link clicks.
                  </p>
                  <p>
                    Use this section to review approved ad creatives, check performance stats, and ensure your campaign aligns with <span className="text-[#00C2CB]">Meta’s compliance</span> and payout policy.
                  </p>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
      {/* Delete Campaign Section */}
      <div className="max-w-5xl mx-auto mt-10 text-center">
        <button
          onClick={async () => {
            const confirmDelete = window.confirm(
              `⚠️ Permanently delete this campaign?\n\nThis action cannot be undone.`
            );
            if (!confirmDelete) return;

            const { error } = await supabase.from('live_campaigns').delete().eq('id', campaign.id);
            if (error) {
              console.error('❌ Delete error:', error);
              alert('Error deleting campaign.');
            } else {
              alert('Campaign deleted.');
              window.location.href = '/affiliate/dashboard/manage-campaigns';
            }
          }}
          className="relative inline-flex items-center px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-red-500/40 hover:border-red-500/70 text-red-400 hover:text-red-300 rounded-xl font-medium transition-all duration-300 group shadow-[0_0_10px_rgba(255,0,0,0.05)]"
        >
          <TrashIcon className="w-5 h-5 mr-2 text-red-400 group-hover:text-red-300 transition" />
          Delete Campaign
          <span className="absolute inset-0 rounded-xl bg-red-500/10 opacity-0 group-hover:opacity-100 transition" />
        </button>
        <p className="text-xs text-gray-500 mt-2">This will permanently remove all data linked to this campaign.</p>
      </div>
      {/* Email Preview Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50" onClick={() => setShowEmailModal(false)}>
          <div className="bg-[#1A1A1A] w-[90%] max-w-2xl max-h-[80vh] overflow-y-auto p-6 rounded-xl border border-[#00C2CB55]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#00C2CB]">Email Preview</h2>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-white">✖</button>
            </div>
            <div className="text-gray-300 whitespace-pre-line">
              {campaign.caption}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}