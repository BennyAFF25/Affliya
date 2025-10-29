interface Profile {
  id: string;
  role: string | null;
  onboarding_completed: boolean | null;
}
interface ApprovedRequest {
  offer_id: string;
}
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
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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
  const [liveCampaigns, setLiveCampaigns] = useState<any[]>([]);
  // New state for loading and profile
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (isLoading) return; // wait for session resolution
    if (session === null) {
      const next = encodeURIComponent('/affiliate/dashboard');
      router.replace(`/login?role=affiliate&next=${next}`);
      return;
    }
  }, [session, isLoading, router]);

  // New useEffect for profile check
  useEffect(() => {
    const checkProfile = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, onboarding_completed')
        .eq('id', session.user.id)
        .maybeSingle<Profile>();

      // 🚨 Disabled redirects for now to stop bounce loop
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
        .eq('affiliate_email', session.user?.email || '')
        .eq('status', 'approved') as { data: ApprovedRequest[] | null; error: any };

      if (approvedError) {
        console.error('[❌ Failed to fetch approved requests]', approvedError);
      } else {
        const ids = Array.from(new Set((approved || []).map((r: ApprovedRequest) => r.offer_id)));
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
        .eq('affiliate_email', session.user?.email || '')
        .eq('status', 'approved');

      if (ideasError) {
        console.error('[❌ Failed to fetch ad ideas]', ideasError);
        setAdIdeas([]);
      } else {
        setAdIdeas(ideas);
      }

      // Fetch live campaigns for this affiliate
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
  const activeCampaigns = (liveCampaigns || []).map((camp: any) => {
    const matchedOffer = offers.find((offer) => offer.id === camp.offer_id);
    return matchedOffer ? { ...matchedOffer, ideaId: camp.id } : null; // reusing ideaId field to carry campaignId
  }).filter(Boolean) as Offer[];

  // State for toggling show all/less for campaigns and offers
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);

  const visibleCampaigns = showAllCampaigns ? activeCampaigns : activeCampaigns.slice(0, 3);
  const visibleOffers = showAllOffers ? approvedOffers : approvedOffers.slice(0, 3);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }
  if (!user) {
    return null; // redirecting to login above when unauthenticated
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0d0d0d] text-white">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
              {/* Stat Card: Active Campaigns */}
              <div className="group relative rounded-2xl border border-white/10 bg-[#111]/60 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-4 transition-transform duration-300 ease-out hover:scale-[1.01]">
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.03] pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="text-[#7ff5fb] bg-[#00C2CB1a] rounded-lg p-2.5">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Active Campaigns</p>
                    <h2 className="text-3xl font-bold text-white">{liveCampaigns.length}</h2>
                  </div>
                </div>
              </div>
              {/* Stat Card: Total Spent */}
              <div className="group relative rounded-2xl border border-white/10 bg-[#111]/60 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-4 transition-transform duration-300 ease-out hover:scale-[1.01]">
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.03] pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="text-[#7ff5fb] bg-[#00C2CB1a] rounded-lg p-2.5">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Total Spent</p>
                    <h2 className="text-3xl font-bold text-white">$640</h2>
                  </div>
                </div>
              </div>
              {/* Stat Card: Pending Payout */}
              <div className="group relative rounded-2xl border border-white/10 bg-[#111]/60 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-4 transition-transform duration-300 ease-out hover:scale-[1.01]">
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.03] pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="text-[#7ff5fb] bg-[#00C2CB1a] rounded-lg p-2.5">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Pending Payout</p>
                    <h2 className="text-3xl font-bold text-white">$280</h2>
                  </div>
                </div>
              </div>
              {/* Stat Card: Approved Offers */}
              <div className="group relative rounded-2xl border border-white/10 bg-[#111]/60 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-4 transition-transform duration-300 ease-out hover:scale-[1.01]">
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.03] pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
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

            {/* Premium Area Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              {[
                { title: 'Ad Spend (Last 30 Days)', data: spendData },
                { title: 'Conversions (Last 30 Days)', data: conversionData },
              ].map((chart, i) => (
                <div
                  key={i}
                  className="relative rounded-2xl border border-white/5 bg-[#0d0d0d]/60 backdrop-blur-md p-6 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                >
                  <div className="absolute inset-0 pointer-events-none rounded-2xl" />
                  <div className="relative z-10">
                    <h2 className="text-sm font-semibold text-white/70 mb-2">{chart.title}</h2>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={chart.data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`nmGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00C2CB" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#00C2CB" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          padding={{ left: 20, right: 20 }}
                          tick={{ fill: '#666', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={['dataMin - 5', 'auto']}
                          tick={{ fill: '#666', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(0,194,203,0.2)',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                          labelStyle={{ fontWeight: 600, color: '#fff' }}
                          itemStyle={{ color: '#00C2CB' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#00C2CB"
                          strokeWidth={2}
                          fill={`url(#nmGrad${i})`}
                          isAnimationActive={true}
                          animationDuration={900}
                          animationEasing="ease-in-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-6 mt-8">
              {/* Active Campaigns */}
              <div className="w-full md:w-1/2 rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f0f0f] to-[#111] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                <h2 className="text-lg font-semibold text-white mb-4">Active Campaigns</h2>
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
                            <span className="truncate text-sm text-white/70">Campaign: {offer.ideaId?.slice(0, 8)}...</span>
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
                    {activeCampaigns.length > 3 && (
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
                <h2 className="text-lg font-semibold text-white mb-4">Approved Offers</h2>
                {approvedOffers.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center text-white/70">
                    You haven't been approved to promote any offers yet.<br />
                    Head over to the <Link href="/affiliate/marketplace" className="underline">Marketplace</Link> to request one!
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
                    ))}
                    {approvedOffers.length > 3 && (
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