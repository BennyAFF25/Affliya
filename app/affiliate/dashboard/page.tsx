'use client';

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
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;

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
        .eq('affiliate_email', user.email)
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
        .eq('affiliate_email', user.email)
        .eq('status', 'approved');

      if (ideasError) {
        console.error('[❌ Failed to fetch ad ideas]', ideasError);
        setAdIdeas([]);
      } else {
        setAdIdeas(ideas);
      }
    };

    loadInitialData();
  }, [user]);

  const approvedOffers = offers.filter((offer) => approvedIds.includes(offer.id));

  if (!user) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#00C2CB] mb-1">Affiliate Dashboard</h1>
        <p className="text-sm text-gray-500">
          Welcome back, <span className="font-medium text-gray-700">{user?.email}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-14">
        <div className="backdrop-blur-md bg-white/80 border border-[#00C2CB] rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="text-[#00C2CB] bg-[#e0fafa] rounded-full p-3">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Campaigns</p>
              <h2 className="text-2xl font-bold text-black">{approvedOffers.length}</h2>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md bg-white/80 border border-yellow-400 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="text-yellow-500 bg-yellow-100 rounded-full p-3">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Spent</p>
              <h2 className="text-2xl font-bold text-yellow-600">$640</h2>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md bg-white/80 border border-green-400 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="text-green-600 bg-green-100 rounded-full p-3">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Payout</p>
              <h2 className="text-2xl font-bold text-green-600">$280</h2>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md bg-white/80 border border-purple-400 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="text-purple-600 bg-purple-100 rounded-full p-3">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved Offers</p>
              <h2 className="text-2xl font-bold text-purple-600">{approvedOffers.length}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Updated Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {[{ title: 'Ad Spend (Last 30 Days)', data: spendData }, { title: 'Conversions (Last 30 Days)', data: conversionData }].map((chart, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-[#00C2CB]">
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

      {/* Active Campaigns */}
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Active Campaigns</h2>
      <div className="mb-10">
        {adIdeas.length === 0 ? (
          <div className="bg-[#e0fafa] text-[#007d80] p-6 rounded-xl text-center">
            No active campaigns yet.
          </div>
        ) : (
          adIdeas.map((idea) => {
            console.log("[🎥 File URL]", idea.file_url);
            const matchedOffer = offers.find((offer) => offer.id === idea.offer_id);
            if (!matchedOffer) return null;

            return (
              <div key={idea.id} className="bg-white border border-[#00C2CB] rounded-xl mb-4 overflow-hidden shadow-sm">
                <div className="flex justify-between items-center px-6 py-4 cursor-pointer group hover:bg-[#f9f9f9]">
                  <div>
                    <h3 className="text-md font-semibold text-[#00C2CB]">Offer ID: {idea.offer_id}</h3>
                    <p className="text-sm text-gray-600">Status: <span className="font-medium text-green-600">Live</span></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const section = document.getElementById(`campaign-${idea.id}`);
                      if (section) section.classList.toggle('hidden');
                    }}
                    className="text-sm text-[#00C2CB] font-medium hover:underline"
                  >
                    View Details
                  </button>
                </div>

                <div id={`campaign-${idea.id}`} className="hidden border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-full md:w-1/3">
                      {renderMedia(idea)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 text-sm text-gray-700">
                        <TrendingUp className="h-5 w-5 text-[#00C2CB]" />
                        <strong>Clicks:</strong> 124
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-700">
                        <CheckCircle className="h-5 w-5 text-[#00C2CB]" />
                        <strong>Leads:</strong> 9
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-700">
                        <DollarSign className="h-5 w-5 text-[#00C2CB]" />
                        <strong>Earnings:</strong> $128.00
                      </div>
                      <div className="mt-4">
                        <Link href={`/affiliate/dashboard/manage-campaigns/${idea.id}`}>
                          <button className="text-sm text-[#00C2CB] underline font-medium">
                            View Full Details
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Approved Offers */}
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Approved Offers</h2>
      {approvedOffers.length === 0 ? (
        <div className="bg-[#e0fafa] text-[#007d80] p-6 rounded-xl text-center">
          You haven't been approved to promote any offers yet.<br />
          Head over to the <Link href="/affiliate/marketplace" className="underline">Marketplace</Link> to request one!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {approvedOffers.map((offer) => (
            <div key={offer.id} className="bg-white p-6 border border-[#00C2CB] rounded-2xl shadow-sm hover:shadow-md transition">
              <h2 className="text-lg font-semibold text-[#00C2CB]">{offer.businessName}</h2>
              <p className="text-sm mt-1 text-gray-600">{offer.description}</p>
              <p className="text-sm mt-1 text-gray-500">Commission: {offer.commission}%</p>
              <p className="text-sm mb-4 text-gray-500">Type: {offer.type}</p>
              <Link href={`/affiliate/dashboard/promote/${offer.id}`}>
                <button className="w-full bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold py-2 rounded-lg transition">
                  Promote
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AffiliateDashboardContent;