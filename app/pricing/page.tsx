// app/pricing/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";

import { useRouter } from "next/navigation";

type Plan = "business" | "affiliate";

type Meta = {
  title: string;
  priceNow: string;
  priceDetail: string;
  blurb: string;
  cta: string;
};

export default function PricingPage() {
  const router = useRouter();

  const handleLogin = (type: "business" | "affiliate") => {
    router.push(`/login?role=${type}`);
  };

  const handleCreateAccount = (type: "business" | "affiliate") => {
    try {
      localStorage.setItem("intent.role", type);
      localStorage.setItem("intent.flow", "signup");
    } catch {
      // ignore localStorage write failures
    }
    router.push(`/create-account?role=${type}`);
  };

  const getMeta = (plan: Plan): Meta => {
    const isBusiness = plan === "business";
    return {
      title: isBusiness ? "For Businesses" : "For Partners",
      priceNow: "$0 platform access",
      priceDetail: isBusiness
        ? "2.2% fee on wallet top-ups and payout charges"
        : "2.2% fee when funds are added to your wallet",
      blurb: isBusiness
        ? "Publish offers, approve affiliates, and manage payouts."
        : "Access offers, run ads, and track commissions.",
      cta: isBusiness ? "Create Business Account" : "Create Partner Account",
    };
  };

  const faqs = [
    {
      q: "Do I need to pay to create an account?",
      a: "No. You can create your Nettmark account without paying up front. Platform fees only apply when money moves through wallet top-ups and business payout charges.",
    },
    {
      q: "How does Nettmark pricing work?",
      a: "Nettmark uses a fee-based model instead of subscriptions. Platform access is free, and a 2.2% Nettmark fee is applied when money moves through wallet top-ups and business payout charges.",
    },
    {
      q: "Does Business pay for ads?",
      a: "No. Partners fund ad spend from their pre-funded wallets. You only pay commissions on verified conversions.",
    },
    {
      q: "How do payouts work?",
      a: "Confirmed partner-driven sales trigger automated Stripe payouts according to your offer. Nettmark shows the principal, Nettmark fee, and Stripe fee separately when money moves.",
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
            <span className="text-[#00C2CB]">{meta.priceNow}</span>
          </div>
          <div className="text-xs text-gray-400 -mt-2">{meta.priceDetail}</div>

          <button
            onClick={() => handleCreateAccount(role)}
            className="mt-2 w-full sm:w-auto bg-[#00C2CB]/90 text-black font-medium px-6 py-2.5 rounded-lg hover:bg-[#00C2CB] shadow-[0_8px_30px_-10px_rgba(0,194,203,0.45)]"
          >
            {meta.cta}
          </button>

          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-3 w-full">
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
              No subscription required
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
              Fee-based pricing
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
              No card required to join
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
                    "Low-risk, pay-on-results acquisition instead of subscription overhead.",
                    "Infrastructure for approvals, tracking, and automated Stripe payouts.",
                    "Clear fee breakdowns when you top up wallets or settle partner payouts.",
                    "Shared ad infrastructure so partners can run Meta ads from your account without sharing logins.",
                  ]
                : [
                    "Access to vetted offers you can promote as a partner.",
                    "Use Nettmark’s tracking, wallets, and payout rails instead of building your own.",
                    "Centralised dashboard for campaigns, conversions, and wallet balance.",
                    "Only pay transaction fees when you add funds to your wallet.",
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
    <div className="marketing-pricing-theme min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      <MarketingHeader />

      {/* Main */}
      <main className="flex-1 w-full px-6 md:px-10 py-8 md:py-12">
        <section className="mx-auto mb-10 w-full max-w-5xl text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#00C2CB] drop-shadow-[0_0_12px_rgba(0,194,203,0.35)]">
            Create your Nettmark account
          </h1>

          <p className="mt-3 text-gray-400 max-w-3xl mx-auto text-sm md:text-base">
            Choose how you want to use Nettmark. Create a business account to
            launch offers and approve affiliates, or create a partner account to
            run campaigns and earn commissions.
          </p>

          <div className="mt-5 mx-auto max-w-3xl rounded-2xl border border-[#00C2CB]/25 bg-gradient-to-b from-[#001f20] via-[#0b0b0b] to-black p-5 text-left shadow-[0_0_25px_rgba(0,194,203,0.12)]">
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#00C2CB]" />
              <div className="text-sm text-gray-200">
                <div className="font-semibold text-[#00C2CB]">
                  No subscription required
                </div>
                <div className="text-gray-400">
                  No card required to create an account. Nettmark charges a
                  <span className="text-white/80 font-medium"> 2.2% platform fee</span>{" "}
                  on wallet top-ups and business payout charges, with Stripe
                  fees shown separately where applicable.
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
          You can operate as both a Business and a Partner using separate
          accounts.
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
            <Link
              className="text-[#00C2CB] hover:text-[#7ff5fb]"
              href="/contact"
            >
              Talk to us
            </Link>{" "}
            — we’ll help you choose.
          </p>
        </section>
      </main>
    </div>
  );
}
