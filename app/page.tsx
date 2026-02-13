'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import Image from 'next/image';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import { ShieldCheck, Link2, Wallet, Cpu, Briefcase, Users, ArrowRight, Facebook, Instagram, Mail } from 'lucide-react';

export default function Home() {
  const { supabaseClient } = useSessionContext();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const user = session?.user ?? null;
  const router = useRouter();
  const [userType, setUserType] = useState<'business' | 'affiliate' | null>(null);
  const [showBizWhy, setShowBizWhy] = useState(false);
  const [showAffWhy, setShowAffWhy] = useState(false);

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

  const handleLogin = (type: 'business' | 'affiliate') => {
    setUserType(type);
    try {
      localStorage.setItem('intent.role', type); // canonical
      localStorage.setItem('userType', type);    // legacy (kept for backward-compat)
    } catch {}
    router.push(`/login?role=${type}`);
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      <MarketingHeader />


      <main className="flex-1">
        {/* HERO */}
        <section className="relative">
          <div className="absolute inset-0 pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent_90%)]">
            {/* subtle glow behind hero */}
            <div className="mx-auto max-w-7xl h-[420px] blur-3xl opacity-30 bg-gradient-to-r from-[#00C2CB] via-[#7ff5fb] to-transparent" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-14 md:pt-16 pb-16 md:pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              {/* Left: Text */}
              <div>
                <h2 className="text-[2rem] leading-[1.15] sm:text-5xl md:text-6xl font-extrabold tracking-tight">
                  Grow Faster with <span className="text-[#7ff5fb]">Performance-Based</span>
                  <br className="hidden md:block" /> Promotion
                </h2>
                <p className="mt-4 text-white/70 text-base sm:text-lg max-w-xl">
                  Nettmark connects your brand to thousands of partners ready to drive revenue.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <Link
                    href="/for-businesses"
                    className="flex-1 px-6 py-3 rounded-lg bg-[#00C2CB] text-black font-semibold shadow-[0_0_28px_#00C2CB55] border border-[#00C2CB]/40 hover:bg-[#00b0b8] hover:shadow-[0_0_36px_#00C2CB66] transition-colors text-center"
                  >
                    For Businesses
                  </Link>
                  <Link
                    href="/for-partners"
                    className="flex-1 px-6 py-3 rounded-lg bg-[#00C2CB] text-black font-semibold shadow-[0_0_28px_#00C2CB55] border border-[#00C2CB]/40 hover:bg-[#00b0b8] hover:shadow-[0_0_36px_#00C2CB66] transition-colors text-center"
                  >
                    For Partners
                  </Link>
                  <Link
                    href="/pricing"
                    className="flex-1 px-6 py-3 rounded-lg bg-[#00C2CB] text-black font-semibold shadow-[0_0_28px_#00C2CB55] border border-[#00C2CB]/40 hover:bg-[#00b0b8] hover:shadow-[0_0_36px_#00C2CB66] transition-colors text-center"
                  >
                    View Pricing
                  </Link>
                </div>
              </div>

              {/* Right: Visual placeholder */}
              <div className="relative group max-w-full">
                {/* teal glow behind card */}
                <div className="absolute -inset-6 rounded-3xl bg-[radial-gradient(60%_60%_at_60%_40%,#00C2CB33,transparent_60%)] blur-2xl opacity-70 group-hover:opacity-100 transition-opacity" />

                {/* framed card */}
                <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] overflow-hidden shadow-[0_25px_80px_-20px_rgba(0,0,0,0.6),0_0_60px_0_rgba(0,194,203,0.15)] ring-1 ring-white/5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-1">
                  <div className="w-full h-[240px] sm:h-[300px] md:h-[420px] bg-black/60">
                    <img
                      src="/marketplace-visual.png"
                      alt="Product preview"
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* top glass/shine */}
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.065),transparent_30%)]" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* WHAT IS NETTMARK */}
      <section id="bridge" className="relative mx-auto max-w-7xl px-4 sm:px-6 mt-16 md:mt-24 mb-16 md:mb-24">
        <div className="text-center mb-12">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            What is <span className="text-[#00C2CB]">Nettmark</span>?
          </h3>
          <p className="mt-3 text-white/70 max-w-3xl mx-auto">
            Nettmark is a performance platform that connects brands with trusted promoters under a single shared system for
            tracking, policy guardrails, and payouts. It makes growth predictable and safe—without the usual mess of
            spreadsheets, ad-hoc links, or blind spend.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">Pillar 01</div>
            <h4 className="mt-1 font-semibold text-lg">Brand-Safe Growth</h4>
            <p className="mt-2 text-sm text-white/70">
              Clear rules and built-in guardrails ensure promotions stay on-brand and within policy—whether paid or organic.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">Pillar 02</div>
            <h4 className="mt-1 font-semibold text-lg">Unified Tracking</h4>
            <p className="mt-2 text-sm text-white/70">
              One source of truth for clicks, carts, and conversions. Real-time visibility replaces random links and screenshots.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">Pillar 03</div>
            <h4 className="mt-1 font-semibold text-lg">Performance Payouts</h4>
            <p className="mt-2 text-sm text-white/70">
              Pay for outcomes, not promises. Nettmark automates earnings so incentives are aligned and transparent.
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
                One bridge between <span className="text-[#7ff5fb]">brands</span> and{' '}
                <span className="text-[#7ff5fb]">partners</span>.
              </h3>
              <p className="mt-4 text-sm sm:text-base text-white/70 max-w-2xl">
                We take care of tracking, routing, and payouts so both sides can focus on what they&apos;re good at:
                brands building great products, and partners driving attention.
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
                      <span>Run performance campaigns without handing out ad account logins.</span>
                    </li>
                    <li className="flex gap-2">
                      <Link2 className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>Unified links and tracking across paid, organic, and UGC.</span>
                    </li>
                    <li className="flex gap-2">
                      <Wallet className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>Only pay on verified conversions via automated Stripe payouts.</span>
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
                      <span>Ready-to-run offers with creatives, tracking links, and guardrails built in.</span>
                    </li>
                    <li className="flex gap-2">
                      <Wallet className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>Wallet-funded ad spend and automated payouts on approved sales.</span>
                    </li>
                    <li className="flex gap-2">
                      <ArrowRight className="w-4 h-4 mt-[3px] text-[#7ff5fb]" />
                      <span>Focus on performance instead of chasing screenshots and invoices.</span>
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
                  <span>Brands publish offers and set the rules once inside Nettmark.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    2
                  </span>
                  <span>Partners request access, submit creatives, and launch ads or organic posts.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    3
                  </span>
                  <span>Nettmark tracks every click, cart, and conversion through a single pipeline.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-full bg-[#00C2CB33] text-xs font-semibold text-[#00C2CB]">
                    4
                  </span>
                  <span>Approved revenue auto-pays to partners and reconciles back to the brand.</span>
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
                  No long-term lock-ins. Start with a single offer, add more as your performance pipeline scales.
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
              Approvals, rules, and brand guidelines live alongside each offer. Partners know exactly what&apos;s allowed,
              and brands see a clean audit trail.
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
              Offers, creatives, tracking, wallets, and payouts all live in one UI — no more hopping between spreadsheets,
              ad accounts, and DMs.
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
              Wallet-funded spend, refunds, and performance payouts are handled by Nettmark + Stripe. Everyone sees exactly
              what moved and why.
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
              Whether you&apos;re a solo creator, an agency, or an in-house growth team, Nettmark is built so both sides
              win on the same numbers.
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
              © {new Date().getFullYear()} Nettmark. Built for performance teams and partners.
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
            <Link href="/legal/privacy" className="hover:text-[#00C2CB] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/legal/privacy/terms-of-service" className="hover:text-[#00C2CB] transition-colors">
              Terms of Service
            </Link>
            <Link href="/legal/privacy/cookies" className="hover:text-[#00C2CB] transition-colors">
              Cookie Policy
            </Link>
            <Link href="/legal/privacy/acceptable-use" className="hover:text-[#00C2CB] transition-colors">
              Acceptable Use
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
