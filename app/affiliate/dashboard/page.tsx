'use client';

import { useSessionContext } from '@supabase/auth-helpers-react';
import { RocketLaunchIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import Link from 'next/link';
import { TrendingUp, DollarSign, Wallet, CheckCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// Currency formatter helper
const formatCurrency = (value: number) => {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

interface Profile {
  id: string;
  role: string | null;
  onboarding_completed: boolean | null;
  revenue_subscription_status?: string | null;
  revenue_current_period_end?: string | null;
}

interface ApprovedRequest {
  offer_id: string;
}

interface Offer {
  id: string;
  title: string;
  description: string;
  commission: number;
  type: string;
  payoutType: string;
  ideaId?: string; // optional idea ID for active campaign tracking
}

interface LiveAdRow {
  id: string;
  spend: number | null;
  status: string | null;
  created_at: string | null;
}

interface TrackingEventRow {
  id: string;
  created_at: string | null;
}

// (Not used on the dashboard right now, but keeping for future ad preview use)
const renderMedia = (idea: any) => {
  const file = idea.file_url;

  if (!file) {
    return <div className="text-gray-500 italic">No media file</div>;
  }

  const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().includes('.mp4');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);

  if (isVideo) {
    return (
      <video controls className="rounded-lg border border-gray-300 max-h-48 w-full object-cover">
        <source src={file} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  }

  if (isImage) {
    return (
      <img
        src={file}
        alt="Ad Preview"
        className="rounded-lg border border-gray-300 max-h-48 w-full object-cover"
        onError={(e) => {
          e.currentTarget.src = '/placeholder.png'; // fallback if image fails to load
        }}
      />
    );
  }

  return <div className="text-gray-500 italic">Unsupported media type</div>;
};

function AffiliateDashboardContent() {
  const { session, isLoading } = useSessionContext();
  const router = useRouter();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [adIdeas, setAdIdeas] = useState<any[]>([]);
  const [liveCampaigns, setLiveCampaigns] = useState<any[]>([]);

  // loading/profile
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);


  // live ads + payouts
  const [liveAds, setLiveAds] = useState<any[]>([]);
  const [walletPayouts, setWalletPayouts] = useState<any[]>([]);

  // chart series
  const [spendSeries, setSpendSeries] = useState<{ name: string; value: number }[]>([]);
  const [conversionSeries, setConversionSeries] = useState<{ name: string; value: number }[]>([]);

  // timeframe selection for Ad Spend chart
  const [spendTimeframe, setSpendTimeframe] = useState<'7d' | '30d' | '365d' | 'custom'>('30d');
  const [spendRange, setSpendRange] = useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });

  // timeframe selection for Conversions chart
  const [convTimeframe, setConvTimeframe] = useState<'7d' | '30d' | '365d' | 'custom'>('30d');
  const [convRange, setConvRange] = useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });

  useEffect(() => {
    if (isLoading) return; // wait for session resolution
    if (session === null) {
      const next = encodeURIComponent('/affiliate/dashboard');
      router.replace(`/login?role=affiliate&next=${next}`);
      return;
    }
  }, [session, isLoading, router]);

  // Profile check (redirects currently disabled to avoid loop)
  useEffect(() => {
    const checkProfile = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, onboarding_completed, terms_accepted, revenue_subscription_status, revenue_current_period_end')
        .eq('id', session.user.id)
        .maybeSingle<any>();

      // Redirect logic commented out for now:
      /*
      if (error || !data) {
        router.replace('/create-account?role=affiliate');
        return;
      }

      if (!data.role) {
        router.replace('/create-account?role=affiliate');
        return;
      }

      if (data.role !== 'affiliate') {
        router.replace('/business/dashboard');
        return;
      }
      */

      setProfile(data);
      setLoading(false);
    };

    if (session?.user) {
      setLoading(true);
      void checkProfile();
    }
  }, [session, router]);

  useEffect(() => {
    if (!session || !session.user) return;

    const loadInitialData = async () => {
      // derive date windows for each chart
      const now = new Date();

      // Ad Spend window
      let spendFromIso: string | null = null;
      let spendToIso: string | null = now.toISOString();

      if (spendTimeframe === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        spendFromIso = d.toISOString();
      } else if (spendTimeframe === '30d') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        spendFromIso = d.toISOString();
      } else if (spendTimeframe === '365d') {
        const d = new Date();
        d.setDate(d.getDate() - 365);
        spendFromIso = d.toISOString();
      } else if (spendTimeframe === 'custom') {
        if (spendRange.from && spendRange.to) {
          const from = new Date(spendRange.from);
          const to = new Date(spendRange.to);
          spendFromIso = from.toISOString();
          spendToIso = to.toISOString();
        } else {
          spendFromIso = null;
          spendToIso = null;
        }
      }

      // Conversions window
      let convFromIso: string | null = null;
      let convToIso: string | null = now.toISOString();

      if (convTimeframe === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        convFromIso = d.toISOString();
      } else if (convTimeframe === '30d') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        convFromIso = d.toISOString();
      } else if (convTimeframe === '365d') {
        const d = new Date();
        d.setDate(d.getDate() - 365);
        convFromIso = d.toISOString();
      } else if (convTimeframe === 'custom') {
        if (convRange.from && convRange.to) {
          const from = new Date(convRange.from);
          const to = new Date(convRange.to);
          convFromIso = from.toISOString();
          convToIso = to.toISOString();
        } else {
          convFromIso = null;
          convToIso = null;
        }
      }

      // Fetch offers
      const { data: liveOffers, error: offerError } = await supabase.from('offers').select('*');

      if (offerError) {
        console.error('[❌ Failed to fetch offers]', offerError);
        setOffers([]);
      } else {
        setOffers(liveOffers || []);
      }

      // Approved requests for this affiliate
      const { data: approved, error: approvedError } = (await supabase
        .from('affiliate_requests')
        .select('offer_id')
        .eq('affiliate_email', session.user?.email || '')
        .eq('status', 'approved')) as { data: ApprovedRequest[] | null; error: any };

      if (approvedError) {
        console.error('[❌ Failed to fetch approved requests]', approvedError);
      } else {
        const ids = Array.from(new Set((approved || []).map((r: ApprovedRequest) => r.offer_id)));
        setApprovedIds(ids);
        console.log('[✅ Approved IDs]', ids);
      }

      // Approved ad ideas for this affiliate
      const { data: ideas, error: ideasError } = await supabase
        .from('ad_ideas')
        .select(`
          id,
          offer_id,
          affiliate_email,
          file_url,
          status,
          caption
        `)
        .eq('affiliate_email', session.user?.email || '')
        .eq('status', 'approved');

      if (ideasError) {
        console.error('[❌ Failed to fetch ad ideas]', ideasError);
        setAdIdeas([]);
      } else {
        setAdIdeas(ideas || []);
      }

      // Live organic campaigns for this affiliate
      const { data: live, error: liveErr } = await supabase
        .from('live_campaigns')
        .select('id, offer_id, media_url, caption, platform, status, created_at')
        .eq('affiliate_email', session.user?.email || '');

      if (liveErr) {
        console.error('[❌ Failed to fetch live_campaigns]', liveErr);
        setLiveCampaigns([]);
      } else {
        setLiveCampaigns(live || []);
      }

      // Live ads (Meta paid) for this affiliate within Ad Spend window
      let adsQuery = supabase
        .from('live_ads')
        .select('id, spend, status, created_at')
        .eq('affiliate_email', session.user?.email || '');

      if (spendFromIso) {
        adsQuery = adsQuery.gte('created_at', spendFromIso);
      }
      if (spendToIso) {
        adsQuery = adsQuery.lte('created_at', spendToIso);
      }

      const { data: ads, error: adsErr } = await adsQuery;

      if (adsErr) {
        console.error('[❌ Failed to fetch live_ads]', adsErr);
        setLiveAds([]);
      } else {
        const adsSafe = (ads || []) as LiveAdRow[];
        setLiveAds(adsSafe);

        // Build spend series by day
        const spendByDate: Record<string, number> = {};
        for (const ad of adsSafe) {
          if (!ad.created_at) continue;
          const dateKey = new Date(ad.created_at).toISOString().slice(0, 10); // YYYY-MM-DD
          const val = Number(ad.spend ?? 0);
          if (isNaN(val)) continue;
          spendByDate[dateKey] = (spendByDate[dateKey] || 0) + val;
        }

        const sortedSpend = Object.entries(spendByDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({
            name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
            value,
          }));

        setSpendSeries(sortedSpend);
      }

      // Conversions from tracking events – treat every event as a conversion for now, within Conversions window
      let convQuery = supabase
        .from('campaign_tracking_events')
        .select('id, created_at');

      if (convFromIso) {
        convQuery = convQuery.gte('created_at', convFromIso);
      }
      if (convToIso) {
        convQuery = convQuery.lte('created_at', convToIso);
      }

      const { data: conversions, error: convErr } = await convQuery;

      if (convErr) {
        console.error('[❌ Failed to fetch campaign_tracking_events]', convErr);
        setConversionSeries([]);
      } else {
        const convSafe = (conversions || []) as TrackingEventRow[];
        console.log('[✅ Conversions loaded for affiliate conversions chart]', convSafe.length);

        const convByDate: Record<string, number> = {};
        for (const ev of convSafe) {
          if (!ev.created_at) continue;
          const dateKey = new Date(ev.created_at).toISOString().slice(0, 10);
          convByDate[dateKey] = (convByDate[dateKey] || 0) + 1;
        }

        const sortedConv = Object.entries(convByDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({
            name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
            value,
          }));

        setConversionSeries(sortedConv);
      }

      // Wallet payouts for this affiliate
      const { data: payouts, error: payoutsErr } = await supabase
        .from('wallet_payouts')
        .select('id, amount, status')
        .eq('affiliate_email', session.user?.email || '');

      if (payoutsErr) {
        console.error('[❌ Failed to fetch wallet_payouts]', payoutsErr);
        setWalletPayouts([]);
      } else {
        setWalletPayouts(payouts || []);
      }
    };

    void loadInitialData();
  }, [
    session,
    spendTimeframe,
    spendRange.from,
    spendRange.to,
    convTimeframe,
    convRange.from,
    convRange.to,
  ]);

  useEffect(() => {
    if (session?.user && approvedIds.length === 0) {
      console.warn('[⚠️ No approved offers — user still stays on dashboard]');
    }
  }, [session, approvedIds]);

  const user = session?.user;
  const trialDaysLeft =
    profile?.revenue_subscription_status === 'trialing' &&
    profile?.revenue_current_period_end
      ? Math.ceil(
          (new Date(profile.revenue_current_period_end).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  const approvedOffers = offers.filter((offer) => approvedIds.includes(offer.id));
  const activeCampaigns = (liveCampaigns || [])
    .map((camp: any) => {
      const matchedOffer = offers.find((offer) => offer.id === camp.offer_id);
      return matchedOffer ? { ...matchedOffer, ideaId: camp.id } : null; // reusing ideaId for campaignId
    })
    .filter(Boolean) as Offer[];

  // Derived metrics for stat cards
  const activeCampaignCount = (activeCampaigns?.length || 0) + (liveAds?.length || 0);

  const totalSpent = (liveAds || []).reduce((sum: number, ad: any) => {
    const val = Number(ad.spend || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const pendingPayoutTotal = (walletPayouts || [])
    .filter((p: any) => p.status === 'pending')
    .reduce((sum: number, p: any) => {
      const val = Number(p.amount || 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  // State for toggling show all/less for campaigns and offers
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);

  const visibleCampaigns = showAllCampaigns ? activeCampaigns : activeCampaigns.slice(0, 1);
  const visibleOffers = showAllOffers ? approvedOffers : approvedOffers.slice(0, 1);

if (loading) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0d0d0d] text-white">
      <div className="p-4">Loading...</div>
    </div>
  );
}
  if (!user) {
    return null; // redirect handled above
  }

  const chartConfigs = [
    { id: 'spend', title: 'Ad Spend', data: spendSeries },
    { id: 'conv', title: 'Conversions', data: conversionSeries },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0d0d0d] text-white">
      
      <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
          {/* Stat Card: Active Campaigns */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#0f0f0f] overflow-hidden backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-4 transition-transform duration-300 ease-out hover:scale-[1.01]">
            <div className="flex items-center gap-4 relative z-10">
              <div className="text-[#00C2CB] bg-[#00C2CB]/10 rounded-lg p-2.5">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-white/60">Active Campaigns</p>
                <h2 className="text-3xl font-bold text-white">{activeCampaignCount}</h2>
              </div>
            </div>
          </div>

          {/* Stat Card: Total Spent */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#0f0f0f] overflow-hidden backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-4 transition-transform duration-300 ease-out hover:scale-[1.01]">
            <div className="flex items-center gap-4 relative z-10">
              <div className="text-[#00C2CB] bg-[#00C2CB]/10 rounded-lg p-2.5">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-white/60">Total Spent</p>
                <h2 className="text-3xl font-bold text-white">{formatCurrency(totalSpent)}</h2>
              </div>
            </div>
          </div>

          {/* Stat Card: Pending Payout */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#0f0f0f] overflow-hidden backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-4 transition-transform duration-300 ease-out hover:scale-[1.01]">
            <div className="flex items-center gap-4 relative z-10">
              <div className="text-[#00C2CB] bg-[#00C2CB]/10 rounded-lg p-2.5">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-white/60">Pending Payout</p>
                <h2 className="text-3xl font-bold text-white">{formatCurrency(pendingPayoutTotal)}</h2>
              </div>
            </div>
          </div>

          {/* Stat Card: Approved Offers */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#0f0f0f] overflow-hidden backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-4 transition-transform duration-300 ease-out hover:scale-[1.01]">
            <div className="flex items-center gap-4 relative z-10">
              <div className="text-[#00C2CB] bg-[#00C2CB]/10 rounded-lg p-2.5">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-white/60">Approved Offers</p>
                <h2 className="text-3xl font-bold text-white">{approvedOffers.length}</h2>
              </div>
            </div>
          </div>
        </div>


        {/* Area Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {chartConfigs.map((chart, i) => {
            const isSpendChart = chart.id === 'spend';
            const tf = isSpendChart ? spendTimeframe : convTimeframe;
            const setTf = isSpendChart ? setSpendTimeframe : setConvTimeframe;
            const range = isSpendChart ? spendRange : convRange;
            const setRange = isSpendChart ? setSpendRange : setConvRange;

            return (
              <div
                key={chart.title}
                className="relative rounded-2xl border border-white/5 bg-[#0d0d0d]/60 backdrop-blur-md p-6 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 pointer-events-none rounded-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-white/70">{chart.title}</h2>
                    <div className="flex items-center gap-1 rounded-full bg-black/40 border border-white/10 px-1 py-0.5">
                      {[
                        { label: '7D', value: '7d' as const },
                        { label: '30D', value: '30d' as const },
                        { label: '1Y', value: '365d' as const },
                        { label: 'Custom', value: 'custom' as const },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTf(option.value)}
                          className={`px-2 py-0.5 text-[10px] rounded-full transition ${
                            tf === option.value
                              ? 'bg-[#00C2CB] text-black font-semibold'
                              : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tf === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                        <span>From</span>
                        <input
                          type="date"
                          className="rounded-md bg-[#050505] border border-white/10 px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
                          value={range.from}
                          onChange={(e) =>
                            setRange((prev) => ({ ...prev, from: e.target.value }))
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                        <span>To</span>
                        <input
                          type="date"
                          className="rounded-md bg-[#050505] border border-white/10 px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
                          value={range.to}
                          onChange={(e) =>
                            setRange((prev) => ({ ...prev, to: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {chart.data.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-[#050505]/80 px-4 py-5">
                    <h3 className="text-sm font-semibold text-[#00C2CB] mb-1">
                      {chart.title.includes('Ad Spend')
                        ? 'No ad spend recorded yet'
                        : 'No conversions recorded yet'}
                    </h3>
                    <p className="text-xs text-white/60 mb-4">
                      {chart.title.includes('Ad Spend')
                        ? 'Once you start running campaigns, your daily spend will appear here.'
                        : 'As soon as your tracking fires, daily conversions will show up here.'}
                    </p>

                    <div className="rounded-lg bg-black/60 px-3 py-3">
                      <div className="flex items-end gap-2 h-10">
                        <div className="w-2.5 rounded-full bg-[#1f2933]" style={{ height: '25%' }} />
                        <div className="w-2.5 rounded-full bg-[#1f2933]" style={{ height: '45%' }} />
                        <div className="w-2.5 rounded-full bg-[#00C2CB]" style={{ height: '70%' }} />
                        <div className="w-2.5 rounded-full bg-[#1f2933]" style={{ height: '40%' }} />
                        <div className="w-2.5 rounded-full bg-[#00C2CB]" style={{ height: '85%' }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart
                      data={chart.data}
                      margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="rgba(148,163,184,0.14)"
                        strokeDasharray="2 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        padding={{ left: 10, right: 10 }}
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickMargin={8}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 'auto']}
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickMargin={8}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                        contentStyle={{
                          backgroundColor: '#020617',
                          border: '1px solid rgba(148,163,184,0.35)',
                          borderRadius: 10,
                          padding: '8px 10px',
                        }}
                        labelStyle={{ fontSize: 11, color: '#e5e7eb', marginBottom: 4 }}
                        itemStyle={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600 }}
                      />
                      <Bar
                        dataKey="value"
                        fill="#00C2CB"
                        radius={[7, 7, 0, 0]}
                        maxBarSize={28}
                        background={{ fill: 'rgba(15,23,42,0.9)' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          );
          })}
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-6 mt-8">
          {/* Active Campaigns */}
          <div className="w-full md:w-1/2 rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f0f0f] to-[#111] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <h2 className="text-lg font-semibold text-[#00C2CB] mb-4">Active Campaigns</h2>
            {activeCampaigns.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center text-white/70">
                No active campaigns yet.
              </div>
            ) : (
              <>
                {visibleCampaigns.map((offer) => (
                  <div
                    key={`${offer.id}-${offer.ideaId}`}
                    className="flex items-center justify-between bg-[#121212] border border-white/10 rounded-xl px-4 py-3 hover:bg-[#171717] transition mb-3"
                  >
                    <div className="flex flex-col">
                      <p className="text-white font-semibold">{offer.title}</p>
                      <div className="flex items-center">
                        <RocketLaunchIcon className="w-5 h-5 text-[#00C2CB] mr-2" />
                        <span className="truncate text-sm text-white/70">
                          Campaign: {offer.ideaId?.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/affiliate/dashboard/manage-campaigns/${offer.ideaId}`}
                      className="text-sm px-3 py-1 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]"
                    >
                      View
                    </Link>
                  </div>
                ))}
                {activeCampaigns.length > 1 && (
                  <button
                    onClick={() => setShowAllCampaigns((prev) => !prev)}
                    className="w-full text-center text-sm text-[#00C2CB] hover:text-[#00b0b8] mt-2"
                  >
                    {showAllCampaigns ? 'Show Less' : `View All (${activeCampaigns.length})`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Approved Offers */}
          <div className="w-full md:w-1/2 rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f0f0f] to-[#111] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <h2 className="text-lg font-semibold text-[#00C2CB] mb-4">Approved Offers</h2>
            {approvedOffers.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center text-white/70">
                You haven't been approved to promote any offers yet.
                <br />
                Head over to the{' '}
                <Link href="/affiliate/marketplace" className="underline">
                  Marketplace
                </Link>{' '}
                to request one!
              </div>
            ) : (
              <>
                {visibleOffers.map((offer) => (
                  <div
                    key={`${offer.id}-${offer.title}`}
                    className="flex items-center justify-between bg-[#121212] border border-white/10 rounded-xl px-4 py-3 hover:bg-[#171717] transition mb-3"
                  >
                    <div className="flex flex-col">
                      <p className="text-white font-semibold">{offer.title}</p>
                      <div className="flex items-center">
                        <RocketLaunchIcon className="w-5 h-5 text-[#00C2CB] mr-2" />
                        <span className="truncate text-sm text-white/70">
                          Commission: {offer.commission}% | Type: {offer.payoutType}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/affiliate/dashboard/promote/${offer.id}`}
                      className="text-sm px-3 py-1 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]"
                    >
                      Promote
                    </Link>
                  </div>
                ))}
                {approvedOffers.length > 1 && (
                  <button
                    onClick={() => setShowAllOffers((prev) => !prev)}
                    className="w-full text-center text-sm text-[#00C2CB] hover:text-[#00b0b8] mt-2"
                  >
                    {showAllOffers ? 'Show Less' : `View All (${approvedOffers.length})`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AffiliateDashboardContent;