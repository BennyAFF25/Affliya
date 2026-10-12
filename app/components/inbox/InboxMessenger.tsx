"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CheckCheck, MessageCircle, RefreshCw, Search, Send,
  Store, UserRound,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

type Contact = {
  key: string; offerId: string; offerTitle: string;
  businessUserId: string; affiliateUserId: string;
  displayName: string; partnerRole: "affiliate" | "business";
};
type ChatMessage = {
  id: string; key: string; senderId: string; body: string;
  createdAt: string; readAt: string | null;
};
type Snapshot = {
  success: boolean; error?: string; contacts: Contact[];
  messages: ChatMessage[]; viewerId: string;
};
type InboxAudience = "affiliate" | "business";

const when = (value: string) => new Date(value).toLocaleString("en-AU", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});

export function InboxMessenger({ audience }: { audience: InboxAudience }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/chat", { cache: "no-store", credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as Snapshot | null;
      if (!res.ok || !data?.success) throw new Error(data?.error || "Unable to load conversations.");
      setContacts(data.contacts);
      setMessages(data.messages);
      setViewerId(data.viewerId);
      setError("");
      setActiveKey((current) =>
        current && data.contacts.some((c) => c.key === current)
          ? current
          : (data.contacts.find((c) => data.messages.some((m) => m.key === c.key)) || data.contacts[0])?.key || null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    // Realtime INSERT events respect participant-only SELECT RLS. Focus/interval
    // refresh is a fallback for browser sleep or dropped websocket connections.
    const channel = supabase.channel("inbox-chat-" + audience)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "inbox_chat_messages" },
        () => { void refresh(); })
      .subscribe();
    const focus = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") focus(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12000);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [audience, refresh]);

  const enriched = useMemo(() => contacts.map((contact) => {
    const history = messages.filter((m) => m.key === contact.key);
    const latest = history.length ? history.reduce((a, b) =>
      a.createdAt > b.createdAt ? a : b
    ) : null;
    return {
      ...contact,
      latest,
      unread: history.filter((m) => m.senderId !== viewerId && !m.readAt).length,
    };
  }).sort((a, b) => (b.latest?.createdAt || "").localeCompare(a.latest?.createdAt || "")), [contacts, messages, viewerId]);

  const shown = enriched.filter((c) =>
    (c.displayName + " " + c.offerTitle).toLowerCase().includes(query.toLowerCase()));
  const current = enriched.find((c) => c.key === activeKey);
  const history = useMemo(() =>
    messages.filter((m) => m.key === activeKey)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages, activeKey]);

  useEffect(() => {
    if (!current || !viewerId || current.unread === 0) return;
    const key = current.key;
    void fetch("/api/inbox/chat", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: current.offerId, affiliateUserId: current.affiliateUserId }),
    }).then((res) => {
      if (!res.ok) return;
      setMessages((prev) => prev.map((m) =>
        m.key === key && m.senderId !== viewerId && !m.readAt
          ? { ...m, readAt: new Date().toISOString() } : m
      ));
    }).catch(() => { /* will retry on next successful refresh */ });
  }, [current, viewerId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [history.length, activeKey]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!current || sending || !draft.trim()) return;
    const text = draft.trim();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/inbox/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: current.offerId,
          affiliateUserId: current.affiliateUserId,
          text,
          clientMessageId: crypto.randomUUID(),
        }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) throw new Error(result?.error || "Your message could not be sent.");
      setDraft("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Direct messages" className="overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#151718] shadow-[0_22px_65px_rgba(0,0,0,0.18)]">
      <div className="flex min-h-[570px] flex-col md:h-[min(740px,calc(100vh-220px))] md:min-h-[550px] md:flex-row">
        <aside className={(mobileThread ? "hidden " : "flex ") + "w-full shrink-0 flex-col border-white/[0.08] md:flex md:w-[330px] md:border-r xl:w-[355px]"}>
          <div className="border-b border-white/[0.08] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5fe6ec]">Private conversations</p>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Message approved partners</p>
              </div>
              <button type="button" onClick={() => { void refresh(); }} aria-label="Refresh messages"
                className="rounded-lg border border-white/10 p-2.5 text-slate-300 hover:bg-white/[0.05]">
                <RefreshCw size={15} />
              </button>
            </div>
            <label className="relative mt-4 block">
              <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
              <span className="sr-only">Search conversations</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts or offers"
                className="w-full rounded-xl border border-white/[0.10] bg-[#101415] py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#00C2CB]/60" />
            </label>
          </div>
          <div className="max-h-[460px] flex-1 overflow-y-auto md:max-h-none">
            {loading && !contacts.length ? (
              <p role="status" className="p-5 text-sm text-slate-400">Loading contacts…</p>
            ) : !shown.length ? (
              <div className="p-6 text-center text-sm text-slate-400">
                <MessageCircle className="mx-auto mb-3 h-6 w-6 text-[#00C2CB]" />
                {query ? "No matching partners." : "No approved partnerships yet. Conversations become available once an affiliate is approved for an offer."}
              </div>
            ) : shown.map((contact) => (
              <button key={contact.key} type="button" onClick={() => { setActiveKey(contact.key); setMobileThread(true); setError(""); }}
                className={"flex w-full items-center gap-3 border-b border-white/[0.055] p-3.5 text-left transition hover:bg-white/[0.04] " +
                  (contact.key === activeKey ? "bg-[#00C2CB]/[0.065]" : "")}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#00C2CB]/15 bg-[#00C2CB]/[0.09] text-[#22d5de]">
                  {contact.partnerRole === "business" ? <Store size={18} /> : <UserRound size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{contact.displayName}</span>
                  <span className="block truncate text-[11px] text-[var(--muted-foreground)]">{contact.offerTitle}</span>
                  <span className="mt-1 block truncate text-[11px] text-slate-400">
                    {contact.latest?.body || "Start a conversation"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  {contact.latest ? <span className="text-[10px] text-slate-500">{when(contact.latest.createdAt).split(", ").pop()}</span> : null}
                  {contact.unread > 0 ? (
                    <span className="rounded-full bg-[#00C2CB] px-2 py-0.5 text-[10px] font-bold text-[#071315]" aria-label={contact.unread + " unread messages"}>{contact.unread}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className={(mobileThread ? "flex " : "hidden ") + "min-w-0 flex-1 flex-col md:flex"}>
          {current ? (
            <>
              <div className="flex items-center gap-3 border-b border-white/[0.08] px-3 py-4 sm:px-5">
                <button type="button" onClick={() => setMobileThread(false)}
                  aria-label="Back to conversations" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 md:hidden">
                  <ArrowLeft size={18} />
                </button>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-[#101415] text-[#00C2CB]">
                  {current.partnerRole === "business" ? <Store size={19} /> : <UserRound size={19} />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-white">{current.displayName}</h2>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">{current.offerTitle} · Private conversation</p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[#101415]/40 px-3 py-5 sm:px-6">
                {!history.length ? (
                  <div className="flex h-full min-h-[250px] flex-col items-center justify-center text-center">
                    <MessageCircle size={30} className="mb-3 text-[#00C2CB]/70" />
                    <h3 className="text-base font-semibold text-white">Start the conversation</h3>
                    <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">Coordinate content, campaigns and next steps here. Only approved offer partners can participate.</p>
                  </div>
                ) : history.map((message) => {
                  const mine = message.senderId === viewerId;
                  return (
                    <div key={message.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                      <div className={"max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm sm:max-w-[76%] " +
                        (mine ? "rounded-br-md border border-[#00C2CB]/20 bg-[#00C2CB]/[0.12] text-slate-50" :
                          "rounded-bl-md border border-white/[0.08] bg-[#202427] text-slate-100")}>
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <p className={"mt-1 flex items-center justify-end gap-1 text-[10px] " +
                          (mine ? "text-[#6ed9e2]" : "text-slate-400")}>
                          {when(message.createdAt)}
                          {mine && message.readAt ? <CheckCheck size={13} aria-label="Read" /> : null}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {error && <p role="alert" className="border-t border-red-400/20 px-4 py-2 text-xs text-red-300">{error}</p>}
              <form onSubmit={send} className="flex items-end gap-2 border-t border-white/[0.08] bg-[#151718] p-3 sm:p-4">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Write a message</span>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                    maxLength={3000} rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        if (!sending && draft.trim()) void send(e);
                      }
                    }}
                    placeholder={"Message " + current.displayName}
                    className="max-h-32 min-h-[48px] w-full resize-y rounded-xl border border-white/[0.10] bg-[#101415] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00C2CB]/60" />
                </label>
                <button type="submit" disabled={sending || !draft.trim()}
                  className="flex h-12 min-w-12 items-center justify-center gap-2 rounded-xl bg-[#00C2CB] px-3 text-[#091719] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={sending ? "Sending message" : "Send message"}>
                  <Send size={17} /> <span className="hidden text-xs font-bold sm:inline">{sending ? "Sending" : "Send"}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="hidden flex-1 items-center justify-center p-8 text-center md:flex">
              <div><MessageCircle className="mx-auto mb-4 h-9 w-9 text-[#00C2CB]" />
                <h2 className="text-base font-semibold">Select a conversation</h2>
                <p className="mt-2 text-xs text-slate-400">Choose an approved partner to get started.</p></div>
            </div>
          )}
        </div>
      </div>
      {error && !mobileThread ? <p role="alert" className="border-t border-white/10 px-4 py-3 text-xs text-red-300">{error}</p> : null}
    </section>
  );
}
