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
  Megaphone,
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

const cyan = "#00C2CB";

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
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0f0f0f] text-white">
      <MarketingPageTracker pagePath={pagePath} audience="business" />

      <div className="pointer-events-none fixed inset-x-0 top-0 h-[540px] bg-[radial-gradient(circle_at_50%_-10%,rgba(0,194,203,0.18),transparent_48%)]" />

      <main className="relative mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-24">
        <nav className="flex items-center justify-between border-b border-white/[0.07] pb-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-sm font-black text-cyan-300">N</span>
            NETTMARK
          </Link>
          <Link
            href={signupHref}
            onClick={() => trackCta("nav", "Start as a business", signupHref)}
            className="rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-white/85 transition hover:border-cyan-400/30 hover:text-white"
          >
            Start as a business
          </Link>
        </nav>

        <section className="grid gap-10 pb-14 pt-12 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:pb-20 lg:pt-20">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" /> A different way to fund growth
            </div>
            <h1 className="text-[42px] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[72px]">
              Let affiliates fund your advertising. <span className="text-[#00C2CB]">Pay when they make sales.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-7 text-white/65 sm:text-lg">
              Affiliates fund their own campaigns to promote your business. You choose who can promote you, set the commission, and review campaigns before they go live.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => scrollToHowItWorks("hero")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-6 text-sm font-semibold text-[#061012] shadow-[0_0_32px_rgba(0,194,203,.18)] transition hover:bg-[#18d4dc]"
              >
                See how it works <ArrowDown className="h-4 w-4" />
              </button>
              <Link
                href={signupHref}
                onClick={() => trackCta("hero_secondary", "Start as a business", signupHref)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-[#1a1a1a] px-6 text-sm font-semibold text-white transition hover:border-white/20"
              >
                Start as a business <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/50">
              <span>No upfront affiliate ad spend</span>
              <span className="hidden text-white/20 sm:inline">•</span>
              <span>You approve who promotes you</span>
              <span className="hidden text-white/20 sm:inline">•</span>
              <span>Pay when verified sales happen</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-10 bg-[radial-gradient(circle,rgba(0,194,203,.13),transparent_64%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1a1a] p-4 shadow-[0_28px_80px_rgba(0,0,0,.35)] sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">The model</div>
                  <div className="mt-1 text-sm font-medium text-white/70">Who pays for what?</div>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold text-emerald-300">Business ad spend: $0 upfront</span>
              </div>
              <div className="space-y-2.5">
                {flow.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <React.Fragment key={`${item.label}-${item.copy}`}>
                      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#222] px-4 py-3.5 transition hover:border-cyan-400/20">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="h-5 w-5" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{item.label}</p>
                          <p className="mt-0.5 text-sm font-semibold text-white">{item.copy}</p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-cyan-400/55" />
                      </div>
                      {index < flow.length - 1 ? <div className="mx-auto h-3 w-px bg-gradient-to-b from-cyan-400/45 to-transparent" /> : null}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {quickProof.map((item) => (
            <div key={item} className="rounded-2xl border border-white/[0.07] bg-[#1a1a1a] px-3 py-4 text-center text-xs font-medium leading-5 text-white/75 sm:px-4">
              <Check className="mx-auto mb-2 h-4 w-4 text-cyan-300" />
              {item}
            </div>
          ))}
        </section>

        <section id="how-it-works" className="scroll-mt-6 pt-20 sm:pt-28">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">How Nettmark works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">You set the terms. Affiliates take the advertising risk.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base">The flow is deliberately simple. You do not hand your brand to strangers and hope for the best.</p>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.n} className="group rounded-[24px] border border-white/[0.07] bg-[#1a1a1a] p-5 transition hover:-translate-y-1 hover:border-cyan-400/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/25">{step.n}</span>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2a2a2a] text-cyan-300"><Icon className="h-5 w-5" /></div>
                  </div>
                  <h3 className="mt-7 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">{step.copy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="pt-20 sm:pt-28">
          <div className="overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#1a1a1a]">
            <div className="grid lg:grid-cols-[.78fr_1.22fr]">
              <div className="border-b border-white/[0.07] p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">How the economics work</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Who actually pays for the advertising?</h2>
                <p className="mt-4 text-sm leading-6 text-white/55">The affiliate funds it. You pay the commission tied to qualifying sales. Here is a simple illustrative example.</p>
                <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-4 text-sm leading-6 text-white/65">
                  <strong className="text-white">Example only.</strong> Your real commission, order value and affiliate ad spend are set by the offer and campaign economics.
                </div>
              </div>
              <div className="p-5 sm:p-8">
                <div className="space-y-2">
                  {[
                    ["Affiliate ad spend", "$500", "Paid by affiliate", "text-cyan-300"],
                    ["Tracked customer sales", "$3,000", "Illustrative", "text-white"],
                    ["Commission", "$600", "Paid on qualifying sales", "text-amber-300"],
                    ["Business revenue before other costs", "$2,400", "After example commission", "text-emerald-300"],
                  ].map(([label, value, helper, tone]) => (
                    <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#222] px-4 py-4">
                      <div><p className="text-sm font-medium text-white/75">{label}</p><p className="mt-0.5 text-xs text-white/35">{helper}</p></div>
                      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
                    </div>
                  ))}
                  <div className="mt-3 flex items-center justify-between rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.09] px-4 py-5">
                    <div><p className="text-sm font-semibold">Business upfront affiliate ad cost</p><p className="mt-1 text-xs text-white/40">The affiliate funded the campaign.</p></div>
                    <p className="text-3xl font-semibold text-cyan-300">$0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 pt-20 sm:pt-28 lg:grid-cols-2">
          <div className="rounded-[28px] border border-white/[0.07] bg-[#1a1a1a] p-6 sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Zap className="h-5 w-5" /></div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">The obvious question</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Why would an affiliate pay for my advertising?</h2>
            <p className="mt-4 text-sm leading-6 text-white/55">Because they are looking for offers they believe they can promote profitably. Their upside is the commission when their campaign generates a tracked sale.</p>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-medium text-white/65">
              {['Finds an offer', 'Funds campaign', 'Generates customer', 'Sale is tracked', 'Earns commission'].map((item, index, arr) => (
                <React.Fragment key={item}><span className="rounded-full border border-white/[0.08] bg-[#2a2a2a] px-3 py-2">{item}</span>{index < arr.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-cyan-400/40" /> : null}</React.Fragment>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(145deg,rgba(0,194,203,.08),#1a1a1a_45%)] p-6 sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><ShieldCheck className="h-5 w-5" /></div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">You stay in control</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">No blank cheque. No handing over your brand.</h2>
            <p className="mt-4 text-sm leading-6 text-white/55">You decide who can promote you, and the paid campaign flow is built around business review before approved campaigns go live.</p>
            <div className="mt-6 space-y-3">
              {controlItems.map((item) => <div key={item} className="flex items-start gap-3 text-sm text-white/70"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{item}</div>)}
            </div>
          </div>
        </section>

        <section className="pt-20 sm:pt-28">
          <div className="mb-7 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">See the product</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Here&apos;s what it looks like inside Nettmark.</h2>
            <p className="mt-4 text-sm leading-6 text-white/55 sm:text-base">Create an offer, review affiliate requests, review funded campaign submissions and track the resulting sales and commissions.</p>
          </div>
          <div className="rounded-[30px] border border-white/[0.08] bg-[#1a1a1a] p-3 shadow-[0_30px_100px_-30px_rgba(0,0,0,.8)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-sm font-semibold"><PlayCircle className="h-4 w-4 text-cyan-300" /> Interactive business walkthrough</div>
              <span className="text-xs text-white/35">Explore before creating an account</span>
            </div>
            <StorylaneEmbed
              desktopHref={demoHref}
              desktopPadding={demoPadding}
              title={demoTitle}
              mobileHref={mobileDemoHref}
              mobilePadding={mobileDemoPadding}
              mobileTitle={mobileDemoTitle}
            />
          </div>
        </section>

        <section className="pt-20 sm:pt-28">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[26px] border border-white/[0.07] bg-[#1a1a1a] p-6 md:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">What do I risk?</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Keep the responsibilities clear.</h2>
            </div>
            <ResponsibilityCard title="You control" icon={ShieldCheck} items={["Your offer", "Your commission", "Who you approve", "Which submitted campaigns go live"]} />
            <ResponsibilityCard title="Affiliate funds" icon={WalletCards} items={["Their paid-media budget", "Their campaign testing", "Their customer acquisition effort"]} />
            <ResponsibilityCard title="You pay" icon={CircleDollarSign} items={["The agreed commission", "On qualifying verified sales", "Nettmark fees under the current pricing plan"]} />
          </div>
        </section>

        <section className="pt-20 sm:pt-28">
          <div className="rounded-[30px] border border-white/[0.07] bg-[#1a1a1a] p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Meta & account access</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Your Meta login is not handed to affiliates.</h2>
                <p className="mt-4 text-sm leading-6 text-white/55">Nettmark uses connected business assets for campaign creation and tracking. The existing product is designed so partners can work through shared ad infrastructure without receiving your login credentials.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TrustCard title="You connect the assets" copy="Your business connects the Meta assets Nettmark needs for the paid campaign flow." icon={MousePointerClick} />
                <TrustCard title="You review submissions" copy="Paid campaign creative moves through the business review flow before an approved campaign runs." icon={Eye} />
                <TrustCard title="Affiliates fund spend" copy="Partners fund paid media from their pre-funded Nettmark wallets." icon={WalletCards} />
                <TrustCard title="No shared login" copy="Affiliates do not need your Facebook or Meta login credentials to participate." icon={ShieldCheck} />
              </div>
            </div>
          </div>
        </section>

        <section className="pt-20 sm:pt-28">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Straight answers</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">The questions you should ask before trying it.</h2>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-2xl border border-white/[0.07] bg-[#1a1a1a] p-5 open:border-cyan-400/20">
                <summary className="cursor-pointer list-none pr-6 text-sm font-semibold leading-6 text-white marker:hidden">{faq.q}</summary>
                <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm leading-6 text-white/50">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pt-20 sm:pt-28">
          <div className="relative overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[#1a1a1a] px-6 py-10 text-center sm:px-10 sm:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(0,194,203,.16),transparent_48%)]" />
            <div className="relative mx-auto max-w-2xl">
              <BadgeCheck className="mx-auto h-7 w-7 text-cyan-300" />
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Ready to see if affiliates want to promote your business?</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base">Create your first offer, set the commission and decide who gets approved. You can explore the product before committing paid ad spend of your own.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href={signupHref} onClick={() => trackCta("footer", "Create my first offer", signupHref)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-6 text-sm font-semibold text-[#061012] hover:bg-[#18d4dc]">Create my first offer <ArrowRight className="h-4 w-4" /></Link>
                <button onClick={() => scrollToHowItWorks("footer_secondary")} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-[#222] px-6 text-sm font-semibold text-white">See how it works</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0f0f0f]/92 px-3 py-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <button onClick={() => scrollToHowItWorks("mobile_sticky")} className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/10 bg-[#1a1a1a] px-4 text-xs font-semibold text-white">See how it works</button>
          <Link href={signupHref} onClick={() => trackCta("mobile_sticky_signup", "Start as a business", signupHref)} className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#00C2CB] px-4 text-xs font-semibold text-[#061012]">Start as a business</Link>
        </div>
      </div>
    </div>
  );
}

function ResponsibilityCard({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: string[] }) {
  return (
    <article className="rounded-[24px] border border-white/[0.07] bg-[#1a1a1a] p-5">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="h-4 w-4" /></div><h3 className="font-semibold">{title}</h3></div>
      <div className="mt-5 space-y-3">{items.map((item) => <div key={item} className="flex items-start gap-2.5 text-sm leading-5 text-white/60"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{item}</div>)}</div>
    </article>
  );
}

function TrustCard({ title, copy, icon: Icon }: { title: string; copy: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#222] p-4">
      <Icon className="h-5 w-5 text-cyan-300" />
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-white/45">{copy}</p>
    </div>
  );
}
