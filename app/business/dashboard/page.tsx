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
    if (session === undefined) return;
    if (session === null) {
      router.push('/');
      return;
    }

    const fetchData = async () => {
      const [activeCampaignsRes, approvedAffiliatesRes] = await Promise.all([
        supabase
          .from('ad_ideas')
          .select('*')
          .eq('business_email', user?.email)
          .eq('status', 'approved'),

        supabase
          .from('affiliate_requests')
          .select('*')
          .eq('status', 'approved')
      ]);

      if (!activeCampaignsRes.error && activeCampaignsRes.data) {
        setActiveCampaigns(activeCampaignsRes.data);
      } else {
        console.error('[❌ Failed to fetch active campaigns]', activeCampaignsRes.error);
      }

      if (!approvedAffiliatesRes.error && approvedAffiliatesRes.data) {
        setApprovedAffiliates(approvedAffiliatesRes.data);
      } else {
        console.error('[❌ Failed to fetch approved affiliates]', approvedAffiliatesRes.error);
      }
    };

    fetchData();
  }, [session, router, user]);

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
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start sm:items-center sm:flex-row sm:justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold text-[#00C2CB]">Business Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, <span className="font-semibold">{user?.email}</span>
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow border border-[#00C2CB] flex items-center p-5">
            <div className="flex-shrink-0 bg-[#e0fafa] text-[#00C2CB] rounded-full p-3 mr-4">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Active Affiliates</div>
              <div className="text-2xl font-bold tracking-tight mt-1">24</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow border border-yellow-400 flex items-center p-5">
            <div className="flex-shrink-0 bg-yellow-100 text-yellow-500 rounded-full p-3 mr-4">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Pending Requests</div>
              <div className="text-2xl font-bold tracking-tight mt-1">6</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow border border-green-400 flex items-center p-5">
            <div className="flex-shrink-0 bg-green-100 text-green-600 rounded-full p-3 mr-4">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Total Revenue</div>
              <div className="text-2xl font-bold tracking-tight mt-1 text-green-600">$12,400</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow border border-purple-400 flex items-center p-5">
            <div className="flex-shrink-0 bg-purple-100 text-purple-600 rounded-full p-3 mr-4">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Live Offers</div>
              <div className="text-2xl font-bold tracking-tight mt-1 text-purple-600">4</div>
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow border border-[#00C2CB] p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Affiliate Growth</h3>
              <span className="text-xs text-gray-400">Last 30 Days</span>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={affiliateData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
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
          </div>
          <div className="bg-white rounded-xl shadow border border-[#00C2CB] p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Sales Performance</h3>
              <span className="text-xs text-gray-400">Last 30 Days</span>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
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
        </div>

        {/* Affiliates & Recent Requests row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Affiliate Card */}
          <div className="bg-white rounded-xl shadow border border-[#00C2CB] p-6 flex flex-col mb-6 lg:mb-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-[#00C2CB]">Top Performing Affiliate</h2>
              <a href="#" className="text-sm text-[#00C2CB] underline hover:text-[#009ba3]">Export to CSV</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:grid-cols-4 mt-2 text-sm text-gray-700">
              <p><span className="font-bold">Email:</span> jane.doe@example.com</p>
              <p><span className="font-bold">Revenue:</span> $2,120</p>
              <p><span className="font-bold">Leads:</span> 78</p>
              <p><span className="font-bold">Conversion Rate:</span> 26.9%</p>
            </div>
          </div>
          {/* Approved Affiliates */}
          <div className="flex flex-col">
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
        </div>

        {/* Active Campaigns */}
        <div className="bg-white rounded-xl shadow border border-[#00C2CB] p-6 mb-12">
          <h2 className="text-lg font-semibold text-[#00C2CB] mb-6">Active Campaigns ({activeCampaigns.length})</h2>
          <div className="space-y-4">
            {activeCampaigns.length > 0 ? activeCampaigns.map((c) => (
              <div
                key={c.id}
                className="space-y-2"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-[#f6fafd] rounded-lg px-6 py-4 border border-[#e0fafa]">
                    <div className="flex flex-col mb-4 md:mb-0">
                      {/* <p className="text-sm text-[#00C2CB] font-semibold break-all">
                        Offer ID: {c.offer_id}
                      </p>
                      <p className="text-sm text-gray-500">Affiliate: {c.affiliate_email}</p> */}
                    </div>
                    <div className="flex flex-wrap gap-6 items-center justify-between w-full md:w-auto">
                      <div className="flex items-center gap-2">
                        <PlayCircle className="w-6 h-6 text-[#00C2CB]" />
                        <span className="text-[17px] font-semibold text-[#00C2CB]">12,340</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MousePointerClick className="w-6 h-6 text-[#00C2CB]" />
                        <span className="text-[17px] font-semibold text-[#00C2CB]">921</span>
                      </div>
                      <button
                        onClick={() => setSelectedIdea(c)}
                        className="text-[#00C2CB] hover:underline font-semibold text-[17px]"
                      >
                        View Campaign
                      </button>
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-[#00C2CB]" />
                        <span className="text-[17px] font-semibold text-[#00C2CB]">53</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-6 h-6 text-[#00C2CB]" />
                        <span className="text-[17px] font-semibold text-[#00C2CB]">$1,278</span>
                      </div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-8">
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
          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded shadow"
        >
          Test Deduct & Payout $10
        </button>
      </div>
    </div>
  );
}