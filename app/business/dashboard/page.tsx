'use client';

import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowUpRight, DollarSign, Users, ClipboardList, LayoutGrid, Pause, X } from 'lucide-react';
import { PlayCircle, MousePointerClick, ShoppingCart, BarChart2 } from 'lucide-react';
import { supabase } from 'utils/supabase/pages-client';

interface Profile {
  id: string;
  role: string | null;
  email: string | null;
}

const CARD = "rounded-xl border border-[#262626] bg-[#121212] hover:ring-1 hover:ring-white/5 transition-shadow p-6";

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
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
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

    const fetchProfileAndData = async () => {
      setLoading(true);

      if (!user?.id) {
        console.warn('[❌ No user id available yet]');
        setLoading(false);
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

      const [activeCampaignsRes, approvedAffiliatesRes] = await Promise.all([
        supabase
          .from('ad_ideas')
          .select('*')
          .eq('business_email', user?.email || '')
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

      setLoading(false);
    };

    fetchProfileAndData();
  }, [session, router, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

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
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0b0b0b] to-[#0e0e0e] text-white px-5 py-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 mt-2">
        <div className={`${CARD} ring-1 ring-[#00C2CB]/15`}>
          <p className="text-xs text-gray-400">Active Affiliates</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">{approved.length}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#00C2CB]/15 text-[#7ff5fb] border border-[#00C2CB]/25">Live</span>
          </div>
        </div>
        <div className={`${CARD} ring-1 ring-[#fbbf24]/15`}>
          <p className="text-xs text-gray-400">Pending Requests</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">{pendingRequests.length}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#fbbf24]/15 text-[#fde68a] border border-[#fbbf24]/25">Queue</span>
          </div>
        </div>
        <div className={`${CARD} ring-1 ring-[#10b981]/15`}>
          <p className="text-xs text-gray-400">Total Revenue</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">${mockData.totalRevenue.toLocaleString()}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#bbf7d0] border border-[#10b981]/25">MTD</span>
          </div>
        </div>
        <div className={`${CARD} ring-1 ring-[#a78bfa]/15`}>
          <p className="text-xs text-gray-400">Live Offers</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-white">{liveOffersCount}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#a78bfa]/15 text-[#e9d5ff] border border-[#a78bfa]/25">Now</span>
          </div>
        </div>
      </div>

      {/* Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className={`${CARD}`}>
          <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-4">Affiliate Growth</h2>
          <div className="h-40 rounded-md flex items-center justify-center text-gray-400">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={affiliateData}>
                <XAxis dataKey="name" hide />
                <Bar dataKey="value" fill="#00C2CB" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={`${CARD}`}>
          <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-4">Sales Performance</h2>
          <div className="h-40 rounded-md flex items-center justify-center text-gray-400">
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
      <div className={`${CARD}`}>
        <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-2">Active Campaigns (0)</h2>
        <p className="text-sm text-gray-400">No active campaigns yet.</p>
      </div>

      {/* Affiliate Activity and Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className={`${CARD}`}>
          <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-2">Affiliate Activity</h2>
          <p className="text-sm text-gray-400">No recent affiliate activity.</p>
        </div>
        <div className={`${CARD}`}>
          <h2 className="text-[15px] font-semibold tracking-wide text-[#7ff5fb] mb-2">Transaction History</h2>
          <p className="text-sm text-gray-400">No recent transactions.</p>
        </div>
      </div>
    </div>
  );
}