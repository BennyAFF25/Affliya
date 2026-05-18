"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const slides = [
  {
    title: "Welcome to Nettmark",
    body: "Here’s how to get moving fast: connect payouts, finish your profile, and grab an offer.",
    actions: [
      { label: "View wallet", href: "/affiliate/wallet" },
      { label: "Browse offers", href: "/affiliate/marketplace" },
    ],
  },
  {
    title: "Connect payouts",
    body: "Go to Settings → Payouts to connect Stripe Express before launching campaigns.",
    actions: [
      { label: "Open settings", href: "/affiliate/settings?from=onboarding#payouts" },
    ],
  },
  {
    title: "Promote your first offer",
    body: "Pick an offer in the marketplace, submit your ad or organic post, and start earning.",
    actions: [
      { label: "Marketplace", href: "/affiliate/marketplace" },
      { label: "Campaign manager", href: "/affiliate/dashboard/manage-campaigns" },
    ],
  },
];

export function AffiliateOnboardingQuickstart({ onFinish }: { onFinish: () => void }) {
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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onFinish} />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#05070a] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.65)]">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Quick start</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{current.title}</h2>
        <p className="mt-2 text-sm text-white/70">{current.body}</p>

        <div className="mt-4 flex flex-wrap gap-3">
          {current.actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white hover:border-[#00C2CB]/40"
              onClick={() => router.prefetch(action.href)}
            >
              {action.label} →
            </Link>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            onClick={onFinish}
            className="text-xs text-white/60 hover:text-white"
          >
            Skip for now
          </button>
          <div className="flex items-center gap-1">
            {slides.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 w-2 rounded-full ${idx === index ? "bg-[#00C2CB]" : "bg-white/20"}`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
          >
            {index === slides.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
