'use client';

import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  ArrowUpRight,
  Users,
  Wallet,
  LineChart as LineChartIcon,
  Sparkles,
  PlayCircle,
  Receipt,
  ChevronRight,
  X,
} from 'lucide-react';
import { supabase } from 'utils/supabase/pages-client';

interface Profile {
  id: string;
  role: string | null;
  email: string | null;
  revenue_subscription_status?: string | null;
  revenue_current_period_end?: string | null;
}

type Timeframe = '7d' | '30d' | '1y' | 'all';

const CARD =
  'rounded-xl border border-[#262626] bg-[#121212] hover:ring-1 hover:ring-white/5 transition-shadow p-4 sm:p-6';

const formatShortDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
  });
};

const formatCurrency = (val: number) => {
  if (!val || Number.isNaN(val)) return '$0.00';
  return '$' + val.toFixed(2);
};

const filterSeriesByRange = (series: any[], range: Timeframe) => {
  if (!series || series.length === 0 || range === 'all') return series;

  const now = new Date();
  const from = new Date(now);

  if (range === '7d') {
    from.setDate(now.getDate() - 7);
  } else if (range === '30d') {
    from.setDate(now.getDate() - 30);
  } else if (range === '1y') {
    from.setFullYear(now.getFullYear() - 1);
  }

  return series.filter((point: any) => {
    if (!point?.name) return false;
    const d = new Date(point.name);
    if (Number.isNaN(d.getTime())) return false;
    return d >= from && d <= now;
  });
};

// Tooltip for Affiliate Growth
function AffiliateTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const req = payload.find((p: any) => p.dataKey === 'requested');
  const app = payload.find((p: any) => p.dataKey === 'approved');

  return (
    <div className="rounded-lg border border-[#262626] bg-black/90 px-3 py-2 text-xs text-gray-100 shadow-lg">
      <div className="mb-1 font-medium text-[#7ff5fb]">{formatShortDate(label)}</div>
      <div>Requests: {req?.value ?? 0}</div>
      <div>Approved: {app?.value ?? 0}</div>
    </div>
  );
}

// Tooltip for Sales Performance
function SalesTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0];

  return (
    <div className="rounded-lg border border-[#262626] bg-black/90 px-3 py-2 text-xs text-gray-100 shadow-lg">
      <div className="mb-1 font-medium text-[#7ff5fb]">{formatShortDate(label)}</div>
      <div>Net revenue: {formatCurrency(Number(point.value || 0))}</div>
    </div>
  );
}

export default function BusinessDashboard() {
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const [approvedAffiliates, setApprovedAffiliates] = useState<any[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingPayoutCount, setPendingPayoutCount] = useState<number>(0);
  const [pendingPayoutTotal, setPendingPayoutTotal] = useState<number>(0);

  const [affiliateSeriesRaw, setAffiliateSeriesRaw] = useState<any[]>([]);
  const [salesSeriesRaw, setSalesSeriesRaw] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);

  const [affiliateRange, setAffiliateRange] = useState<Timeframe>('30d');
  const [salesRange, setSalesRange] = useState<Timeframe>('30d');

  const affiliateSeries = filterSeriesByRange(affiliateSeriesRaw, affiliateRange);
  const salesSeries = filterSeriesByRange(salesSeriesRaw, salesRange);
  const [liveOffersCount, setLiveOffersCount] = useState<number>(0);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const [offerLookup, setOfferLookup] = useState<Record<string, string>>({});
  const [offerPayoutMeta, setOfferPayoutMeta] = useState<
    Record<
      string,
      {
        payout_mode: string | null;
        payout_interval: string | null;
        payout_cycles: number | null;
      }
    >
  >({});
  const [recentAffiliateEvents, setRecentAffiliateEvents] = useState<any[]>([]);
  const [completedPayouts, setCompletedPayouts] = useState<any[]>([]);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [showAllAffiliateActivity, setShowAllAffiliateActivity] = useState(false);


  // simple dynamic goal line for sales
  const salesGoal =
    salesSeries.length > 0
      ? Math.max(...salesSeries.map((d: any) => Number(d.value || 0))) * 1.2
      : 0;

  // Fetch pending payouts (shared by initial load + realtime updates)
  const fetchPendingPayouts = async (bizEmail: string) => {
    const { data: payoutsData, error: payoutsError } = await supabase
      .from('wallet_payouts')
      .select('amount')
      .eq('business_email', bizEmail)
      .eq('status', 'pending');

    if (!payoutsError && payoutsData) {
      setPendingPayoutCount(payoutsData.length);
      const total = payoutsData.reduce(
        (sum: number, row: any) => sum + Number(row.amount || 0),
        0
      );
      setPendingPayoutTotal(total);
    } else {
      console.error('[❌ Failed to fetch pending payouts]', payoutsError);
    }
  };

  // Fetch last few completed payouts for transaction history
  const fetchCompletedPayouts = async (bizEmail: string) => {
    const { data, error } = await supabase
      .from('wallet_payouts')
      .select(
        'id, affiliate_email, amount, status, created_at, stripe_transfer_id, offer_id, is_recurring, cycle_number'
      )
      .eq('business_email', bizEmail)
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setCompletedPayouts(data);
    } else {
      console.error('[❌ Failed to fetch completed payouts]', error);
    }
  };

  const approved = approvedAffiliates;

  useEffect(() => {
    // Wait until we actually have a session and user id before loading data
    if (!session || !user?.id) {
      return;
    }

    const fetchProfileAndData = async () => {

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, email, revenue_subscription_status, revenue_current_period_end')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        router.push('/create-account?role=business');
        return;
      }

      if ((profileData as Profile).role !== 'business') {
        router.push('/affiliate/dashboard');
        return;
      }

      setProfile(profileData as Profile);


      const businessEmail = user?.email || '';

      // Fetch offers
      const { data: offers, error: offersError } = await supabase
        .from('offers')
        .select('id, title, commission, payout_mode, payout_interval, payout_cycles')
        .eq('business_email', businessEmail);

      if (!offersError && offers) {
        setLiveOffersCount(offers.length);
        const lookup: Record<string, string> = {};
        const payoutMeta: Record<
          string,
          {
            payout_mode: string | null;
            payout_interval: string | null;
            payout_cycles: number | null;
          }
        > = {};
        offers.forEach((o: any) => {
          lookup[o.id] = o.title ?? null;
          payoutMeta[o.id] = {
            payout_mode: o.payout_mode ?? null,
            payout_interval: o.payout_interval ?? null,
            payout_cycles:
              typeof o.payout_cycles === 'number' ? o.payout_cycles : o.payout_cycles ?? null,
          };
        });
        setOfferLookup(lookup);
        setOfferPayoutMeta(payoutMeta);
      } else {
        console.error('[❌ Failed to fetch offers for dashboard]', offersError);
      }

      const offerIds = (offers || []).map((o: any) => o.id);
      const commissionByOffer: Record<string, number> = {};
      (offers || []).forEach((o: any) => {
        commissionByOffer[o.id] = Number(o.commission || 0);
      });

      // Fetch affiliate requests for this business
      const { data: affiliateReqData, error: affiliateReqError } = await supabase
        .from('affiliate_requests')
        .select('id, created_at, status, business_email, affiliate_email, offer_id')
        .eq('business_email', businessEmail);

      if (!affiliateReqError && affiliateReqData) {
        const approvedForBiz = affiliateReqData.filter(
          (r: any) => r.status === 'approved'
        );
        const pendingForBiz = affiliateReqData.filter(
          (r: any) => r.status === 'pending'
        );
        setApprovedAffiliates(approvedForBiz);
        setPendingRequests(pendingForBiz);

        // Build affiliate growth series: requests vs approved per day
        const countsByDate: Record<
          string,
          { requested: number; approved: number }
        > = {};

        affiliateReqData.forEach((r: any) => {
          const date = new Date(r.created_at);
          const key = date.toISOString().slice(0, 10); // YYYY-MM-DD

          if (!countsByDate[key]) {
            countsByDate[key] = { requested: 0, approved: 0 };
          }
          countsByDate[key].requested += 1;
          if (r.status === 'approved') {
            countsByDate[key].approved += 1;
          }
        });

        const affiliateSeriesData = Object.entries(countsByDate)
          .sort(([a], [b]) => (a as string).localeCompare(b as string))
          .slice(-20)
          .map(([date, counts]) => ({
            name: date,
            requested: (counts as any).requested,
            approved: (counts as any).approved,
          }));

        setAffiliateSeriesRaw(affiliateSeriesData);

        // Recent affiliate events list
        const recent = affiliateReqData
          .slice()
          .sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          .slice(0, 6);
        setRecentAffiliateEvents(recent);
      } else {
        console.error('[❌ Failed to fetch affiliate requests for dashboard]', affiliateReqError);
      }

      // Fetch active campaigns from both paid ads (live_ads) and organic (live_campaigns) with offers join
      const [liveAdsResult, liveCampaignsResult] = await Promise.all([
        supabase
          .from('live_ads')
          .select(`
            id,
            offer_id,
            affiliate_email,
            business_email,
            status,
            created_at,
            spend,
            campaign_type,
            offers (
              id,
              title
            )
          `)
          .eq('business_email', businessEmail),
        supabase
          .from('live_campaigns')
          .select(`
            id,
            offer_id,
            affiliate_email,
            business_email,
            status,
            created_at,
            platform,
            type,
            offers (
              id,
              title
            )
          `)
          .eq('business_email', businessEmail),
      ]);

      const liveAds = !liveAdsResult.error && liveAdsResult.data ? liveAdsResult.data : [];
      const liveOrganic =
        !liveCampaignsResult.error && liveCampaignsResult.data
          ? liveCampaignsResult.data
          : [];

      if (liveAdsResult.error) {
        console.error('[❌ Failed to fetch active campaigns from live_ads]', liveAdsResult.error);
      }
      if (liveCampaignsResult.error) {
        console.error(
          '[❌ Failed to fetch active campaigns from live_campaigns]',
          liveCampaignsResult.error
        );
      }

      console.log('[📊 live_ads rows]', liveAds);
      console.log('[📊 live_campaigns rows]', liveOrganic);

      // Normalize both paid and organic campaigns into a consistent shape
      const normalizedCampaigns = [...liveAds, ...liveOrganic].map((c: any) => ({
        ...c,
        __source: c.campaign_type ? 'paid' : 'organic',
        resolved_offer_title: c.offers?.title ?? null,
      }));

      setActiveCampaigns(normalizedCampaigns);

      // Fetch conversion events and build sales series and total revenue
      if (offerIds.length > 0) {
        const { data: convData, error: convError } = await supabase
          .from('campaign_tracking_events')
          .select('created_at, amount, offer_id')
          .eq('event_type', 'conversion')
          .in('offer_id', offerIds);

        if (!convError && convData) {
          const revenueByDate: Record<string, number> = {};
          let totalNet = 0;

          convData.forEach((ev: any) => {
            const date = new Date(ev.created_at);
            const key = date.toISOString().slice(0, 10);
            const gross = Number(ev.amount || 0);
            const pct = commissionByOffer[ev.offer_id] ?? 0;
            const net = gross * (1 - pct / 100);
            totalNet += net;
            revenueByDate[key] = (revenueByDate[key] || 0) + net;
          });

          const salesSeriesData = Object.entries(revenueByDate)
            .sort(([a], [b]) => (a as string).localeCompare(b as string))
            .slice(-20)
            .map(([date, value]) => ({
              name: date,
              value: Number((value as number).toFixed(2)),
            }));

          setSalesSeriesRaw(salesSeriesData);
          setTotalRevenue(Number(totalNet.toFixed(2)));
        } else {
          console.error(
            '[❌ Failed to fetch conversion events for dashboard]',
            convError
          );
        }
      } else {
        setSalesSeriesRaw([]);
        setTotalRevenue(0);
      }

      // Fetch payout data for this business
      if (user?.email) {
        await fetchPendingPayouts(user.email);
        await fetchCompletedPayouts(user.email);
      }
    };

    fetchProfileAndData();

    // Realtime updates for wallet_payouts affecting this business
    if (session && user?.email) {
      const channel = supabase
        .channel(`payouts-feed-${user.email}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallet_payouts',
            filter: `business_email=eq.${user.email}`,
          },
          () => {
            fetchPendingPayouts(user.email!);
            fetchCompletedPayouts(user.email!);
          }
        )
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      };
    }
  }, [session, router, user]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0b0b0b] to-[#0e0e0e] text-white px-4 py-4 sm:px-5 sm:py-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 mt-2">
        <div className={`${CARD} ring-1 ring-[#00C2CB]/20 shadow-[0_0_30px_rgba(0,194,203,0.12)] relative overflow-hidden`}
        >
          <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#00C2CB]/10 blur-xl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Users className="h-3 w-3 text-[#7ff5fb]" />
                Active Affiliates
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <h2 className="text-2xl font-semibold text-white">{approved.length}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#00C2CB]/15 text-[#7ff5fb] border border-[#00C2CB]/25">
                  Live
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={`${CARD} ring-1 ring-[#fbbf24]/25 relative overflow-hidden`}>
          <div className="absolute -right-4 -top-8 h-16 w-16 rounded-full bg-[#facc15]/10 blur-xl" />
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[#fde68a]" />
            Pending Requests
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">{pendingRequests.length}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#fbbf24]/15 text-[#fde68a] border border-[#fbbf24]/25">
              Queue
            </span>
          </div>
        </div>

        <div className={`${CARD} ring-1 ring-[#10b981]/20 relative overflow-hidden`}>
          <div className="absolute -right-6 -bottom-8 h-16 w-16 rounded-full bg-[#10b981]/15 blur-xl" />
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <LineChartIcon className="h-3 w-3 text-[#bbf7d0]" />
            Total Revenue
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">
              {formatCurrency(totalRevenue)}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#bbf7d0] border border-[#10b981]/25">
              MTD
            </span>
          </div>
        </div>

        <div
          onClick={() => router.push('/business/payouts')}
          className={`${CARD} ring-1 ring-[#00C2CB]/25 cursor-pointer hover:ring-[#00C2CB]/60 hover:shadow-[0_0_40px_rgba(0,194,203,0.25)] relative overflow-hidden`}
          role="button"
          aria-label="View pending payouts"
        >
          <div className="absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-[#00C2CB]/10 blur-xl" />
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Wallet className="h-3 w-3 text-[#7ff5fb]" />
            Pending Payouts
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {formatCurrency(pendingPayoutTotal)}
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#00C2CB]/15 text-[#7ff5fb] border border-[#00C2CB]/25">
                {pendingPayoutCount} awaiting
              </span>
            </div>
            <ArrowUpRight className="w-5 h-5 text-[#7ff5fb]" />
          </div>
        </div>

        <div className={`${CARD} ring-1 ring-[#a78bfa]/20 relative overflow-hidden`}>
          <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#a78bfa]/15 blur-xl" />
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <PlayCircle className="h-3 w-3 text-[#e9d5ff]" />
            Live Offers
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">{liveOffersCount}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#a78bfa]/15 text-[#e9d5ff] border border-[#a78bfa]/25">
              Now
            </span>
          </div>
        </div>
      </div>

      {/* Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
        {/* Affiliate Growth */}
        <div className={`${CARD}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb]">
              Affiliate Growth
            </h2>
            <div className="flex items-center gap-1 rounded-full bg-black/40 px-1 py-0.5">
              {(['7d', '30d', '1y', 'all'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setAffiliateRange(tf)}
                  className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                    affiliateRange === tf
                      ? 'bg-[#00C2CB]/20 text-[#7ff5fb]'
                      : 'text-gray-400 hover:text-gray-100'
                  }`}
                >
                  {tf === '7d' ? '7D' : tf === '30d' ? '30D' : tf === '1y' ? '1Y' : 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64 sm:h-52 rounded-md text-gray-400">
            {affiliateSeries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm">
                <div className="rounded-xl border border-dashed border-slate-800/80 bg-[#111827] px-4 py-3 max-w-sm w-full">
                  <div className="text-xs font-medium text-[#7ff5fb] mb-1">
                    No affiliate activity yet
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Once affiliates start requesting and you approve them, this chart will
                    show daily requests vs approvals.
                  </p>
                  <div className="mt-3 h-16 w-full rounded-md bg-black/70 flex items-end gap-2 px-2 pb-1">
                    {/* Requests (teal) */}
                    <div className="flex-1 flex items-end gap-1">
                      <div className="h-3 w-1.5 rounded-full bg-slate-700/70" />
                      <div className="h-5 w-1.5 rounded-full bg-[#22d3ee]/80" />
                      <div className="h-2 w-1.5 rounded-full bg-slate-800/70" />
                      <div className="h-4 w-1.5 rounded-full bg-[#22d3ee]/80" />
                    </div>
                    {/* Approved (green) */}
                    <div className="flex-1 flex items-end gap-1">
                      <div className="h-2 w-1.5 rounded-full bg-slate-800/70" />
                      <div className="h-4 w-1.5 rounded-full bg-[#22c55e]/80" />
                      <div className="h-3 w-1.5 rounded-full bg-slate-800/70" />
                      <div className="h-6 w-1.5 rounded-full bg-[#22c55e]/80" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={affiliateSeries}
                  margin={{ top: 12, right: 8, left: -10, bottom: 0 }}
                  barCategoryGap={18}
                >
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.18)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    width={30}
                  />
                  <Tooltip content={<AffiliateTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10, color: '#9ca3af' }}
                  />
                  <Bar
                    dataKey="requested"
                    name="Requests"
                    fill="#22d3ee"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey="approved"
                    name="Approved"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sales Performance */}
        <div className={`${CARD}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb]">
              Sales Performance
            </h2>
            <div className="flex items-center gap-1 rounded-full bg-black/40 px-1 py-0.5">
              {(['7d', '30d', '1y', 'all'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setSalesRange(tf)}
                  className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                    salesRange === tf
                      ? 'bg-[#00C2CB]/20 text-[#7ff5fb]'
                      : 'text-gray-400 hover:text-gray-100'
                  }`}
                >
                  {tf === '7d' ? '7D' : tf === '30d' ? '30D' : tf === '1y' ? '1Y' : 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64 sm:h-52 rounded-md text-gray-400">
            {salesSeries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm">
                <div className="rounded-xl border border-dashed border-slate-800/80 bg-[#111827] px-4 py-3 max-w-sm w-full">
                  <div className="text-xs font-medium text-[#7ff5fb] mb-1">
                    No sales recorded yet
                  </div>
                  <p className="text-[11px] text-gray-400">
                    As soon as your first conversion comes through, this area will light up
                    with daily revenue and trend lines.
                  </p>
                  <div className="mt-3 h-16 w-full rounded-md bg-black/70 flex items-end gap-1 px-2 pb-1">
                    <div className="h-3 w-1.5 rounded-full bg-slate-700/70" />
                    <div className="h-4 w-1.5 rounded-full bg-[#00C2CB]/70" />
                    <div className="h-2 w-1.5 rounded-full bg-slate-800/70" />
                    <div className="h-5 w-1.5 rounded-full bg-[#00C2CB]/70" />
                    <div className="h-3 w-1.5 rounded-full bg-slate-800/70" />
                    <div className="h-6 w-1.5 rounded-full bg-slate-700/70" />
                  </div>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={salesSeries}
                  margin={{ top: 12, right: 16, left: -4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.18)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                  />
                  <YAxis
                    tickFormatter={(v) => '$' + v}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    width={40}
                  />
                  <Tooltip content={<SalesTooltip />} />
                  {salesGoal > 0 && (
                    <ReferenceLine
                      y={salesGoal}
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                    dot={{ r: 3, strokeWidth: 1 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Active Campaigns Section */}
      <div className={`${CARD} mt-2`}>
        <button
          type="button"
          onClick={() => setShowAllCampaigns((prev) => !prev)}
          className="flex w-full items-center justify-between mb-2 text-left"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/40">
              <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] flex items-center gap-2">
                <span>Active Campaigns ({activeCampaigns.length})</span>
              </h2>
              {activeCampaigns.length > 0 && (
                <p className="text-[11px] text-gray-500">
                  Showing {showAllCampaigns ? 'all campaigns' : 'most recent campaign'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeCampaigns.length > 1 && !showAllCampaigns && (
              <span className="text-[11px] text-gray-400">
                + {activeCampaigns.length - 1} more
              </span>
            )}
            {activeCampaigns.length > 0 && (
              <ChevronRight
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                  showAllCampaigns ? 'rotate-90' : 'rotate-0'
                }`}
              />
            )}
          </div>
        </button>

        {activeCampaigns.length === 0 ? (
          <p className="text-sm text-gray-400">No active campaigns yet.</p>
        ) : (
          <div className="mt-1 space-y-2 text-sm text-gray-200">
            {(
              showAllCampaigns
                ? activeCampaigns
                : activeCampaigns
                    .slice()
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .slice(0, 1)
            ).map((c: any) => {
              const title = c.resolved_offer_title ?? undefined;
              const status = (c.status || 'scheduled') as string;
              const typeLabel = c.campaign_type || c.type || c.platform || 'Campaign';

              const statusColor =
                status === 'active' || status === 'live'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : status === 'paused'
                  ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                  : 'text-sky-300 bg-sky-500/10 border-sky-500/30';

              const spend = typeof c.spend === 'number' ? Number(c.spend) : 0;
              const spendRatio = Math.max(0.12, Math.min(spend / 100, 1));

              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-[#262626] bg-black/40 px-3 py-2 hover:border-[#00C2CB]/40 hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                      <div className="font-medium text-white truncate">
                        {title || '⚠️ Offer not resolved'}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400 flex flex-wrap items-center gap-2 pl-4">
                      <span>{c.affiliate_email || 'Affiliate'}</span>
                      <span className="h-1 w-1 rounded-full bg-gray-500" />
                      <span>Started {formatShortDate(c.created_at)}</span>
                      <span className="h-1 w-1 rounded-full bg-gray-500" />
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-sky-300 border-sky-500/40 bg-sky-500/10">
                        {typeLabel}
                      </span>
                    </div>
                    {spend > 0 && (
                      <div className="mt-2 pl-4 pr-4">
                        <div className="h-1.5 rounded-full bg-[#111827] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#0ea5e9]"
                            style={{ width: `${spendRatio * 100}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                          Spend {formatCurrency(spend)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <div
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusColor}`}
                    >
                      {status}
                    </div>
                  </div>
                </div>
              );
            })}

            {activeCampaigns.length > 0 && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => router.push('/business/manage-campaigns')}
                  className="inline-flex items-center gap-1 text-[11px] text-gray-300 hover:text-[#7ff5fb] px-2 py-1 rounded-full bg-white/5 border border-white/5"
                >
                  Manage campaigns
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Affiliate Activity and Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
        <div className={`${CARD}`}>
          <button
            type="button"
            onClick={() => setShowAllAffiliateActivity((prev) => !prev)}
            className="flex w-full items-center justify-between mb-2 text-left"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#7ff5fb]" />
              <div>
                <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb]">
                  Affiliate Activity
                </h2>
                {recentAffiliateEvents.length > 0 && (
                  <p className="text-[11px] text-gray-500">
                    {showAllAffiliateActivity
                      ? `Showing all ${recentAffiliateEvents.length} events`
                      : `Showing 1 of ${recentAffiliateEvents.length}`}
                  </p>
                )}
              </div>
            </div>
            {recentAffiliateEvents.length > 0 && (
              <div className="flex items-center gap-2">
                {recentAffiliateEvents.length > 1 && !showAllAffiliateActivity && (
                  <span className="text-[11px] text-gray-400">
                    + {recentAffiliateEvents.length - 1} more
                  </span>
                )}
                <ChevronRight
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                    showAllAffiliateActivity ? 'rotate-90' : 'rotate-0'
                  }`}
                />
              </div>
            )}
          </button>
          {recentAffiliateEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No recent affiliate activity.</p>
          ) : (
            <div className="mt-1 text-sm">
              <div className="relative border-l border-[#262626] pl-5 space-y-3">
                {(showAllAffiliateActivity
                  ? recentAffiliateEvents
                  : recentAffiliateEvents.slice(0, 1)
                ).map((ev: any) => {
                  const title = ev.offer_id ? offerLookup[ev.offer_id] : null;
                  const statusColor =
                    ev.status === 'approved'
                      ? 'text-emerald-400'
                      : ev.status === 'rejected'
                      ? 'text-rose-400'
                      : 'text-amber-300';
                  return (
                    <div key={ev.id} className="relative pl-3">
                      <div className="absolute -left-3 top-4 h-3 w-3 rounded-full border border-[#00C2CB] bg-[#050608]" />
                      <div className="text-xs text-gray-400">
                        {formatShortDate(ev.created_at)}
                      </div>
                      <div className="font-medium text-white">
                        {ev.affiliate_email || 'Affiliate'}
                      </div>
                      {title && (
                        <div className="text-xs text-gray-400">Offer: {title}</div>
                      )}
                      <div className={`text-[11px] mt-0.5 ${statusColor}`}>{ev.status}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className={`${CARD}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#7ff5fb]" />
              <span>Transaction History</span>
            </h2>
            {completedPayouts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTransactionsModal(true)}
                className="text-[11px] text-gray-300 hover:text-[#7ff5fb] inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/5"
              >
                View all
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
          {completedPayouts.length === 0 ? (
            <p className="text-sm text-gray-400">No recent transactions.</p>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              {completedPayouts.slice(0, 5).map((p: any) => {
                const title = p.offer_id ? offerLookup[p.offer_id] : null;
                const meta = p.offer_id ? offerPayoutMeta[p.offer_id] : undefined;
                const isRecurring = !!p.is_recurring;
                const cyclesTotal =
                  meta && typeof meta.payout_cycles === 'number'
                    ? meta.payout_cycles
                    : null;

                let detailLine = '';
                if (title) {
                  if (isRecurring && p.cycle_number != null && cyclesTotal) {
                    detailLine = `${title} · Cycle ${p.cycle_number}/${cyclesTotal}${
                      meta?.payout_interval ? ` · ${meta.payout_interval}` : ''
                    }`;
                  } else if (meta?.payout_mode === 'spread') {
                    detailLine = `${title} · Spread payout`;
                  } else {
                    detailLine = `${title} · One-off payout`;
                  }
                }

                const statusBadgeClass =
                  p.status === 'paid'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : p.status === 'failed'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                    : 'border-slate-500/40 bg-slate-500/10 text-slate-300';

                return (
                  <div
                    key={p.id}
                    className="flex items-start justify-between rounded-lg border border-[#262626] bg-black/40 px-3 py-2 hover:border-[#00C2CB]/50 hover:shadow-[0_0_25px_rgba(0,194,203,0.25)] hover:bg-black/60 transition-all"
                  >
                    <div className="flex gap-3">
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#050810] border border-[#1f2937]">
                        <Wallet className="w-4 h-4 text-[#7ff5fb]" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">
                          {formatShortDate(p.created_at)}
                        </div>
                        <div className="font-medium text-white">
                          {formatCurrency(Number(p.amount || 0))}
                        </div>
                        <div className="text-xs text-gray-400">
                          To {p.affiliate_email || 'affiliate'}
                        </div>
                        {detailLine && (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {detailLine}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs mt-1 flex flex-col items-end gap-1">
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border ${statusBadgeClass}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        <span className="uppercase tracking-wide">{p.status}</span>
                      </div>
                      {p.stripe_transfer_id && (
                        <div className="text-[10px] text-gray-500">
                          {p.stripe_transfer_id}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showTransactionsModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#262626] bg-[#050608] p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#7ff5fb] flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <span>All transactions</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTransactionsModal(false)}
                className="rounded-full p-1 hover:bg-white/5 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {completedPayouts.length === 0 ? (
              <p className="text-sm text-gray-400">No transactions yet.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 text-sm">
                {completedPayouts.map((p: any) => {
                  const title = p.offer_id ? offerLookup[p.offer_id] : null;
                  const meta = p.offer_id ? offerPayoutMeta[p.offer_id] : undefined;
                  const isRecurring = !!p.is_recurring;
                  const cyclesTotal =
                    meta && typeof meta.payout_cycles === 'number'
                      ? meta.payout_cycles
                      : null;

                  let detailLine = '';
                  if (title) {
                    if (isRecurring && p.cycle_number != null && cyclesTotal) {
                      detailLine = `${title} · Cycle ${p.cycle_number}/${cyclesTotal}${
                        meta?.payout_interval ? ` · ${meta.payout_interval}` : ''
                      }`;
                    } else if (meta?.payout_mode === 'spread') {
                      detailLine = `${title} · Spread payout`;
                    } else {
                      detailLine = `${title} · One-off payout`;
                    }
                  }

                  const statusBadgeClass =
                    p.status === 'paid'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : p.status === 'failed'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                      : 'border-slate-500/40 bg-slate-500/10 text-slate-300';

                  return (
                    <div
                      key={p.id}
                      className="flex items-start justify-between rounded-lg border border-[#262626] bg-black/40 px-3 py-2"
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#050810] border border-[#1f2937]">
                          <Wallet className="w-3.5 h-3.5 text-[#7ff5fb]" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">
                            {formatShortDate(p.created_at)}
                          </div>
                          <div className="font-medium text-white">
                            {formatCurrency(Number(p.amount || 0))}
                          </div>
                          <div className="text-xs text-gray-400">
                            To {p.affiliate_email || 'affiliate'}
                          </div>
                          {detailLine && (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {detailLine}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs mt-1 flex flex-col items-end gap-1">
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border ${statusBadgeClass}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          <span className="uppercase tracking-wide">{p.status}</span>
                        </div>
                        {p.stripe_transfer_id && (
                          <div className="text-[10px] text-gray-500">
                            {p.stripe_transfer_id}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}