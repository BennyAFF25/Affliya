import Link from "next/link";
import Script from "next/script";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import MarketingPageTracker from "@/components/marketing/MarketingPageTracker";

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
  bullets: string[];
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
  bullets,
  footerTitle,
  footerCopy,
}: StorylaneLandingPageProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,194,203,0.18),transparent_32%),linear-gradient(180deg,#061012_0%,#05070b_55%,#030405_100%)] text-white">
      <MarketingPageTracker pagePath={pagePath} audience={audience} />
      <main className="mx-auto flex max-w-7xl flex-col px-4 pb-14 pt-6 sm:px-6 lg:px-8 lg:pb-20 lg:pt-8">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/85 transition hover:bg-white/10 hover:text-white"
          >
            Visit Nettmark home
          </Link>
          <span className="rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[#7ff5fb]">
            {badge}
          </span>
        </div>

        <section className="grid gap-10 lg:grid-cols-[0.9fr,1.1fr] lg:items-center">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/45">
              {audienceLabel}
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-5 text-base leading-7 text-white/70 sm:text-lg">
              {subtitle}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryCta.href}
                className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black shadow-[0_0_35px_rgba(0,194,203,0.28)] transition hover:bg-[#00b0b8]"
              >
                {primaryCta.label}
              </Link>
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
              >
                {secondaryCta.label}
              </Link>
            </div>

            <div className="mt-8 grid gap-3">
              {bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7ff5fb]" />
                  <p className="text-sm leading-6 text-white/72">{bullet}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[2rem] bg-[radial-gradient(circle,rgba(0,194,203,0.2),transparent_65%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.85)] sm:p-4">
              <Script
                src="https://js.storylane.io/js/v2/storylane.js"
                strategy="afterInteractive"
                data-verify-origin=""
              />
              <div
                className="sl-embed relative w-full overflow-hidden rounded-[1.35rem] bg-black"
                style={{
                  paddingBottom: demoPadding,
                  height: 0,
                  transform: "scale(1)",
                }}
              >
                <iframe
                  title={demoTitle}
                  loading="lazy"
                  className="sl-demo absolute left-0 top-0 h-full w-full"
                  src={demoHref}
                  name="sl-embed"
                  allow="fullscreen"
                  allowFullScreen
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: "1px solid rgba(63,95,172,0.35)",
                    boxShadow: "0px 0px 18px rgba(26, 19, 72, 0.15)",
                    borderRadius: "10px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.03] px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
                Next step
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                {footerTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">
                {footerCopy}
              </p>
            </div>

            <Link
              href={primaryCta.href}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#04131d] transition hover:bg-[#dffcff]"
            >
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
