"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Handshake,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";

const slides = [
  {
    eyebrow: "Start here",
    title: "Welcome to Nettmark",
    body: "Nettmark helps partners find business offers, request approval, launch organic posts or paid campaigns, and track earnings in one place.",
    helper: "You do not need to understand every metric today — start with one offer and build from there.",
    icon: Sparkles,
    actions: [
      { label: "Browse offers", href: "/affiliate/marketplace", primary: true },
      { label: "Open wallet", href: "/affiliate/wallet" },
    ],
  },
  {
    eyebrow: "Step 1",
    title: "Connect payouts when you are ready",
    body: "Stripe lets Nettmark send your commissions automatically after approved tracked sales.",
    helper: "You can browse offers first, but connect payouts before you expect to withdraw earnings.",
    icon: BadgeDollarSign,
    actions: [
      {
        label: "Open payout settings",
        href: "/affiliate/settings?from=onboarding#payouts",
        primary: true,
      },
    ],
  },
  {
    eyebrow: "Step 2",
    title: "Pick an offer and request approval",
    body: "Use the marketplace to choose a business you understand, then submit a request so the business can approve you.",
    helper: "Approved offers unlock the promotion flow and campaign tools.",
    icon: Search,
    actions: [
      { label: "Open marketplace", href: "/affiliate/marketplace", primary: true },
    ],
  },
  {
    eyebrow: "Step 3",
    title: "Launch a post or campaign",
    body: "Once approved, submit organic content or a paid campaign idea. The business reviews it before anything goes live.",
    helper: "After launch, your dashboard tracks clicks, conversions, spend, and commission activity.",
    icon: Handshake,
    actions: [
      {
        label: "Manage campaigns",
        href: "/affiliate/dashboard/manage-campaigns",
        primary: true,
      },
      { label: "Browse offers", href: "/affiliate/marketplace" },
    ],
  },
];

export function AffiliateOnboardingQuickstart({
  onFinish,
}: {
  onFinish: () => void;
}) {
  const [index, setIndex] = useState(0);
  const router = useRouter();

  const next = () => {
    if (index < slides.length - 1) {
      setIndex((prev) => prev + 1);
    } else {
      complete();
    }
  };

  const complete = async () => {
    try {
      await fetch("/api/profile/onboarding-complete", { method: "POST" });
    } catch (err) {
      console.warn("[Quickstart] onboarding-complete failed", err);
    }
    onFinish();
  };

  const current = slides[index];
  const Icon = current.icon;

  function handleOpenAssistant() {
    if (typeof window === "undefined") return;

    const chatbase = (
      window as Window & {
        chatbase?: ((command: string, ...args: unknown[]) => unknown) & {
          open?: () => unknown;
        };
      }
    ).chatbase;

    if (typeof chatbase?.open === "function") {
      chatbase.open();
      return;
    }

    if (typeof chatbase === "function") {
      chatbase("open");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onFinish}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#05070a] shadow-[0_28px_90px_rgba(0,0,0,0.72)]">
        <div className="relative bg-gradient-to-br from-[#0f2225] via-[#081011] to-black p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#00C2CB]/15 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 text-[#7ff5fb]">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#7ff5fb]/75">
                {current.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {current.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/72">
                {current.body}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/62">
            {current.helper}
          </div>

          <button
            type="button"
            onClick={handleOpenAssistant}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-4 py-3 text-sm font-semibold text-[#7ff5fb] transition hover:bg-[#00C2CB]/15"
          >
            <MessageCircle className="h-4 w-4" />
            Stuck? Talk to the Nettmark bot for assistance
          </button>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {current.actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  action.primary
                    ? "bg-[#00C2CB] text-black hover:bg-[#00b0b8]"
                    : "border border-white/12 text-white/78 hover:border-[#00C2CB]/40 hover:text-white"
                }`}
                onMouseEnter={() => router.prefetch(action.href)}
              >
                {action.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-between gap-4">
            <button
              onClick={onFinish}
              className="text-xs font-medium text-white/55 hover:text-white"
            >
              Skip for now
            </button>
            <div className="flex items-center gap-1.5">
              {slides.map((slide, idx) => (
                <span
                  key={slide.title}
                  className={`h-2 rounded-full transition-all ${
                    idx === index ? "w-6 bg-[#00C2CB]" : "w-2 bg-white/20"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              {index === slides.length - 1 ? (
                <>
                  Finish <CheckCircle2 className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
