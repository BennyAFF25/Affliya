"use client";

import Link from "next/link";
import React from "react";

export type MobileBusinessView = "overview" | "offers" | "setup";

interface Props {
  view: MobileBusinessView;
  onNavigate: (view: MobileBusinessView) => void;
  loading: boolean;
  offers: { id: string; title: string; commission: number }[];
  requests: number;
  adIdeas: number;
  postIdeas: number;
  reviewHref: string;
  billingRequired: boolean;
  onSupport: () => void;
}

export default function MobileBusinessOverview({
  view, onNavigate, loading, offers, requests, adIdeas, postIdeas,
  reviewHref, billingRequired, onSupport,
}: Props) {
  const pending = requests + adIdeas + postIdeas;
  const title = billingRequired ? "One step before approval."
    : loading ? "Your business, at a glance."
    : pending > 0 ? "You have something to review."
    : offers.length > 0 ? "Make room for your next partner."
    : "Let’s get your first offer out there.";

  return (
    <div className="mobile-business-overview">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium tracking-tight">My Business</h1>
        <button type="button" onClick={onSupport} className="min-h-11 px-2 text-sm text-slate-400">Help ↗</button>
      </header>
      <nav aria-label="Business dashboard" className="mb-6 flex gap-6 border-b border-white/10">
        {(["overview", "offers", "setup"] as const).map((item) => (
          <button key={item} type="button" aria-current={view === item ? "page" : undefined}
            onClick={() => onNavigate(item)}
            className={`min-h-11 border-b-2 pb-3 text-sm capitalize ${view === item ? "border-[#00C2CB] text-white" : "border-transparent text-slate-400"}`}>
            {item}{item === "offers" && !loading ? ` (${offers.length})` : ""}
          </button>
        ))}
      </nav>

      {view === "overview" && (
        <div className="space-y-7">
          <section aria-label="Next action" className="rounded-xl border border-white/10 bg-[#151718] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#00C2CB]">{billingRequired ? "Action needed" : pending > 0 ? "Your inbox" : "Your next move"}</p>
            <h2 className="mt-3 text-[25px] font-medium leading-tight tracking-tight">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {billingRequired ? "Add a payment method to continue the campaign approval you opened."
                : loading ? "Loading your offers…"
                : pending > 0 ? `${pending} request${pending === 1 ? " or idea is" : "s or ideas are"} waiting for your decision.`
                : offers.length > 0 ? "Your offer is available to affiliates. Add brand content to help them get started."
                : "Give affiliates something to promote. You can handle integrations when a campaign needs them."}
            </p>
            {billingRequired ? (
              <button type="button" onClick={() => onNavigate("setup")} className="mobile-business-primary">Continue billing setup →</button>
            ) : !loading && (
              <Link prefetch={false} className="mobile-business-primary"
                href={pending > 0 ? reviewHref : offers.length > 0 ? "/business/my-business/publish-creatives" : "/business/my-business/create-offer"}>
                {pending > 0 ? "Review submissions" : offers.length > 0 ? "Add creative" : "Create an offer"} →
              </Link>
            )}
          </section>

          <section aria-label="Business overview" className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-4">
            <button type="button" onClick={() => onNavigate("offers")} className="text-left">
              <span className="block text-2xl font-medium">{loading ? "—" : offers.length}</span>
              <span className="text-xs text-slate-400">Offers</span>
            </button>
            <Link href={reviewHref} prefetch={false} className="pl-4">
              <span className="block text-2xl font-medium">{loading ? "—" : pending}</span>
              <span className="text-xs text-slate-400">To review</span>
            </Link>
            <Link href="/business/manage-campaigns" prefetch={false} className="pl-4">
              <span className="block text-2xl font-medium" aria-hidden="true">↗</span>
              <span className="text-xs text-slate-400">Campaigns</span>
            </Link>
          </section>

          {!loading && offers.length > 0 && (
            <section aria-label="Your offers">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-medium">Your offers</h2>
                <button type="button" onClick={() => onNavigate("offers")} className="min-h-11 text-xs text-slate-400">Manage →</button>
              </div>
              {offers.slice(0, 2).map((offer) => (
                <Link key={offer.id} href={`/business/my-business/edit-offer/${offer.id}/`} prefetch={false}
                  className="flex min-h-16 items-center justify-between gap-4 border-b border-white/10 py-3">
                  <span className="min-w-0 break-words text-sm font-medium">{offer.title}</span>
                  <span className="shrink-0 text-right text-sm text-[#00C2CB]">{offer.commission}%<span className="mt-1 block text-[11px] text-slate-400">commission</span></span>
                </Link>
              ))}
            </section>
          )}

          <section aria-label="Submission inbox">
            <h2 className="mb-2 text-base font-medium">Inbox</h2>
            {[
              { label: "Affiliate requests", count: requests, path: "affiliate-requests" },
              { label: "Paid ad ideas", count: adIdeas, path: "ad-ideas" },
              { label: "Organic post ideas", count: postIdeas, path: "post-ideas" },
            ].map((item) => (
              <Link key={item.path} href={`/business/my-business/${item.path}`} prefetch={false}
                className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 text-sm">
                <span className="text-slate-300">{item.label}</span>
                <span className={item.count ? "text-[#00C2CB]" : "text-slate-500"}>{loading ? "—" : item.count} <span aria-hidden="true" className="ml-3">→</span></span>
              </Link>
            ))}
          </section>

          <div className="space-y-1 pb-3">
            <button type="button" onClick={() => onNavigate("setup")} className="flex min-h-12 w-full items-center justify-between text-sm text-slate-400">Setup & integrations <span aria-hidden="true">→</span></button>
            <Link href="/business/my-business/publish-creatives" prefetch={false} className="flex min-h-12 items-center justify-between text-sm text-slate-400">Creative library <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      )}
    </div>
  );
}
