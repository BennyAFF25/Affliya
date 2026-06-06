// app/for-partners/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";

const startHref = "/pricing";
const demoHref = "/lp/partner-demo#interactive-demo";

const reasons = [
  {
    title: "Organic Promotion",
    desc: "Promote offers using content, social media, and your audience.",
  },
  {
    title: "Paid Campaigns",
    desc: "Request and launch campaigns through businesses that support paid advertising.",
  },
  {
    title: "Live Tracking",
    desc: "See clicks, conversions, commissions, and campaign performance in one place.",
  },
  {
    title: "Automated Payouts",
    desc: "When commissions are approved, earnings can be withdrawn directly through Stripe.",
  },
];

const steps = [
  {
    step: "1",
    title: "Find an offer",
    desc: "Browse businesses and choose products or services you want to promote.",
  },
  {
    step: "2",
    title: "Get approved",
    desc: "Businesses review requests and approve affiliates that fit their offer.",
  },
  {
    step: "3",
    title: "Promote",
    desc: "Use organic promotion or launch approved campaigns.",
  },
  {
    step: "4",
    title: "Earn commissions",
    desc: "Sales are tracked automatically and commissions are recorded inside your account.",
  },
];

const faqs = [
  {
    q: "Do I need a Stripe account?",
    a: "No. You only need to connect Stripe when you have earnings ready to withdraw.",
  },
  {
    q: "Do I need a Facebook ad account?",
    a: "Not always. Some businesses support paid campaign requests through Nettmark while others focus on organic promotion.",
  },
  {
    q: "Can I browse offers before committing?",
    a: "Yes. You can explore the platform and understand how it works before deciding to participate.",
  },
];

export default function ForPartnersPage() {
  return (
    <main className="marketing-partners-theme min-h-screen bg-[#0a0a0a] text-white">
      <MarketingHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute left-1/2 top-[-10%] h-[60vh] w-[80vw] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(45% 60% at 50% 40%, rgba(0,194,203,0.25), rgba(0,0,0,0))",
            }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-10 pt-16 md:pb-14 md:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a3b] bg-[#082123] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#7ff5fb] shadow-[0_0_30px_rgba(0,194,203,0.15)]">
            FOR AFFILIATES
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
          </span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Run ads for businesses and earn commissions.
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-bold leading-relaxed text-white">
            Browse offers, get approved by businesses, launch campaigns, track
            results, and get paid when sales happen.
          </p>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white">
            See exactly how Nettmark works before creating an account with our
            short interactive demo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={startHref}
              className="rounded-xl bg-[#00C2CB] px-5 py-3 font-semibold text-black transition-colors hover:bg-[#00b0b8]"
            >
              Start Free
            </Link>
            <Link
              href={demoHref}
              className="rounded-xl border border-[#1e3a3b] bg-[#0f1516] px-5 py-3 font-semibold text-white transition-colors hover:border-[#00C2CB]/50 hover:bg-[#122223]"
            >
              Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* WHY PEOPLE USE NETTMARK */}
      <section className="mx-auto max-w-7xl px-6 pb-8 md:pb-12">
        <div className="mb-6 max-w-2xl">
          <h2 className="text-2xl font-bold md:text-3xl">
            Most affiliate platforms stop at the link.
          </h2>
          <p className="mt-3 text-lg font-bold leading-relaxed text-white">
            Nettmark gives approved affiliates more ways to promote.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[#1b3132] bg-[#0f1516] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="mb-3 flex items-center gap-2 text-[#7ff5fb]">
                <span className="inline-block h-2 w-2 rounded-full bg-[#00C2CB]" />
                <h3 className="font-semibold">{item.title}</h3>
              </div>
              <p className="text-sm font-bold leading-6 text-white">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="text-2xl font-bold md:text-3xl">How Nettmark works</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-4">
          {steps.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-[#1b3132] bg-[#0f1516] p-6"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#26494b] bg-[#0c1e1f] text-[#7ff5fb]">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-white">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* INTERACTIVE DEMO */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="relative overflow-hidden rounded-3xl border border-[#142526] bg-[#0b1112] p-6 md:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(60% 50% at 60% 0%, rgba(0,194,203,0.22) 0%, rgba(0,0,0,0) 70%)",
            }}
          />
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold md:text-3xl">
                See the platform before signing up
              </h2>
              <p className="mt-3 text-lg font-bold leading-relaxed text-white">
                Take the 3-minute walkthrough and see exactly what affiliates
                experience inside Nettmark.
              </p>
            </div>
            <Link
              href={demoHref}
              className="inline-flex justify-center rounded-xl bg-[#00C2CB] px-5 py-3 font-semibold text-black transition-colors hover:bg-[#00b0b8]"
            >
              Start Interactive Demo
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="text-2xl font-bold md:text-3xl">Questions affiliates ask</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {faqs.map((faq) => (
            <div
              key={faq.q}
              className="rounded-2xl border border-[#1b3132] bg-[#0f1516] p-6"
            >
              <h3 className="text-lg font-semibold text-[#7ff5fb]">
                {faq.q}
              </h3>
              <p className="mt-3 text-sm font-bold leading-6 text-white">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-3xl border border-[#142526] bg-[#0c1213] p-6 md:p-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                Ready to start promoting offers?
              </h2>
              <p className="mt-3 text-lg font-bold leading-relaxed text-white">
                Create an account, browse live offers, and start building
                campaigns with full tracking and commission reporting.
              </p>
            </div>
            <Link
              href={startHref}
              className="inline-flex justify-center rounded-xl bg-[#00C2CB] px-5 py-3 font-semibold text-black transition-colors hover:bg-[#00b0b8]"
            >
              Start Free
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
