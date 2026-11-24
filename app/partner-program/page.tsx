import type { Metadata } from "next";
import Link from "next/link";
import React, { type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Check,
  CircleDollarSign,
  Clock3,
  Link2,
  Megaphone,
  Store,
  UsersRound,
  Wallet,
} from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import ApplicationForm from "../growth-partners/apply/ApplicationForm";
import { starterKitTemplates } from "../../utils/growthPartners/starterKit";
import "../growth-partners/growth-partners.css";

// Facebook/Meta ad landing page for the Growth Partner Programme (referral partners).
// Copy must only state implemented programme rules (see utils/growthPartners/starterKit.ts).
export const metadata: Metadata = {
  title: "Nettmark Growth Partner Programme | Introduce brands, earn commission",
  description:
    "Nettmark is the affiliate marketplace where approved affiliates fund and run ads on a brand's own Meta ad account. Introduce brands to Nettmark and earn 50% of their eligible subscription revenue, excluding GST, for their first 3 paid months.",
  alternates: { canonical: "/partner-program" },
  openGraph: {
    title: "Nettmark Growth Partner Programme",
    description:
      "Introduce brands to Nettmark, the marketplace where affiliates fund and run ads on the brand's own Meta ad account. Apply to become a Growth Partner.",
    url: "https://www.nettmark.com/partner-program",
    type: "website",
  },
};

const partnerFaq = [
  {
    q: "What is Nettmark?",
    a: "Nettmark is an affiliate marketplace. Brands post commission offers, and approved affiliates fund and run ads directly on the brand's own Meta ad account. Brands pay for performance instead of upfront agency costs.",
  },
  {
    q: "What does a Growth Partner do?",
    a: "You introduce businesses to Nettmark using your personal referral link. You don't need to run ads yourself.",
  },
  {
    q: "Which businesses count?",
    a: "New businesses that sign up and pay for a Nettmark plan at nettmark.com through your link, including those that connect their Shopify store from inside Nettmark. Businesses that install Nettmark from the Shopify App Store and pay through Shopify aren't eligible.",
  },
  {
    q: "How much can I earn?",
    a: "50% of each referred business's eligible subscription revenue, excluding GST, for their first 3 paid months. Free trial periods don't earn commission.",
  },
  {
    q: "When do I get paid?",
    a: "Each commission is held for 14 days after the payment, then reviewed and approved by Nettmark before it is paid out. Payouts are not automatic.",
  },
  {
    q: "How long does my referral link last?",
    a: "The first partner link a business clicks is remembered on that browser for 60 days. They need to start their Nettmark plan within that window.",
  },
  {
    q: "Does it cost anything to join?",
    a: "No. Applying and joining are free. Applications are reviewed for fit, relevance and credibility.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: partnerFaq.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

const applyHref = "#apply";

export default function PartnerProgramPage() {
  return (
    <div className="marketing-home-theme min-h-screen bg-[#05090c] text-white">
      <MarketingHeader />
      <main className="mx-auto max-w-[1180px] px-5 pb-16 pt-4 sm:px-6 lg:px-8">
        <Hero />
        <WhatIsNettmark />
        <WhoItsFor />
        <HowItWorks />
        <StarterKitPreview />
        <ApplySection />
        <Faq />
        <AffiliateAlternative />
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">{children}</div>;
}

function ApplyButton({ className = "" }: { className?: string }) {
  return (
    <a href={applyHref} className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-bold text-black shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300 ${className}`}>
      Apply to become a Growth Partner
      <ArrowRight size={17} aria-hidden="true" />
    </a>
  );
}

function Hero() {
  return (
    <section className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] lg:items-center lg:py-12">
      <div>
        <Eyebrow>Nettmark Growth Partner Programme</Eyebrow>
        <h1 className="mt-5 text-4xl font-bold leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          Know brands that want more sales?
          <br />
          <span className="text-cyan-400">Introduce them to Nettmark.</span>
        </h1>
        <p className="mt-5 max-w-[680px] text-base leading-7 text-slate-300 sm:text-lg">
          Nettmark is an affiliate marketplace where brands post commission offers and approved affiliates fund and
          run ads directly on the brand&apos;s own Meta ad account. Brands pay for performance, not upfront agency fees.
          As a Growth Partner, you introduce the brands and earn when they subscribe.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ApplyButton />
          <a href="#how-it-works" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/5">
            How it works
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Free to apply. Already approved?{" "}
          <Link href="/growth-partners/login" className="text-cyan-300 underline underline-offset-4">Sign in</Link>
        </p>
      </div>
      <div className="rounded-[24px] border border-cyan-400/30 bg-[#0c1115] p-6 shadow-2xl shadow-cyan-500/5 sm:p-7">
        <Eyebrow>Your referral reward</Eyebrow>
        <div className="mt-4 text-5xl font-bold tracking-tight text-white">50%</div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          of each referred business&apos;s eligible subscription revenue, excluding GST, for their first 3 paid months.
        </p>
        <div className="my-5 border-t border-white/10" />
        <div className="space-y-3 text-sm text-slate-300">
          <CheckRow text="Your own referral link and partner dashboard" />
          <CheckRow text="Ready-to-send outreach templates" />
          <CheckRow text="14-day hold, then payouts approved by Nettmark" />
          <CheckRow text="No need to run ads yourself" />
        </div>
      </div>
    </section>
  );
}

function WhatIsNettmark() {
  const cards = [
    { icon: <Store size={22} />, title: "Brands post offers", text: "Brands list what they sell and the commission they will pay affiliates for results." },
    { icon: <Megaphone size={22} />, title: "Affiliates run the ads", text: "Approved affiliates fund and run Meta ads directly on the brand's own native ad account, not on someone else's." },
    { icon: <CircleDollarSign size={22} />, title: "Brands pay for performance", text: "Because affiliates put up the ad spend, brands pay for results instead of upfront agency costs." },
  ];
  return (
    <section className="mt-6 rounded-[24px] border border-white/10 bg-[#0b1014] p-6 lg:p-8" aria-labelledby="what-is-nettmark">
      <Eyebrow>What is Nettmark?</Eyebrow>
      <h2 id="what-is-nettmark" className="mt-3 text-2xl font-bold sm:text-3xl">Not a standard affiliate platform.</h2>
      <p className="mt-3 max-w-[760px] text-sm leading-6 text-slate-400 sm:text-base">
        Most affiliate programmes stop at a coupon code or a tracking link. On Nettmark, affiliates run real ad campaigns
        for a brand on the brand&apos;s own Meta ad account.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cards.map((card) => <Card key={card.title} {...card} />)}
      </div>
    </section>
  );
}

function WhoItsFor() {
  const people = [
    { icon: <Briefcase size={22} />, title: "Agency and marketing people", text: "Media buyers, marketers and agency teams who talk to brands about growth every day." },
    { icon: <UsersRound size={22} />, title: "Consultants and advisors", text: "Consultants, accountants and advisors whose clients want more sales without agency retainers." },
    { icon: <Store size={22} />, title: "Founders and operators", text: "People with contacts at ecommerce, DTC and Shopify brands, especially those already running Meta ads." },
    { icon: <Megaphone size={22} />, title: "Community builders", text: "Creators, educators and community leads with an audience of business owners." },
  ];
  return (
    <section className="mt-8" aria-labelledby="who-its-for">
      <Eyebrow>Who it&apos;s for</Eyebrow>
      <h2 id="who-its-for" className="mt-3 text-2xl font-bold sm:text-3xl">People business owners already trust.</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {people.map((person) => <Card key={person.title} {...person} />)}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <BadgeCheck size={22} />, title: "Apply and get approved", text: "Tell us about yourself below. Approved partners receive a personal referral link and dashboard." },
    { icon: <Link2 size={22} />, title: "Share your link", text: "Send your nettmark.com referral link to business owners. The first partner link they click counts for 60 days." },
    { icon: <Wallet size={22} />, title: "They sign up and pay", text: "The business creates a Nettmark account and pays for a monthly plan at nettmark.com." },
    { icon: <Clock3 size={22} />, title: "You earn", text: "50% of eligible subscription revenue, excluding GST, for their first 3 paid months, after a 14-day hold and Nettmark approval." },
  ];
  return (
    <section id="how-it-works" className="mt-8 scroll-mt-24 rounded-[24px] border border-white/10 bg-[#0b1014] p-6 lg:p-8" aria-labelledby="how-it-works-title">
      <Eyebrow>How it works</Eyebrow>
      <h2 id="how-it-works-title" className="mt-3 text-2xl font-bold sm:text-3xl">Four steps from introduction to payout.</h2>
      <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-white/8 bg-white/[0.015] p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full border border-cyan-400/40 text-cyan-400" aria-hidden="true">{step.icon}</div>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-400 text-xs font-black text-black" aria-hidden="true">{index + 1}</span>
            </div>
            <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 text-sm leading-6 text-slate-300">
        <strong className="text-white">Eligibility:</strong> only Nettmark plans paid at nettmark.com count, including
        businesses that connect their Shopify store from inside Nettmark. Businesses that install Nettmark from the
        Shopify App Store and pay through Shopify aren&apos;t eligible, so always send businesses to your link on
        nettmark.com.
      </p>
    </section>
  );
}

function StarterKitPreview() {
  const sample = starterKitTemplates(null)[0];
  const included = [
    "The key pitch: why brands say yes",
    "Who to approach first",
    "Four copy-ready templates: DM, email, social post and text, with your link filled in",
    "Dos and don'ts, so you stay on the right side of the rules",
  ];
  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start" aria-labelledby="starter-kit-preview">
      <div>
        <Eyebrow>Partner starter kit</Eyebrow>
        <h2 id="starter-kit-preview" className="mt-3 text-2xl font-bold sm:text-3xl">You won&apos;t start from a blank page.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">Every approved partner gets a starter kit in their dashboard, including:</p>
        <ul className="mt-5 space-y-3 text-sm text-slate-300">
          {included.map((item) => <li key={item}><CheckRow text={item} /></li>)}
        </ul>
      </div>
      <figure className="rounded-[24px] border border-white/10 bg-[#0b1014] p-6">
        <figcaption className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Example: {sample.title}</figcaption>
        <blockquote className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{sample.body}</blockquote>
      </figure>
    </section>
  );
}

function ApplySection() {
  return (
    <section id="apply" className="mt-10 scroll-mt-24 rounded-[24px] border border-cyan-400/30 bg-[linear-gradient(135deg,#09272b_0%,#0c1115_55%,#0c1115_100%)] p-6 lg:p-8" aria-labelledby="apply-title">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <Eyebrow>Apply now</Eyebrow>
          <h2 id="apply-title" className="mt-3 text-2xl font-bold sm:text-3xl">Become a Growth Partner.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            It takes about a minute. We review every application for fit, relevance and credibility. If you&apos;re
            approved, your referral link and sign-in instructions arrive by email.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Already approved? <Link href="/growth-partners/login" className="text-cyan-300 underline underline-offset-4">Sign in</Link>
          </p>
        </div>
        <div className="growth-partners gp-embedded">
          <ApplicationForm />
          <p className="mt-4 text-xs text-slate-400">
            By applying, you agree that we can contact you about your application.{" "}
            <Link className="gp-link" href="/legal/privacy">Privacy policy</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="mt-10" aria-labelledby="faq-title">
      <Eyebrow>FAQ</Eyebrow>
      <h2 id="faq-title" className="mt-3 text-2xl font-bold sm:text-3xl">Questions partners ask.</h2>
      <div className="mt-6 grid gap-3">
        {partnerFaq.map((item) => (
          <details key={item.q} className="rounded-2xl border border-white/10 bg-[#0b1014] p-5">
            <summary className="cursor-pointer text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">{item.q}</summary>
            <p className="mt-3 text-sm leading-6 text-slate-400">{item.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8 flex justify-center"><ApplyButton className="w-full sm:w-auto" /></div>
    </section>
  );
}

function AffiliateAlternative() {
  return (
    <section className="mt-10 rounded-[24px] border border-white/10 bg-[#0b1014] px-6 py-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Eyebrow>Prefer to run the ads yourself?</Eyebrow>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Affiliates can join the Nettmark marketplace separately, pick brand offers and run Meta campaigns for
            commission.
          </p>
        </div>
        <Link href="/for-partners" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5">
          Explore the affiliate marketplace
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function Card({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="h-full rounded-[20px] border border-white/10 bg-[#0b1014] p-5">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-cyan-400/35 text-cyan-400" aria-hidden="true">{icon}</div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <span className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400 text-black" aria-hidden="true">
        <Check size={12} strokeWidth={3} />
      </span>
      <span>{text}</span>
    </span>
  );
}
