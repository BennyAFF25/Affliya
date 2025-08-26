'use client';

import { useSessionContext } from '@supabase/auth-helpers-react';
import { RocketLaunchIcon } from '@heroicons/react/24/outline';

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

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import Link from 'next/link';
import { TrendingUp, DollarSign, Wallet, CheckCircle } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Offer {
  id: string;
  title: string;
  description: string;
  commission: number;
  type: string;
  payoutType: string;
  ideaId?: string; // optional idea ID for active campaign tracking
}

const spendData = [
  { name: 'Day 1', value: 50 },
  { name: 'Day 5', value: 90 },
  { name: 'Day 10', value: 70 },
  { name: 'Day 15', value: 130 },
  { name: 'Day 20', value: 110 },
  { name: 'Day 25', value: 160 },
  { name: 'Day 30', value: 140 },
];

const conversionData = [
  { name: 'Day 1', value: 3 },
  { name: 'Day 5', value: 5 },
  { name: 'Day 10', value: 8 },
  { name: 'Day 15', value: 6 },
  { name: 'Day 20', value: 9 },
  { name: 'Day 25', value: 11 },
  { name: 'Day 30', value: 13 },
];

function AffiliateDashboardContent() {
  const { session, isLoading } = useSessionContext();
  const router = useRouter();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [adIdeas, setAdIdeas] = useState<any[]>([]);
  // New state for loading and profile
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (isLoading) return;
    if (session === null) {
      console.warn('[🔁 Session null — showing landing instead of redirect]');
      setLoading(false);
      return;
    }
  }, [session, isLoading]);

  // New useEffect for profile check
  useEffect(() => {
    const checkProfile = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      // Query the profiles table for this user
      const { data, error } = await supabase
        .from('profiles')
        .select('id, active_role')
        .eq('id', session.user.id)
        .single();
      if (error || !data || !data.active_role) {
        router.push('/create-account');
        return;
      }
      setProfile(data);
      setLoading(false);
    };
    if (session?.user) {
      setLoading(true);
      checkProfile();
    }
  }, [session, router]);

  useEffect(() => {
    if (!session || !session.user) return;

    const loadInitialData = async () => {
      // Fetch live offers from Supabase
      const { data: liveOffers, error: offerError } = await supabase
        .from('offers')
        .select('*');

      if (offerError) {
        console.error('[❌ Failed to fetch offers]', offerError);
        setOffers([]);
      } else {
        setOffers(liveOffers || []);
      }

      const { data: approved, error: approvedError } = await supabase
        .from('affiliate_requests')
        .select('offer_id')
        .eq('affiliate_email', session.user.email)
        .eq('status', 'approved');

      if (approvedError) {
        console.error('[❌ Failed to fetch approved requests]', approvedError);
      } else {
        const ids = Array.from(new Set(approved.map((r) => r.offer_id)));
        setApprovedIds(ids);
        console.log('[✅ Approved IDs]', ids);
      }

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
        .eq('affiliate_email', session.user.email)
        .eq('status', 'approved');

      if (ideasError) {
        console.error('[❌ Failed to fetch ad ideas]', ideasError);
        setAdIdeas([]);
      } else {
        setAdIdeas(ideas);
      }
    };

    loadInitialData();
  }, [session]);

  useEffect(() => {
    if (session?.user && approvedIds.length === 0) {
      console.warn('[⚠️ No approved offers — user still stays on dashboard]');
    }
  }, [session, approvedIds]);

  const user = session?.user;

  const approvedOffers = offers.filter((offer) => approvedIds.includes(offer.id));
  const activeOffers = adIdeas.map((idea) => {
    const matchedOffer = offers.find((offer) => offer.id === idea.offer_id);
    return matchedOffer ? { ...matchedOffer, ideaId: idea.id } : null;
  }).filter(Boolean) as Offer[];

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }
  if (!user) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
              <div className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-0.5">
                <div className="pointer-events-none absolute -inset-16 opacity-0 group-hover:opacity-100 transition-opacity"><div className="h-full w-full bg-[radial-gradient(80%_60%_at_30%_20%,#00C2CB33,transparent_60%)]" /></div>
                <div className="flex items-center gap-4">
                  <div className="text-[#7ff5fb] bg-[#00C2CB1a] rounded-lg p-2.5">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Active Campaigns</p>
                    <h2 className="text-3xl font-bold text-white">{approvedOffers.length}</h2>
                  </div>
                </div>
              </div>

              <div className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-0.5">
                <div className="pointer-events-none absolute -inset-16 opacity-0 group-hover:opacity-100 transition-opacity"><div className="h-full w-full bg-[radial-gradient(80%_60%_at_30%_20%,#00C2CB33,transparent_60%)]" /></div>
                <div className="flex items-center gap-4">
                  <div className="text-[#7ff5fb] bg-[#00C2CB1a] rounded-lg p-2.5">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Total Spent</p>
                    <h2 className="text-3xl font-bold text-white">$640</h2>
                  </div>
                </div>
              </div>

              <div className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-0.5">
                <div className="pointer-events-none absolute -inset-16 opacity-0 group-hover:opacity-100 transition-opacity"><div className="h-full w-full bg-[radial-gradient(80%_60%_at_30%_20%,#00C2CB33,transparent_60%)]" /></div>
                <div className="flex items-center gap-4">
                  <div className="text-[#7ff5fb] bg-[#00C2CB1a] rounded-lg p-2.5">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Pending Payout</p>
                    <h2 className="text-3xl font-bold text-white">$280</h2>
                  </div>
                </div>
              </div>

              <div className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-0.5">
                <div className="pointer-events-none absolute -inset-16 opacity-0 group-hover:opacity-100 transition-opacity"><div className="h-full w-full bg-[radial-gradient(80%_60%_at_30%_20%,#00C2CB33,transparent_60%)]" /></div>
                <div className="flex items-center gap-4">
                  <div className="text-teal-400 bg-teal-700/10 rounded-lg p-2.5">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Approved Offers</p>
                    <h2 className="text-3xl font-bold text-white">{approvedOffers.length}</h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Updated Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              {[{ title: 'Ad Spend (Last 30 Days)', data: spendData }, { title: 'Conversions (Last 30 Days)', data: conversionData }].map((chart, i) => (
                <div key={i} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.35)]">
                  <div className="absolute -inset-3 rounded-2xl blur-2xl bg-[#00C2CB0d]" />
                  <div className="relative">
                    <h2 className="text-sm font-semibold text-white/70 mb-2">{chart.title}</h2>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={chart.data}>
                        <defs>
                          <linearGradient id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00C2CB" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#00C2CB" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="name"
                          padding={{ left: 20, right: 20 }}
                          tick={{ fill: '#555', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={['dataMin - 5', 'auto']}
                          tick={{ fill: '#555', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #ddd' }}
                          labelStyle={{ fontWeight: 600 }}
                          itemStyle={{ color: '#00C2CB' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#00C2CB"
                          fillOpacity={1}
                          fill={`url(#color${i})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-6 mt-8">
              {/* Active Campaigns */}
              <div className="w-full md:w-1/2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.35)]">
                <h2 className="text-lg font-semibold text-white mb-4">Active Campaigns</h2>
                {activeOffers.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center text-white/70">
                    No active campaigns yet.
                  </div>
                ) : (
                  activeOffers.map((offer) => (
                    <div
                      key={`${offer.id}-${offer.ideaId}`}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 mb-3"
                    >
                      <div className="flex flex-col">
                        <p className="text-white font-semibold">{offer.title}</p>
                        <div className="flex items-center">
                          <RocketLaunchIcon className="w-5 h-5 text-[#00C2CB] mr-2" />
                          <span className="truncate text-sm text-white/70">Ad Campaign: {offer.ideaId?.slice(0, 8)}...</span>
                        </div>
                      </div>
                      <button className="text-sm px-3 py-1 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]">View</button>
                    </div>
                  ))
                )}
              </div>

              {/* Approved Offers */}
              <div className="w-full md:w-1/2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.35)]">
                <h2 className="text-lg font-semibold text-white mb-4">Approved Offers</h2>
                {approvedOffers.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center text-white/70">
                    You haven't been approved to promote any offers yet.<br />
                    Head over to the <Link href="/affiliate/marketplace" className="underline">Marketplace</Link> to request one!
                  </div>
                ) : (
                  approvedOffers.map((offer) => (
                    <div
                      key={`${offer.id}-${offer.title}`}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 mb-3"
                    >
                      <div className="flex flex-col">
                        <p className="text-white font-semibold">{offer.title}</p>
                        <div className="flex items-center">
                          <RocketLaunchIcon className="w-5 h-5 text-[#00C2CB] mr-2" />
                          <span className="truncate text-sm text-white/70">Commission: {offer.commission}% | Type: {offer.payoutType}</span>
                        </div>
                      </div>
                      <Link
                        href={`/affiliate/dashboard/promote/${offer.id}`}
                        className="text-sm px-3 py-1 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]"
                      >
                        Promote
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
      </div>
    </div>
  );
}

export default AffiliateDashboardContent;