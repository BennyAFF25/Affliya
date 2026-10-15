"use client";
import { PAID_CURRENCY_BLOCK_MESSAGE } from "../../../../utils/currency/paidCurrencyMessage";
import React from "react";
import { formatMoney } from "../../../../utils/currency";
import { Badge, Button } from "../../../../components/ui";
import type { SubmissionKind } from "../../../../utils/affiliate/portalData";

export type PendingProposal = {
  id: string;
  offerId: string;
  offerTitle: string;
  kind: SubmissionKind;
  businessViewedAt?: string | null;
  title?: string;
  campaignName?: string | null;
  objective?: string | null;
  currency?: string | null;
  createdAt?: string | null;
  currencyBlock?: string | null;
  state: "currency_blocked" | "loading" | "waiting_for_business" | "funding_required" | "funded_waiting_for_business" | "funding_unavailable" | "timing_update_required" | "meta_cleanup_required";
  timingMessage?: string | null;
  growthReady: boolean;
  funding: {
    ready: boolean;
    requiredAmount: number;
    deficit: number;
  } | null;
};

export function PendingProposalRow({ proposal }: { proposal: PendingProposal }) {
  const fundingRequired = proposal.state === "funding_required";
  const funded = proposal.state === "funded_waiting_for_business";
  const timingUpdate = proposal.state === "timing_update_required";
  const metaCleanup = proposal.state === "meta_cleanup_required";
  const crossCurrency = proposal.kind === "paid" && (proposal.state === "currency_blocked" || (!!proposal.currency && proposal.currency.toUpperCase() !== "AUD"));
  const showCurrencyWarning = crossCurrency && proposal.state !== "loading" && !timingUpdate && !metaCleanup;
  const title = proposal.campaignName || proposal.title || proposal.offerTitle;

  const statusLabel = showCurrencyWarning ? "PAID LAUNCH BLOCKED" : proposal.kind === "organic" ? proposal.businessViewedAt ? "VIEWED" : "PENDING REVIEW" : proposal.state === "loading" ? "Checking status…" : metaCleanup ? "META RECOVERY NEEDED" : timingUpdate ? "SCHEDULE UPDATE NEEDED" : proposal.state === "funding_unavailable" ? "FUNDING NOT CHECKED" : fundingRequired
    ? "FUNDING REQUIRED"
    : funded
      ? "FUNDED"
      : "WAITING FOR BUSINESS";

  const description = showCurrencyWarning
    ? PAID_CURRENCY_BLOCK_MESSAGE
    : proposal.kind === "organic" ? "Organic proposal sent for business review. No ad funding is required." : proposal.state === "loading" ? "Proposal saved. Checking campaign readiness…" : metaCleanup
    ? "This proposal has a saved Meta campaign from an earlier launch attempt. The brand needs to check that attempt and recover any incomplete setup in Nettmark before trying again. You do not need to resubmit or add funds to fix this. Contact the brand through your Nettmark inbox if it remains unresolved."
    : timingUpdate
      ? "The proposed campaign start or end date needs updating. The business can reschedule this proposal without changing your approved budget or creative."
    : proposal.state === "funding_unavailable" ? "Proposal saved. Funding could not be checked; it will be verified before launch." : fundingRequired
    ? `The business has enabled paid promotion. Add ${formatMoney(proposal.funding?.deficit || 0)} to prepare this campaign for launch.`
    : funded
      ? "Campaign funding is ready. Waiting for the business to finish setup and approve the campaign."
      : "Proposal sent. No deposit is required while the business decides whether to enable paid promotion.";

  return (
    <div className="rounded-[17px] border border-white/[0.08] bg-[#101415] p-3.5 sm:p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 truncate text-[13px] font-semibold text-white">{title}</div>
            <Badge variant={showCurrencyWarning || fundingRequired || timingUpdate || metaCleanup ? "warning" : funded ? "success" : "muted"}>
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--muted-foreground)]">
            {description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--muted-foreground)]">
            <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              {proposal.offerTitle}
            </span>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              {proposal.state === "loading" ? "Checking status…" : proposal.funding ? crossCurrency ? "Paid launch blocked" : `Required at launch: ${formatMoney(proposal.funding.requiredAmount)}` : "Funding not checked"}
            </span>
            {proposal.createdAt ? (
              <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
                Submitted {new Date(proposal.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            ) : null}
          </div>
        </div>
        <Button href={`/affiliate/dashboard/reviews/${proposal.kind}/${proposal.id}`} variant="outline" className="min-h-10 shrink-0 rounded-xl text-xs">View proposal</Button>
        {fundingRequired ? (
          <Button href="/affiliate/wallet" className="min-h-10 shrink-0 rounded-xl text-xs">
            {crossCurrency ? "View wallet" : "Top up wallet"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

