'use client';

import Link from 'next/link';
import { useSession } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';

const ManageCampaignsBusiness = () => {
  const session = useSession();
  const user = session?.user;

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showActive, setShowActive] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchCampaigns = async () => {
      // 1) Fetch organic campaigns
      const { data: organic, error: organicError } = await supabase
        .from('live_campaigns')
        .select(`
          id,
          type,
          offer_id,
          business_email,
          affiliate_email,
          media_url,
          caption,
          platform,
          created_from,
          status,
          created_at
        `)
        .eq('business_email', user.email as string)
        .order('created_at', { ascending: false });

      if (organicError) {
        console.error('[❌ Failed to fetch live_campaigns (organic)]', organicError);
      }

      // 2) Fetch paid Meta ads
      const { data: metaAds, error: metaError } = await supabase
        .from('live_ads')
        .select(`
          id,
          ad_idea_id,
          business_email,
          affiliate_email,
          caption,
          status,
          spend,
          clicks,
          conversions,
          tracking_link,
          campaign_type,
          created_from,
          created_at
        `)
        .eq('business_email', user.email as string)
        .order('created_at', { ascending: false });

      if (metaError) {
        console.error('[❌ Failed to fetch live_ads (meta)]', metaError);
      }

      const merged = [
        ...(organic || []).map((c: any) => ({ ...c, _source: 'organic' })),
        ...(metaAds || []).map((a: any) => ({ ...a, _source: 'meta' })),
      ];

      setCampaigns(merged);
    };

    fetchCampaigns();
  }, [user]);

  console.log('[📢 useEffect Completed]');

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus =
      (currentStatus || '').toUpperCase() === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    const campaign = campaigns.find((c) => c.id === id);
    const source = campaign?._source === 'meta' ? 'live_ads' : 'live_campaigns';

    const { error } = await (supabase as any)
      .from(source)
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('[❌ Failed to update campaign status]', error);
    } else {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
      );
    }
  };

  // 🔴 Permanent stop for paid Meta campaigns (business-only control)
  const handlePermanentStop = async (id: string) => {
    const campaign = campaigns.find((c) => c.id === id);

    // Only applies to paid Meta campaigns stored in live_ads
    if (!campaign || campaign._source !== 'meta') return;

    const confirmed = window.confirm(
      'Permanently stop this ad campaign?\n\nThis will pause delivery in Meta Ads Manager and mark it as STOPPED in Nettmark. It cannot be reactivated from here.'
    );
    if (!confirmed) return;

    try {
      // 1) Pause at Meta level so it actually stops spending
      const res = await fetch('/api/meta/control-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveAdId: id, action: 'PAUSE' }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        console.error('[❌ Failed Meta control from business manage-campaigns]', json);
        alert('Could not stop the Meta campaign. Please try again.');
        return;
      }

      // 2) Mark permanently stopped in Supabase so it moves to archived and cannot be restarted
      const { error } = await (supabase as any)
        .from('live_ads')
        .update({ status: 'STOPPED' })
        .eq('id', id);

      if (error) {
        console.error('[❌ Failed to mark Meta campaign STOPPED in Supabase]', error);
        alert('Meta was paused, but Nettmark could not update the status.');
        return;
      }

      // 3) Update local state so UI reflects the change immediately
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'STOPPED' } : c))
      );
    } catch (err) {
      console.error('[❌ Error in handlePermanentStop]', err);
      alert('Something went wrong while stopping this campaign.');
    }
  };

  const activeCampaigns = campaigns?.filter(
    (c) =>
      (c.status || '').toLowerCase() === 'live' ||
      (c.status || '').toLowerCase() === 'active',
  );

  const archivedCampaigns = campaigns?.filter(
    (c) =>
      (c.status || '').toLowerCase() !== 'live' &&
      (c.status || '').toLowerCase() !== 'active',
  );

  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="mx-auto max-w-6xl px-8 py-10">
        {/* Page header */}
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            Campaigns
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#00C2CB]">
            Manage campaigns
          </h1>
          <p className="mt-2 text-sm text-white/70">
            See every campaign your affiliates are running for this brand,
            pause or inspect performance, and jump into a detailed view.
          </p>
        </header>

        {/* Empty state for the whole page */}
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-6 py-5 text-center text-sm text-yellow-200">
            No campaigns found yet. Once affiliates start running ads for your
            offers, they&apos;ll appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {/* ACTIVE CAMPAIGNS SECTION */}
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
              <button
                type="button"
                onClick={() => setShowActive((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 rounded-3xl px-6 py-4 text-left transition hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C2CB]/10 text-[#00C2CB]">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Active campaigns</h2>
                    <p className="text-xs text-white/60">
                      Campaigns currently delivering traffic for your offers.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="flex items-center justify-center min-w-[70px] rounded-full bg-[#00C2CB]/20 px-3 py-1.5 text-xs font-semibold text-[#00C2CB] shadow-inner shadow-[#00C2CB]/30">
                    {activeCampaigns.length} active
                  </span>
                  <span className="text-2xl leading-none text-[#00C2CB]">
                    {showActive ? '−' : '+'}
                  </span>
                </div>
              </button>

              {showActive && (
                <div className="border-t border-white/5 px-4 py-4 sm:px-6 sm:py-5">
                  {activeCampaigns.length === 0 ? (
                    <p className="rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-white/60">
                      No active campaigns. When an affiliate launches a
                      campaign, it will show here.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activeCampaigns.map((campaign) => (
                        <div
                          key={campaign.id}
                          className="flex flex-col gap-4 rounded-2xl border border-[#00C2CB]/20 bg-black/40 px-4 py-4 shadow-sm shadow-black/40 transition hover:border-[#00C2CB]/60 hover:shadow-[0_0_30px_rgba(0,194,203,0.35)] sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-white">
                              {campaign.caption || 'Untitled campaign'}
                            </p>
                            <p className="text-xs text-white/60">
                              Affiliate:{' '}
                              <span className="text-white">
                                {campaign.affiliate_email || 'N/A'}
                              </span>
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-white/60">
                              {campaign._source === 'meta' ? (
                                <>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                    Meta Ads
                                  </span>
                                  {campaign.campaign_type && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                      {campaign.campaign_type}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {campaign.platform && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                      {campaign.platform}
                                    </span>
                                  )}
                                  {campaign.type && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                      {campaign.type}
                                    </span>
                                  )}
                                </>
                              )}
                              {campaign.created_at && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                  Started {formatDate(campaign.created_at)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 sm:items-end sm:text-right">
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                              {(campaign.status || 'LIVE').toUpperCase()}
                            </span>
                            <div className="flex gap-2">
                              <Link href={`/business/manage-campaigns/${campaign.id}`}>
                                <button className="rounded-full bg-[#00C2CB] px-4 py-1.5 text-xs font-semibold text-black shadow hover:bg-[#00b0b8]">
                                  View campaign
                                </button>
                              </Link>

                              {campaign._source === 'meta' ? (
                                // Paid Meta campaigns: business can only permanently stop them
                                <button
                                  onClick={() => handlePermanentStop(campaign.id)}
                                  className="rounded-full border border-red-500/70 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200"
                                >
                                  Stop permanently
                                </button>
                              ) : (
                                // Organic campaigns keep the softer pause/activate toggle
                                <button
                                  onClick={() =>
                                    handleToggleStatus(campaign.id, campaign.status)
                                  }
                                  className="rounded-full border border-[#00C2CB] bg-transparent px-4 py-1.5 text-xs font-semibold text-[#00C2CB] hover:bg-[#00C2CB]/10"
                                >
                                  {(campaign.status || '').toLowerCase() === 'live' ||
                                  (campaign.status || '').toLowerCase() === 'active'
                                    ? 'Pause'
                                    : 'Activate'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ARCHIVED CAMPAIGNS SECTION */}
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
              <button
                type="button"
                onClick={() => setShowArchived((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 rounded-3xl px-6 py-4 text-left transition hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[#7ff5fb]">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4h16v16H4z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Archived campaigns</h2>
                    <p className="text-xs text-white/60">
                      Paused, completed, or deleted campaigns stay here for
                      history.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="inline-flex items-center justify-center gap-1 rounded-full bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-[#cfd2d3] shadow-inner shadow-black/50 ring-1 ring-white/10 backdrop-blur-sm whitespace-nowrap">
                    <span>{archivedCampaigns.length}</span>
                    <span>archived</span>
                  </span>
                  <span className="text-2xl leading-none text-[#00C2CB]">
                    {showArchived ? '−' : '+'}
                  </span>
                </div>
              </button>

              {showArchived && (
                <div className="border-t border-white/5 px-4 py-4 sm:px-6 sm:py-5">
                  {archivedCampaigns.length === 0 ? (
                    <p className="rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-white/60">
                      No archived campaigns yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {archivedCampaigns.map((campaign) => (
                        <div
                          key={campaign.id}
                          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 shadow-sm shadow-black/40 transition hover:border-white/40 hover:shadow-[0_0_25px_rgba(0,0,0,0.65)] sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-white">
                              {campaign.caption || 'Untitled campaign'}
                            </p>
                            <p className="text-xs text-white/60">
                              Affiliate:{' '}
                              <span className="text-white">
                                {campaign.affiliate_email || 'N/A'}
                              </span>
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-white/60">
                              {campaign._source === 'meta' ? (
                                <>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                    Meta Ads
                                  </span>
                                  {campaign.campaign_type && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                      {campaign.campaign_type}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {campaign.platform && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                      {campaign.platform}
                                    </span>
                                  )}
                                  {campaign.type && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                      {campaign.type}
                                    </span>
                                  )}
                                </>
                              )}
                              {campaign.created_at && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                  Started {formatDate(campaign.created_at)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 sm:items-end sm:text-right">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                (campaign.status || '').toLowerCase() ===
                                'paused'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : (campaign.status || '').toLowerCase() ===
                                    'deleted'
                                  ? 'bg-red-500/15 text-red-300'
                                  : (campaign.status || '').toLowerCase() ===
                                    'stopped'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-slate-500/20 text-slate-200'
                              }`}
                            >
                              {(campaign.status || 'ARCHIVED').toUpperCase()}
                            </span>
                            <div className="flex gap-2">
                              <Link href={`/business/manage-campaigns/${campaign.id}`}>
                                <button className="rounded-full bg-[#00C2CB] px-4 py-1.5 text-xs font-semibold text-black shadow hover:bg-[#00b0b8]">
                                  View campaign
                                </button>
                              </Link>
                              <button className="rounded-full border border-white/20 bg-transparent px-4 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5">
                                Edit details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCampaignsBusiness;