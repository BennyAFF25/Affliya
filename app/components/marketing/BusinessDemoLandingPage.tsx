"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  MousePointerClick,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import MarketingPageTracker from "@/components/marketing/MarketingPageTracker";
import StorylaneEmbed from "@/components/marketing/StorylaneEmbed";
import {
  buildHrefWithAttribution,
  extractAttributionFromSearchParams,
  persistAttribution,
} from "@/../utils/marketing/attribution";
import { logMarketingEvent } from "@/../utils/marketing/logEvent";
import { trackMetaCustomEvent } from "@/../utils/marketing/metaPixel";

type Props = {
  pagePath: string;
  demoHref: string;
  demoPadding: string;
  demoTitle: string;
  mobileDemoHref?: string;
  mobileDemoPadding?: string;
  mobileDemoTitle?: string;
};

const quickProof = [
  "No upfront affiliate ad spend",
  "You approve who promotes you",
  "You review campaigns before launch",
  "Pay commission on verified sales",
];

const flow = [
  { label: "Business", copy: "Creates the offer", icon: Store },
  { label: "Affiliate", copy: "Funds the advertising", icon: WalletCards },
  { label: "Business", copy: "Reviews the campaign", icon: ShieldCheck },
  { label: "Customer", copy: "Makes a purchase", icon: Users },
  { label: "Affiliate", copy: "Earns commission", icon: CircleDollarSign },
];

const steps = [
  {
    n: "01",
    title: "Create your offer",
    copy: "Choose what you want promoted and set the commission affiliates can earn.",
    icon: Store,
  },
  {
    n: "02",
    title: "Approve affiliates",
    copy: "People can request to promote your business. You decide who gets access.",
    icon: Users,
  },
  {
    n: "03",
    title: "Review campaigns",
    copy: "Approved affiliates fund their own campaigns. You review what is submitted before it goes live.",
    icon: Eye,
  },
  {
    n: "04",
    title: "Track the result",
    copy: "Nettmark tracks partner-driven sales and the commission attached to them.",
    icon: Target,
  },
];

const controlItems = [
  "Who is allowed to promote your business",
  "The offer and commission you publish",
  "Which submitted campaigns are approved",
  "Your connected Meta assets and account",
  "Tracked sales and commission activity",
];

const faqs = [
  {
    q: "Do I have to pay for the affiliate's advertising upfront?",
    a: "No. Paid-media affiliates fund ad spend from their own pre-funded Nettmark wallet. Your business pays the agreed commission when a qualifying conversion is verified.",
  },
  {
    q: "How much commission do affiliates receive?",
    a: "You set the commission when you create the offer. Affiliates can decide whether the economics make sense for them before they request to promote it.",
  },
  {
    q: "Who decides which affiliates can promote my business?",
    a: "You do. Nettmark supports approval-required offers, so you can review requests and choose who is approved to promote your business.",
  },
  {
    q: "Can an affiliate launch a paid campaign without my approval?",
    a: "The current paid campaign flow is built around business review before an approved campaign runs through the connected Meta account. You review submitted campaign creative rather than handing affiliates unrestricted access.",
  },
  {
    q: "What if an affiliate's ad doesn't perform?",
    a: "The affiliate is taking the paid-media risk on that campaign. Your commission is tied to qualifying sales rather than the affiliate's ad spend.",
  },
  {
    q: "What happens if a customer refunds?",
    a: "Refund handling depends on the conversion and payout state in your tracking setup. Nettmark only describes commissions as payable on verified conversions; review your offer and payout rules before launch if refunds are common for your business.",
  },
  {
    q: "How are sales tracked?",
    a: "Nettmark uses the tracking configured for the offer and records partner-driven conversions so the sale and associated commission can be attributed to the right affiliate.",
  },
  {
    q: "What access does Nettmark need to my Meta account?",
    a: "You connect the Meta assets Nettmark needs for campaign creation and tracking. Affiliates do not need your Meta login credentials; campaigns can use Nettmark's shared ad infrastructure with your connected business assets.",
  },
  {
    q: "How does Nettmark make money?",
    a: "Creating a business account is free. Nettmark's current pricing page lists a $49/month Business subscription once promotional content has been submitted to your brand, plus a 2.2% platform fee on wallet top-ups and business payout charges. Stripe fees are shown separately where applicable.",
  },
];

export default function BusinessDemoLandingPage({
  pagePath,
  demoHref,
  demoPadding,
  demoTitle,
  mobileDemoHref,
  mobileDemoPadding,
  mobileDemoTitle,
}: Props) {
  const searchParams = useSearchParams();
  const attribution = useMemo(
    () => extractAttributionFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const signupHref = useMemo(
    () => buildHrefWithAttribution("/create-account?role=business", attribution),
    [attribution],
  );

  useEffect(() => {
    const rdt = (window as typeof window & { rdt?: (...args: any[]) => void }).rdt;
    if (typeof rdt === "function") {
      rdt("track", "ViewContent", { pagePath, audience: "business" });
    }
  }, [pagePath]);

  const trackCta = (placement: string, label: string, href: string) => {
    if (Object.keys(attribution).length > 0) persistAttribution(attribution);
    const meta = {
      ...attribution,
      cta_label: label,
      cta_href: href,
      cta_placement: placement,
    };
    void logMarketingEvent({
      eventType: "business_demo_cta_click",
      pagePath,
      audience: "business",
      meta,
    });
    trackMetaCustomEvent("BusinessDemoCtaClick", {
      page_path: pagePath,
      role: "business",
      ...meta,
    });
    const rdt = (window as typeof window & { rdt?: (...args: any[]) => void }).rdt;
    if (typeof rdt === "function") {
      rdt("track", "Custom", {
        customEventName: "BusinessDemoCtaClick",
        pagePath,
        audience: "business",
        placement,
      });
    }
  };

  const scrollToHowItWorks = (placement: string) => {
    trackCta(placement, "See how it works", "#how-it-works");
    document.getElementById("how-it-works")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#090a0a] text-white selection:bg-[#00C2CB]/30">
      <MarketingPageTracker pagePath={pagePath} audience="business" />

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-[#00C2CB]/[0.08] blur-[120px]" />
        <div className="nettmark-grid absolute inset-0 opacity-[0.18]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <main className="relative mx-auto w-full max-w-7xl px-4 pb-28 sm:px-6 lg:px-8 lg:pb-24">
        <section className="grid min-h-[88vh] gap-12 pb-16 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-24 lg:pt-16">
          <div className="demo-reveal max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/55 backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00C2CB] opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00C2CB]" />
              </span>
              A different way to fund growth
            </div>

            <h1 className="max-w-[760px] text-[44px] font-medium leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-[76px]">
              Let affiliates fund your advertising. <span className="text-[#00C2CB]">Pay when they make sales.</span>
            </h1>

            <p className="mt-7 max-w-xl text-[16px] font-normal leading-7 text-white/58 sm:text-[18px] sm:leading-8">
              Affiliates fund their own campaigns to promote your business. You choose who can promote you, set the commission, and review campaigns before they go live.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => scrollToHowItWorks("hero")}
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-6 text-sm font-semibold text-[#051012] shadow-[0_12px_40px_rgba(0,194,203,.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#19d5dc] hover:shadow-[0_18px_55px_rgba(0,194,203,.24)]"
              >
                See how it works
                <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
              </button>
              <Link
                href={signupHref}
                onClick={() => trackCta("hero_secondary", "Start as a business", signupHref)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.035] px-6 text-sm font-semibold text-white/90 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.07]"
              >
                Start as a business <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5 text-[12px] text-white/38">
              {[
                "No upfront affiliate ad spend",
                "You approve who promotes you",
                "Pay when verified sales happen",
              ].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-[#00C2CB]/70" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="demo-reveal-delayed relative mx-auto w-full max-w-[560px] lg:mx-0 lg:ml-auto">
            <div className="absolute -inset-16 rounded-full bg-[#00C2CB]/[0.055] blur-[75px]" />
            <div className="hero-float relative overflow-hidden rounded-[34px] border border-white/[0.095] bg-[linear-gradient(155deg,rgba(255,255,255,.075),rgba(255,255,255,.025)_40%,rgba(0,194,203,.035))] p-1 shadow-[0_40px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl">
              <div className="rounded-[30px] border border-white/[0.045] bg-[#101212]/88 p-5 sm:p-6">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.24em] text-white/30">Live model</div>
                    <div className="mt-1.5 text-sm font-medium text-white/78">Who pays for what?</div>
                  </div>
                  <span className="rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/[0.07] px-3 py-1.5 text-[10px] font-medium text-[#66e8ee]">
                    Business ad spend: $0 upfront
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute bottom-5 left-[19px] top-5 w-px bg-gradient-to-b from-[#00C2CB]/10 via-[#00C2CB]/50 to-[#00C2CB]/10" />
                  <div className="signal-dot absolute left-[17px] top-5 h-[5px] w-[5px] rounded-full bg-[#7af4f8] shadow-[0_0_16px_rgba(122,244,248,.9)]" />
                  <div className="space-y-1.5">
                    {flow.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={`${item.label}-${item.copy}`}
                          className="group relative flex items-center gap-4 rounded-2xl px-2 py-3.5 transition duration-300 hover:bg-white/[0.035]"
                        >
                          <div className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-[#111515] text-[#66e8ee] shadow-[0_0_0_5px_#101212]">
                            <Icon className="h-4 w-4" strokeWidth={1.65} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/28">{item.label}</p>
                            <p className="mt-1 text-[14px] font-medium text-white/88">{item.copy}</p>
                          </div>
                          <span className="font-mono text-[10px] text-white/18">0{index + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.07] py-6">
          <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-y-0">
            {quickProof.map((item, index) => (
              <div key={item} className="flex min-h-[90px] items-center gap-3 px-4 py-4 sm:px-6">
                <span className="font-mono text-[10px] text-[#00C2CB]/55">0{index + 1}</span>
                <span className="text-xs font-medium leading-5 text-white/62">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-8 pt-24 sm:pt-32">
          <SectionIntro
            eyebrow="How Nettmark works"
            title="You set the terms. Affiliates take the advertising risk."
            copy="The flow is deliberately simple. You do not hand your brand to strangers and hope for the best."
          />

          <div className="relative mt-10 border-y border-white/[0.07]">
            <div className="pointer-events-none absolute left-0 right-0 top-0 hidden h-px bg-gradient-to-r from-transparent via-[#00C2CB]/30 to-transparent md:block" />
            <div className="grid md:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article
                    key={step.n}
                    className="group relative min-h-[250px] border-b border-white/[0.07] p-6 transition duration-500 last:border-b-0 hover:bg-white/[0.025] md:border-b-0 md:border-r md:last:border-r-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] tracking-[0.18em] text-white/24">{step.n}</span>
                      <Icon className="h-5 w-5 text-[#00C2CB]/65 transition duration-500 group-hover:text-[#74f0f5]" strokeWidth={1.5} />
                    </div>
                    <div className="mt-20">
                      <h3 className="text-lg font-medium tracking-[-0.02em] text-white/92">{step.title}</h3>
                      <p className="mt-3 max-w-[230px] text-sm leading-6 text-white/43">{step.copy}</p>
                    </div>
                    {index < steps.length - 1 ? (
                      <span className="absolute right-[-5px] top-1/2 z-10 hidden h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-[#00C2CB]/35 bg-[#0b0c0c] md:block" />
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="pt-24 sm:pt-32">
          <div className="overflow-hidden rounded-[34px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018))] shadow-[0_35px_100px_rgba(0,0,0,.26)] backdrop-blur-xl">
            <div className="grid lg:grid-cols-[.76fr_1.24fr]">
              <div className="border-b border-white/[0.07] p-7 sm:p-10 lg:border-b-0 lg:border-r">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#62e7ed]">How the economics work</p>
                <h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-white sm:text-[42px] sm:leading-[1.02]">Who actually pays for the advertising?</h2>
                <p className="mt-5 text-sm leading-6 text-white/48">The affiliate funds it. You pay the commission tied to qualifying sales. Here is a simple illustrative example.</p>
                <div className="mt-8 border-l border-[#00C2CB]/35 pl-4 text-sm leading-6 text-white/48">
                  <strong className="font-medium text-white/82">Example only.</strong> Your real commission, order value and affiliate ad spend are set by the offer and campaign economics.
                </div>
              </div>

              <div className="p-6 sm:p-9">
                <div className="divide-y divide-white/[0.065]">
                  {[
                    ["Affiliate ad spend", "$500", "Paid by affiliate", "text-[#67e9ee]"],
                    ["Tracked customer sales", "$3,000", "Illustrative", "text-white"],
                    ["Commission", "$600", "Paid on qualifying sales", "text-amber-200"],
                    ["Business revenue before other costs", "$2,400", "After example commission", "text-emerald-200"],
                  ].map(([label, value, helper, tone]) => (
                    <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-5 py-5 first:pt-1">
                      <div>
                        <p className="text-sm font-medium text-white/67">{label}</p>
                        <p className="mt-1 text-xs text-white/28">{helper}</p>
                      </div>
                      <p className={`text-2xl font-medium tracking-[-0.04em] ${tone}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-[22px] border border-[#00C2CB]/18 bg-[#00C2CB]/[0.055] px-5 py-5">
                  <div>
                    <p className="text-sm font-medium text-white/82">Business upfront affiliate ad cost</p>
                    <p className="mt-1 text-xs text-white/32">The affiliate funded the campaign.</p>
                  </div>
                  <p className="text-4xl font-medium tracking-[-0.05em] text-[#62e7ed]">$0</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-12 pt-24 sm:pt-32 lg:grid-cols-2 lg:gap-20">
          <EditorialBlock
            eyebrow="The obvious question"
            icon={Zap}
            title="Why would an affiliate pay for my advertising?"
            copy="Because they are looking for offers they believe they can promote profitably. Their upside is the commission when their campaign generates a tracked sale."
          >
            <div className="mt-7 flex flex-wrap items-center gap-2.5 text-xs text-white/48">
              {["Finds an offer", "Funds campaign", "Generates customer", "Sale is tracked", "Earns commission"].map((item, index, arr) => (
                <React.Fragment key={item}>
                  <span className="border-b border-white/[0.12] py-1.5">{item}</span>
                  {index < arr.length - 1 ? <ArrowRight className="h-3 w-3 text-[#00C2CB]/35" /> : null}
                </React.Fragment>
              ))}
            </div>
          </EditorialBlock>

          <EditorialBlock
            eyebrow="You stay in control"
            icon={ShieldCheck}
            title="No blank cheque. No handing over your brand."
            copy="You decide who can promote you, and the paid campaign flow is built around business review before approved campaigns go live."
            accent
          >
            <div className="mt-7 divide-y divide-white/[0.06]">
              {controlItems.map((item) => (
                <div key={item} className="flex items-center gap-3 py-3 text-sm text-white/58">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#58e1e7]" strokeWidth={1.7} />
                  {item}
                </div>
              ))}
            </div>
          </EditorialBlock>
        </section>

        <section className="pt-24 sm:pt-32">
          <SectionIntro
            eyebrow="See the product"
            title="Here&apos;s what it looks like inside Nettmark."
            copy="Create an offer, review affiliate requests, review funded campaign submissions and track the resulting sales and commissions."
          />

          <div className="relative mt-10">
            <div className="absolute -inset-6 rounded-[44px] bg-[#00C2CB]/[0.035] blur-3xl" />
            <div className="relative rounded-[34px] border border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.018))] p-2 shadow-[0_45px_120px_-35px_rgba(0,0,0,.82)] backdrop-blur-2xl sm:p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white/78">
                  <PlayCircle className="h-4 w-4 text-[#62e7ed]" strokeWidth={1.7} />
                  Interactive business walkthrough
                </div>
                <span className="text-[11px] text-white/28">Explore before creating an account</span>
              </div>
              <div className="overflow-hidden rounded-[26px] border border-white/[0.06] bg-black/30">
                <StorylaneEmbed
                  desktopHref={demoHref}
                  desktopPadding={demoPadding}
                  title={demoTitle}
                  mobileHref={mobileDemoHref}
                  mobilePadding={mobileDemoPadding}
                  mobileTitle={mobileDemoTitle}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="pt-24 sm:pt-32">
          <SectionIntro eyebrow="What do I risk?" title="Keep the responsibilities clear." />
          <div className="mt-9 grid border-y border-white/[0.07] md:grid-cols-3 md:divide-x md:divide-white/[0.07]">
            <ResponsibilityCard
              title="You control"
              icon={ShieldCheck}
              items={["Your offer", "Your commission", "Who you approve", "Which submitted campaigns go live"]}
            />
            <ResponsibilityCard
              title="Affiliate funds"
              icon={WalletCards}
              items={["Their paid-media budget", "Their campaign testing", "Their customer acquisition effort"]}
            />
            <ResponsibilityCard
              title="You pay"
              icon={CircleDollarSign}
              items={["The agreed commission", "On qualifying verified sales", "Nettmark fees under the current pricing plan"]}
            />
          </div>
        </section>

        <section className="pt-24 sm:pt-32">
          <div className="rounded-[34px] border border-white/[0.08] bg-white/[0.025] p-7 backdrop-blur-xl sm:p-10">
            <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:gap-16">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#62e7ed]">Meta & account access</p>
                <h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] sm:text-[42px] sm:leading-[1.04]">Your Meta login is not handed to affiliates.</h2>
                <p className="mt-5 text-sm leading-6 text-white/46">Nettmark uses connected business assets for campaign creation and tracking. The existing product is designed so partners can work through shared ad infrastructure without receiving your login credentials.</p>
              </div>

              <div className="grid gap-x-8 sm:grid-cols-2">
                <TrustCard title="You connect the assets" copy="Your business connects the Meta assets Nettmark needs for the paid campaign flow." icon={MousePointerClick} />
                <TrustCard title="You review submissions" copy="Paid campaign creative moves through the business review flow before an approved campaign runs." icon={Eye} />
                <TrustCard title="Affiliates fund spend" copy="Partners fund paid media from their pre-funded Nettmark wallets." icon={WalletCards} />
                <TrustCard title="No shared login" copy="Affiliates do not need your Facebook or Meta login credentials to participate." icon={ShieldCheck} />
              </div>
            </div>
          </div>
        </section>

        <section className="pt-24 sm:pt-32">
          <SectionIntro
            eyebrow="Straight answers"
            title="The questions you should ask before trying it."
          />
          <div className="mt-9 border-t border-white/[0.07]">
            {faqs.map((faq, index) => (
              <details key={faq.q} className="group border-b border-white/[0.07] py-1">
                <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-sm font-medium leading-6 text-white/78 marker:hidden sm:text-[15px]">
                  <span className="font-mono text-[10px] text-white/20">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{faq.q}</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.08] text-white/38 transition duration-300 group-open:rotate-45 group-open:border-[#00C2CB]/25 group-open:text-[#62e7ed]">+</span>
                </summary>
                <p className="max-w-3xl pb-6 pl-10 pr-10 text-sm leading-6 text-white/44">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pt-24 sm:pt-32">
          <div className="relative overflow-hidden rounded-[38px] border border-[#00C2CB]/15 bg-[linear-gradient(145deg,rgba(0,194,203,.075),rgba(255,255,255,.025)_48%,rgba(255,255,255,.018))] px-6 py-12 text-center shadow-[0_40px_100px_rgba(0,0,0,.28)] sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute left-1/2 top-full h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C2CB]/10 blur-[75px]" />
            <div className="relative mx-auto max-w-2xl">
              <BadgeCheck className="mx-auto h-7 w-7 text-[#62e7ed]" strokeWidth={1.5} />
              <h2 className="mt-6 text-3xl font-medium tracking-[-0.05em] sm:text-5xl">Ready to see if affiliates want to promote your business?</h2>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-white/46 sm:text-base">Create your first offer, set the commission and decide who gets approved. You can explore the product before committing paid ad spend of your own.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href={signupHref}
                  onClick={() => trackCta("footer", "Create my first offer", signupHref)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-6 text-sm font-semibold text-[#061012] shadow-[0_12px_40px_rgba(0,194,203,.15)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#19d5dc]"
                >
                  Create my first offer <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => scrollToHowItWorks("footer_secondary")}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.035] px-6 text-sm font-semibold text-white/86 backdrop-blur-xl transition hover:bg-white/[0.07]"
                >
                  See how it works
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#090a0a]/80 px-3 py-3 backdrop-blur-2xl md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            onClick={() => scrollToHowItWorks("mobile_sticky")}
            className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.04] px-4 text-xs font-semibold text-white/86"
          >
            See how it works
          </button>
          <Link
            href={signupHref}
            onClick={() => trackCta("mobile_sticky_signup", "Start as a business", signupHref)}
            className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#00C2CB] px-4 text-xs font-semibold text-[#061012]"
          >
            Start as a business
          </Link>
        </div>
      </div>

      <style jsx global>{`
        .nettmark-grid {
          background-image:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: linear-gradient(to bottom, black, transparent 70%);
        }

        .demo-reveal {
          animation: demoReveal .8s cubic-bezier(.22,.75,.2,1) both;
        }

        .demo-reveal-delayed {
          animation: demoReveal .9s .12s cubic-bezier(.22,.75,.2,1) both;
        }

        .hero-float {
          animation: heroFloat 7s ease-in-out infinite;
        }

        .signal-dot {
          animation: signalTravel 5.4s cubic-bezier(.45,.05,.55,.95) infinite;
        }

        @keyframes demoReveal {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes heroFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        @keyframes signalTravel {
          0% { top: 20px; opacity: 0; }
          8% { opacity: 1; }
          92% { opacity: 1; }
          100% { top: calc(100% - 24px); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .demo-reveal,
          .demo-reveal-delayed,
          .hero-float,
          .signal-dot {
            animation: none !important;
          }
          html:focus-within { scroll-behavior: auto; }
        }
      `}</style>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#62e7ed]">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-white sm:text-5xl sm:leading-[1.02]">{title}</h2>
      {copy ? <p className="mt-5 max-w-xl text-sm leading-6 text-white/45 sm:text-base sm:leading-7">{copy}</p> : null}
    </div>
  );
}

function EditorialBlock({
  eyebrow,
  icon: Icon,
  title,
  copy,
  accent = false,
  children,
}: {
  eyebrow: string;
  icon: React.ElementType;
  title: string;
  copy: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article className={`relative border-t pt-7 ${accent ? "border-[#00C2CB]/30" : "border-white/[0.1]"}`}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#62e7ed]">{eyebrow}</p>
        <Icon className="h-5 w-5 text-white/32" strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 max-w-xl text-3xl font-medium tracking-[-0.04em] sm:text-[40px] sm:leading-[1.04]">{title}</h2>
      <p className="mt-5 max-w-xl text-sm leading-6 text-white/46">{copy}</p>
      {children}
    </article>
  );
}

function ResponsibilityCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ElementType;
  items: string[];
}) {
  return (
    <article className="border-b border-white/[0.07] p-6 last:border-b-0 md:border-b-0">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-[#62e7ed]" strokeWidth={1.55} />
        <h3 className="text-sm font-medium text-white/82">{title}</h3>
      </div>
      <div className="mt-6 space-y-3.5">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2.5 text-sm leading-5 text-white/46">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#62e7ed]/70" strokeWidth={1.6} />
            {item}
          </div>
        ))}
      </div>
    </article>
  );
}

function TrustCard({
  title,
  copy,
  icon: Icon,
}: {
  title: string;
  copy: string;
  icon: React.ElementType;
}) {
  return (
    <div className="border-t border-white/[0.07] py-5 first:border-t-0 sm:first:border-t sm:[&:nth-child(2)]:border-t-0">
      <Icon className="h-5 w-5 text-[#62e7ed]/75" strokeWidth={1.55} />
      <h3 className="mt-4 text-sm font-medium text-white/82">{title}</h3>
      <p className="mt-2 max-w-[280px] text-xs leading-5 text-white/38">{copy}</p>
    </div>
  );
}
