// app/pricing/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import MarketingHeader from '@/components/marketing/MarketingHeader';

import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";

type Plan = "business" | "affiliate";

type Meta = {
  title: string;
  priceNow: string;
  priceLater: string;
  blurb: string;
  cta: string;
};

export default function PricingPage() {
  const { session } = useSessionContext();
  const user = session?.user ?? null;

  const router = useRouter();

  const handleLogin = (type: "business" | "affiliate") => {
    router.push(`/login?role=${type}`);
  };

  const handleCreateAccount = (type: "business" | "affiliate") => {
    try {
      localStorage.setItem("intent.role", type);
      localStorage.setItem("intent.flow", "signup");
    } catch {}
    router.push(`/create-account?role=${type}`);
  };

  const displayPrice = (plan: Plan) => {
    const base = plan === "business" ? 150 : 50;
    return `$${base}/mo`;
  };

  const getMeta = (plan: Plan): Meta => {
    const isBusiness = plan === "business";
    return {
      title: isBusiness ? "For Businesses" : "For Partners",
      priceNow: "$0/mo (Early Access)",
      priceLater: `Then ${displayPrice(plan)}`,
      blurb: isBusiness
        ? "Publish offers, approve affiliates, and manage payouts."
        : "Access offers, run ads, and track commissions.",
      cta: isBusiness ? "Create Business Account" : "Create Partner Account",
    };
  };

  const faqs = [
    {
      q: "Is it really free right now?",
      a: "Yes. The first 150 users get Nettmark free for life. This Early Access window is mainly for feedback while we polish onboarding, support, and overall UX.",
    },
    {
      q: "What will pricing be after Early Access?",
      a: "Once Early Access is full, pricing returns to $150/month for Businesses and $50/month for Partners.",
    },
    {
      q: "Does Business pay for ads?",
      a: "No. Partners fund ad spend from their pre-funded wallets. You only pay commissions on verified conversions.",
    },
    {
      q: "How do payouts work?",
      a: "Confirmed partner-driven sales trigger automatic, compliant Stripe payouts according to your offer.",
    },
  ] as const;

  const PlanCard = ({ plan }: { plan: Plan }) => {
    const meta = getMeta(plan);
    const label = plan === "business" ? "Business" : "Partner";
    const role = plan === "business" ? "business" : "affiliate";

    return (
      <section className="relative w-full rounded-2xl border border-white/10 bg-white/[0.02] transition-all duration-300 hover:border-[#00C2CB]/40 hover:shadow-[0_0_35px_rgba(0,194,203,0.25)] backdrop-blur-xl shadow-lg">
        <div className="relative p-8 md:p-10 flex flex-col items-center text-center gap-5">
          <span className="text-xs uppercase tracking-widest text-gray-400">
            {label}
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {meta.title}
          </h2>
          <p className="text-gray-400 max-w-md">{meta.blurb}</p>

          <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-200">
            Platform access ·{" "}
            <span className="text-[#00C2CB]">{meta.priceNow}</span>
          </div>
          <div className="text-xs text-gray-400 -mt-2">
            <span className="line-through opacity-70">{displayPrice(plan)}</span>{" "}
            <span className="opacity-70">({meta.priceLater})</span>
          </div>

          <button
            onClick={() => handleCreateAccount(role)}
            className="mt-2 w-full sm:w-auto bg-[#00C2CB]/90 text-black font-medium px-6 py-2.5 rounded-lg hover:bg-[#00C2CB] shadow-[0_8px_30px_-10px_rgba(0,194,203,0.45)]"
          >
            {meta.cta}
          </button>

          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-3 w-full">
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
              First 150 free for life
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
              Early user feedback
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
              No card required
            </div>
          </div>

          <details className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left">
            <summary className="cursor-pointer select-none text-sm font-medium list-none">
              What you get
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-300 list-disc list-inside">
              {(plan === "business"
                ? [
                    "Always-on exposure inside the Nettmark offer marketplace.",
                    "Low-risk, pay-on-results acquisition instead of fixed retainers.",
                    "Infrastructure for approvals, tracking, and automated Stripe payouts.",
                    "Shared ad infrastructure so partners can run Meta ads from your account without sharing logins.",
                  ]
                : [
                    "Access to vetted offers you can promote as a partner.",
                    "Use Nettmark’s tracking, wallets, and payout rails instead of building your own.",
                    "Centralised dashboard for campaigns, conversions, and wallet balance.",
                    "Support for both paid traffic and organic / UGC promotion flows.",
                  ]
              ).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>

          <div className="text-xs text-gray-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => handleLogin(role)}
              className="text-[#00C2CB] hover:text-[#7ff5fb] underline underline-offset-2"
            >
              Log in
            </button>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      <MarketingHeader />

      {/* Main */}
      <main className="flex-1 w-full px-6 md:px-10 py-8 md:py-12">
        <section className="mx-auto mb-10 w-full max-w-5xl text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#00C2CB] drop-shadow-[0_0_12px_rgba(0,194,203,0.35)]">
            Early Access is Live
          </h1>

          <p className="mt-3 text-gray-400 max-w-3xl mx-auto text-sm md:text-base">
            The first <span className="text-white/90 font-semibold">150 users</span> get{" "}
            <span className="text-[#00C2CB] font-semibold">free access for life</span>. This Early
            Access window is mainly for early user feedback while we tighten onboarding and polish
            the platform. Choose how you want to join — as a business or a partner.
          </p>

          <div className="mt-5 mx-auto max-w-3xl rounded-2xl border border-[#00C2CB]/25 bg-gradient-to-b from-[#001f20] via-[#0b0b0b] to-black p-5 text-left shadow-[0_0_25px_rgba(0,194,203,0.12)]">
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#00C2CB]" />
              <div className="text-sm text-gray-200">
                <div className="font-semibold text-[#00C2CB]">
                  Free for life (first 150 users)
                </div>
                <div className="text-gray-400">
                  No card required. After Early Access fills up, pricing returns to{" "}
                  <span className="text-white/80 font-medium">$150/mo for Businesses</span> and{" "}
                  <span className="text-white/80 font-medium">$50/mo for Partners</span>.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-5xl grid gap-6 md:gap-8 md:grid-cols-2">
          <PlanCard plan="business" />
          <PlanCard plan="affiliate" />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          You can operate as both a Business and a Partner using separate accounts.
        </p>

        <section className="mx-auto mt-12 w-full max-w-5xl">
          <h3 className="text-xl font-semibold mb-4">FAQs</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {faqs.map(({ q, a }) => (
              <details
                key={q}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <summary className="cursor-pointer select-none font-medium list-none">
                  {q}
                </summary>
                <p className="mt-2 text-sm text-gray-300">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-12 w-full max-w-5xl rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
          <p className="text-gray-300">
            Still comparing?{" "}
            <Link className="text-[#00C2CB] hover:text-[#7ff5fb]" href="/contact">
              Talk to us
            </Link>{" "}
            — we’ll help you choose.
          </p>
        </section>
      </main>
    </div>
  );
}