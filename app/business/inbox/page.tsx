"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import Link from "next/link";
import { supabase } from "utils/supabase/pages-client";
import {
  Megaphone,
  Image as ImageIcon,
  Activity,
  Inbox as InboxIcon,
  Archive,
  ArchiveRestore,
  Users,
  Sparkles,
} from "lucide-react";
import { InboxTabs } from "@/components/inbox/InboxTabs";
import { InboxCard } from "@/components/inbox/InboxCard";

interface Offer {
  id: string;
  title: string;
}

type EntryKind = "ad_idea" | "live_ad" | "organic_post";

interface EntryData {
  id: string;
  kind: EntryKind;
  offerId: string;
  affiliateEmail: string;
  status?: string;
  title: string;
  subtitle?: string;
  body?: string;
  timestamp: string;
  link: { href: string; label: string };
}

interface DecoratedEntry extends EntryData {
  icon: JSX.Element;
  accent: "teal" | "amber" | "neutral";
}

const iconMap: Record<EntryKind, JSX.Element> = {
  ad_idea: <Megaphone className="h-4 w-4" />,
  live_ad: <Activity className="h-4 w-4" />,
  organic_post: <ImageIcon className="h-4 w-4" />,
};

const accentMap: Record<EntryKind, DecoratedEntry["accent"]> = {
  ad_idea: "teal",
  live_ad: "amber",
  organic_post: "neutral",
};

const archiveStorageKey = (email?: string | null) =>
  email ? `nettmark_business_inbox_${email}` : null;

const shouldAutoArchive = (entry: EntryData) => {
  if (entry.status !== "approved") return false;
  return entry.kind === "ad_idea" || entry.kind === "organic_post";
};

export default function BusinessInbox() {
  const session = useSession();
  const user = session?.user;

  const [offers, setOffers] = useState<Offer[]>([]);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [archivedData, setArchivedData] = useState<EntryData[]>([]);

  const [activeTab, setActiveTab] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const offerName = (offerId: string) => {
    const offer = offers.find((offer) => offer.id === offerId);
    return offer?.title || "Unknown offer";
  };

  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error(
          "[❌ Error fetching auth user for offers]",
          error.message,
        );
        return;
      }

      const authUser = data?.user;
      if (!authUser?.email) return;

      const { data: offersData, error: offersErr } = await supabase
        .from("offers")
        .select("id, title")
        .eq("business_email", authUser.email);

      if (offersErr) {
        console.error(
          "[❌ Error fetching offers for inbox]",
          offersErr.message,
        );
        return;
      }

      setOffers(offersData || []);
    };

    fetchOffers();
  }, []);

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

  useEffect(() => {
    const loadEntries = async () => {
      if (offers.length === 0) {
        setEntries([]);
        return;
      }

      const offerIds = offers.map((offer) => offer.id);

      const [adIdeas, liveAds, organicPosts] = await Promise.all([
        supabase.from("ad_ideas").select("*").in("offer_id", offerIds),
        supabase.from("live_ads").select("*").in("offer_id", offerIds),
        supabase.from("organic_posts").select("*").in("offer_id", offerIds),
      ]);

      const list: EntryData[] = [];

      (adIdeas.data || []).forEach((item: any) => {
        list.push({
          id: `adidea-${item.id}`,
          kind: "ad_idea",
          offerId: item.offer_id,
          affiliateEmail: item.affiliate_email,
          status: item.status,
          title: `Ad idea from ${item.affiliate_email}`,
          subtitle: offerName(item.offer_id),
          body: "Review the creative, leave notes, and approve before Meta submission.",
          timestamp: new Date(item.created_at).toLocaleString(),
          link: {
            href: "/business/my-business/ad-ideas",
            label: "Review ad idea",
          },
        });
      });

      (liveAds.data || []).forEach((item: any) => {
        list.push({
          id: `livead-${item.id}`,
          kind: "live_ad",
          offerId: item.offer_id,
          affiliateEmail: item.affiliate_email,
          status: item.status,
          title: `Live ad update: ${offerName(item.offer_id)}`,
          subtitle: item.affiliate_email,
          body: "Monitor performance and ensure wallet transfers stay synced to spend.",
          timestamp: new Date(item.created_at).toLocaleString(),
          link: { href: "/business/manage-campaigns", label: "Open campaigns" },
        });
      });

      (organicPosts.data || []).forEach((item: any) => {
        list.push({
          id: `organic-${item.id}`,
          kind: "organic_post",
          offerId: item.offer_id,
          affiliateEmail: item.affiliate_email,
          status: item.status,
          title: `Organic post idea: ${offerName(item.offer_id)}`,
          subtitle: item.affiliate_email,
          body: "Publish across owned channels or schedule with your team.",
          timestamp: new Date(item.created_at).toLocaleString(),
          link: {
            href: "/business/my-business/post-ideas",
            label: "Review post idea",
          },
        });
      });

      list.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      setEntries(list);
    };

    loadEntries();
  }, [offers]);

  const manualArchivedIds = new Set(archivedData.map((entry) => entry.id));
  const autoArchivedEntries = entries.filter((entry) => shouldAutoArchive(entry));
  const autoArchivedIds = new Set(autoArchivedEntries.map((entry) => entry.id));
  const archivedIds = new Set([
    ...Array.from(manualArchivedIds),
    ...Array.from(autoArchivedIds),
  ]);
  const activeEntriesData = entries.filter((entry) => !archivedIds.has(entry.id));
  const archivedEntriesData = [
    ...autoArchivedEntries,
    ...archivedData.filter((entry) => !autoArchivedIds.has(entry.id)),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const decorateEntries = (data: EntryData[]): DecoratedEntry[] =>
    data.map((entry) => ({
      ...entry,
      icon: iconMap[entry.kind],
      accent: accentMap[entry.kind],
    }));

  const filterByTab = (data: EntryData[], tab: string) => {
    switch (tab) {
      case "ad_ideas":
        return data.filter((entry) => entry.kind === "ad_idea");
      case "live_ads":
        return data.filter((entry) => entry.kind === "live_ad");
      case "organic_posts":
        return data.filter((entry) => entry.kind === "organic_post");
      case "archived":
        return data;
      default:
        return data;
    }
  };

  const displayedData = useMemo(() => {
    const source = activeTab === "archived" ? archivedEntriesData : activeEntriesData;
    return filterByTab(source, activeTab);
  }, [activeTab, activeEntriesData, archivedEntriesData]);

  const displayedEntries = decorateEntries(displayedData);
  const archivedEntries = decorateEntries(archivedEntriesData);
  const liveEntries = decorateEntries(entries);
  const allEntriesMap = new Map<string, DecoratedEntry>();
  liveEntries.forEach((entry) => allEntriesMap.set(entry.id, entry));
  archivedEntries.forEach((entry) => allEntriesMap.set(entry.id, entry));
  const allEntries = Array.from(allEntriesMap.values());

  useEffect(() => {
    if (displayedEntries.length === 0) {
      setSelectedEntryId(null);
      return;
    }
    if (
      !selectedEntryId ||
      !displayedEntries.some((entry) => entry.id === selectedEntryId)
    ) {
      setSelectedEntryId(displayedEntries[0].id);
    }
  }, [displayedEntries, selectedEntryId]);

  const selectedEntry =
    allEntries.find((entry) => entry.id === selectedEntryId) || null;

  const handleArchive = (entryId: string) => {
    if (archivedIds.has(entryId)) return;
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    setArchivedData((prev) => [
      entry,
      ...prev.filter((item) => item.id !== entryId),
    ]);
  };

  const handleRestore = (entryId: string) => {
    setArchivedData((prev) => prev.filter((item) => item.id !== entryId));
  };

  const tabs = [
    {
      id: "all",
      label: "All",
      count: activeEntriesData.length,
      icon: <InboxIcon className="h-3.5 w-3.5" />,
    },
    {
      id: "ad_ideas",
      label: "Ad ideas",
      count: activeEntriesData.filter((i) => i.kind === "ad_idea").length,
    },
    {
      id: "live_ads",
      label: "Live ads",
      count: activeEntriesData.filter((i) => i.kind === "live_ad").length,
    },
    {
      id: "organic_posts",
      label: "Organic",
      count: activeEntriesData.filter((i) => i.kind === "organic_post").length,
    },
    {
      id: "archived",
      label: "Archived",
      count: archivedEntriesData.length,
      icon: <Archive className="h-3.5 w-3.5" />,
    },
  ];

  const suggestionCards = [
    activeEntriesData.length === 0
      ? {
          title: "Zero inbound requests",
          body: "Share your offer listing with affiliates so they can request access.",
          href: "/business/my-business/create-offer",
          label: "Boost visibility",
        }
      : null,
    offers.length === 0
      ? {
          title: "No offers live",
          body: "Create a fresh offer so affiliates can promote you through Nettmark.",
          href: "/business/my-business/create-offer",
          label: "Create offer",
        }
      : null,
  ].filter(Boolean) as {
    title: string;
    body: string;
    href: string;
    label: string;
  }[];

  return (
    <div className="business-inbox-theme min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--foreground)] sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--primary)]/70">
            Business Ops
          </p>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Inbox
            </h1>
            <p className="mt-2 text-base text-[var(--muted-foreground)]">
              Review affiliate submissions, live campaign updates, and organic
              assets without leaving one surface.
            </p>
          </div>
        </header>

        {suggestionCards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {suggestionCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {card.title}
                </p>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {card.body}
                </p>
                <Link
                  href={card.href}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:brightness-110"
                >
                  {card.label}
                  <Sparkles className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        )}

        <InboxTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <div className="space-y-3">
            {displayedEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/5 px-5 py-10 text-center text-sm text-[var(--muted-foreground)]">
                No submissions in this view. Encourage affiliates to submit
                creatives or sync live ads.
              </div>
            ) : (
              displayedEntries.map((entry) => {
                const isArchived = archivedIds.has(entry.id);
                const isAutoArchived = autoArchivedIds.has(entry.id);
                const primaryAction = (
                  <Link
                    href={entry.link.href}
                    className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                  >
                    {entry.link.label}
                  </Link>
                );

                const archiveButton = isAutoArchived ? (
                  <span className="rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--primary)]">
                    Auto-archived
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isArchived) {
                        handleRestore(entry.id);
                      } else {
                        handleArchive(entry.id);
                      }
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      isArchived
                        ? "border-[var(--primary)]/30 text-[var(--primary)] hover:border-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:border-[var(--primary)]/50"
                    }`}
                  >
                    {isArchived ? "Restore" : "Archive"}
                  </button>
                );

                const swipeActions = isAutoArchived ? undefined : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isArchived) {
                        handleRestore(entry.id);
                      } else {
                        handleArchive(entry.id);
                      }
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      isArchived
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    }`}
                  >
                    {isArchived ? "Restore" : "Archive"}
                  </button>
                );

                return (
                  <InboxCard
                    key={entry.id}
                    title={entry.title}
                    subtitle={`${entry.subtitle || offerName(entry.offerId)} • ${entry.affiliateEmail}`}
                    body={entry.body}
                    statusBadge={entry.status}
                    timestamp={entry.timestamp}
                    icon={entry.icon}
                    accent={entry.accent}
                    selected={entry.id === selectedEntryId}
                    onSelect={() => setSelectedEntryId(entry.id)}
                    actions={
                      <>
                        {primaryAction}
                        {archiveButton}
                      </>
                    }
                    swipeActions={swipeActions}
                  />
                );
              })
            )}
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.12)]">
            {selectedEntry ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[var(--primary)]">
                  <span className="rounded-full bg-[var(--primary)]/10 p-2 text-[var(--primary)]">
                    {selectedEntry.icon}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      {selectedEntry.kind}
                    </p>
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">
                      {selectedEntry.title}
                    </h2>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                  <p>
                    <span className="text-[var(--muted-foreground)]/80">
                      Offer:{" "}
                    </span>
                    {offerName(selectedEntry.offerId)}
                  </p>
                  <p>
                    <span className="text-[var(--muted-foreground)]/80">
                      Affiliate:{" "}
                    </span>
                    {selectedEntry.affiliateEmail}
                  </p>
                  {selectedEntry.body && <p>{selectedEntry.body}</p>}
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {selectedEntry.timestamp}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={selectedEntry.link.href}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                  >
                    {selectedEntry.link.label}
                  </Link>
                  {autoArchivedIds.has(selectedEntry.id) ? (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--primary)]">
                      <Archive className="h-4 w-4" /> Archived automatically
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        archivedIds.has(selectedEntry.id)
                          ? handleRestore(selectedEntry.id)
                          : handleArchive(selectedEntry.id)
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted-foreground)] transition hover:border-[var(--primary)]/50 hover:text-[var(--primary)]"
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
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-[var(--muted-foreground)]">
                <Users className="mb-4 h-10 w-10 text-[var(--primary)]" />
                <p className="text-lg font-semibold text-[var(--foreground)]">
                  Select a submission
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Choose an item on the left to see affiliate details, offer
                  context, and quick actions.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
