import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";
import MarketingPageTracker from "@/components/marketing/MarketingPageTracker";
import StorylaneEmbed from "@/components/marketing/StorylaneEmbed";

type StorylaneLandingPageProps = {
  pagePath: string;
  audience: string;
  audienceLabel: string;
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta: {
    label: string;
    href: string;
  };
  demoHref: string;
  demoPadding: string;
  demoTitle: string;
  mobileDemoHref?: string;
  mobileDemoPadding?: string;
  mobileDemoTitle?: string;
  bullets: string[];
  demoIntroTitle: string;
  demoIntroCopy: string;
  demoSteps: string[];
  objectionTitle: string;
  objectionCards: Array<{
    title: string;
    copy: string;
  }>;
  footerTitle: string;
  footerCopy: string;
};

export default function StorylaneLandingPage({
  pagePath,
  audience,
  audienceLabel,
  badge,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  demoHref,
  demoPadding,
  demoTitle,
  mobileDemoHref,
  mobileDemoPadding,
  mobileDemoTitle,
  bullets,
  demoIntroTitle,
  demoIntroCopy,
  demoSteps,
  objectionTitle,
  objectionCards,
  footerTitle,
  footerCopy,
}: StorylaneLandingPageProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,194,203,0.18),transparent_32%),linear-gradient(180deg,#061012_0%,#05070b_55%,#030405_100%)] text-white font-bold">
      <MarketingPageTracker pagePath={pagePath} audience={audience} />
      <main className="mx-auto flex max-w-7xl flex-col px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-20 lg:pt-8">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white/85 transition hover:bg-white/10 hover:text-white"
          >
            Visit Nettmark home
          </Link>
          <span className="rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7ff5fb]">
            {badge}
          </span>
        </div>

        <section className="grid gap-10 lg:grid-cols-[0.9fr,1.1fr] lg:items-center">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/70">
              {audienceLabel}
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-5 text-base leading-7 text-white/85 sm:text-lg">
              {subtitle}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryCta.href}
                className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-bold text-black shadow-[0_0_35px_rgba(0,194,203,0.28)] transition hover:bg-[#00b0b8]"
              >
                {primaryCta.label}
              </Link>
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-white/85 transition hover:bg-white/5 hover:text-white"
              >
                {secondaryCta.label}
              </Link>
            </div>

            <div className="mt-5 text-sm leading-6 text-white/75">
              Watch the demo first, then start only if the flow makes sense.
            </div>

            <div className="mt-8 grid gap-3">
              {bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7ff5fb]" />
                  <p className="text-sm leading-6 text-white/85">{bullet}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="mb-4 rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/10 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#7ff5fb]">
                <PlayCircle className="h-4 w-4" />
                {demoIntroTitle}
              </div>
              <p className="mt-2 text-sm leading-6 text-white/85">
                {demoIntroCopy}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {demoSteps.map((step, index) => (
                  <div
                    key={step}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-white/85"
                  >
                    <span className="mr-2 font-bold text-[#00C2CB]">
                      {index + 1}.
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -inset-5 rounded-[2rem] bg-[radial-gradient(circle,rgba(0,194,203,0.2),transparent_65%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.85)] sm:p-4">
              <StorylaneEmbed
                desktopHref={demoHref}
                desktopPadding={demoPadding}
                title={demoTitle}
                mobileHref={mobileDemoHref}
                mobilePadding={mobileDemoPadding}
                mobileTitle={mobileDemoTitle}
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-bold text-white">
                  Like what you saw?
                </div>
                <div className="text-xs leading-5 text-white/75">
                  Create an account and pick up from the flow shown in the demo.
                </div>
              </div>
              <Link
                href={primaryCta.href}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#00b0b8]"
              >
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 md:col-span-3">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/65">
              Before you start
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {objectionTitle}
            </h2>
          </div>
          {objectionCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5"
            >
              <h3 className="text-base font-bold text-[#7ff5fb]">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/82">
                {card.copy}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.03] px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/65">
                Next step
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                {footerTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/82 sm:text-base">
                {footerCopy}
              </p>
            </div>

            <Link
              href={primaryCta.href}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#04131d] transition hover:bg-[#dffcff]"
            >
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#05070b]/92 px-4 py-3 backdrop-blur md:hidden">
        <Link
          href={primaryCta.href}
          className="flex items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-5 py-3 text-sm font-bold text-black shadow-[0_0_30px_rgba(0,194,203,0.22)]"
        >
          {primaryCta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
