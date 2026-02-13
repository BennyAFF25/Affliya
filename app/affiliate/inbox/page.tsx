'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import { supabase } from 'utils/supabase/pages-client';
import {
  Rocket,
  Sparkles,
  Bell,
  AlertTriangle,
  Inbox as InboxIcon,
  ArrowUpRight,
  ArchiveRestore,
  Archive,
} from 'lucide-react';
import { InboxTabs } from '@/components/inbox/InboxTabs';
import { InboxCard } from '@/components/inbox/InboxCard';

interface AffiliateRequest {
  id: string;
  offer_id: string;
  status: string;
  created_at: string;
}

interface AdIdea {
  id: string;
  offer_id: string;
  status: string;
  created_at: string;
  rejection_reason?: string;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  created_at: string;
}

interface Offer {
  id: string;
  title: string;
}

type EntryKind = 'approval' | 'creative' | 'rejection' | 'alert';

interface EntryData {
  id: string;
  kind: EntryKind;
  title: string;
  subtitle?: string;
  body?: string;
  statusLabel?: string;
  timestamp: string;
  link?: { href: string; label: string };
  badge?: string;
  rejectionReason?: string;
}

interface DecoratedEntry extends EntryData {
  icon: JSX.Element;
  accent: 'teal' | 'amber' | 'red' | 'neutral';
}

const iconMap: Record<EntryKind, JSX.Element> = {
  approval: <Rocket className="h-4 w-4" />,
  creative: <Sparkles className="h-4 w-4" />,
  alert: <Bell className="h-4 w-4" />,
  rejection: <AlertTriangle className="h-4 w-4" />,
};

const accentMap: Record<EntryKind, DecoratedEntry['accent']> = {
  approval: 'teal',
  creative: 'teal',
  alert: 'amber',
  rejection: 'red',
};

const archiveStorageKey = (email?: string | null) =>
  email ? `nettmark_affiliate_inbox_${email}` : null;

export default function AffiliateInbox() {
  const session = useSession();
  const user = session?.user;

  const [approvedRequests, setApprovedRequests] = useState<AffiliateRequest[]>([]);
  const [approvedAds, setApprovedAds] = useState<AdIdea[]>([]);
  const [rejectedAds, setRejectedAds] = useState<AdIdea[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [archivedData, setArchivedData] = useState<EntryData[]>([]);

  const [activeTab, setActiveTab] = useState('all');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase.from('offers').select('id, title');
      if (error) {
        console.error('[❌ Error fetching offers]', error.message);
        return;
      }
      setOffers(data || []);
    };

    fetchOffers();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.email) return;

      const { data: requests } = await supabase
        .from('affiliate_requests')
        .select('*')
        .eq('affiliate_email', user.email)
        .eq('status', 'approved');

      const { data: ads } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('affiliate_email', user.email)
        .eq('status', 'approved');

      const { data: rejected } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('affiliate_email', user.email)
        .eq('status', 'rejected');

      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false });

      setApprovedRequests(requests || []);
      setApprovedAds(ads || []);
      setRejectedAds(rejected || []);
      setNotifications(notifs || []);
    };

    fetchNotifications();
  }, [user]);

  useEffect(() => {
    if (!user?.email) return;
    const key = archiveStorageKey(user.email);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setArchivedData(raw ? JSON.parse(raw) : []);
    } catch {
      setArchivedData([]);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    const key = archiveStorageKey(user.email);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(archivedData));
  }, [archivedData, user?.email]);

  const offerName = (offerId: string) => {
    const offer = offers.find((o) => o.id === offerId);
    return offer?.title || 'Unknown Offer';
  };

  const entryData = useMemo<EntryData[]>(() => {
    const entries: EntryData[] = [];

    approvedRequests.forEach((req) => {
      entries.push({
        id: `approval-${req.id}`,
        kind: 'approval',
        title: `Offer unlocked: ${offerName(req.offer_id)}`,
        subtitle: 'Promotion access granted',
        body: 'You can now run ads through this business account. Get live within Nettmark and keep wallet balances topped up to avoid pauses.',
        statusLabel: 'Approved',
        timestamp: new Date(req.created_at).toLocaleString(),
        link: { href: `/affiliate/dashboard/promote/${req.offer_id}`, label: 'Open offer' },
      });
    });

    approvedAds.forEach((ad) => {
      entries.push({
        id: `creative-${ad.id}`,
        kind: 'creative',
        title: `Creative approved: ${offerName(ad.offer_id)}`,
        subtitle: 'Ad idea ready to launch',
        body: 'Deploy this creative via your campaign dashboard. Remember to monitor spend and submit performance notes back to the business.',
        statusLabel: 'Ready',
        timestamp: new Date(ad.created_at).toLocaleString(),
        link: { href: `/affiliate/dashboard/manage-campaigns/${ad.offer_id}`, label: 'Launch creative' },
      });
    });

    rejectedAds.forEach((ad) => {
      entries.push({
        id: `rejection-${ad.id}`,
        kind: 'rejection',
        title: `Creative rejected: ${offerName(ad.offer_id)}`,
        subtitle: 'Feedback available',
        body: 'Adjust your copy or media according to the reviewer notes and re-submit for approval.',
        statusLabel: 'Action needed',
        timestamp: new Date(ad.created_at).toLocaleString(),
        rejectionReason: ad.rejection_reason,
        link: { href: `/affiliate/dashboard/manage-campaigns/${ad.offer_id}`, label: 'Revise creative' },
      });
    });

    notifications.forEach((notif) => {
      entries.push({
        id: `alert-${notif.id}`,
        kind: 'alert',
        title: notif.title,
        subtitle: 'Platform notification',
        body: notif.body,
        timestamp: new Date(notif.created_at).toLocaleString(),
        link: notif.link_url ? { href: notif.link_url, label: 'View details' } : undefined,
      });
    });

    return entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [approvedRequests, approvedAds, rejectedAds, notifications, offers]);

  const archivedIds = new Set(archivedData.map((entry) => entry.id));
  const activeData = entryData.filter((entry) => !archivedIds.has(entry.id));

  const decorateEntries = (data: EntryData[]): DecoratedEntry[] =>
    data.map((entry) => ({
      ...entry,
      icon: iconMap[entry.kind],
      accent: accentMap[entry.kind],
    }));

  const filterByTab = (data: EntryData[], tab: string) => {
    switch (tab) {
      case 'approvals':
        return data.filter((item) => item.kind === 'approval');
      case 'creatives':
        return data.filter((item) => item.kind === 'creative');
      case 'alerts':
        return data.filter((item) => item.kind === 'alert');
      case 'rejections':
        return data.filter((item) => item.kind === 'rejection');
      case 'archived':
        return data;
      default:
        return data;
    }
  };

  const displayedData = useMemo(() => {
    const source = activeTab === 'archived' ? archivedData : activeData;
    return filterByTab(source, activeTab);
  }, [activeTab, activeData, archivedData]);

  const displayedEntries = decorateEntries(displayedData);
  const archivedEntries = decorateEntries(archivedData);
  const activeEntries = decorateEntries(activeData);
  const liveEntries = decorateEntries(entryData);
  const allEntriesMap = new Map<string, DecoratedEntry>();
  liveEntries.forEach((entry) => allEntriesMap.set(entry.id, entry));
  archivedEntries.forEach((entry) => allEntriesMap.set(entry.id, entry));
  const allEntries = Array.from(allEntriesMap.values());

  useEffect(() => {
    if (displayedEntries.length === 0) {
      setSelectedEntryId(null);
      return;
    }
    if (!selectedEntryId || !displayedEntries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(displayedEntries[0].id);
    }
  }, [displayedEntries, selectedEntryId]);

  const selectedEntry = allEntries.find((entry) => entry.id === selectedEntryId) || null;

  const handleArchive = (entryId: string) => {
    if (archivedIds.has(entryId)) return;
    const entry = entryData.find((item) => item.id === entryId);
    if (!entry) return;
    setArchivedData((prev) => [entry, ...prev.filter((item) => item.id !== entryId)]);
  };

  const handleRestore = (entryId: string) => {
    setArchivedData((prev) => prev.filter((item) => item.id !== entryId));
  };

  const tabs = [
    { id: 'all', label: 'All', count: activeData.length, icon: <InboxIcon className="h-3.5 w-3.5" /> },
    { id: 'approvals', label: 'Approvals', count: activeData.filter((i) => i.kind === 'approval').length },
    { id: 'creatives', label: 'Creatives', count: activeData.filter((i) => i.kind === 'creative').length },
    { id: 'alerts', label: 'Alerts', count: activeData.filter((i) => i.kind === 'alert').length },
    { id: 'rejections', label: 'Feedback', count: activeData.filter((i) => i.kind === 'rejection').length },
    { id: 'archived', label: 'Archived', count: archivedData.length, icon: <Archive className="h-3.5 w-3.5" /> },
  ];

  const suggestionCards = [
    approvedRequests.length === 0
      ? {
          title: 'No approved offers yet',
          body: 'Browse the marketplace to request access and start running new campaigns.',
          href: '/affiliate/marketplace',
          label: 'Browse marketplace',
        }
      : null,
    {
      title: 'Want new offers?',
      body: 'Head to the marketplace to discover fresh offers and request promotion access.',
      href: '/affiliate/marketplace',
      label: 'Open marketplace',
    },
  ].filter(Boolean) as { title: string; body: string; href: string; label: string }[];

  return (
    <div className="min-h-screen bg-surface text-white px-4 sm:px-8 lg:px-12 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-[#00C2CB]/70">Command Center</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Inbox</h1>
              <p className="mt-2 text-base text-white/70">
                Approvals, creative feedback, and Nettmark alerts in one streamlined lane.
              </p>
            </div>
          </div>
        </header>

        {suggestionCards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {suggestionCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-white/10 bg-[#0c0c0c] px-6 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <p className="text-sm font-semibold text-white">{card.title}</p>
                <p className="mt-2 text-sm text-white/70">{card.body}</p>
                <Link
                  href={card.href}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#00C2CB] hover:text-[#00b0b8]"
                >
                  {card.label}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-6">
          <InboxTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
            <div className="space-y-3">
              {displayedEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white/60">
                  Nothing in this view yet. Switch tabs or head to the marketplace to get moving.
                </div>
              ) : (
                displayedEntries.map((entry) => {
                  const isArchived = archivedIds.has(entry.id);
                  const actions = (
                    <>
                      {entry.link && (
                        <Link
                          href={entry.link.href}
                          className="rounded-lg bg-[#00C2CB] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#00b0b8]"
                        >
                          {entry.link.label}
                        </Link>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          isArchived ? handleRestore(entry.id) : handleArchive(entry.id);
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          isArchived
                            ? 'border-[#00C2CB]/30 text-[#00C2CB] hover:border-[#00C2CB]'
                            : 'border-white/15 text-white/70 hover:text-[#00C2CB] hover:border-[#00C2CB]/50'
                        }`}
                      >
                        {isArchived ? 'Restore' : 'Archive'}
                      </button>
                    </>
                  );

                  const swipeActions = (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        isArchived ? handleRestore(entry.id) : handleArchive(entry.id);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        isArchived ? 'bg-[#00C2CB]/20 text-[#00C2CB]' : 'bg-[#00C2CB] text-black'
                      }`}
                    >
                      {isArchived ? 'Restore' : 'Archive'}
                    </button>
                  );

                  return (
                    <InboxCard
                      key={entry.id}
                      title={entry.title}
                      subtitle={entry.subtitle}
                      body={entry.body}
                      statusBadge={entry.statusLabel}
                      timestamp={entry.timestamp}
                      icon={entry.icon}
                      accent={entry.accent}
                      selected={entry.id === selectedEntryId}
                      onSelect={() => setSelectedEntryId(entry.id)}
                      actions={actions}
                      swipeActions={swipeActions}
                    />
                  );
                })
              )}
            </div>

            <aside className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0c0c] to-[#070707] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.45)]">
              {selectedEntry ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-[#00C2CB]">
                    <span className="rounded-full bg-[#00C2CB]/10 p-2 text-white">{selectedEntry.icon}</span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">{selectedEntry.kind}</p>
                      <h2 className="text-lg font-semibold text-white">{selectedEntry.title}</h2>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-white/70">
                    {selectedEntry.subtitle && <p className="text-white/80">{selectedEntry.subtitle}</p>}
                    {selectedEntry.body && <p>{selectedEntry.body}</p>}
                    {selectedEntry.rejectionReason && (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                        <p className="font-semibold text-red-300">Reviewer notes</p>
                        <p className="mt-1 text-white/80">{selectedEntry.rejectionReason}</p>
                      </div>
                    )}
                    <p className="text-xs text-white/40">{selectedEntry.timestamp}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.link && (
                      <Link
                        href={selectedEntry.link.href}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#00b0b8]"
                      >
                        {selectedEntry.link.label}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    )}
                    <button
                      onClick={() =>
                        archivedIds.has(selectedEntry.id)
                          ? handleRestore(selectedEntry.id)
                          : handleArchive(selectedEntry.id)
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-[#00C2CB]/50 hover:text-[#00C2CB]"
                    >
                      {archivedIds.has(selectedEntry.id) ? (
                        <>
                          <ArchiveRestore className="h-4 w-4" /> Restore
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4" /> Archive
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-white/60">
                  <InboxIcon className="mb-4 h-10 w-10 text-[#00C2CB]" />
                  <p className="text-lg font-semibold text-white">Select a message</p>
                  <p className="mt-1 text-sm text-white/70">
                    Choose an item on the left to see full details, reviewer notes, and shortcuts.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
