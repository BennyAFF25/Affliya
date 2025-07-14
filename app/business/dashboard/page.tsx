'use client';

import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, DollarSign, Users, ClipboardList, LayoutGrid, Pause, X } from 'lucide-react';
import { PlayCircle, MousePointerClick, ShoppingCart, BarChart2 } from 'lucide-react';
import { supabase } from 'utils/supabase/pages-client';

const affiliateData = [
  { name: 'Day 1', value: 3 },
  { name: 'Day 10', value: 11 },
  { name: 'Day 20', value: 20 },
  { name: 'Day 30', value: 28 },
];

const salesData = [
  { name: 'Day 1', value: 200 },
  { name: 'Day 10', value: 300 },
  { name: 'Day 20', value: 700 },
  { name: 'Day 30', value: 950 },
];

export default function BusinessDashboard() {
  const session = useSession();
  const user = session?.user;
  const router = useRouter();
  const [approvedAffiliates, setApprovedAffiliates] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);
  useEffect(() => {
    const fetchActiveCampaigns = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('business_email', user.email)
        .eq('status', 'approved');

      if (!error && data) {
        setActiveCampaigns(data);
      } else {
        console.error('[❌ Failed to fetch active campaigns]', error);
      }
    };

    fetchActiveCampaigns();
  }, [user]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/');
    }
  }, [session, router]);

  useEffect(() => {
    const fetchApprovedAffiliates = async () => {
      const { data, error } = await supabase
        .from('affiliate_requests')
        .select('*')
        .eq('status', 'approved');

      if (!error && data) {
        setApprovedAffiliates(data);
      }
    };

    fetchApprovedAffiliates();
  }, []);

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
            e.currentTarget.src = '/placeholder.png';
          }}
        />
      );
    }

    return <div className="text-gray-500 italic">Unsupported media type</div>;
  };

  return (
    <div className="w-full">
      <div className="p-10 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[#00C2CB] text-center mb-1">Business Dashboard</h1>
        <p className="text-center text-gray-600 mb-8">
          Welcome back, <span className="font-semibold">{user?.email}</span>
        </p>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white border border-[#00C2CB] rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-4">
              <div className="bg-[#e0fafa] p-3 rounded-full text-[#00C2CB]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Affiliates</p>
                <p className="text-2xl font-bold">24</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-yellow-400 rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-full text-yellow-500">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Requests</p>
                <p className="text-2xl font-bold">6</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-green-400 rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full text-green-600">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">$12,400</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-purple-400 rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Live Offers</p>
                <p className="text-2xl font-bold text-purple-600">4</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Affiliate Card */}
        <div className="bg-[#e0fafa] border border-[#00C2CB] rounded-xl p-6 shadow mb-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-[#00C2CB]">Top Performing Affiliate</h2>
            <a href="#" className="text-sm text-[#00C2CB] underline hover:text-[#009ba3]">Export to CSV</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-700">
            <p><span className="font-bold">Email:</span> jane.doe@example.com</p>
            <p><span className="font-bold">Revenue:</span> $2,120</p>
            <p><span className="font-bold">Leads:</span> 78</p>
            <p><span className="font-bold">Conversion Rate:</span> 26.9%</p>
          </div>
        </div>

        {/* Approved Affiliates */}
        <div className="mb-10">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left bg-white border border-[#00C2CB] px-6 py-4 rounded-xl shadow-sm hover:shadow-md transition flex justify-between items-center"
          >
            <h2 className="text-lg font-semibold text-[#00C2CB]">Approved Affiliates ({approvedAffiliates.length})</h2>
            <span className="text-[#00C2CB] text-sm">{expanded ? 'Hide' : 'View All'}</span>
          </button>

          {expanded && (
            <div className="mt-4 bg-white border border-[#00C2CB]/30 rounded-xl shadow p-4 space-y-4">
              {approvedAffiliates.length > 0 ? approvedAffiliates.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between items-center border border-[#e0fafa] rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-gray-700 font-semibold">{a.affiliate_email}</p>
                    <p className="text-xs text-gray-400">Approved: {new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-yellow-600 bg-yellow-100 px-3 py-1 text-xs rounded flex items-center gap-1">
                      <Pause size={12} /> Pause
                    </button>
                    <button className="text-red-600 bg-red-100 px-3 py-1 text-xs rounded flex items-center gap-1">
                      <X size={12} /> Disable
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-500">No approved affiliates yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#00C2CB] rounded-2xl p-4 shadow">
            <h3 className="text-md font-semibold mb-2">Affiliate Growth (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={affiliateData} margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorAffiliates" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C2CB" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#00C2CB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" padding={{ left: 20, right: 20 }} interval="preserveStartEnd" />
                <YAxis domain={['dataMin - 5', 'auto']} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#00C2CB" fillOpacity={1} fill="url(#colorAffiliates)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-[#00C2CB] rounded-2xl p-4 shadow">
            <h3 className="text-md font-semibold mb-2">Sales Performance (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesData} margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C2CB" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#00C2CB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" padding={{ left: 20, right: 20 }} interval="preserveStartEnd" />
                <YAxis domain={['dataMin - 5', 'auto']} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#00C2CB" fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-[#00C2CB] mb-6">Active Campaigns ({activeCampaigns.length})</h2>
          <div className="space-y-4">
            {activeCampaigns.length > 0 ? activeCampaigns.map((c) => (
              <div
                key={c.id}
                className="space-y-2"
              >
                {/* Details Right */}
                <div className="flex-1 space-y-2">
                  {/* <p className="text-sm text-[#00C2CB] font-semibold break-all">
                    Offer ID: {c.offer_id}
                  </p>
                  <p className="text-sm text-gray-500">Affiliate: {c.affiliate_email}</p> */}
                  {/* Stats Pill Row */}
                  <div className="flex justify-evenly items-center bg-[#4A4A4A] text-[#00C2CB] rounded-full px-12 py-6 text-[17px] font-semibold">
                    <div className="flex items-center gap-1">
                      <PlayCircle className="w-8 h-8" />
                      <span>12,340</span>
                    </div>
                    <div className="flex items-center gap-1 ml-6">
                      <MousePointerClick className="w-8 h-8" />
                      <span>921</span>
                    </div>
                    <button
                      onClick={() => setSelectedIdea(c)}
                      className="text-[#00C2CB] hover:underline font-semibold"
                    >
                      View Campaign
                    </button>
                    <div className="flex items-center gap-1 mr-6">
                      <ShoppingCart className="w-8 h-8" />
                      <span>53</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart2 className="w-8 h-8" />
                      <span>$1,278</span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-500">No active campaigns yet.</p>
            )}
          </div>
        </div>
      </div>
      {/* Modal-style viewer for selectedIdea */}
      {selectedIdea && (
        <div className="fixed z-50 inset-0 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="bg-gradient-to-b from-[#1f1f1f] to-[#111111] text-white p-0 rounded-lg shadow-lg z-50 max-w-sm w-full overflow-hidden border border-gray-800">
            <div className="flex flex-col bg-gradient-to-b from-gray-800 to-gray-900 text-white">
              <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#ff5757] to-[#8c52ff] text-white flex items-center justify-center font-bold text-sm">
                  {selectedIdea.affiliate_email.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm font-semibold">@{selectedIdea.affiliate_email.split('@')[0]}</div>
              </div>

              {selectedIdea.file_url?.toLowerCase().endsWith('.mp4') ? (
                <video
                  src={selectedIdea.file_url}
                  controls
                  className="w-full h-auto max-h-[500px] object-cover bg-black"
                />
              ) : (
                <img
                  src={selectedIdea.file_url}
                  alt="Post Image"
                  className="w-full h-auto max-h-[500px] object-contain bg-gray-800"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallbackUsed) {
                      target.src = '/fallback-organic-post.png';
                      target.dataset.fallbackUsed = 'true';
                    }
                  }}
                />
              )}

              <div className="px-4 py-2 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 18.657l-6.828-6.829a4 4 0 010-5.656z" />
                  </svg>
                  <span>123 likes</span>
                </div>
                <p>
                  <span className="font-semibold">@{selectedIdea.affiliate_email.split('@')[0]}</span>{' '}
                  {selectedIdea.location}
                </p>
                <div className="text-sm text-white/80 mt-2">
                  <p className="mb-1">
                    <span className="font-semibold">@adreviewer</span> Looks good!
                  </p>
                  <p>
                    <span className="font-semibold">@mediaexpert</span> Great angle 🔥
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 text-sm space-y-1">
                <div className="text-xs text-white/60">Audience: {selectedIdea.audience}</div>
                <div className="text-xs">
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      selectedIdea.status === 'approved'
                        ? 'text-green-600'
                        : selectedIdea.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {selectedIdea.status}
                  </span>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100">
                <button
                  className="w-full py-2 rounded bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-medium text-sm"
                  onClick={() => setSelectedIdea(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Test Deduct & Payout Button */}
      <button
        onClick={async () => {
          const res = await fetch('/api/wallet/deduct-and-transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              affiliateEmail: 'ben@falconx.com.au',
              businessStripeAccountId: 'acct_1RhoAxIk3BumxMp4',
              amount: 10
            })
          });
          const data = await res.json();
          console.log('[✅ Deduct & Transfer Result]', data);
          alert(`Done: ${JSON.stringify(data)}`);
        }}
        className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded mt-6"
      >
        Test Deduct & Payout $10
      </button>
    </div>
  );
}