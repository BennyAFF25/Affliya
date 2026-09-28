"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Megaphone } from "lucide-react";

type ResumeCampaign = {
  proposalId: string;
  path: string;
  offerTitle?: string | null;
  affiliateEmail?: string | null;
};

const STORAGE_KEY = "nettmark:paid-campaign-resume";
export const RESUME_CAMPAIGN_EVENT = "nettmark:paid-campaign-resume-updated";

function safeResume(value: unknown): ResumeCampaign | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ResumeCampaign>;
  const proposalId = String(row.proposalId || "").trim();
  const path = String(row.path || "").trim();
  if (!proposalId || !path.startsWith("/business/") || path.startsWith("//") || path.includes("\\")) {
    return null;
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

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setCampaign(null);
      return;
    }
    try {
      setCampaign(safeResume(JSON.parse(raw)));
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
      setCampaign(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(RESUME_CAMPAIGN_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(RESUME_CAMPAIGN_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  if (!campaign || pathname?.startsWith("/business/review-campaign/")) return null;

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
              {campaign.offerTitle || "An affiliate-funded campaign"} is still waiting for review.
            </div>
          </div>
        </div>
        <Link
          href={campaign.path}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-[#061113] transition hover:brightness-110"
        >
          Resume review
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
