"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Megaphone, X } from "lucide-react";

type ResumeCampaign = {
  proposalId: string;
  path: string;
  offerTitle?: string | null;
  affiliateEmail?: string | null;
};

type PendingCampaign = {
  id: string;
  offer_title?: string | null;
  affiliate_email?: string | null;
};

const STORAGE_KEY = "nettmark:paid-campaign-resume";
export const RESUME_CAMPAIGN_EVENT = "nettmark:paid-campaign-resume-updated";
const DISMISSED_KEY = "nettmark:paid-campaign-banner-dismissed";

function inboxPath(proposalId: string) {
  return `/business/my-business/ad-ideas?proposal=${encodeURIComponent(proposalId)}`;
}

function safeResume(value: unknown): ResumeCampaign | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ResumeCampaign>;
  const proposalId = String(row.proposalId || "").trim();
  let path = String(row.path || "").trim();
  if (!proposalId || !path.startsWith("/business/") || path.startsWith("//") || path.includes("\\")) {
    return null;
  }

  // Migrate resume state created by the temporary standalone review route back
  // into the canonical Ad Ideas inbox.
  if (path.startsWith("/business/review-campaign/")) {
    path = inboxPath(proposalId);
  }

  return {
    proposalId,
    path: path.slice(0, 500),
    offerTitle: row.offerTitle ? String(row.offerTitle) : null,
    affiliateEmail: row.affiliateEmail ? String(row.affiliateEmail) : null,
  };
}

export function savePaidCampaignResume(campaign: ResumeCampaign) {
  if (typeof window === "undefined") return;
  const safe = safeResume(campaign);
  if (!safe) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  window.dispatchEvent(new Event(RESUME_CAMPAIGN_EVENT));
}

export function clearPaidCampaignResume(proposalId?: string) {
  if (typeof window === "undefined") return;
  if (proposalId) {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const current = safeResume(JSON.parse(raw));
        if (current && current.proposalId !== proposalId) return;
      } catch {
        // Clear malformed values below.
      }
    }
  }
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(RESUME_CAMPAIGN_EVENT));
}

export default function PaidCampaignResumeBanner() {
  const pathname = usePathname();
  const [campaign, setCampaign] = useState<ResumeCampaign | null>(null);
  const pendingIdsRef = useRef<string[]>([]);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const currentRequest = ++requestRef.current;

    // Do not trust cached sessionStorage resume state as proof that a campaign
    // still needs review. The database is authoritative after launch/rejection.
    try {
      const res = await fetch("/api/business/ad-ideas/pending-summary?banner=1", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (currentRequest !== requestRef.current) return;
      if (!res.ok || !json?.success) {
        pendingIdsRef.current = [];
        setCampaign(null);
        return;
      }

      const pending = (Array.isArray(json.campaigns) ? json.campaigns : []) as PendingCampaign[];
      pendingIdsRef.current = pending.map((idea) => idea.id).filter(Boolean);

      let saved: ResumeCampaign | null = null;
      try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (raw) saved = safeResume(JSON.parse(raw));
      } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }

      // A locally saved resume can outlive a successful launch. Clear it
      // quietly, without sending another resume-updated event and refetching.
      if (saved && !pending.some((idea) => idea.id === saved?.proposalId)) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        saved = null;
      }

      let dismissed: string[] = [];
      try {
        const raw = window.sessionStorage.getItem(DISMISSED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) dismissed = parsed.filter((id): id is string => typeof id === "string");
      } catch {
        window.sessionStorage.removeItem(DISMISSED_KEY);
      }
      // Dismissal lasts for this tab's session for known pending proposals.
      // An actual NEW submission is not suppressed by dismissing old ones.
      const unseen = pending.filter((idea) => idea.id && !dismissed.includes(idea.id));
      const selected = unseen.find((idea) => idea.id === saved?.proposalId) || unseen[0];
      setCampaign(selected ? {
        proposalId: selected.id,
        path: "/business/my-business/ad-ideas/" + encodeURIComponent(selected.id),
        offerTitle: selected.offer_title || null,
        affiliateEmail: selected.affiliate_email || null,
      } : null);
    } catch (error) {
      if (currentRequest !== requestRef.current) return;
      pendingIdsRef.current = [];
      setCampaign(null);
      console.warn("[paid-campaign-resume] pending campaign lookup failed", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onRefresh = () => { void refresh(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") onRefresh();
    };
    window.addEventListener(RESUME_CAMPAIGN_EVENT, onRefresh);
    window.addEventListener("storage", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(RESUME_CAMPAIGN_EVENT, onRefresh);
      window.removeEventListener("storage", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      requestRef.current++;
    };
  }, [refresh]);

  const dismiss = () => {
    // Hide the current set of review reminders, not the proposals themselves.
    // New proposal IDs will appear again when we next refresh.
    window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(pendingIdsRef.current));
    setCampaign(null);
  };

  // On the Ad Ideas page the review queue is already present; no duplicate
  // full-width reminder is useful there.
  if (!campaign || pathname?.startsWith("/business/my-business/ad-ideas") || pathname?.startsWith("/business/review-campaign/")) return null;

  return (
    <div className="border-b border-[#00C2CB]/20 bg-[#00C2CB]/10 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00C2CB]/15 text-[#00C2CB]">
            <Megaphone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              Paid campaign waiting for you
            </div>
            <div className="truncate text-xs text-[var(--muted-foreground)]">
              {campaign.offerTitle || "An affiliate-funded campaign"} is waiting for review.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Link
            href={campaign.path}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-[#061113] transition hover:brightness-110 sm:flex-none"
          >
            Open Ad Ideas
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={dismiss}
            title="Dismiss paid campaign reminder"
            aria-label="Dismiss paid campaign reminder"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-[var(--muted-foreground)] transition hover:border-white/25 hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
