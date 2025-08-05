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
    <div className="bg-[#0e0e0e] min-h-screen text-white">
      <div className="p-10 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-[#00C2CB] mb-6">Manage Campaigns</h1>

        {campaigns.length === 0 ? (
          <div className="bg-yellow-100 text-yellow-800 p-6 rounded-lg text-center">
            No campaigns found.
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="bg-[#1a1a1a] border border-[#00C2CB] p-6 rounded-xl shadow-lg hover:shadow-[#00C2CB]/30 transition duration-300 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-[#00C2CB] text-lg flex items-center gap-2">
                    <span className="text-sm text-white">Offer: {campaign.offer_name || 'N/A'}</span>
                    <svg className="w-5 h-5 text-[#00C2CB]" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a1 1 0 00-1 1v3.278A2 2 0 004.447 9.72l4.316 1.724a2 2 0 001.474 0l4.316-1.724A2 2 0 0017 7.278V4a1 1 0 00-1-1H4z" /><path d="M3 13a1 1 0 011-1h12a1 1 0 011 1v2.25a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15.25V13z" /></svg>
                    {campaign.business_name || campaign.offer_name || campaign.description || campaign.offer_id}
                  </p>
                  <p className="text-sm text-gray-500">Affiliate: {campaign.affiliate_email}</p>
                  <p className="text-sm text-gray-500">Status: {campaign.status}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-1 rounded font-medium text-sm shadow"
                  >
                    View Campaign
                  </button>
                  <button
                    className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#00C2CB] border border-[#00C2CB] px-4 py-1 rounded font-medium text-sm shadow"
                  >
                    Edit Campaign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCampaignsBusiness;
