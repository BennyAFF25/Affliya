'use client';

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
import { useSession } from '@supabase/auth-helpers-react';

interface Offer {
  id: string;
  businessName: string;
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
  const session = useSession();
  const user = session?.user;
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [adIdeas, setAdIdeas] = useState<any[]>([]);

  useEffect(() => {
    if (session === undefined) return;

    if (session === null) {
      console.warn('[🔁 Session null — showing landing instead of redirect]');
      return; // prevent redirect loops during session check
    }
  }, [session]);

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
    if (approvedIds.length === 0 && session?.user) {
      console.warn('[⚠️ No approved offers — user still stays on dashboard]');
    }
  }, [approvedIds, session]);

  const approvedOffers = offers.filter((offer) => approvedIds.includes(offer.id));
  const activeOffers = adIdeas.map((idea) => {
    const matchedOffer = offers.find((offer) => offer.id === idea.offer_id);
    return matchedOffer ? { ...matchedOffer, ideaId: idea.id } : null;
  }).filter(Boolean) as Offer[];

  if (!user) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-6">
      <div className="text-white px-4 sm:px-6 md:px-8 lg:px-10 pb-20">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-[#00C2CB] mb-1">Affiliate Dashboard</h1>
              <p className="text-sm text-gray-500">
                Welcome back, <span className="font-medium text-gray-300">{user?.email}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-14">
              <div className="bg-[#121212] text-[#00C2CB] rounded-md p-4 border border-[1px] border-[#00C2CB]/40">
                <div className="flex items-center gap-4">
                  <div className="text-[#00C2CB] bg-[#c1f4f5] rounded-full p-3">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#00C2CB]">Active Campaigns</p>
                    <h2 className="text-2xl font-bold text-[#00C2CB]">{approvedOffers.length}</h2>
                  </div>
                </div>
              </div>

              <div className="bg-[#121212] text-[#fbbf24] rounded-md p-4 border border-[1px] border-[#FACC15]/40">
                <div className="flex items-center gap-4">
                  <div className="text-[#fbbf24] bg-[#fef3c7] rounded-full p-3">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#fbbf24]">Total Spent</p>
                    <h2 className="text-2xl font-bold text-[#fbbf24]">$640</h2>
                  </div>
                </div>
              </div>

              <div className="bg-[#121212] text-[#10b981] rounded-md p-4 border border-[1px] border-[#4ADE80]/40">
                <div className="flex items-center gap-4">
                  <div className="text-[#10b981] bg-[#d1fae5] rounded-full p-3">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#10b981]">Pending Payout</p>
                    <h2 className="text-2xl font-bold text-[#10b981]">$280</h2>
                  </div>
                </div>
              </div>

              <div className="bg-[#121212] text-[#a78bfa] rounded-md p-4 border border-[1px] border-[#A78BFA]/40">
                <div className="flex items-center gap-4">
                  <div className="text-[#a78bfa] bg-[#ede9fe] rounded-full p-3">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[#a78bfa]">Approved Offers</p>
                    <h2 className="text-2xl font-bold text-[#a78bfa]">{approvedOffers.length}</h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Updated Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              {[{ title: 'Ad Spend (Last 30 Days)', data: spendData }, { title: 'Conversions (Last 30 Days)', data: conversionData }].map((chart, i) => (
                <div key={i} className="bg-[#121212] p-6 rounded-xl shadow-sm border border-transparent">
                  <h2 className="text-md font-semibold mb-2">{chart.title}</h2>
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
              ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-6 mt-8">
              {/* Active Campaigns */}
              <div className="w-full md:w-1/2 bg-[#121212] rounded-xl p-4 shadow-lg">
                <h2 className="text-lg font-semibold text-white mb-4">Active Campaigns</h2>
                {activeOffers.length === 0 ? (
                  <div className="bg-[#e0fafa] text-[#007d80] p-6 rounded-xl text-center text-black">
                    No active campaigns yet.
                  </div>
                ) : (
                  activeOffers.map((offer) => (
                    <div
                      key={`${offer.id}-${offer.ideaId}`}
                      className="flex items-center justify-between bg-[#121212] p-3 rounded-md mb-3 border border-[#00C2CB]"
                    >
                      <div className="flex flex-col">
                        <p className="text-[#00C2CB] font-semibold">{offer.businessName}</p>
                        <div className="flex items-center">
                          <RocketLaunchIcon className="w-5 h-5 text-[#00C2CB] mr-2" />
                          <span className="truncate font-semibold">Ad Campaign: {offer.ideaId?.slice(0, 8)}...</span>
                        </div>
                      </div>
                      <button className="text-sm text-[#00C2CB] hover:underline">View</button>
                    </div>
                  ))
                )}
              </div>

              {/* Approved Offers */}
              <div className="w-full md:w-1/2 bg-[#121212] rounded-xl p-4 shadow-lg">
                <h2 className="text-lg font-semibold text-white mb-4">Approved Offers</h2>
                {approvedOffers.length === 0 ? (
                  <div className="bg-[#e0fafa] text-[#007d80] p-6 rounded-xl text-center text-black">
                    You haven't been approved to promote any offers yet.<br />
                    Head over to the <Link href="/affiliate/marketplace" className="underline">Marketplace</Link> to request one!
                  </div>
                ) : (
                  approvedOffers.map((offer) => (
                    <div key={`${offer.id}-${offer.businessName}`} className="bg-[#121212] p-4 rounded-md mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-medium">{offer.businessName}</span>
                        <span className="bg-green-600 text-xs px-2 py-1 rounded-full text-white">Approved</span>
                      </div>
                      <p className="text-sm text-gray-300">Commission: {offer.commission}%</p>
                      <p className="text-sm text-gray-300 mb-3">Type: {offer.payoutType}</p>
                      <button className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white text-sm px-4 py-2 rounded-md">Promote</button>
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