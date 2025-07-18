'use client';

import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowUpRight, DollarSign, Users, ClipboardList, LayoutGrid, Pause, X } from 'lucide-react';
import { PlayCircle, MousePointerClick, ShoppingCart, BarChart2 } from 'lucide-react';
import { supabase } from 'utils/supabase/pages-client';

const affiliateData = Array.from({ length: 20 }, (_, i) => ({ name: `Day ${i + 1}`, value: Math.floor(Math.random() * 10) + 1 }));
const salesData = Array.from({ length: 20 }, (_, i) => ({ name: `Day ${i + 1}`, value: Math.floor(Math.random() * 1000) + 100 }));

export default function BusinessDashboard() {
  const session = useSession();
  const user = session?.user;
  const router = useRouter();
  const [approvedAffiliates, setApprovedAffiliates] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);
  // Mock data for stat cards (replace as needed)
  const pendingRequests = []; // Replace with real pending requests array if available
  const approved = approvedAffiliates;
  const liveOffersCount = 0; // Replace with real number if available
  const mockData = { totalRevenue: 12400 }; // Replace with real revenue value if available

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
    <div className="p-4 sm:p-6 bg-white min-h-screen pt-2">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 mt-2">
        <div className="bg-[#e0fafa]/40 shadow-md border-2 border-[#66d2d6] p-5 rounded-lg hover:shadow-[0_0_8px_#66d2d6] transition ring-2 ring-[#66d2d6]/40">
          <p className="text-sm text-[#00C2CB]">Active Affiliates</p>
          <p className="text-2xl font-bold text-[#00C2CB]">{approved.length}</p>
        </div>
        <div className="bg-[#fff7db]/40 shadow-md border-2 border-[#f9e28d] p-5 rounded-lg hover:shadow-[0_0_8px_#f9e28d] transition ring-2 ring-[#f9e28d]/40">
          <p className="text-sm text-[#00C2CB]">Pending Requests</p>
          <p className="text-2xl font-bold text-yellow-500">{pendingRequests.length}</p>
        </div>
        <div className="bg-[#dcfce7]/40 shadow-md border-2 border-[#6ee7b7] p-5 rounded-lg hover:shadow-[0_0_8px_#6ee7b7] transition ring-2 ring-[#6ee7b7]/40">
          <p className="text-sm text-[#00C2CB]">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">${mockData.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-[#f3f0ff]/40 shadow-md border-2 border-[#c4b5fd] p-5 rounded-lg hover:shadow-[0_0_8px_#c4b5fd] transition ring-2 ring-[#c4b5fd]/40">
          <p className="text-sm text-[#00C2CB]">Live Offers</p>
          <p className="text-2xl font-bold text-purple-600">{liveOffersCount}</p>
        </div>
      </div>

      {/* Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="bg-white rounded-lg shadow border border-[#66d2d6] ring-1 ring-[#66d2d6]/25 p-6">
          <h2 className="text-xl font-semibold text-[#00C2CB] mb-4">Affiliate Growth</h2>
          <div className="h-40 bg-white rounded-md flex items-center justify-center text-gray-400">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={affiliateData}>
                <XAxis dataKey="name" hide />
                <Bar dataKey="value" fill="#00C2CB" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-[#66d2d6] ring-1 ring-[#66d2d6]/25 p-6">
          <h2 className="text-xl font-semibold text-[#00C2CB] mb-4">Sales Performance</h2>
          <div className="h-40 bg-white rounded-md flex items-center justify-center text-gray-400">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={salesData}>
                <XAxis dataKey="name" hide />
                <Bar dataKey="value" fill="#00C2CB" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Campaigns Section */}
      <div className="bg-[#3a3a3a] rounded-lg shadow border border-[#66d2d6] ring-1 ring-[#66d2d6]/25 p-6">
        <h2 className="text-lg font-semibold text-[#00C2CB] mb-2">Active Campaigns (0)</h2>
        <p className="text-[#00C2CB]">No active campaigns yet.</p>
      </div>

      {/* Affiliate Activity and Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-[#3a3a3a] rounded-lg shadow border border-[#66d2d6] ring-1 ring-[#66d2d6]/25 p-6">
          <h2 className="text-lg font-semibold text-[#00C2CB] mb-2">Affiliate Activity</h2>
          <p className="text-[#00C2CB]">No recent affiliate activity.</p>
        </div>
        <div className="bg-[#3a3a3a] rounded-lg shadow border border-[#66d2d6] ring-1 ring-[#66d2d6]/25 p-6">
          <h2 className="text-lg font-semibold text-[#00C2CB] mb-2">Transaction History</h2>
          <p className="text-[#00C2CB]">No recent transactions.</p>
        </div>
      </div>
    </div>
  );
}