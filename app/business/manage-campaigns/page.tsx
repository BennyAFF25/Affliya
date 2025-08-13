'use client';

import Link from 'next/link';
import { useSession } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';

const ManageCampaignsBusiness = () => {
  const session = useSession();
  const user = session?.user;

  const [adIdeas, setAdIdeas] = useState<any[]>([]);
  const [showActive, setShowActive] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchAdIdeas = async () => {
      const { data: adIdeas, error } = await supabase
        .from('ad_ideas')
        .select(`
          id,
          offer_id,
          affiliate_email,
          business_email,
          status,
          meta_status,
          file_url,
          ad_name,
          campaign_name,
          caption,
          thumbnail_url,
          created_at
        `)
        .eq('business_email', session?.user.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[❌ Failed to fetch campaigns]', error);
      } else {
        setAdIdeas(adIdeas || []);
      }
    };

    fetchAdIdeas();
  }, [user]);

  console.log('[📢 useEffect Completed]');

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    // Updated toggle logic to use Meta-style statuses: toggle between 'ACTIVE' and 'PAUSED'
    const newStatus = currentStatus.toUpperCase() === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const { error } = await supabase
      .from('ad_ideas')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('[❌ Failed to update campaign status]', error);
    } else {
      setAdIdeas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    }
  };

  const uniqueAdIdeas = adIdeas?.filter(
    (item, index, self) => index === self.findIndex(t => t.id === item.id)
  );

  const activeCampaigns = uniqueAdIdeas?.filter(
    (ad) => ad.meta_status === "ACTIVE" || ad.meta_status === "PROCESSING"
  );

  const archivedCampaigns = uniqueAdIdeas?.filter(
    (ad) =>
      ad.meta_status === "PAUSED" ||
      ad.meta_status === "DELETED" ||
      !ad.meta_status
  );

  return (
    <div className="bg-[#0e0e0e] min-h-screen text-white">
      <div className="p-10 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-[#00C2CB] mb-6">Manage Campaigns</h1>

        <div
          onClick={() => setShowActive((prev) => !prev)}
          className="cursor-pointer bg-[#1a1a1a] border border-[#00C2CB] rounded-lg px-6 py-4 mb-4 flex justify-between items-center hover:shadow-md transition"
        >
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-[#00C2CB]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-xl font-bold text-white">Active Campaigns</h2>
          </div>
          <span className="text-[#00C2CB] text-2xl font-bold">{showActive ? '−' : '+'}</span>
        </div>

        {uniqueAdIdeas.length === 0 ? (
          <div className="bg-yellow-100 text-yellow-800 p-6 rounded-lg text-center">
            No campaigns found.
          </div>
        ) : (
          <div>
            {showActive && (
              <div className="space-y-4 mb-6">
                {activeCampaigns.map((campaign) => (
                  <div key={campaign.id} className="bg-[#1a1a1a] border border-[#00C2CB] p-6 rounded-xl shadow-lg hover:shadow-[#00C2CB]/30 transition duration-300 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-[#00C2CB] text-lg flex items-center gap-2">
                        <span className="text-sm text-white">Offer: {campaign.campaign_name || 'N/A'}</span>
                        <svg className="w-5 h-5 text-[#00C2CB]" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a1 1 0 00-1 1v3.278A2 2 0 004.447 9.72l4.316 1.724a2 2 0 001.474 0l4.316-1.724A2 2 0 0017 7.278V4a1 1 0 00-1-1H4z" /><path d="M3 13a1 1 0 011-1h12a1 1 0 011 1v2.25a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15.25V13z" /></svg>
                        {campaign.ad_name || campaign.caption || campaign.offer_id}
                      </p>
                      <p className="text-sm text-gray-500">Affiliate: {campaign.affiliate_email}</p>
                      <div className="mt-1">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          campaign.meta_status === 'ACTIVE'
                            ? 'bg-green-600/20 text-green-300'
                            : campaign.meta_status === 'PROCESSING'
                            ? 'bg-yellow-600/20 text-yellow-300'
                            : 'bg-red-600/20 text-red-300'
                        }`}>
                          {campaign.meta_status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/business/manage-campaigns/${campaign.id}`}>
                        <button
                          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-1 rounded font-medium text-sm shadow"
                        >
                          View Campaign
                        </button>
                      </Link>
                      <button
                        onClick={() => handleToggleStatus(campaign.id, campaign.meta_status)}
                        className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#00C2CB] border border-[#00C2CB] px-4 py-1 rounded font-medium text-sm shadow"
                      >
                        {campaign.meta_status === 'ACTIVE' ? 'Pause Campaign' : 'Activate Campaign'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-6">
              <div
                onClick={() => setShowArchived((prev) => !prev)}
                className="cursor-pointer bg-[#1a1a1a] border border-[#00C2CB] rounded-lg px-6 py-4 mb-4 flex justify-between items-center hover:shadow-md transition"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-[#00C2CB]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16h16V4H4zm4 4h8v2H8V8zm0 4h5v2H8v-2z" />
                  </svg>
                  <h2 className="text-xl font-bold text-white">Archived Campaigns</h2>
                </div>
                <span className="text-[#00C2CB] text-2xl font-bold">{showArchived ? '−' : '+'}</span>
              </div>
              {showArchived && (
                <div className="space-y-4">
                  {archivedCampaigns.map((campaign) => (
                    <div key={campaign.id} className="bg-[#1a1a1a] border border-[#00C2CB] p-6 rounded-xl shadow-lg hover:shadow-[#00C2CB]/30 transition duration-300 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-[#00C2CB] text-lg flex items-center gap-2">
                          <span className="text-sm text-white">Offer: {campaign.campaign_name || 'N/A'}</span>
                          <svg className="w-5 h-5 text-[#00C2CB]" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a1 1 0 00-1 1v3.278A2 2 0 004.447 9.72l4.316 1.724a2 2 0 001.474 0l4.316-1.724A2 2 0 0017 7.278V4a1 1 0 00-1-1H4z" /><path d="M3 13a1 1 0 011-1h12a1 1 0 011 1v2.25a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15.25V13z" /></svg>
                          {campaign.ad_name || campaign.caption || campaign.offer_id}
                        </p>
                        <p className="text-sm text-gray-500">Affiliate: {campaign.affiliate_email}</p>
                        <div className="mt-1">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                            campaign.meta_status === 'ACTIVE'
                              ? 'bg-green-600/20 text-green-300'
                              : campaign.meta_status === 'PROCESSING'
                              ? 'bg-yellow-600/20 text-yellow-300'
                              : campaign.meta_status === 'PAUSED'
                              ? 'bg-orange-600/20 text-orange-300'
                              : campaign.meta_status === 'DELETED'
                              ? 'bg-red-600/20 text-red-300'
                              : 'bg-gray-600/20 text-gray-300'
                          }`}>
                            {campaign.meta_status || campaign.status || 'Pending'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/business/manage-campaigns/${campaign.id}`}>
                          <button className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-1 rounded font-medium text-sm shadow">View Campaign</button>
                        </Link>
                        <button className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#00C2CB] border border-[#00C2CB] px-4 py-1 rounded font-medium text-sm shadow">Edit Campaign</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCampaignsBusiness;
