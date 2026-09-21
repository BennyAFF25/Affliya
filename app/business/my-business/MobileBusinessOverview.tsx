"use client";

import Link from "next/link";
import React from "react";

export type MobileBusinessView = "overview" | "offers" | "setup";

type IconProps = React.SVGProps<SVGSVGElement>;

const IconBox = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </svg>
);

const IconDocument = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h8l4 4v14H6V3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 12h6M9 16h6" />
  </svg>
);

const IconBolt = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m13.5 2-9 12h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

const IconRocket = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5c2.5-2.5 5.5-2 5.5-2s.5 3-2 5.5l-5 5-4-4 5.5-4.5Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 9.5 5 10l-2 3 5 .5M12.5 13.5 12 17l-3 2-.5-5M15 8.5h.01" />
  </svg>
);

const IconGear = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.7 3.4 10.3 2h3.4l.6 1.4 1.5.6 1.4-.6 2.4 2.4-.6 1.4.6 1.5L21 9.3v3.4l-1.4.6-.6 1.5.6 1.4-2.4 2.4-1.4-.6-1.5.6-.6 1.4h-3.4l-.6-1.4-1.5-.6-1.4.6-2.4-2.4.6-1.4-.6-1.5L3 12.7V9.3l1.4-.6L5 7.2l-.6-1.4 2.4-2.4 1.4.6 1.5-.6Z" />
    <circle cx="12" cy="11" r="3" />
  </svg>
);

const IconImage = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="9" r="1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 18 5-5 3 3 2-2 4 4" />
  </svg>
);

const IconCheck = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
  </svg>
);

const IconClock = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="12" cy="12" r="8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
  </svg>
);

const IconChat = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h16v11H9l-5 3v-14Z" />
  </svg>
);

const IconBook = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4.5c3.5-.7 6 .2 8 2v13c-2-1.8-4.5-2.7-8-2V4.5ZM20 4.5c-3.5-.7-6 .2-8 2v13c2-1.8 4.5-2.7 8-2V4.5Z" />
  </svg>
);

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

const actionButtonClass =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-white/[0.11] bg-white/[0.02] px-4 text-xs font-semibold text-slate-200 transition hover:border-[#00C2CB]/40 hover:text-white";

export default function MobileBusinessOverview({
  view,
  onNavigate,
  loading,
  offers,
  requests,
  adIdeas,
  postIdeas,
  reviewHref,
  billingRequired,
  onSupport,
}: Props) {
  const pending = requests + adIdeas + postIdeas;
  const hasOffer = offers.length > 0;

  const navigate = (nextView: MobileBusinessView) => {
    onNavigate(nextView);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  };

  if (view !== "overview") {
    return (
      <div className="mobile-business-overview">
        <div className="mb-5 flex items-center justify-between rounded-[20px] border border-white/[0.08] bg-[#151718] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
          <button
            type="button"
            onClick={() => navigate("overview")}
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-white"
          >
            <span aria-hidden="true" className="text-[#00C2CB]">←</span>
            Business overview
          </button>
          <span className="rounded-full border border-white/[0.09] bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-slate-400">
            {view === "offers" ? "Offers" : "Launch setup"}
          </span>
        </div>
      </div>
    );
  }

  const nextAction = billingRequired
    ? {
        eyebrow: "Action needed",
        title: "Finish launch setup",
        description: "Complete the billing step required by the approval you opened.",
        label: "Open setup",
        href: null as string | null,
        onClick: () => navigate("setup"),
      }
    : pending > 0
      ? {
          eyebrow: "Next best action",
          title: "Review pending submissions",
          description: `${pending} item${pending === 1 ? " is" : "s are"} waiting for your decision.`,
          label: "Review submissions",
          href: reviewHref,
          onClick: null as (() => void) | null,
        }
      : !hasOffer
        ? {
            eyebrow: "Next best action",
            title: "Create your first offer",
            description: "Get your business in front of affiliates and give them something to promote.",
            label: "Create new offer",
            href: "/business/my-business/create-offer",
            onClick: null as (() => void) | null,
          }
        : {
            eyebrow: "Next best action",
            title: "Give affiliates brand content",
            description: "Add approved creative so partners can start promoting faster.",
            label: "Add creative",
            href: "/business/my-business/publish-creatives",
            onClick: null as (() => void) | null,
          };

  const activityText = pending > 0
    ? `${pending} item${pending === 1 ? "" : "s"} waiting for review.`
    : hasOffer
      ? "Your offers are available. New affiliate activity will appear here."
      : "No recent activity yet. Create an offer and affiliate activity will appear here.";

  return (
    <div className="mobile-business-overview space-y-4 pb-3">
      <section className="rounded-[24px] border border-white/[0.09] bg-[#151718] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[25px] font-semibold tracking-tight text-white">Business overview</h1>
            <p className="mt-1 text-sm leading-5 text-slate-400">Launch, manage and grow with affiliates.</p>
          </div>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-2 rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/[0.07] px-3 py-1.5 text-[11px] font-semibold text-[#63e8ee]">
            <span className={`h-2 w-2 rounded-full ${billingRequired ? "bg-amber-300" : "bg-[#00C2CB]"}`} />
            {billingRequired ? "Action needed" : pending > 0 ? "Needs review" : hasOffer ? "Active" : "Getting started"}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => navigate("offers")}
            className="min-w-0 rounded-[17px] border border-white/[0.09] bg-black/10 p-3 text-left"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#00C2CB]/10 text-[#19d4dd]"><IconBox className="h-5 w-5" /></span>
            <span className="mt-3 block text-[11px] text-slate-400">Offers</span>
            <span className="mt-0.5 block text-[24px] font-semibold leading-none text-white">{loading ? "—" : offers.length}</span>
          </button>
          <Link href={reviewHref} prefetch={false} className="min-w-0 rounded-[17px] border border-white/[0.09] bg-black/10 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#00C2CB]/10 text-[#19d4dd]"><IconDocument className="h-5 w-5" /></span>
            <span className="mt-3 block text-[11px] text-slate-400">Submissions</span>
            <span className="mt-0.5 block text-[24px] font-semibold leading-none text-white">{loading ? "—" : pending}</span>
          </Link>
          <button
            type="button"
            onClick={() => navigate("setup")}
            className="min-w-0 rounded-[17px] border border-white/[0.09] bg-black/10 p-3 text-left"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#00C2CB]/10 text-[#19d4dd]"><IconBolt className="h-5 w-5" /></span>
            <span className="mt-3 block text-[11px] text-slate-400">Setup</span>
            <span className="mt-1 block truncate text-[13px] font-semibold text-white">{billingRequired ? "Required" : "On demand"}</span>
          </button>
        </div>

        <div className="mt-4 rounded-[19px] border border-[#00C2CB]/25 !bg-[#101415] p-4 shadow-[inset_0_0_24px_rgba(0,194,203,0.025)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] !text-[#5ae5eb]">{nextAction.eyebrow}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 text-[#21d9e2]"><IconRocket className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold !text-white">{nextAction.title}</h2>
              <p className="mt-1 text-xs leading-5 !text-slate-300">{nextAction.description}</p>
            </div>
          </div>
          {nextAction.href ? (
            <Link href={nextAction.href} prefetch={false} className="mobile-business-primary !mt-4 !rounded-full !bg-[#00C2CB] !font-bold !text-black shadow-[0_10px_24px_rgba(0,194,203,0.16)]">
              {nextAction.label} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <button type="button" onClick={nextAction.onClick ?? undefined} className="mobile-business-primary !mt-4 !rounded-full !bg-[#00C2CB] !font-bold !text-black shadow-[0_10px_24px_rgba(0,194,203,0.16)]">
              {nextAction.label} <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/[0.09] bg-[#151718] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.22)]">
        <div className="flex items-end justify-between gap-3 border-b border-white/[0.07] pb-4">
          <h2 className="text-[23px] font-semibold tracking-tight text-white">Action hub</h2>
          <span className="pb-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Get things done</span>
        </div>

        <div className="divide-y divide-white/[0.07]">
          <div className="flex items-center gap-3 py-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 text-[#1cd3dc]"><IconDocument className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white">Review submissions</h3>
              <p className="mt-0.5 text-xs text-slate-400">{loading ? "Checking inbox…" : `${pending} pending request${pending === 1 ? "" : "s"}`}</p>
            </div>
            <Link href={reviewHref} prefetch={false} className={actionButtonClass}>View <span aria-hidden="true" className="text-[#00C2CB]">→</span></Link>
          </div>

          <div className="flex items-center gap-3 py-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 text-[#1cd3dc]"><IconGear className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white">Launch setup</h3>
              <p className="mt-0.5 text-xs leading-5 text-slate-400">Tracking, Meta, billing and payouts</p>
            </div>
            <button type="button" onClick={() => navigate("setup")} className={actionButtonClass}>
              {billingRequired ? "Required" : "Open"} <span aria-hidden="true" className="text-[#00C2CB]">→</span>
            </button>
          </div>

          <div className="flex items-center gap-3 py-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 text-[#1cd3dc]"><IconImage className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Creative library</h3>
                <span className="rounded-full border border-white/[0.09] px-2 py-0.5 text-[9px] font-semibold text-slate-500">Optional</span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-slate-400">Approved ads and brand content</p>
            </div>
            <Link href="/business/my-business/publish-creatives" prefetch={false} className={actionButtonClass}>Manage <span aria-hidden="true" className="text-[#00C2CB]">→</span></Link>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/[0.09] bg-[#151718] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.22)]">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-[23px] font-semibold tracking-tight text-white">Progress &amp; activity</h2>
          <span className="pb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">At a glance</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-[18px] border border-white/[0.07] bg-black/10">
          {[
            { label: "Business profile", detail: "Available", done: true, status: "Complete" },
            { label: "First offer", detail: hasOffer ? "Marketplace offer live" : "Create an offer to start", done: hasOffer, status: hasOffer ? "Complete" : "Not started" },
            { label: "Brand assets", detail: "Upload when useful", done: false, status: "Optional" },
            { label: "Launch setup", detail: "Only required when a launch needs it", done: !billingRequired, status: billingRequired ? "Required" : "Optional" },
          ].map((item, index) => (
            <div key={item.label} className={`flex items-center gap-3 px-3 py-3 ${index > 0 ? "border-t border-white/[0.07]" : ""}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${item.done ? "bg-[#00C2CB] text-black" : "border border-white/[0.16] text-slate-500"}`}>
                {item.done ? <IconCheck className="h-4 w-4" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${item.done ? "border-[#00C2CB]/30 bg-[#00C2CB]/[0.08] text-[#5fe6ec]" : billingRequired && item.label === "Launch setup" ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-white/[0.09] bg-white/[0.02] text-slate-400"}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-white/[0.07] bg-black/10 p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.04] text-slate-400"><IconClock className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white">{pending > 0 ? "Activity waiting for you" : "Recent activity"}</p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{activityText}</p>
          </div>
          <Link href={pending > 0 ? reviewHref : "/business/manage-campaigns"} prefetch={false} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.1] text-[#00C2CB]" aria-label="View activity">→</Link>
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-[22px] border border-white/[0.09] bg-[#151718] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white">Need help?</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">Our team is here to support you.</p>
        </div>
        <button type="button" onClick={onSupport} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#00C2CB] px-3.5 text-xs font-bold text-black hover:bg-[#14d5de]">
          <IconChat className="h-4 w-4" /> Chat
        </button>
        <Link href="/business/support" prefetch={false} aria-label="Help center" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.11] text-slate-300 hover:border-[#00C2CB]/35 hover:text-white">
          <IconBook className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
