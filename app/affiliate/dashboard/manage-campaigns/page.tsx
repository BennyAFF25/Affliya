'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from '@/../utils/supabase/pages-client';
import Link from 'next/link';
import { FaFacebookF, FaInstagram, FaEnvelope } from 'react-icons/fa';

interface Offer {
  id: string;
  title: string;
  logo_url?: string | null;
}
interface LiveCampaign {
  id: string;
  type: string;
  offer_id: string;
  business_email: string;
  affiliate_email: string;
  media_url: string | null;
  caption?: string;
  platform?: string;
  created_from?: string;
  status: string;
  created_at: string;
  offer?: {
    title: string;
    logo_url?: string | null;
  };
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform?.toLowerCase()) {
    case 'facebook':
      return <FaFacebookF className="w-6 h-6" />;
    case 'instagram':
      return <FaInstagram className="w-6 h-6" />;
    case 'email':
      return <FaEnvelope className="w-6 h-6" />;
    default:
      return null;
  }
}

export default function ManageCampaignsPage() {
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([]);
  const session = useSession();
  const user = session?.user;

  useEffect(() => {
    const fetchCampaigns = async () => {
      const email = user?.email;
      if (!email) return;

      // 1. Fetch campaigns
      const { data: campaignsRaw, error: campaignsError } = await supabase
        .from('live_campaigns')
        .select('*')
        .eq('affiliate_email', email);

      if (campaignsError) {
        console.error('Error fetching campaigns:', campaignsError.message);
        return;
      }

      if (!campaignsRaw || campaignsRaw.length === 0) {
        setCampaigns([]);
        return;
      }

      // 2. Fetch all unique offer_ids
      const offerIds = Array.from(new Set((campaignsRaw as any[]).map(c => c.offer_id).filter(Boolean)));
      let offersById: { [id: string]: Offer } = {};

      if (offerIds.length > 0) {
        const { data: offersRaw, error: offersError } = await supabase
          .from('offers')
          .select('id, title, logo_url')
          .in('id', offerIds);

        if (offersError) {
          console.error('Error fetching offers:', offersError.message);
        } else if (offersRaw) {
          offersById = Object.fromEntries(offersRaw.map((o: Offer) => [o.id, o]));
        }
      }

      // 3. Merge offer data into campaigns
      const campaignsWithOffers = campaignsRaw.map((c: any) => ({
        ...c,
        offer: offersById[c.offer_id] || null,
      }));

      setCampaigns(campaignsWithOffers);
    };

    fetchCampaigns();
  }, [user]);

  return (
    <div className="px-8 py-6 min-h-screen bg-[#0A0A0A] text-white">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-8 drop-shadow-[0_0_6px_#00C2CB] text-center">Approved Campaigns</h1>
      <div className="max-w-6xl mx-auto mb-6 px-2 text-center text-gray-400 text-sm">
        Manage and review your approved campaigns below.
      </div>

      <div className="flex justify-between items-center max-w-6xl mx-auto mb-4 px-2 text-gray-400 text-sm">
        <span>{campaigns.length} Campaign{campaigns.length === 1 ? '' : 's'}</span>
        <div className="flex gap-3">
          <button className="px-3 py-1 bg-[#111] border border-[#00C2CB33] rounded-md hover:border-[#00C2CB88]">All</button>
          <button className="px-3 py-1 bg-[#111] border border-[#00C2CB33] rounded-md hover:border-[#00C2CB88]">Organic</button>
          <button className="px-3 py-1 bg-[#111] border border-[#00C2CB33] rounded-md hover:border-[#00C2CB88]">Ads</button>
        </div>
      </div>

      <div className="flex justify-center mb-8">
        <select className="bg-[#111] border border-[#00C2CB55] text-[#00C2CB] px-3 py-2 rounded-md">
          <option>Most Recent</option>
          <option>Highest CTR</option>
          <option>Platform: Instagram</option>
        </select>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-[#7ff5fb] italic text-lg text-center">No approved campaigns yet. Submit one to get started!</p>
      ) : (
        <div className="flex flex-col gap-4 max-w-6xl mx-auto">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="relative flex justify-between items-center bg-[#1a1a1a] border border-[#00C2CB22] hover:border-[#00C2CB55] rounded-lg shadow-[0_0_10px_#00C2CB25] hover:shadow-[0_0_20px_#00C2CB55] transition-all duration-300 p-5 w-full max-w-6xl mx-auto before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-[#00C2CB]"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {campaign.offer?.logo_url && (
                    <img src={campaign.offer.logo_url} alt="Brand Logo" className="w-7 h-7 rounded-full" />
                  )}
                  <span className="font-semibold text-[#00C2CB]">{campaign.offer?.title || 'Unknown Offer'}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{campaign.caption || 'Untitled Campaign'}</h3>
                <p className="text-sm text-[#00C2CB] mb-1">{campaign.platform || 'Unknown Platform'}</p>
                <p className="text-xs text-gray-400">
                  <span className="text-white font-medium">Affiliate:</span> {campaign.affiliate_email}
                  <Link
                    href={`/affiliate/dashboard/manage-campaigns/${campaign.id}`}
                    className="ml-3 text-[#00C2CB] hover:text-[#7ff5fb] text-xs"
                  >
                    View Detail
                  </Link>
                </p>
              </div>
              <div>
                <span
                  className={`px-3 py-1 text-xs rounded-full font-medium ${
                    campaign.status?.toLowerCase() === 'approved'
                      ? 'bg-[#0f5132] text-[#4ef08a]'
                      : 'bg-[#512d0f] text-[#f0b84e]'
                  }`}
                >
                  {campaign.status?.toUpperCase() || 'PENDING'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}