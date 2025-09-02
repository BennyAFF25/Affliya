'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';

interface Campaign {
  id: string;
  budget: string | null;
  targeting: string | null;
  cta: string | null;
  image_url?: string | null;
  video_url?: string | null;
  [key: string]: any;
}

const CampaignDetailPage = () => {
  const { campaignId } = useParams();
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [budget, setBudget] = useState('');
  const [targeting, setTargeting] = useState('');
  const [cta, setCta] = useState('');
  const [liveStats, setLiveStats] = useState<any>(null);

  useEffect(() => {
    if (session === undefined) return;

    const fetchCampaign = async () => {
      const { data, error } = await supabase
        .from<Campaign>('ad_ideas')
        .select('*')
        .eq('id', campaignId as string)
        .single();

      if (error) {
        console.error('[❌ Fetch failed]', error.message);
        return;
      }

      if (data) {
        setCampaign(data);
        setBudget(data.budget ?? '');
        setTargeting(data.targeting ?? '');
        setCta(data.cta ?? '');

        const liveAdRes = await supabase
          .from('live_ads')
          .select('*')
          .eq('ad_idea_id', data.id)
          .single();

        if (liveAdRes.data) {
          const { meta_ad_id, business_email } = liveAdRes.data;

          const tokenRes = await supabase
            .from('meta_connections')
            .select('access_token')
            .eq('business_email', business_email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const accessToken = tokenRes.data?.access_token;

          if (accessToken) {
            const insightRes = await fetch(`https://graph.facebook.com/v19.0/${meta_ad_id}/insights?fields=spend,impressions,clicks,reach&access_token=${accessToken}`);
            const insightJson = await insightRes.json();
            setLiveStats(insightJson?.data?.[0]);
          }
        }
      }
    };

    fetchCampaign();
  }, [campaignId, session]);

  useEffect(() => {
    // Only redirect if session is explicitly null (not undefined)
    if (session === null) {
      router.push('/login');
    }
  }, [session, router]);

  const handleSave = async () => {
    const { error } = await supabase
      .from('ad_ideas')
      .update({
        budget,
        targeting,
        cta,
        status: 'pending', // require reapproval
      })
      .eq('id', campaignId as string);

    if (!error) {
      alert('Changes saved and submitted for reapproval.');
      router.push('/affiliate/dashboard/manage-campaigns');
    } else {
      console.error('[❌ Save failed]', error.message);
    }
  };

  if (!campaign) return <div className="p-6 text-gray-300 bg-[#0e0e0e]">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#0e0e0e]">
      <div className="p-10 max-w-3xl mx-auto bg-[#0e0e0e] min-h-screen">

        <div className="bg-[#1a1a1a] rounded-xl p-8 mb-10 shadow-lg flex flex-col lg:flex-row justify-between items-start gap-8">
          {/* Left side: Ad Meta Details */}
          <div className="lg:w-2/3 space-y-3">
            <h2 className="text-xl font-semibold text-[#00C2CB] mb-2">Ad Preview Details</h2>
            <div className="grid grid-cols-2 gap-4 text-white text-sm">
              <div><span className="text-gray-400">Status:</span> {campaign.status || 'Pending'}</div>
              <div><span className="text-gray-400">Budget:</span> {campaign.budget || '—'}</div>
              <div><span className="text-gray-400">Targeting:</span> {campaign.targeting || '—'}</div>
              <div><span className="text-gray-400">CTA:</span> {campaign.cta || '—'}</div>
              <div><span className="text-gray-400">Placement:</span> Facebook & Instagram</div>
              <div><span className="text-gray-400">Ad Format:</span> Single Image or Video</div>
              <div><span className="text-gray-400">Tracking:</span> Meta Pixel</div>
              <div><span className="text-gray-400">Delivery:</span> Standard</div>
              {liveStats && (
                <>
                  <div><span className="text-gray-400">Spend:</span> ${liveStats.spend || 0}</div>
                  <div><span className="text-gray-400">Clicks:</span> {liveStats.clicks || 0}</div>
                  <div><span className="text-gray-400">Impressions:</span> {liveStats.impressions || 0}</div>
                  <div><span className="text-gray-400">Reach:</span> {liveStats.reach || 0}</div>
                </>
              )}
            </div>
          </div>

          {/* Right side: Media */}
          <div className="lg:w-1/3 w-full">
            {campaign.video_url ? (
              <video controls className="rounded-lg w-full border border-[#333] shadow-md">
                <source src={campaign.video_url} type="video/mp4" />
              </video>
            ) : campaign.image_url ? (
              <img src={campaign.image_url} alt="Ad" className="rounded-lg w-full border border-[#333] shadow-md" />
            ) : (
              <div className="rounded-lg bg-[#0e0e0e] text-center text-gray-500 py-10 px-4 border border-[#333] shadow-md">
                No media preview
              </div>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#00C2CB] mb-6">Edit Campaign</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400">Budget</label>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#333] bg-[#0e0e0e] text-white placeholder-gray-400 p-2 focus:ring-2 focus:ring-[#00C2CB]"
              placeholder="e.g. $50/day"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400">Targeting</label>
            <input
              type="text"
              value={targeting}
              onChange={(e) => setTargeting(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#333] bg-[#0e0e0e] text-white placeholder-gray-400 p-2 focus:ring-2 focus:ring-[#00C2CB]"
              placeholder="e.g. Male, 18-25, Australia"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400">Call to Action</label>
            <input
              type="text"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#333] bg-[#0e0e0e] text-white placeholder-gray-400 p-2 focus:ring-2 focus:ring-[#00C2CB]"
              placeholder="e.g. Shop Now"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="mt-6 bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold px-6 py-2 rounded-lg"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default CampaignDetailPage;