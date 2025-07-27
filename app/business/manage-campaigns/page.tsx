'use client';

import { useSession } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';

const ManageCampaignsBusiness = () => {
  const session = useSession();
  const user = session?.user;

  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchCampaigns = async () => {
      const { data, error } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('business_email', user.email)
        .in('status', ['approved', 'paused']);

      if (error) {
        console.error('[❌ Failed to fetch campaigns]', error);
      } else {
        setCampaigns(data);
      }
    };

    fetchCampaigns();
  }, [user]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'approved' ? 'paused' : 'approved';
    const { error } = await supabase
      .from('ad_ideas')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('[❌ Failed to update campaign status]', error);
    } else {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    }
  };

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#00C2CB] mb-6">Manage Campaigns</h1>

      {campaigns.length === 0 ? (
        <div className="bg-yellow-100 text-yellow-800 p-6 rounded-lg text-center">
          No campaigns found.
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="border border-[#00C2CB] p-4 rounded-xl bg-white shadow-sm flex justify-between items-center">
              <div>
                <p className="font-semibold text-[#00C2CB] text-lg">
                  {campaign.business_name} — {campaign.offer_name || campaign.businessName || campaign.description || campaign.offer_id}
                </p>
                <p className="text-sm text-gray-500">Affiliate: {campaign.affiliate_email}</p>
                <p className="text-sm text-gray-500">Status: {campaign.status}</p>
              </div>
              <div className="flex items-center gap-2">
                {campaign.image_url || campaign.video_url ? (
                  campaign.video_url ? (
                    <video className="h-16 w-28 object-cover rounded" controls>
                      <source src={campaign.video_url} type="video/mp4" />
                    </video>
                  ) : (
                    <img src={campaign.image_url} className="h-16 w-28 object-cover rounded" alt="Preview" />
                  )
                ) : (
                  <div className="h-16 w-28 bg-gray-100 flex items-center justify-center rounded text-gray-400 text-xs">
                    No Media
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-1 rounded font-medium text-sm"
                  >
                    View Campaign
                  </button>
                  <button
                    className="bg-white hover:bg-gray-100 text-[#00C2CB] border border-[#00C2CB] px-4 py-1 rounded font-medium text-sm"
                  >
                    Edit Campaign
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageCampaignsBusiness;
