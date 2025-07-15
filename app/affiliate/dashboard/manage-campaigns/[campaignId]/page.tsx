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

  useEffect(() => {
    if (session === undefined) return;

    const fetchCampaign = async () => {
      const { data, error } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('id', campaignId)
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
      .eq('id', campaignId);

    if (!error) {
      alert('Changes saved and submitted for reapproval.');
      router.push('/affiliate/dashboard/manage-campaigns');
    } else {
      console.error('[❌ Save failed]', error.message);
    }
  };

  if (!campaign) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[#00C2CB] mb-6">Edit Campaign</h1>

      {campaign.image_url || campaign.video_url ? (
        campaign.video_url ? (
          <video controls className="rounded-lg w-full mb-4">
            <source src={campaign.video_url} type="video/mp4" />
          </video>
        ) : (
          <img src={campaign.image_url ?? ''} alt="Ad" className="rounded-lg w-full mb-4" />
        )
      ) : (
        <div className="bg-gray-100 p-6 rounded-lg mb-4 text-center">No media preview</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Budget</label>
          <input
            type="text"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            placeholder="e.g. $50/day"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Targeting</label>
          <input
            type="text"
            value={targeting}
            onChange={(e) => setTargeting(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            placeholder="e.g. Male, 18-25, Australia"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Call to Action</label>
          <input
            type="text"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
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
  );
};

export default CampaignDetailPage;