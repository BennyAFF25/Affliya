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
import { ArrowUpRight } from 'lucide-react';
import { supabase } from 'utils/supabase/pages-client';
import Link from 'next/link';

interface Profile {
  id: string;
  role: string | null;
  email: string | null;
}

const CARD =
  'rounded-xl border border-[#262626] bg-[#121212] hover:ring-1 hover:ring-white/5 transition-shadow p-6';

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

  const [affiliateSeries, setAffiliateSeries] = useState<any[]>([]);
  const [salesSeries, setSalesSeries] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [liveOffersCount, setLiveOffersCount] = useState<number>(0);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

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

  const approved = approvedAffiliates;

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/');
      return;
    }

    const fetchProfileAndData = async () => {
      if (!user?.id) {
        console.warn('[❌ No user id available yet]');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, email')
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
        .select('id, title, commission')
        .eq('business_email', businessEmail);

      if (!offersError && offers) {
        setLiveOffersCount(offers.length);
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
        .select('id, created_at, status, business_email')
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

        setAffiliateSeries(affiliateSeriesData);
      } else {
        console.error('[❌ Failed to fetch affiliate requests for dashboard]', affiliateReqError);
      }

      // Fetch active campaigns
      const { data: activeCampaignsData, error: activeCampaignsError } =
        await supabase
          .from('ad_ideas')
          .select('*')
          .eq('business_email', businessEmail)
          .eq('status', 'approved');

      if (!activeCampaignsError && activeCampaignsData) {
        setActiveCampaigns(activeCampaignsData);
      } else {
        console.error('[❌ Failed to fetch active campaigns]', activeCampaignsError);
      }

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

          setSalesSeries(salesSeriesData);
          setTotalRevenue(Number(totalNet.toFixed(2)));
        } else {
          console.error(
            '[❌ Failed to fetch conversion events for dashboard]',
            convError
          );
        }
      } else {
        setSalesSeries([]);
        setTotalRevenue(0);
      }

      // Fetch pending payouts for this business
      if (user?.email) {
        await fetchPendingPayouts(user.email);
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
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0b0b0b] to-[#0e0e0e] text-white px-5 py-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-6 mt-2">
        <div className={`${CARD} ring-1 ring-[#00C2CB]/15`}>
          <p className="text-xs text-gray-400">Active Affiliates</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">{approved.length}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#00C2CB]/15 text-[#7ff5fb] border border-[#00C2CB]/25">
              Live
            </span>
          </div>
        </div>
        <div className={`${CARD} ring-1 ring-[#fbbf24]/15`}>
          <p className="text-xs text-gray-400">Pending Requests</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">
              {pendingRequests.length}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#fbbf24]/15 text-[#fde68a] border border-[#fbbf24]/25">
              Queue
            </span>
          </div>
        </div>
        <div className={`${CARD} ring-1 ring-[#10b981]/15`}>
          <p className="text-xs text-gray-400">Total Revenue</p>
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
          className={`${CARD} ring-1 ring-[#00C2CB]/20 cursor-pointer hover:ring-[#00C2CB]/40`}
          role="button"
          aria-label="View pending payouts"
        >
          <p className="text-xs text-gray-400">Pending Payouts</p>
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
        <div className={`${CARD} ring-1 ring-[#a78bfa]/15`}>
          <p className="text-xs text-gray-400">Live Offers</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">{liveOffersCount}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#a78bfa]/15 text-[#e9d5ff] border border-[#a78bfa]/25">
              Now
            </span>
          </div>
        </div>
      </div>

      {/* Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Affiliate Growth */}
        <div className={`${CARD}`}>
          <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-4">
            Affiliate Growth
          </h2>
          <div className="h-48 rounded-md text-gray-400">
            {affiliateSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No affiliate activity yet.
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
                    fill="#facc15"
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
          <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-4">
            Sales Performance
          </h2>
          <div className="h-48 rounded-md text-gray-400">
            {salesSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No sales recorded yet.
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
      <div className={`${CARD}`}>
        <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-2">
          Active Campaigns (0)
        </h2>
        <p className="text-sm text-gray-400">No active campaigns yet.</p>
      </div>

      {/* Affiliate Activity and Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className={`${CARD}`}>
          <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-2">
            Affiliate Activity
          </h2>
          <p className="text-sm text-gray-400">No recent affiliate activity.</p>
        </div>
        <div className={`${CARD}`}>
          <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-2">
            Transaction History
          </h2>
          <p className="text-sm text-gray-400">No recent transactions.</p>
        </div>
      </div>
    </div>
  );
}