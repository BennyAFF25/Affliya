// app/pricing/page.tsx
"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import Image from "next/image";

type Plan = "business" | "affiliate";

type Meta = {
  title: string;
  price: string;
  blurb: string;
  cta: string;
};

export default function PricingPage() {
  const [err, setErr] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  const displayPrice = (plan: Plan) => {
    const base = plan === "business" ? 150 : 50;
    return `$${base}/mo`;
  };

  const getMeta = (plan: Plan): Meta => {
    const isBusiness = plan === "business";
    return {
      title: isBusiness ? "Business Plan" : "Affiliate Plan",
      price: displayPrice(plan),
      blurb: isBusiness
        ? "Publish offers, approve affiliates, and manage payouts."
        : "Access offers, run ads, and track commissions.",
      cta: "Start Free 50-Day Trial",
    };
  };

  const startCheckout = async (plan: Plan) => {
    setErr(null);
    setLoadingPlan(plan);
    try {
      // eslint-disable-next-line no-console
      console.log("[pricing] starting checkout with plan =", plan);

      const res = await fetch("/api/stripe-app/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: plan }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || `Could not start checkout for ${plan}.`);
        // eslint-disable-next-line no-console
        console.error("[pricing] checkout error:", data);
        return;
      }

      if (data?.url) {
        // eslint-disable-next-line no-console
        console.log("[pricing] redirecting to Stripe Checkout:", data.url);
        window.location.href = data.url;
        return;
      }

      setErr("Checkout session did not return a URL.");
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[pricing] unexpected error:", e);
      setErr(e?.message || "Unexpected error.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const features = [
    { label: "Publish offers & approvals", business: true, affiliate: false },
    { label: "Access marketplace offers", business: false, affiliate: true },
    { label: "Account-hosted Meta ads", business: true, affiliate: true },
    { label: "Unified tracking", business: true, affiliate: true },
    { label: "Auto Stripe payouts", business: true, affiliate: true },
  ] as const;

  const Tick = () => <span className="inline-block h-4 w-4 rounded-full bg-emerald-400/90" />;
  const Dash = () => <span className="inline-block h-4 w-4 rounded bg-white/15" />;

  const faqs = [
    {
      q: "When am I charged?",
      a: "After your free trial ends, monthly on the same date. Cancel anytime from settings.",
    },
    {
      q: "Does Business pay for ads?",
      a: "No. Partners fund ad spend from their pre-funded wallets. You only pay commissions on verified conversions.",
    },
    {
      q: "Can I keep control of my brand?",
      a: "Yes. All creatives and audiences are submitted for approval and run under your guardrails.",
    },
    {
      q: "How do payouts work?",
      a: "Confirmed partner-driven sales trigger automatic, compliant Stripe payouts according to your offer.",
    },
  ] as const;

  const PlanCard = ({ plan }: { plan: Plan }) => {
    const meta = getMeta(plan);
    const label = plan === "business" ? "Business" : "Affiliate";

    return (
      <section className="relative w-full rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-white/[0.01] backdrop-blur-xl shadow-lg">
        <div className="relative p-8 md:p-10 flex flex-col items-center text-center gap-5">
          <div className="flex items-center justify-center">
            <span
              className={`px-4 py-2 rounded-lg border text-sm ${
                plan === "business"
                  ? "bg-[#00C2CB] text-black font-semibold border-transparent"
                  : "border-white/10 text-gray-300"
              }`}
            >
              {label}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{meta.title}</h2>
          <p className="text-gray-400 max-w-md">{meta.blurb}</p>
          <div className="mt-1 text-4xl sm:text-5xl font-black tracking-tight">{meta.price}</div>
          <button
            onClick={() => {
              try {
                // Map UI plan to canonical role used elsewhere
                const role = plan === 'business' ? 'business' : 'affiliate';
                localStorage.setItem('intent.role', role);
              } catch {}
              startCheckout(plan);
            }}
            disabled={loadingPlan === plan}
            className="mt-2 w-full sm:w-auto bg-[#00C2CB] text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-[#00d7df] disabled:opacity-50 shadow-[0_8px_30px_-10px_rgba(0,194,203,0.45)]"
          >
            {loadingPlan === plan ? "Starting…" : meta.cta}
          </button>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-3 w-full">
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">50‑day free trial</div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">Cancel anytime</div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">Stripe‑powered, secure</div>
          </div>
          <details className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left">
            <summary className="cursor-pointer select-none text-sm font-medium list-none">
              What you’re paying for
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-300 list-disc list-inside">
              {(plan === "business"
                ? [
                    "Always-on exposure inside the Nettmark offer marketplace.",
                    "Low-risk, pay-on-results acquisition instead of fixed retainers.",
                    "Infrastructure for approvals, tracking, and automated Stripe payouts.",
                    "Shared ad infrastructure so partners can run Meta ads from your account without sharing logins.",
                  ]
                : [
                    "Access to vetted offers you can promote as a partner.",
                    "Use Nettmark’s tracking, wallets, and payout rails instead of building your own.",
                    "Centralised dashboard for campaigns, conversions, and wallet balance.",
                    "Support for both paid traffic and organic / UGC promotion flows.",
                  ]
              ).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      {/* Header */}
      <header
        className="fixed inset-x-0 top-0 z-50 w-full h-16 px-6 md:px-12 bg-black/80 backdrop-blur text-white flex justify-between items-center border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <Image src="/nettmark-logo.png" alt="Nettmark" width={140} height={40} priority className="rounded-sm" />
        </Link>

        {/* Centered primary nav (desktop) */}
        <nav className="hidden md:flex items-center gap-8 text-sm justify-center absolute left-1/2 -translate-x-1/2">
          <Link href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">For Businesses</Link>
          <Link href="/for-partners" className="text-[#00C2CB] hover:text-[#7fffb] font-semibold tracking-wide transition-colors">For Partners</Link>
          <Link href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">Pricing</Link>
        </nav>

        {/* Right-side actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login?type=business" className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors">Business Login</Link>
          <Link href="/login?type=affiliate" className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors">Affiliate Login</Link>
        </div>

        {/* Mobile menu button (placeholder) */}
        <button type="button" className="md:hidden text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#00C2CB] p-2 rounded" aria-label="Open menu">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>
      <div aria-hidden className="pointer-events-none" style={{ height: "calc(4rem + env(safe-area-inset-top))" }} />

      {/* Main */}
      <main className="flex-1 w-full px-6 md:px-10 py-8 md:py-12">
        <div className="mx-auto w-full max-w-5xl grid gap-6 md:gap-8 md:grid-cols-2">
          <PlanCard plan="business" />
          <PlanCard plan="affiliate" />
        </div>

        {err && (
          <p className="mt-6 text-center text-red-500 text-sm" role="status" aria-live="polite">
            {err}
          </p>
        )}

        <section className="mx-auto mt-12 w-full max-w-5xl rounded-2xl border border-[#00C2CB]/20 bg-gradient-to-b from-[#001f20] via-[#0b0b0b] to-black p-6 md:p-8 shadow-[0_0_25px_rgba(0,194,203,0.15)]">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2"><span className="inline-block w-2 h-2 bg-[#00C2CB] rounded-full"></span> Why Nettmark is worth it</h3>
          <p className="text-sm text-gray-300 mb-6 max-w-3xl">
            Whether you&apos;re a brand or a partner, you&apos;re paying for infrastructure you
            could never justify building alone — tracking, payouts, and guardrails that let
            you focus on the work, not the plumbing.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Business card */}
            <div className="rounded-xl border border-[#00C2CB]/20 bg-[#001718]/60 p-5 shadow-[0_0_20px_rgba(0,194,203,0.12)]">
              <h4 className="text-base font-semibold mb-2 text-[#00C2CB]">If you&apos;re a business</h4>
              <p className="text-xs text-gray-300 mb-3">
                Turn partner traffic into a predictable channel without bloated retainers or
                handing out logins.
              </p>
              <ul className="list-none space-y-1 text-xs text-gray-300">
                <li><span className="inline-block w-2 h-2 rounded-full bg-[#00C2CB] mr-2"></span>Always-on exposure inside the Nettmark marketplace.</li>
                <li><span className="inline-block w-2 h-2 rounded-full bg-[#00C2CB] mr-2"></span>Low-risk, pay-on-results acquisition instead of fixed ad retainers.</li>
                <li><span className="inline-block w-2 h-2 rounded-full bg-[#00C2CB] mr-2"></span>Meta ad infrastructure that lets partners run ads from your account safely.</li>
                <li><span className="inline-block w-2 h-2 rounded-full bg-[#00C2CB] mr-2"></span>Automated, compliant Stripe payouts on verified conversions only.</li>
              </ul>
            </div>

            {/* Partner card */}
            <div className="rounded-xl border border-[#00C2CB]/20 bg-[#001718]/60 p-5 shadow-[0_0_20px_rgba(0,194,203,0.12)]">
              <h4 className="text-base font-semibold mb-2 text-[#00C2CB]">If you&apos;re a partner</h4>
              <p className="text-xs text-gray-300 mb-3">
                Plug into ready-to-sell offers with rails for both paid campaigns and
                organic content.
              </p>
              <ul className="list-none space-y-1 text-xs text-gray-300">
                <li><span className="inline-block w-2 h-2 rounded-full bg-[#00C2CB] mr-2"></span>Instant access to vetted offers and clear commission structures.</li>
                <li><span className="inline-block w-2 h-2 rounded-full bg-[#00C2CB] mr-2"></span>Use Nettmark&apos;s tracking, wallets, and reporting instead of duct-taping tools.</li>
                <li><span className="inline-block w-2 h-2 rounded-full bg-[#00C2CB] mr-2"></span>Run paid Meta ads or lean on organic / UGC flows from the same dashboard.</li>
                <li><span className="inline-block w-2 h-2 rounded-full bg-[#00C2CB] mr-2"></span>Get paid automatically via Stripe without chasing invoices.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 w-full max-w-5xl">
          <h3 className="text-xl font-semibold mb-4">FAQs</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {faqs.map(({ q, a }) => (
              <details key={q} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
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
            Still comparing? <Link className="text-[#00C2CB] hover:text-[#7ff5fb]" href="/contact">Talk to us</Link> — we’ll help you choose.
          </p>
        </section>
      </main>
    </div>
  );
}