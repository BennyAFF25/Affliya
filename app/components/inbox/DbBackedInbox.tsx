"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Inbox as InboxIcon,
  MailOpen,
  Megaphone,
  Rocket,
  Users,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";
import { Button, Card, EmptyState, PageHeader } from "@/../components/ui";
import { InboxCard } from "@/components/inbox/InboxCard";
import { InboxTabs } from "@/components/inbox/InboxTabs";

type InboxAudience = "affiliate" | "business";
type InboxSource = "inbox_messages" | "notifications";
type InboxAccent = "teal" | "amber" | "red" | "neutral";

type InboxMessageRow = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  sender_email: string;
  sender_role: string;
  sender_name?: string | null;
  recipient_email: string;
  recipient_role: string;
  message_type: string;
  title: string;
  body: string;
  preview?: string | null;
  offer_id?: string | null;
  campaign_id?: string | null;
  affiliate_request_id?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  read_at?: string | null;
  archived_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

type OfferRow = {
  id: string;
  title: string;
};

type QueryError = { message: string } | null;
type SelectResult<T> = Promise<{ data: T[] | null; error: QueryError }>;
type UpdateResult = Promise<{ error: QueryError }>;
type LooseSelectQuery<T> = {
  eq: (column: string, value: string) => LooseSelectQuery<T>;
  order: (column: string, options: { ascending: boolean }) => SelectResult<T>;
};
type LooseTable = {
  select: <T>(columns: string) => LooseSelectQuery<T>;
  update: (values: Record<string, string | null>) => {
    eq: (column: string, value: string) => UpdateResult;
  };
};
type LooseSupabase = {
  from: (table: string) => LooseTable;
};

const inboxSupabase = supabase as unknown as LooseSupabase;

type InboxEntry = {
  id: string;
  source: InboxSource;
  rawId: string;
  sender: string;
  senderRole: string;
  messageType: string;
  title: string;
  preview?: string;
  body?: string;
  offerId?: string;
  campaignId?: string;
  createdAt: string;
  readAt?: string | null;
  archivedAt?: string | null;
  cta?: { href: string; label: string };
  accent: InboxAccent;
  icon: React.ReactElement;
};

interface DbBackedInboxProps {
  audience: InboxAudience;
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  selectTitle: string;
  selectDescription: string;
  suggestionCards?: Array<{
    title: string;
    body: string;
    href: string;
    label: string;
  }>;
}

const roleLabel = (value?: string | null) => {
  if (!value) return "Nettmark";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const typeLabel = (value?: string | null) => roleLabel(value || "message");

const dateLabel = (value?: string | null) => {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString();
};

const archiveStorageKey = (audience: InboxAudience, email?: string | null) =>
  email ? `nettmark_${audience}_inbox_${email}` : null;

const isLaunchInvite = (entry: Pick<InboxEntry, "messageType" | "title">) => {
  const haystack = `${entry.messageType} ${entry.title}`.toLowerCase();
  return (
    haystack.includes("launch_invite") ||
    haystack.includes("launch invite") ||
    haystack.includes("launch invitation") ||
    haystack.includes("campaign invite")
  );
};

const accentForType = (messageType?: string | null): InboxAccent => {
  const type = String(messageType || "").toLowerCase();
  if (type.includes("reject") || type.includes("declined")) return "red";
  if (type.includes("invite") || type.includes("launch")) return "teal";
  if (type.includes("approval") || type.includes("approved")) return "teal";
  if (type.includes("alert") || type.includes("warning")) return "amber";
  return "neutral";
};

const iconForType = (messageType?: string | null) => {
  const type = String(messageType || "").toLowerCase();
  if (type.includes("launch") || type.includes("invite")) {
    return <Rocket className="h-4 w-4" />;
  }
  if (type.includes("approval") || type.includes("creative")) {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  if (type.includes("campaign") || type.includes("ad")) {
    return <Megaphone className="h-4 w-4" />;
  }
  return <Bell className="h-4 w-4" />;
};

export function DbBackedInbox({
  audience,
  title,
  eyebrow,
  description,
  emptyTitle,
  emptyDescription,
  selectTitle,
  selectDescription,
  suggestionCards = [],
}: DbBackedInboxProps) {
  const session = useSession();
  const user = session?.user;

  const [messages, setMessages] = useState<InboxMessageRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [localArchivedIds, setLocalArchivedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInbox = async () => {
      if (!user?.email) return;
      setLoading(true);

      const [messageResult, notificationResult, offerResult] =
        await Promise.all([
          inboxSupabase
            .from("inbox_messages")
            .select<InboxMessageRow>("*")
            .eq("recipient_email", user.email)
            .order("created_at", { ascending: false }),
          supabase
            .from("notifications")
            .select("id, title, body, link_url, read_at, created_at")
            .eq("user_email", user.email)
            .order("created_at", { ascending: false }),
          supabase.from("offers").select("id, title"),
        ]);

      if (messageResult.error) {
        console.error(
          "[Inbox messages fetch failed]",
          messageResult.error.message,
        );
        setMessages([]);
      } else {
        const rows = ((messageResult.data || []) as InboxMessageRow[]).filter(
          (row) => row.recipient_role === audience,
        );
        setMessages(rows);
      }

      if (notificationResult.error) {
        console.error(
          "[Notifications fetch failed]",
          notificationResult.error.message,
        );
        setNotifications([]);
      } else {
        setNotifications((notificationResult.data || []) as NotificationRow[]);
      }

      if (offerResult.error) {
        console.error("[Offers fetch failed]", offerResult.error.message);
        setOffers([]);
      } else {
        setOffers((offerResult.data || []) as OfferRow[]);
      }

      setLoading(false);
    };

    loadInbox();
  }, [audience, user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    const key = archiveStorageKey(audience, user.email);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      setLocalArchivedIds(
        Array.isArray(parsed)
          ? parsed
              .map((item) => (typeof item === "string" ? item : item?.id))
              .filter((id): id is string => typeof id === "string")
          : [],
      );
    } catch {
      setLocalArchivedIds([]);
    }
  }, [audience, user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    const key = archiveStorageKey(audience, user.email);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(localArchivedIds));
  }, [audience, localArchivedIds, user?.email]);

  const offerName = (offerId?: string | null) => {
    if (!offerId) return null;
    return offers.find((offer) => offer.id === offerId)?.title || offerId;
  };

  const entries = useMemo<InboxEntry[]>(() => {
    const messageEntries = messages.map((row) => {
      const messageType = row.message_type;
      const ctaHref = row.cta_url || null;
      const ctaLabel = row.cta_label || "View details";
      const sender =
        row.sender_name || row.sender_email || roleLabel(row.sender_role);

      return {
        id: `db-${row.id}`,
        source: "inbox_messages" as const,
        rawId: row.id,
        sender,
        senderRole: roleLabel(row.sender_role),
        messageType: typeLabel(messageType),
        title: row.title,
        preview: row.preview || row.body || undefined,
        body: row.body || row.preview || undefined,
        offerId: row.offer_id || undefined,
        campaignId: row.campaign_id || undefined,
        createdAt: row.created_at || row.updated_at || new Date().toISOString(),
        readAt: row.read_at,
        archivedAt: row.archived_at,
        cta: ctaHref ? { href: ctaHref, label: ctaLabel } : undefined,
        accent: accentForType(messageType),
        icon: iconForType(messageType),
      } satisfies InboxEntry;
    });

    const notificationEntries = notifications.map((row) => ({
      id: `notification-${row.id}`,
      source: "notifications" as const,
      rawId: row.id,
      sender: "Nettmark",
      senderRole: "Platform",
      messageType: "Notification",
      title: row.title,
      preview: row.body || undefined,
      body: row.body || undefined,
      createdAt: row.created_at,
      readAt: row.read_at,
      archivedAt: null,
      cta: row.link_url
        ? { href: row.link_url, label: "View details" }
        : undefined,
      accent: "amber" as const,
      icon: <Bell className="h-4 w-4" />,
    }));

    return [...messageEntries, ...notificationEntries].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages, notifications]);

  const archivedIds = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.archivedAt)
          .map((entry) => entry.id)
          .concat(localArchivedIds),
      ),
    [entries, localArchivedIds],
  );

  const activeEntries = entries.filter((entry) => !archivedIds.has(entry.id));
  const archivedEntries = entries.filter((entry) => archivedIds.has(entry.id));

  const displayedEntries = useMemo(() => {
    const source = activeTab === "archived" ? archivedEntries : activeEntries;
    switch (activeTab) {
      case "unread":
        return source.filter((entry) => !entry.readAt);
      case "launch_invites":
        return source.filter(isLaunchInvite);
      case "archived":
        return source;
      default:
        return source;
    }
  }, [activeEntries, activeTab, archivedEntries]);

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
    entries.find((entry) => entry.id === selectedEntryId) || null;

  const updateReadState = async (entry: InboxEntry) => {
    const timestamp = new Date().toISOString();
    if (entry.source === "inbox_messages") {
      setMessages((prev) =>
        prev.map((row) =>
          row.id === entry.rawId ? { ...row, read_at: timestamp } : row,
        ),
      );
      const { error } = await inboxSupabase
        .from("inbox_messages")
        .update({ read_at: timestamp })
        .eq("id", entry.rawId);
      if (error) console.error("[Inbox mark-read failed]", error.message);
      return;
    }

    setNotifications((prev) =>
      prev.map((row) =>
        row.id === entry.rawId ? { ...row, read_at: timestamp } : row,
      ),
    );
    const { error } = await inboxSupabase
      .from("notifications")
      .update({ read_at: timestamp })
      .eq("id", entry.rawId);
    if (error) console.error("[Notification mark-read failed]", error.message);
  };

  const updateArchiveState = async (entry: InboxEntry, archive: boolean) => {
    setLocalArchivedIds((prev) =>
      archive
        ? Array.from(new Set([entry.id, ...prev]))
        : prev.filter((item) => item !== entry.id),
    );

    if (entry.source !== "inbox_messages") return;

    const { error } = await inboxSupabase
      .from("inbox_messages")
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .eq("id", entry.rawId);
    if (error) console.error("[Inbox archive update failed]", error.message);
  };

  const tabs = [
    {
      id: "all",
      label: "All",
      count: activeEntries.length,
      icon: <InboxIcon className="h-3.5 w-3.5" />,
    },
    {
      id: "unread",
      label: "Unread",
      count: activeEntries.filter((entry) => !entry.readAt).length,
      icon: <MailOpen className="h-3.5 w-3.5" />,
    },
    {
      id: "launch_invites",
      label: "Launch Invites",
      count: activeEntries.filter(isLaunchInvite).length,
      icon: <Rocket className="h-3.5 w-3.5" />,
    },
    {
      id: "archived",
      label: "Archived",
      count: archivedEntries.length,
      icon: <Archive className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 lg:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Card variant="elevated" className="px-5 py-6 sm:px-6">
          <PageHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
          />
        </Card>

        {suggestionCards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {suggestionCards.map((card) => (
              <Card key={card.title} className="p-5">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {card.title}
                </p>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {card.body}
                </p>
                <Button
                  href={card.href}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  {card.label}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}

        <InboxTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
          <div className="space-y-3">
            {displayedEntries.length === 0 ? (
              <EmptyState
                icon={<InboxIcon className="h-5 w-5" />}
                title={loading ? "Loading inbox…" : emptyTitle}
                description={
                  loading
                    ? "Fetching your latest database-backed messages."
                    : emptyDescription
                }
                className="border-dashed"
              />
            ) : (
              displayedEntries.map((entry) => {
                const isArchived = archivedIds.has(entry.id);
                const isUnread = !entry.readAt;
                const relatedOffer = offerName(entry.offerId);
                const subtitle = `${entry.sender} · ${entry.senderRole} · ${entry.messageType}`;
                const metaParts = [
                  relatedOffer ? `Offer: ${relatedOffer}` : null,
                  entry.campaignId ? `Campaign: ${entry.campaignId}` : null,
                ].filter(Boolean);

                return (
                  <InboxCard
                    key={entry.id}
                    title={entry.title}
                    subtitle={subtitle}
                    body={entry.preview || entry.body}
                    statusBadge={isUnread ? "Unread" : "Read"}
                    timestamp={dateLabel(entry.createdAt)}
                    icon={entry.icon}
                    accent={isUnread ? entry.accent : "neutral"}
                    selected={entry.id === selectedEntryId}
                    onSelect={() => setSelectedEntryId(entry.id)}
                    meta={
                      metaParts.length > 0 ? metaParts.join(" · ") : undefined
                    }
                    actions={
                      <>
                        {entry.cta && (
                          <Button href={entry.cta.href} size="sm">
                            {entry.cta.label}
                          </Button>
                        )}
                        {isUnread && (
                          <Button
                            onClick={(
                              e: React.MouseEvent<
                                HTMLButtonElement | HTMLAnchorElement
                              >,
                            ) => {
                              e.stopPropagation();
                              updateReadState(entry);
                            }}
                            variant="outline"
                            size="sm"
                          >
                            Mark read
                          </Button>
                        )}
                        <Button
                          onClick={(
                            e: React.MouseEvent<
                              HTMLButtonElement | HTMLAnchorElement
                            >,
                          ) => {
                            e.stopPropagation();
                            updateArchiveState(entry, !isArchived);
                          }}
                          variant={isArchived ? "outline" : "secondary"}
                          size="sm"
                        >
                          {isArchived ? "Restore" : "Archive"}
                        </Button>
                      </>
                    }
                    swipeActions={
                      <Button
                        onClick={(
                          e: React.MouseEvent<
                            HTMLButtonElement | HTMLAnchorElement
                          >,
                        ) => {
                          e.stopPropagation();
                          updateArchiveState(entry, !isArchived);
                        }}
                        variant={isArchived ? "outline" : "primary"}
                        size="sm"
                      >
                        {isArchived ? "Restore" : "Archive"}
                      </Button>
                    }
                  />
                );
              })
            )}
          </div>

          <Card className="p-5 lg:p-6">
            {selectedEntry ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3 text-[var(--primary)]">
                  <span className="rounded-full bg-[var(--primary)]/10 p-2 text-[var(--primary)]">
                    {selectedEntry.icon}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      {selectedEntry.messageType}
                    </p>
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">
                      {selectedEntry.title}
                    </h2>
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Sender
                    </p>
                    <p className="mt-1 font-medium text-[var(--foreground)]">
                      {selectedEntry.sender}
                    </p>
                    <p>{selectedEntry.senderRole}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Status
                    </p>
                    <p className="mt-1 font-medium text-[var(--foreground)]">
                      {selectedEntry.readAt ? "Read" : "Unread"}
                    </p>
                    <p>{dateLabel(selectedEntry.createdAt)}</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
                  {selectedEntry.body && <p>{selectedEntry.body}</p>}
                  {(offerName(selectedEntry.offerId) ||
                    selectedEntry.campaignId) && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-[var(--foreground)]/85">
                      {offerName(selectedEntry.offerId) && (
                        <p>Offer: {offerName(selectedEntry.offerId)}</p>
                      )}
                      {selectedEntry.campaignId && (
                        <p>Campaign: {selectedEntry.campaignId}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedEntry.cta && (
                    <Button href={selectedEntry.cta.href}>
                      {selectedEntry.cta.label}
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  )}
                  {!selectedEntry.readAt && (
                    <Button
                      onClick={() => updateReadState(selectedEntry)}
                      variant="outline"
                    >
                      <MailOpen className="h-4 w-4" /> Mark read
                    </Button>
                  )}
                  <Button
                    onClick={() =>
                      updateArchiveState(
                        selectedEntry,
                        !archivedIds.has(selectedEntry.id),
                      )
                    }
                    variant="secondary"
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
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-[var(--muted-foreground)]">
                <Users className="mb-4 h-10 w-10 text-[var(--primary)]" />
                <p className="text-lg font-semibold text-[var(--foreground)]">
                  {selectTitle}
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {selectDescription}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
