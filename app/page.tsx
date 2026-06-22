"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import Link from "next/link";
import Image from "next/image";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingPageTracker from "@/components/marketing/MarketingPageTracker";
import StorylaneEmbed from "@/components/marketing/StorylaneEmbed";
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
  const [walkthroughAudience, setWalkthroughAudience] = useState<
    "business" | "affiliate"
  >("business");

  const trustBadges = [
    "Online stores",
    "Product brands",
    "SaaS companies",
    "Agencies",
    "Creators",
    "Apps",
  ];

  const brandFlow = [
    {
      title: "Create a commission offer",
      copy: "Choose what marketers can promote, how much they earn, and the campaign rules they need to follow.",
    },
    {
      title: "Approve the right marketers",
      copy: "Review who wants to promote your brand before they run Facebook ads or publish organic content.",
    },
    {
      title: "Track sales and pay automatically",
      copy: "Nettmark tracks clicks, sales, and commissions so you can pay for real results without spreadsheets.",
    },
  ];

  const partnerFlow = [
    {
      title: "Find products to promote",
      copy: "Browse brand offers, apply for the ones you like, and get the approved links and assets you need.",
    },
    {
      title: "Run ads or organic campaigns",
      copy: "Promote through Facebook ads, content, email, or your own audience while Nettmark tracks the results.",
    },
    {
      title: "Earn commissions automatically",
      copy: "When your campaigns drive approved sales, Nettmark calculates your commission and handles payout.",
    },
  ];

  const productSnapshots = [
    {
      title: "Sales and payout timeline",
      copy: "See which campaigns drove sales, which commissions are pending, and what has already been paid.",
      stat: "$42.4K pending",
      icon: Wallet,
    },
    {
      title: "Marketer approvals",
      copy: "Review marketer applications and campaign requests before anyone promotes your brand.",
      stat: "7 marketers waiting",
      icon: MessageSquare,
    },
    {
      title: "Campaign tracking",
      copy: "Connect campaign activity to clicks, carts, and sales so both sides know what worked.",
      stat: "$3.9K tracked today",
      icon: BarChart2,
    },
  ];

  const plans = [
    {
      id: "business",
      title: "For Brands",
      priceNow: "Pay for results",
      priceLater: "Create offers and pay commissions when approved sales happen",
      bullets: [
        "Create commission offers for marketers",
        "Approve who can run campaigns",
        "Track sales and automate payouts",
      ],
      cta: "Start as a brand",
      href: "/for-businesses",
    },
    {
      id: "affiliate",
      title: "For Marketers",
      priceNow: "Earn commissions",
      priceLater: "Find products to promote and get paid when your campaigns convert",
      bullets: [
        "Browse approved brand offers",
        "Promote with ads or organic content",
        "Track results and payouts in one place",
      ],
      cta: "Start as a marketer",
      href: "/for-partners",
    },
  ];

  const onboardingSteps = [
    "Connect payouts",
    "Add a billing method",
    "Create your first commission offer",
    "Invite marketers or share your application link",
  ];

  const featureBlocks = [
    {
      title: "You stay in control",
      copy: "Approve marketers, campaign ideas, and brand rules before campaigns go live.",
      icon: ShieldCheck,
    },
    {
      title: "Less admin after every sale",
      copy: "Sales tracking, commission calculations, refunds, and payouts are handled in the platform.",
      icon: ClipboardCheck,
    },
    {
      title: "Real people to help",
      copy: "Our team helps with setup, migration, and questions when you need more than a help article.",
      icon: LifeBuoy,
    },
  ];

  const faqs = [
    {
      q: "What is Nettmark?",
      a: "Nettmark is a marketplace where brands create commission-based offers and marketers promote them through Facebook ads, organic content, or their own audiences.",
    },
    {
      q: "How do marketers get approved?",
      a: "Marketers apply to promote a brand's offer. The brand reviews the request and approves who can promote before campaigns go live.",
    },
    {
      q: "How are commissions tracked?",
      a: "Nettmark tracks clicks, carts, sales, and approved conversions automatically, then calculates the commission owed to the marketer.",
    },
    {
      q: "Is there a long-term contract?",
      a: "No. Nettmark is built so you can start with one offer, prove it works, and grow from there.",
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      router.replace(`/auth/update-password?${params.toString()}`);
      return;
    }

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
  }, [router, supabaseClient]);

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
      <MarketingPageTracker pagePath="/" audience="general" />
      <MarketingHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent_90%)]">
            <div className="mx-auto max-w-7xl h-[420px] blur-3xl opacity-40 bg-gradient-to-r from-[#00C2CB] via-[#7ff5fb] to-transparent" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-16 lg:pt-20 lg:pb-24">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.98fr,1.02fr] items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/60">
                  <Sparkles className="h-3.5 w-3.5 text-[#00C2CB]" />
                  Early access is live
                </div>
                <h1 className="text-[2.25rem] leading-tight sm:text-5xl lg:text-6xl font-extrabold">
                  Connect with marketers who promote your brand for commission.
                  <br className="hidden sm:block" /> Track every sale automatically.
                </h1>
                <p className="text-base sm:text-lg text-white/70 max-w-2xl">
                  Nettmark is a marketplace where brands create offers, approve
                  marketers, track sales, and pay commissions automatically.
                  Marketers can promote through Facebook ads or organic content.
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
                    Start as a marketer
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:text-white"
                  >
                    View pricing →
                  </Link>
                </div>
              </div>
              <div className="relative lg:scale-[1.12] lg:origin-center">
                <div className="absolute -inset-6 rounded-3xl bg-[radial-gradient(60%_60%_at_60%_40%,#00C2CB33,transparent_60%)] blur-2xl opacity-70" />
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.6),0_0_60px_0_rgba(0,194,203,0.12)] animate-hero-float">
                  <div
                    className="relative w-full bg-black/70"
                    style={{ aspectRatio: "1280 / 671" }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center px-1 py-1 sm:px-2 sm:py-2">
                      <img
                        src="/home-hero-dashboard.jpg"
                        alt="Nettmark dashboard preview"
                        className="h-auto w-full object-contain object-center drop-shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_35%)]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mb-16 max-w-7xl overflow-hidden px-4 sm:px-6">
          <p className="mb-6 text-center text-xs uppercase tracking-[0.35em] text-white/45">
            Built for teams selling through
          </p>

          <div className="trust-carousel-mask relative">
            <div className="trust-carousel-track">
              {[...trustBadges, ...trustBadges].map((badge, index) => (
                <span
                  key={`${badge}-${index}`}
                  className="trust-carousel-pill inline-flex shrink-0 items-center rounded-full border border-[#7ff5fb]/20 bg-[linear-gradient(180deg,rgba(16,58,66,0.96),rgba(8,25,30,0.94))] px-6 py-3 text-base font-semibold text-[#e7fdff] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_14px_34px_rgba(0,194,203,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] sm:px-8 sm:py-4 sm:text-lg"
                >
                  <span className="mr-3 inline-block h-2.5 w-2.5 rounded-full bg-[#7ff5fb] shadow-[0_0_14px_rgba(127,245,251,0.95)] sm:h-3 sm:w-3" />
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-20">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">
              Who it is for
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              Brands create offers. Marketers drive sales.
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
                    Launch a commission-based offer in minutes
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
                    For marketers
                  </p>
                  <h3 className="text-xl font-semibold">
                    Find products to promote and get paid
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
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 sm:p-8 lg:p-10 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.6)]">
            <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                  How it works
                </p>
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  See how brands and marketers use Nettmark
                </h2>
              </div>

              <div className="flex flex-col gap-3 lg:items-end">
                <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setWalkthroughAudience("business")}
                    className={`rounded-full px-4 py-2 font-medium transition ${
                      walkthroughAudience === "business"
                        ? "bg-[#00C2CB] text-[#04131d]"
                        : "text-white/75 hover:text-white"
                    }`}
                  >
                    Brand
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkthroughAudience("affiliate")}
                    className={`rounded-full px-4 py-2 font-medium transition ${
                      walkthroughAudience === "affiliate"
                        ? "bg-white text-[#04131d]"
                        : "text-white/55 hover:text-white/75"
                    }`}
                  >
                    Marketer
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  <a
                    href="https://app.storylane.io/demo/qdg9lyyhmgmv?embed=inline"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white hover:bg-white/5"
                  >
                    Open demo
                  </a>
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[1200px]">
              <div className="rounded-[1.8rem] border border-white/10 bg-[#05070b] p-3 sm:p-4 shadow-[0_30px_90px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
                <div className="mb-3 flex items-center justify-between px-2 text-[11px] uppercase tracking-[0.28em] text-white/35">
                  <span>Nettmark demo</span>
                  <span>
                    {walkthroughAudience === "business"
                      ? "Business flow"
                      : "Marketer flow"}
                  </span>
                </div>
                {walkthroughAudience === "business" ? (
                  <StorylaneEmbed
                    desktopHref="https://app.storylane.io/demo/qdg9lyyhmgmv?embed=inline"
                    desktopPadding="calc(65.19% + 25px)"
                    title="Nettmark business walkthrough"
                    mobileHref="https://app.storylane.io/demo/8bo7mlvtch9m?embed=inline"
                    mobilePadding="calc(217.27% + 25px)"
                    mobileTitle="Nettmark business mobile walkthrough"
                  />
                ) : (
                  <StorylaneEmbed
                    desktopHref="https://app.storylane.io/demo/p83vbgruopoj?embed=inline"
                    desktopPadding="calc(65.41% + 25px)"
                    title="Nettmark marketer walkthrough"
                    mobileHref="https://app.storylane.io/demo/vql4sszz4w7m?embed=inline"
                    mobilePadding="calc(217.27% + 25px)"
                    mobileTitle="Nettmark marketer mobile walkthrough"
                  />
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-white/75 md:grid-cols-3">
              {walkthroughAudience === "business" ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB1a] text-xs font-semibold text-[#00C2CB]">
                      1
                    </div>
                    <p>
                      See how a brand creates an offer, connects tracking, and
                      prepares to approve marketers.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB1a] text-xs font-semibold text-[#00C2CB]">
                      2
                    </div>
                    <p>
                      Follow the core path: create the offer, set the campaign
                      rules, and get ready for marketer traffic.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB1a] text-xs font-semibold text-[#00C2CB]">
                      3
                    </div>
                    <p>
                      Understand the setup before you sign up, without booking a
                      call or reading a long guide.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                      1
                    </div>
                    <p>
                      Walk marketers through finding offers, getting approved,
                      and launching campaigns with tracking already connected.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                      2
                    </div>
                    <p>
                      See the marketer view clearly: offers, promotion options,
                      campaign links, and results in one place.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                      3
                    </div>
                    <p>
                      Both sides can see how Nettmark works before creating an
                      account.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-20">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">
              What Nettmark tracks
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              Sales, commissions, and payouts stay connected
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
                Launch checklist
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                4 steps to launch your first offer
              </h3>
              <p className="mt-3 text-sm text-white/70">
                Nettmark guides you through the basics so your first marketers
                can apply, promote, and get paid correctly.
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
              Why users trust it
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              Control, tracking, and support without extra tools
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
            Nettmark is a marketplace where brands create commission-based
            offers and marketers promote them. Brands approve who can promote,
            marketers run paid or organic campaigns, and Nettmark tracks the
            sales and payouts automatically.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">
              Pillar 01
            </div>
            <h4 className="mt-1 font-semibold text-lg">Approved promotion</h4>
            <p className="mt-2 text-sm text-white/70">
              Brands set the rules and approve marketers before paid ads or
              organic campaigns go live.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">
              Pillar 02
            </div>
            <h4 className="mt-1 font-semibold text-lg">Automatic sales tracking</h4>
            <p className="mt-2 text-sm text-white/70">
              Clicks, carts, and sales are tracked in one place, so no one has
              to rely on random links or screenshots.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">
              Pillar 03
            </div>
            <h4 className="mt-1 font-semibold text-lg">Commission payouts</h4>
            <p className="mt-2 text-sm text-white/70">
              Brands pay commissions on approved results, and marketers can see
              what they earned.
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
                <span>Campaign rules</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB1f] text-[#00C2CB]">
                  <Cpu className="w-4 h-4" />
                </span>
                <span>Sales tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB1f] text-[#00C2CB]">
                  <Wallet className="w-4 h-4" />
                </span>
                <span>Automated payouts</span>
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
                Why it is different
              </p>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                One place for <span className="text-[#7ff5fb]">brands</span>
                and <span className="text-[#7ff5fb]">marketers</span> to run
                commission campaigns.
              </h3>
              <p className="mt-4 text-sm sm:text-base text-white/70 max-w-2xl">
                Nettmark connects the pieces that usually sit in separate tools:
                offer approvals, Facebook ad or organic promotion, sales
                tracking, commission calculation, and payout.
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
                        Approve marketers before they run paid or organic
                        campaigns for your brand.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <Link2 className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Track sales from Facebook ads, content, email, and other
                        marketer traffic.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <Wallet className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Pay commissions only when approved sales are tracked.
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
                      For marketers
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-white/75">
                    <li className="flex gap-2">
                      <Cpu className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Find brand offers with approved assets, links, and clear
                        campaign rules.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <Wallet className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Run Facebook ads or organic campaigns and see results as
                        they happen.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <ArrowRight className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>
                        Get commissions calculated and paid without chasing
                        screenshots or invoices.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#00C2CB33] bg-black/60 px-4 py-5 sm:px-5 sm:py-6">
              <p className="text-xs font-semibold tracking-[0.24em] text-[#7ff5fb] uppercase mb-2">
                How the marketplace works
              </p>
              <ol className="space-y-3 text-sm text-white/80">
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    1
                  </span>
                  <span>
                    Brands create commission-based offers and set the campaign
                    rules.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    2
                  </span>
                  <span>
                    Marketers apply, get approved, and launch Facebook ads or
                    organic posts.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    3
                  </span>
                  <span>
                    Nettmark tracks clicks, carts, and sales automatically.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    4
                  </span>
                  <span>
                    Commissions are calculated and payouts are handled
                    automatically.
                  </span>
                </li>
              </ol>
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#00b0b8] transition-colors"
                >
                  See pricing
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[11px] text-white/50">
                  Start with one offer, approve your first marketers, and grow
                  from there.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW NETTMARK WORKS DAY TO DAY */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 mb-16 md:mb-24">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#00C2CB1e] text-[#00C2CB]">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h4 className="font-semibold text-sm tracking-wide uppercase text-white/80">
                Campaign rules
              </h4>
            </div>
            <p className="text-sm text-white/70">
              Approvals, campaign rules, and brand guidelines live with each
              offer. Marketers know what&apos;s allowed before they promote.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#00C2CB1e] text-[#00C2CB]">
                <Cpu className="w-4 h-4" />
              </span>
              <h4 className="font-semibold text-sm tracking-wide uppercase text-white/80">
                Everything connected
              </h4>
            </div>
            <p className="text-sm text-white/70">
              Offers, campaign assets, tracking links, sales, and payouts stay
              in one place instead of across spreadsheets, ad accounts, and DMs.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#00C2CB1e] text-[#00C2CB]">
                <Wallet className="w-4 h-4" />
              </span>
              <h4 className="font-semibold text-sm tracking-wide uppercase text-white/80">
                Clear commission payments
              </h4>
            </div>
            <p className="text-sm text-white/70">
              Commissions, refunds, and payouts are handled through Nettmark and
              Stripe so both sides can see what was paid and why.
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
              Start with one offer. Let approved marketers bring you sales.
            </h3>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              Create a commission offer, approve marketers, track every sale,
              and pay automatically when campaigns work.
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
              I&apos;m a marketer
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
              © {new Date().getFullYear()} Nettmark. Built for brands and
              marketers.
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
            <Link
              href="/commission-ads"
              className="hover:text-[#00C2CB] transition-colors"
            >
              Commission Ads
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
