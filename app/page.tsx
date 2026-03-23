"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import Link from "next/link";
import Image from "next/image";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import {
  ShieldCheck,
  Link2,
  Wallet,
  Cpu,
  Briefcase,
  Users,
  ArrowRight,
  Facebook,
  Instagram,
  Mail,
  Sparkles,
  BarChart2,
  MessageSquare,
  ClipboardCheck,
  LifeBuoy,
} from "lucide-react";

export default function Home() {
  const { supabaseClient } = useSessionContext();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const user = session?.user ?? null;
  const router = useRouter();
  const [userType, setUserType] = useState<"business" | "affiliate" | null>(
    null,
  );
  const [showBizWhy, setShowBizWhy] = useState(false);
  const [showAffWhy, setShowAffWhy] = useState(false);

  const trustBadges = [
    "DTC brands",
    "Marketplaces",
    "SaaS",
    "Agencies",
    "Creators",
    "Apps",
  ];

  const brandFlow = [
    {
      title: "Publish an offer",
      copy: "Define payouts, creatives, and guardrails once. Nettmark keeps every partner inside those rails.",
    },
    {
      title: "Approve partners + budgets",
      copy: "Review requests, wallet top-ups, and creative submissions before anything goes live.",
    },
    {
      title: "Track & settle automatically",
      copy: "Clicks, carts, and conversions flow into one ledger so payouts hit Stripe without spreadsheets.",
    },
  ];

  const partnerFlow = [
    {
      title: "Pick ready-to-run offers",
      copy: "Apply to vetted brands with creative packs, tracking links, and policy guardrails baked in.",
    },
    {
      title: "Launch paid or organic",
      copy: "Run campaigns from your own ad accounts or organic channels while Nettmark logs every event.",
    },
    {
      title: "Get paid on proof",
      copy: "Wallet-funded spend and automated payouts mean no more chasing screenshots or invoices.",
    },
  ];

  const productSnapshots = [
    {
      title: "Wallet & payout timeline",
      copy: "Instant view of top-ups, reserved ad spend, and cleared payouts so finance isn’t guessing.",
      stat: "$42.4K in-clearing",
      icon: Wallet,
    },
    {
      title: "Policy-first approvals",
      copy: "Inbox highlights what changed, who approved, and which rules each creative references.",
      stat: "7 partners waiting",
      icon: MessageSquare,
    },
    {
      title: "Ad spend → business charges",
      copy: "Meta spend sync plus automated chargebacks keep every dollar reconciled before payouts fire.",
      stat: "$3.9K synced today",
      icon: BarChart2,
    },
  ];

  const plans = [
    {
      id: "business",
      title: "For Brands",
      priceNow: "$0/mo (Early Access)",
      priceLater: "Then $150/mo",
      bullets: [
        "Publish offers, approvals, and guardrails",
        "Wallet-funded partner spend + meta sync",
        "Automated Stripe payouts + ledger",
      ],
      cta: "Start as a brand",
      href: "/for-businesses",
    },
    {
      id: "affiliate",
      title: "For Partners",
      priceNow: "$0/mo (Early Access)",
      priceLater: "Then $50/mo",
      bullets: [
        "Access vetted offers + policy packs",
        "Submit creatives, track clicks & carts",
        "Wallet + automated payouts in one place",
      ],
      cta: "Start as a partner",
      href: "/for-partners",
    },
  ];

  const onboardingSteps = [
    "Connect Stripe payouts",
    "Add a billing method (wallet top-ups)",
    "Launch your first offer",
    "Invite partners or share application link",
  ];

  const featureBlocks = [
    {
      title: "Compliance & control",
      copy: "Offer guardrails, approval queues, and audit trails keep brands protected while partners move fast.",
      icon: ShieldCheck,
    },
    {
      title: "Automation & reconciliation",
      copy: "Wallet reservations, ad-spend syncing, refunds, and payouts are all ledgered before Stripe moves a dollar.",
      icon: ClipboardCheck,
    },
    {
      title: "Human support",
      copy: "Founders + ops team are in the loop for onboarding, migrations, and escalations — not just a help center.",
      icon: LifeBuoy,
    },
  ];

  const faqs = [
    {
      q: "How do payouts get funded?",
      a: "Brands top up their Nettmark wallet (via card or bank). Funds are reserved the moment a partner drives qualified spend and released to Stripe payouts once conversions clear.",
    },
    {
      q: "Do partners need access to our ad accounts?",
      a: "No. Partners can run from their own ad accounts or submit campaigns that run through Nettmark guarded flows. Everything is logged with offer rules attached.",
    },
    {
      q: "What if Stripe onboarding isn’t finished?",
      a: "We surface a guided checklist (connect payouts, billing, first offer). You can invite partners but money won’t move until payouts + billing are verified.",
    },
    {
      q: "Is there a long-term contract?",
      a: "No. Early access is free for life for the first 150 orgs. After that, monthly plans with cancel-anytime apply.",
    },
  ];

  useEffect(() => {
    const initSession = async () => {
      const { data } = await supabaseClient.auth.getSession();
      setSession(data.session);
      setIsLoading(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseClient]);

  const handleLogin = (type: "business" | "affiliate") => {
    setUserType(type);
    try {
      localStorage.setItem("intent.role", type); // canonical
      localStorage.setItem("userType", type); // legacy (kept for backward-compat)
    } catch {}
    router.push(`/login?role=${type}`);
  };

  return (
    <div className="marketing-home-theme min-h-screen flex flex-col overflow-x-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      <MarketingHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent_90%)]">
            <div className="mx-auto max-w-7xl h-[420px] blur-3xl opacity-40 bg-gradient-to-r from-[#00C2CB] via-[#7ff5fb] to-transparent" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-16 lg:pt-20 lg:pb-24">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr,0.85fr] items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/60">
                  <Sparkles className="h-3.5 w-3.5 text-[#00C2CB]" />
                  Early access is live
                </div>
                <h1 className="text-[2.25rem] leading-tight sm:text-5xl lg:text-6xl font-extrabold">
                  Performance partners on tap.
                  <br className="hidden sm:block" /> Pay only when you win.
                </h1>
                <p className="text-base sm:text-lg text-white/70 max-w-2xl">
                  Wallet-funded ad spend, automated payouts, and a single ledger
                  for brands and affiliates. Nettmark replaces the patchwork of
                  spreadsheets, DMs, and screenshots.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/for-businesses"
                    className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black shadow-[0_0_30px_rgba(0,194,203,0.35)] transition hover:bg-[#00b0b8]"
                  >
                    Start as a brand
                  </Link>
                  <Link
                    href="/for-partners"
                    className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
                  >
                    Start as a partner
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:text-white"
                  >
                    View pricing →
                  </Link>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-6 rounded-3xl bg-[radial-gradient(60%_60%_at_60%_40%,#00C2CB33,transparent_60%)] blur-2xl opacity-70" />
                <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.6),0_0_60px_0_rgba(0,194,203,0.12)] overflow-hidden">
                  <div className="w-full h-[260px] sm:h-[320px] lg:h-[420px] bg-black/60">
                    <img
                      src="/home-hero-dashboard.jpg"
                      alt="Nettmark dashboard preview"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_35%)]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-16">
          <div className="rounded-3xl border border-white/10 bg-black/40 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.35em] text-white/45 mb-4 text-center">
              Trusted by teams across
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
              {trustBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-20">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">
              Guided flow
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              Built for both sides of the table
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#00C2CB1a] text-[#00C2CB]">
                  <Briefcase className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                    For brands
                  </p>
                  <h3 className="text-xl font-semibold">
                    Spin up a partner channel in days
                  </h3>
                </div>
              </div>
              <ul className="space-y-4 text-sm text-white/75">
                {brandFlow.map((step) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#00C2CB]" />
                    <div>
                      <p className="font-semibold text-white">{step.title}</p>
                      <p className="text-white/70">{step.copy}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#7ff5fb1a] text-[#7ff5fb]">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                    For partners
                  </p>
                  <h3 className="text-xl font-semibold">
                    Promote products without chaos
                  </h3>
                </div>
              </div>
              <ul className="space-y-4 text-sm text-white/75">
                {partnerFlow.map((step) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#7ff5fb]" />
                    <div>
                      <p className="font-semibold text-white">{step.title}</p>
                      <p className="text-white/70">{step.copy}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-20">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">
              Live snapshot
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              Everything that moves money shows up here
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {productSnapshots.map((snap) => {
              const Icon = snap.icon;
              return (
                <div
                  key={snap.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.4)]"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#00C2CB1a] text-[#00C2CB]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/35">
                      {snap.stat}
                    </p>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{snap.title}</h3>
                  <p className="text-sm text-white/70">{snap.copy}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-20">
          <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-white/35">
                Onboarding checklist
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                4 steps to go live — no agencies required
              </h3>
              <p className="mt-3 text-sm text-white/70">
                We keep payouts blocked until the essentials are connected, so
                finance and compliance can relax.
              </p>
              <ol className="mt-5 space-y-3 text-sm text-white/80">
                {onboardingSteps.map((step, idx) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB1a] text-xs font-semibold text-[#00C2CB]">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-20">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">
              Proof over promises
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              Built-in guardrails, automation, and humans
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featureBlocks.map((block) => {
              const Icon = block.icon;
              return (
                <div
                  key={block.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/75"
                >
                  <Icon className="h-6 w-6 text-[#00C2CB] mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {block.title}
                  </h3>
                  <p>{block.copy}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-24">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">
              Questions
            </p>
            <h2 className="mt-2 text-3xl font-bold">FAQ</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <FAQItem key={item.q} faq={item} />
            ))}
          </div>
        </section>
      </main>

      {/* WHAT IS NETTMARK */}
      <section
        id="bridge"
        className="relative mx-auto max-w-7xl px-4 sm:px-6 mt-16 md:mt-24 mb-16 md:mb-24"
      >
        <div className="text-center mb-12">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            What is <span className="text-[#00C2CB]">Nettmark</span>?
          </h3>
          <p className="mt-3 text-white/70 max-w-3xl mx-auto">
            Nettmark is a performance platform that connects brands with trusted
            promoters under a single shared system for tracking, policy
            guardrails, and payouts. It makes growth predictable and
            safe—without the usual mess of spreadsheets, ad-hoc links, or blind
            spend.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">
              Pillar 01
            </div>
            <h4 className="mt-1 font-semibold text-lg">Brand-Safe Growth</h4>
            <p className="mt-2 text-sm text-white/70">
              Clear rules and built-in guardrails ensure promotions stay
              on-brand and within policy—whether paid or organic.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">
              Pillar 02
            </div>
            <h4 className="mt-1 font-semibold text-lg">Unified Tracking</h4>
            <p className="mt-2 text-sm text-white/70">
              One source of truth for clicks, carts, and conversions. Real-time
              visibility replaces random links and screenshots.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">
              Pillar 03
            </div>
            <h4 className="mt-1 font-semibold text-lg">Performance Payouts</h4>
            <p className="mt-2 text-sm text-white/70">
              Pay for outcomes, not promises. Nettmark automates earnings so
              incentives are aligned and transparent.
            </p>
          </div>
        </div>

        <div className="mt-10">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 px-5 py-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#00C2CB33,_transparent_60%)] opacity-60 pointer-events-none animate-pulse" />
            <div className="relative flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB1f] text-[#00C2CB]">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <span>Brand‑safe guardrails</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB1f] text-[#00C2CB]">
                  <Cpu className="w-4 h-4" />
                </span>
                <span>Unified tracking &amp; routing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB1f] text-[#00C2CB]">
                  <Wallet className="w-4 h-4" />
                </span>
                <span>Automated Stripe payouts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY NETTMARK WORKS FOR BOTH SIDES */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 mb-16 md:mb-24">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,_#00C2CB22,_transparent_60%)] bg-[#050708] px-6 sm:px-8 py-8 sm:py-10 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
          <div className="grid gap-8 md:grid-cols-[1.2fr,1fr] items-start">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-[#7ff5fb] uppercase mb-3">
                Why Nettmark works
              </p>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                One bridge between{" "}
                <span className="text-[#7ff5fb]">brands</span> and{" "}
                <span className="text-[#7ff5fb]">partners</span>.
              </h3>
              <p className="mt-4 text-sm sm:text-base text-white/70 max-w-2xl">
                We take care of tracking, routing, and payouts so both sides can
                focus on what they&apos;re good at: brands building great
                products, and partners driving attention.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB22] text-[#00C2CB]">
                      <Briefcase className="w-4 h-4" />
                    </span>
                    <p className="text-xs font-semibold tracking-[0.22em] uppercase text-white/60">
                      For brands
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-white/75">
                    <li className="flex gap-2">
                      <ShieldCheck className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Run performance campaigns without handing out ad account
                        logins.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <Link2 className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Unified links and tracking across paid, organic, and
                        UGC.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <Wallet className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Only pay on verified conversions via automated Stripe
                        payouts.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB22] text-[#00C2CB]">
                      <Users className="w-4 h-4" />
                    </span>
                    <p className="text-xs font-semibold tracking-[0.22em] uppercase text-white/60">
                      For partners
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-white/75">
                    <li className="flex gap-2">
                      <Cpu className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Ready-to-run offers with creatives, tracking links, and
                        guardrails built in.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <Wallet className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Wallet-funded ad spend and automated payouts on approved
                        sales.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <ArrowRight className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Focus on performance instead of chasing screenshots and
                        invoices.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#00C2CB33] bg-black/60 px-4 py-5 sm:px-5 sm:py-6">
              <p className="text-xs font-semibold tracking-[0.24em] text-[#7ff5fb] uppercase mb-2">
                A simple shared flow
              </p>
              <ol className="space-y-3 text-sm text-white/80">
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    1
                  </span>
                  <span>
                    Brands publish offers and set the rules once inside
                    Nettmark.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    2
                  </span>
                  <span>
                    Partners request access, submit creatives, and launch ads or
                    organic posts.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    3
                  </span>
                  <span>
                    Nettmark tracks every click, cart, and conversion through a
                    single pipeline.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    4
                  </span>
                  <span>
                    Approved revenue auto-pays to partners and reconciles back
                    to the brand.
                  </span>
                </li>
              </ol>
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#00b0b8] transition-colors"
                >
                  See plans &amp; payouts
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[11px] text-white/50">
                  No long-term lock-ins. Start with a single offer, add more as
                  your performance pipeline scales.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW NETTMARK FEELS TO USE */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 mb-16 md:mb-24">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#00C2CB1e] text-[#00C2CB]">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h4 className="font-semibold text-sm tracking-wide uppercase text-white/80">
                Policy guardrails
              </h4>
            </div>
            <p className="text-sm text-white/70">
              Approvals, rules, and brand guidelines live alongside each offer.
              Partners know exactly what&apos;s allowed, and brands see a clean
              audit trail.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#00C2CB1e] text-[#00C2CB]">
                <Cpu className="w-4 h-4" />
              </span>
              <h4 className="font-semibold text-sm tracking-wide uppercase text-white/80">
                Everything in one pane
              </h4>
            </div>
            <p className="text-sm text-white/70">
              Offers, creatives, tracking, wallets, and payouts all live in one
              UI — no more hopping between spreadsheets, ad accounts, and DMs.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#00C2CB1e] text-[#00C2CB]">
                <Wallet className="w-4 h-4" />
              </span>
              <h4 className="font-semibold text-sm tracking-wide uppercase text-white/80">
                Clean money movement
              </h4>
            </div>
            <p className="text-sm text-white/70">
              Wallet-funded spend, refunds, and performance payouts are handled
              by Nettmark + Stripe. Everyone sees exactly what moved and why.
            </p>
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="border-t border-white/10 bg-gradient-to-r from-[#00C2CB22] via-transparent to-[#7ff5fb22]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 md:py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-[#7ff5fb] uppercase mb-2">
              Ready when you are
            </p>
            <h3 className="text-xl sm:text-2xl font-bold">
              Start with one offer. Grow into a full partner-powered channel.
            </h3>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              Whether you&apos;re a solo creator, an agency, or an in-house
              growth team, Nettmark is built so both sides win on the same
              numbers.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href="/for-businesses"
              className="flex-1 inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8] transition-colors"
            >
              I&apos;m a brand
            </Link>
            <Link
              href="/for-partners"
              className="flex-1 inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
            >
              I&apos;m a partner
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-6">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/50">
              © {new Date().getFullYear()} Nettmark. Built for performance teams
              and partners.
            </p>

            <div className="flex items-center gap-4 text-white/60">
              <Link
                href="https://www.facebook.com/profile.php?id=61583257776587"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#00C2CB] transition-colors"
                aria-label="Nettmark Facebook"
              >
                <Facebook className="w-4 h-4" />
              </Link>

              <Link
                href="https://www.instagram.com/nettmark_?igsh=MTNqOGUyYjgxOGRldg%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#00C2CB] transition-colors"
                aria-label="Nettmark Instagram"
              >
                <Instagram className="w-4 h-4" />
              </Link>

              <Link
                href="mailto:contact@nettmark.com"
                className="hover:text-[#00C2CB] transition-colors"
                aria-label="Email Nettmark"
              >
                <Mail className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Policy links */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50">
            <Link
              href="/legal/privacy"
              className="hover:text-[#00C2CB] transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/privacy/terms-of-service"
              className="hover:text-[#00C2CB] transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/privacy/cookies"
              className="hover:text-[#00C2CB] transition-colors"
            >
              Cookie Policy
            </Link>
            <Link
              href="/legal/privacy/acceptable-use"
              className="hover:text-[#00C2CB] transition-colors"
            >
              Acceptable Use
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

type Plan = {
  id: string;
  title: string;
  priceNow: string;
  priceLater: string;
  bullets: string[];
  cta: string;
  href: string;
};

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 flex flex-col justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-white/35">
          {plan.title}
        </p>
        <h3 className="mt-2 text-2xl font-semibold">{plan.priceNow}</h3>
        <p className="text-sm text-white/60">{plan.priceLater}</p>
        <ul className="mt-4 space-y-2 text-sm text-white/75">
          {plan.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-[#00C2CB]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      <Link
        href={plan.href}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(0,194,203,0.35)] transition hover:bg-[#00b0b8]"
      >
        {plan.cta}
      </Link>
    </div>
  );
}

type FAQ = {
  q: string;
  a: string;
};

function FAQItem({ faq }: { faq: FAQ }) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-base font-semibold text-white">
        {faq.q}
        <span className="text-sm text-white/60 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-3 text-sm text-white/70">{faq.a}</p>
    </details>
  );
}
