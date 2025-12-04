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
  type: string; // 'organic' | 'paid_meta' | etc.
  offer_id?: string | null;
  business_email: string;
  affiliate_email: string;
  media_url?: string | null;
  caption?: string;
  platform?: string;
  created_from?: string;
  status: string;
  created_at: string;
  billing_state?: string;
  billing_paused_at?: string | null;
  terminated_by_business_at?: string | null;
  terminated_by_business_note?: string | null;
  offer?: {
    title: string;
    logo_url?: string | null;
  } | null;
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform?.toLowerCase()) {
    case 'facebook':
      return <FaFacebookF className="w-4 h-4" />;
    case 'instagram':
      return <FaInstagram className="w-4 h-4" />;
    case 'email':
      return <FaEnvelope className="w-4 h-4" />;
    default:
      return <FaFacebookF className="w-4 h-4" />;
  }
}

export default function ManageCampaignsPage() {
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'organic' | 'ads'>('all');
  const [sortOption, setSortOption] = useState<'most_recent' | 'highest_ctr' | 'instagram'>(
    'most_recent'
  );

  const session = useSession();
  const user = session?.user;

  useEffect(() => {
    const fetchCampaigns = async () => {
      const email = user?.email;
      if (!email) return;

      // 1. Fetch organic campaigns from live_campaigns
      const { data: organicRaw, error: organicError } = await supabase
        .from('live_campaigns')
        .select('*')
        .eq('affiliate_email', email);

      if (organicError) {
        console.error('Error fetching organic campaigns:', organicError.message);
      }

      // 2. Fetch paid Meta campaigns from live_ads for this affiliate
      const { data: paidRaw, error: paidError } = await supabase
        .from('live_ads')
        .select(
          `*,
          billing_state,
          billing_paused_at,
          terminated_by_business_at,
          terminated_by_business_note`
        )
        .eq('affiliate_email', email);

      if (paidError) {
        console.error('Error fetching paid campaigns (live_ads):', paidError.message);
      }

      const organic = organicRaw || [];
      const paid = paidRaw || [];

      if (organic.length === 0 && paid.length === 0) {
        setCampaigns([]);
        return;
      }

      // 3. Fetch offers only for organic campaigns (live_campaigns has offer_id)
      const offerIds = Array.from(
        new Set((organic as any[]).map((c) => c.offer_id).filter(Boolean))
      );
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

      // 4. Map organic campaigns with offer data
      const organicCampaigns: LiveCampaign[] = (organic as any[]).map((c) => ({
        id: c.id,
        type: (c.type as string) || 'organic',
        offer_id: c.offer_id,
        business_email: c.business_email,
        affiliate_email: c.affiliate_email,
        media_url: c.media_url ?? null,
        caption: c.caption,
        platform: c.platform ?? 'organic',
        created_from: c.created_from,
        status: c.status,
        created_at: c.created_at,
        offer: offersById[c.offer_id] || null,
      }));

      // 5. Map paid Meta campaigns from live_ads into the same shape
      const paidCampaigns: LiveCampaign[] = (paid as any[]).map((a) => ({
        id: a.id,
        type: (a.campaign_type as string) || 'paid_meta',
        offer_id: (a as any).offer_id ?? null, // live_ads doesn’t store offer_id directly
        business_email: a.business_email,
        affiliate_email: a.affiliate_email,
        media_url: null, // optional – we can hydrate from ad_ideas later if needed
        caption: a.caption || 'Meta campaign',
        platform: 'facebook',
        created_from: a.created_from || 'meta_api',
        status: a.status || 'active',
        created_at: a.created_at,
        billing_state: a.billing_state || 'active',
        billing_paused_at: a.billing_paused_at || null,
        terminated_by_business_at: a.terminated_by_business_at || null,
        terminated_by_business_note: a.terminated_by_business_note || null,
        offer: null,
      }));

      // 6. Merge both arrays into a single campaigns list
      const merged: LiveCampaign[] = [...organicCampaigns, ...paidCampaigns];

      setCampaigns(merged);
    };

    fetchCampaigns();
  }, [user]);

  // ---------- FILTER + SORT LOGIC ----------

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (activeFilter === 'organic') {
      return (campaign.type || '').toLowerCase() === 'organic';
    }
    if (activeFilter === 'ads') {
      const t = (campaign.type || '').toLowerCase();
      // Treat anything that isn't explicitly "organic" as an ad for now
      return t !== 'organic';
    }
    return true; // 'all'
  });

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    if (sortOption === 'most_recent') {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    if (sortOption === 'highest_ctr') {
      // Placeholder for now – same as most recent until CTR is wired
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    if (sortOption === 'instagram') {
      const aIsIg = (a.platform || '').toLowerCase() === 'instagram';
      const bIsIg = (b.platform || '').toLowerCase() === 'instagram';
      if (aIsIg === bIsIg) return 0;
      return bIsIg ? 1 : -1; // bubble Instagram up
    }

    return 0;
  });

  const displayCampaigns = sortedCampaigns;

  // ---------- RENDER ----------

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-gray-100 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
            Campaigns
          </p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-semibold text-[#00C2CB]">
              Approved campaigns
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="inline-flex h-7 px-3 items-center rounded-full bg-[#181818] border border-[#2a2a2a] text-xs">
                {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'} live
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-400 max-w-xl">
            All campaigns you&apos;ve been approved to run. Click into a campaign to see the
            creative and live tracking.
          </p>
        </header>

        {/* Top controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          {/* Filters */}
          <div className="inline-flex rounded-full bg-[#151515] border border-[#262626] p-1 text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-full transition ${
                activeFilter === 'all'
                  ? 'bg-[#00C2CB] text-black font-medium'
                  : 'text-gray-300 hover:text-white hover:bg-[#1f1f1f]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter('organic')}
              className={`px-3 py-1 rounded-full transition ${
                activeFilter === 'organic'
                  ? 'bg-[#00C2CB] text-black font-medium'
                  : 'text-gray-300 hover:text-white hover:bg-[#1f1f1f]'
              }`}
            >
              Organic
            </button>
            <button
              onClick={() => setActiveFilter('ads')}
              className={`px-3 py-1 rounded-full transition ${
                activeFilter === 'ads'
                  ? 'bg-[#00C2CB] text-black font-medium'
                  : 'text-gray-300 hover:text-white hover:bg-[#1f1f1f]'
              }`}
            >
              Ads
            </button>
          </div>

          {/* Sort */}
          <div className="inline-flex items-center gap-2 rounded-full bg-[#151515] border border-[#262626] px-3 py-1.5 text-xs text-gray-300">
            <span className="uppercase tracking-[0.16em] text-[0.65rem] text-gray-500">
              Sort
            </span>
            <select
              value={sortOption}
              onChange={(e) =>
                setSortOption(
                  e.target.value as 'most_recent' | 'highest_ctr' | 'instagram'
                )
              }
              className="bg-transparent text-xs text-gray-100 focus:outline-none cursor-pointer"
            >
              <option value="most_recent" className="bg-[#151515]">
                Most recent
              </option>
              <option value="highest_ctr" className="bg-[#151515]">
                Highest CTR (coming soon)
              </option>
              <option value="instagram" className="bg-[#151515]">
                Platform: Instagram
              </option>
            </select>
          </div>
        </div>

        {/* Empty state / list */}
        {displayCampaigns.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-dashed border-[#3a3a3a] bg-[#151515] px-4 py-1.5 text-[0.75rem] text-gray-300">
              No campaigns found
            </div>
            <p className="text-sm text-gray-400 max-w-md">
              Try switching filters or check back once more campaigns are live for this
              account.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-10">
            {displayCampaigns.map((campaign) => {
              const platform = campaign.platform || 'Unknown';
              const offerTitle = campaign.offer?.title || 'Unknown offer';
              const status = campaign.status?.toUpperCase() || 'PENDING';
              const isPaused = status === 'PAUSED';

              const statusStyles =
                status === 'APPROVED' || status === 'LIVE'
                  ? 'bg-[#06301b] text-[#8ef3b0] border border-[#15803d]' // green
                  : status === 'SCHEDULED'
                  ? 'bg-[#1f2937] text-[#e5e7eb] border border-[#4b5563]' // neutral scheduled
                  : status === 'PAUSED'
                  ? 'bg-[#3f1e1e] text-[#fecaca] border border-[#b91c1c]' // paused warning
                  : 'bg-[#111827] text-gray-200 border border-[#374151]';

              return (
                <div
                  key={campaign.id}
                  className={`flex items-start justify-between gap-6 rounded-xl px-5 py-4 shadow-sm transition-all duration-200 ${
                    isPaused
                      ? 'border border-[#374151] bg-[#101010] opacity-70'
                      : 'border border-[#222] bg-[#141414] hover:border-[#00C2CB] hover:shadow-[0_0_18px_rgba(0,194,203,0.3)]'
                  }`}
                >
                  {/* Left side */}
                  <div className="flex items-start gap-4">
                    {/* Platform icon */}
                    <div className="mt-1 flex flex-col items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] border border-[#333] text-[#7ff5fb]">
                        <PlatformIcon platform={platform} />
                      </div>
                      <span className="text-[0.6rem] uppercase tracking-[0.12em] text-gray-500">
                        {platform.toUpperCase()}
                      </span>
                    </div>

                    {/* Text content */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {campaign.offer?.logo_url && (
                          <img
                            src={campaign.offer.logo_url}
                            alt="Brand Logo"
                            className="w-7 h-7 rounded-full border border-[#333] object-cover"
                          />
                        )}
                        <p className="text-sm font-semibold text-gray-100">
                          {offerTitle}
                        </p>
                      </div>

                      <h3 className="text-[0.98rem] md:text-[1.05rem] font-medium text-white">
                        {campaign.caption || 'Untitled campaign'}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-[0.75rem] text-gray-400">
                        <span>
                          <span className="text-gray-500">Affiliate:</span>{' '}
                          <span className="text-gray-200">{campaign.affiliate_email}</span>
                        </span>
                        <span className="h-1 w-1 rounded-full bg-gray-600" />
                        <span className="uppercase tracking-[0.12em] text-[0.68rem] text-gray-400">
                          {campaign.type || 'organic'}
                        </span>
                        {campaign.created_at && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-gray-600" />
                            <span className="text-[0.7rem] text-gray-500">
                              Started{' '}
                              {new Date(campaign.created_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                      {isPaused && (
                        <p className="mt-2 text-[0.7rem] text-amber-300">
                          Paused by business – your tracking link is temporarily disabled.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-[0.7rem] font-semibold uppercase tracking-[0.16em] ${statusStyles}`}
                    >
                      {status}
                    </span>
                    <Link
                      href={`/affiliate/dashboard/manage-campaigns/${campaign.id}`}
                      className="text-[0.8rem] text-[#7ff5fb] hover:text-white font-medium inline-flex items-center gap-1 border-b border-transparent hover:border-[#7ff5fb] transition"
                    >
                      View campaign
                      <span className="text-xs">↗</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}