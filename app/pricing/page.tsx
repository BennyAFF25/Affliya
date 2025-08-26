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

  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const displayPrice = (plan: Plan) => {
    const base = plan === "business" ? 150 : 50;
    if (billing === "monthly") return `$${base}/mo`;
    const annual = Math.round(base * 12 * 0.83); // ~2 months free
    return `$${annual}/yr`;
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
          {plan === "business" && (
            <span className="self-center -mt-2 mb-1 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
              Most popular
            </span>
          )}
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
          <Link href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">For Partners</Link>
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
        <div className="mx-auto w-full max-w-5xl mb-6 flex items-center justify-center gap-2 text-sm">
          <button
            className={`px-3 py-1.5 rounded-md border ${billing === "monthly" ? "bg-white/10 border-white/20 text-white" : "border-white/10 text-gray-300 hover:text-white"}`}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>
          <button
            className={`px-3 py-1.5 rounded-md border ${billing === "annual" ? "bg-white/10 border-white/20 text-white" : "border-white/10 text-gray-300 hover:text-white"}`}
            onClick={() => setBilling("annual")}
          >
            Annual <span className="ml-1 text-emerald-300">Save ~17%</span>
          </button>
        </div>
        <div className="mx-auto w-full max-w-5xl grid gap-6 md:gap-8 md:grid-cols-2">
          <PlanCard plan="business" />
          <PlanCard plan="affiliate" />
        </div>

        {err && (
          <p className="mt-6 text-center text-red-500 text-sm" role="status" aria-live="polite">
            {err}
          </p>
        )}

        <section className="mx-auto mt-12 w-full max-w-5xl rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <h3 className="text-xl font-semibold mb-4">Compare features</h3>
          <div className="grid grid-cols-3 gap-y-3 text-sm">
            <div className="text-gray-400" />
            <div className="text-center font-medium">Business</div>
            <div className="text-center font-medium">Affiliate</div>
            {features.map((f) => (
              <Fragment key={f.label}>
                <div className="text-gray-300">{f.label}</div>
                <div className="flex justify-center">{f.business ? <Tick /> : <Dash />}</div>
                <div className="flex justify-center">{f.affiliate ? <Tick /> : <Dash />}</div>
              </Fragment>
            ))}
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