"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";
import {
  ShieldCheck,
  Link2,
  Wallet,
  Sparkles,
  Megaphone,
  Rocket,
  CheckCircle2,
} from "lucide-react";

/**
 * For Businesses – marketing/landing page
 * - Top bar matches home (logo, nav, login buttons, mobile menu)
 * - Hero explains the model
 * - Key benefits that reflect your flow (affiliate-funded spend, approvals, Stripe payouts, control, tracking)
 * - How it works (4 steps)
 * - Animated "trusted by" marquee
 * - CTA footer
 */
export default function ForBusinessesPage() {
  const { session, isLoading } = useSessionContext();
  const user = session?.user ?? null;
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
  }, [isLoading]);

  const handleLogin = (type: "business" | "affiliate") => {
    router.push(`/login?role=${type}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      {/* Topbar */}
      <header
        className="fixed inset-x-0 top-0 z-50 w-full h-16 px-6 bg-black/80 backdrop-blur text-white flex justify-between items-center border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/nettmark-logo.png"
            alt="Nettmark"
            width={140}
            height={40}
            priority
            className="rounded-sm"
          />
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm justify-center absolute left-1/2 -translate-x-1/2">
          <Link
            href="/for-businesses"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors"
          >
            For Businesses
          </Link>
          <Link
            href="/for-partners"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors"
          >
            For Partners
          </Link>
          <Link
            href="/pricing"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors"
          >
            Pricing
          </Link>
        </nav>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Right auth */}
        <nav className="hidden md:flex items-center gap-6">
          {user ? (
            <button
              onClick={handleLogout}
              className="text-white font-semibold hover:underline"
            >
              Sign out
            </button>
          ) : (
            <>
              <button
                onClick={() => handleLogin("business")}
                className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors"
              >
                Business Login
              </button>
              <button
                onClick={() => handleLogin("affiliate")}
                className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors"
              >
                Affiliate Login
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Spacer for fixed header */}
      <div
        aria-hidden
        className="pointer-events-none"
        style={{ height: "calc(4rem + env(safe-area-inset-top))" }}
      />

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="md:hidden px-6 py-4 space-y-4 bg-black/90 backdrop-blur border-b border-white/10 text-white"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <Link
            href="/for-businesses"
            className="block w-full text-left text-[#00C2CB] font-medium"
          >
            For Businesses
          </Link>
          <Link
            href="/for-partners"
            className="block w-full text-left text-[#00C2CB] font-medium"
          >
            For Partners
          </Link>
          <Link
            href="/pricing"
            className="block w-full text-left text-[#00C2CB] font-medium"
          >
            Pricing
          </Link>

          <div className="border-t border-white/10 pt-4" />

          {user ? (
            <button
              onClick={handleLogout}
              className="block w-full text-left text-[#00C2CB] font-medium"
            >
              Sign out
            </button>
          ) : (
            <>
              <button
                onClick={() => handleLogin("business")}
                className="block w-full text-left text-[#00C2CB] font-medium"
              >
                Business Login
              </button>
              <button
                onClick={() => handleLogin("affiliate")}
                className="block w-full text-left text-[#00C2CB] font-medium"
              >
                Affiliate Login
              </button>
            </>
          )}
        </div>
      )}

      {/* HERO */}
      <section className="relative mx-auto max-w-7xl px-6 pt-14 pb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#1e3a3b] bg-[#0b1f21] px-3 py-1 text-xs uppercase tracking-wide text-[#7ff5fb]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
          Brand‑safe performance bridge
        </div>

        <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-tight">
          Plug into serious promoters —{" "}
          <span className="text-[#7ff5fb]">without losing control</span>
        </h1>

        <p className="mt-5 max-w-2xl text-gray-300 text-lg leading-relaxed">
          Partners fund media. You approve what runs. Ads go live only after your sign‑off — with one simple tag for clicks, carts and conversions.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/signup/business"
            className="px-5 py-3 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors"
          >
            Get Started (Free to list)
          </Link>
          <Link
            href="/contact"
            className="px-5 py-3 rounded-md border border-[#214244] bg-transparent text-white hover:bg-[#0b2a2b] transition-colors"
          >
            Talk to us
          </Link>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-7xl px-6 pt-6 pb-4">
        <div className="grid md:grid-cols-3 gap-5">
          <BenefitCard
            icon={<Wallet className="h-5 w-5 text-[#7ff5fb]" />}
            title="No ad prepay"
            copy="Partners cover spend from their own wallet. You only pay a commission on confirmed sales."
          />
          <BenefitCard
            icon={<ShieldCheck className="h-5 w-5 text-[#7ff5fb]" />}
            title="Approve first"
            copy="Partners submit creatives & targeting. Nothing runs until you approve."
          />
          <BenefitCard
            icon={<Link2 className="h-5 w-5 text-[#7ff5fb]" />}
            title="One source of truth"
            copy="Lightweight site tag + platform events — payouts via Stripe, automatically."
          />
        </div>
      </section>

      {/* QUICK FACTS BAND */}
      <section className="mx-auto max-w-7xl px-6 pt-4 pb-2">
        <div className="flex flex-wrap gap-3 rounded-2xl border border-[#16393b] bg-[#0e1617] px-4 py-4">
          <span className="rounded-full border border-[#223d3e] bg-[#111b1c] px-4 py-1.5 text-sm text-gray-300">Keep brand control</span>
          <span className="rounded-full border border-[#223d3e] bg-[#111b1c] px-4 py-1.5 text-sm text-gray-300">Unified tracking</span>
          <span className="rounded-full border border-[#223d3e] bg-[#111b1c] px-4 py-1.5 text-sm text-gray-300">Automatic Stripe payouts</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          How Nettmark works for brands
        </h2>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#19383a] to-transparent mb-6" />
        <div className="grid md:grid-cols-4 gap-4">
          <StepCard step="1" title="Connect" copy="Link Meta & Stripe. Add a small site tag." />
          <StepCard step="2" title="Create an offer" copy="Set commission & rules." />
          <StepCard step="3" title="Approve" copy="Partners fund and submit. You sign‑off." />
          <StepCard step="4" title="Payouts" copy="Confirmed sales pay out automatically." />
        </div>
      </section>

      {/* TRUST STRIP (animated) */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="relative overflow-hidden rounded-2xl border border-[#153436] bg-[#0f1516] px-0 py-3">
          <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_0_80px_10px_rgba(0,194,203,0.08)_inset]" />
          <div className="px-4 pb-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a3b] bg-[#0b1f21] px-3 py-1 text-[11px] uppercase tracking-wide text-[#7ff5fb]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
              Trusted by growth teams across
            </span>
          </div>
          <div className="relative">
            <div className="animate-marquee whitespace-nowrap will-change-transform">
              <MarqueeRow />
              <MarqueeRow ariaHidden />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-6 pb-10">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">FAQs</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <FAQ q="Who pays for the ads?" a="Partners do. They pre‑fund spend from their own wallet — you never prepay." />
          <FAQ q="Do partners get full account access?" a="No. They submit campaigns for approval and run under your guardrails." />
          <FAQ q="How do payouts work?" a="When a partner sale is confirmed, Stripe automatically charges your account and pays the exact commission." />
          <FAQ q="What do we need to start?" a="Connect Meta and Stripe during onboarding and add a lightweight tracking tag." />
        </div>
      </section>


      {/* Page-local animation keyframes */}
      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          display: inline-block;
          min-width: 200%;
          animation: marquee 18s linear infinite;
        }
      `}</style>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function QuickFact({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[#1a3b3d] bg-[#101a1b] px-4 py-3">
      <div className="text-[#7ff5fb] font-semibold">{title}</div>
      <div className="text-gray-300 text-sm mt-1">{desc}</div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-[#16393b] bg-[#0e1617] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span className="font-semibold">{q}</span>
        <span className="text-[#7ff5fb] transition-transform group-open:rotate-45 text-xl leading-none">+</span>
      </summary>
      <p className="mt-2 text-gray-300">{a}</p>
    </details>
  );
}

function BenefitCard({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl border border-[#16393b] bg-[#0e1617] p-4 md:p-5 shadow-none">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h3 className="font-semibold text-lg mb-1">{title}</h3>
          <p className="text-gray-300">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  step,
  title,
  copy,
}: {
  step: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl border border-[#16393b] bg-[#0e1617] p-4 md:p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB]/20 text-[#7ff5fb] text-sm font-semibold border border-[#00C2CB]/30">
          {step}
        </span>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="text-gray-300">{copy}</p>
    </div>
  );
}

function MarqueeRow({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div className="inline-flex gap-3 pr-3" aria-hidden={ariaHidden}>
      {[
        "DTC",
        "SaaS",
        "Marketplaces",
        "Mobile Apps",
        "Creators",
        "Agencies",
        "Wellness",
        "Fintech",
        "Education",
        "DTC",
        "SaaS",
        "Marketplaces",
        "Mobile Apps",
        "Creators",
      ].map((label, i) => (
        <span
          key={`${label}-${i}`}
          className="rounded-full border border-[#223d3e] bg-[#111b1c] px-4 py-1.5 text-sm text-gray-300"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
