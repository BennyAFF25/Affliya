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
      const { data, error } = await supabase
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

      if (error) {
        console.error('[❌ Failed to fetch campaigns]', error);
      } else {
        setCampaigns(data || []);
      }
    };

    fetchCampaigns();
  }, [user]);

  console.log('[📢 useEffect Completed]');

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus =
      (currentStatus || '').toUpperCase() === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    const { error } = await (supabase as any)
      .from('live_campaigns')
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
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-[#00C2CB]/10 px-3 py-1 text-xs font-medium text-[#7ff5fb]">
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
                              <Link
                                href={`/business/manage-campaigns/${campaign.id}`}
                              >
                                <button className="rounded-full bg-[#00C2CB] px-4 py-1.5 text-xs font-semibold text-black shadow hover:bg-[#00b0b8]">
                                  View campaign
                                </button>
                              </Link>
                              <button
                                onClick={() =>
                                  handleToggleStatus(
                                    campaign.id,
                                    campaign.status,
                                  )
                                }
                                className="rounded-full border border-[#00C2CB] bg-transparent px-4 py-1.5 text-xs font-semibold text-[#00C2CB] hover:bg-[#00C2CB]/10"
                              >
                                {(campaign.status || '').toLowerCase() ===
                                  'live' ||
                                (campaign.status || '').toLowerCase() ===
                                  'active'
                                  ? 'Pause'
                                  : 'Activate'}
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
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                    {archivedCampaigns.length} archived
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
                                  : 'bg-slate-500/20 text-slate-200'
                              }`}
                            >
                              {(campaign.status || 'ARCHIVED').toUpperCase()}
                            </span>
                            <div className="flex gap-2">
                              <Link
                                href={`/business/manage-campaigns/${campaign.id}`}
                              >
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