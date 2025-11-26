'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Link2, Wallet, Cpu, Briefcase, Users, ArrowRight, Twitter, Linkedin, Mail } from 'lucide-react';

export default function Home() {
  const { session, isLoading, supabaseClient } = useSessionContext();
  const user = session?.user ?? null;
  const router = useRouter();
  const [userType, setUserType] = useState<'business' | 'affiliate' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBizWhy, setShowBizWhy] = useState(false);
  const [showAffWhy, setShowAffWhy] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    // Home should not auto-redirect. Any post-auth routing should happen in /auth-redirect or /auth/callback.
    // If you want to clear old intent on landing home, uncomment the next line:
    // try { localStorage.removeItem('userType'); } catch {}
  }, [isLoading]);

  const handleLogin = (type: 'business' | 'affiliate') => {
    setUserType(type);
    try {
      localStorage.setItem('intent.role', type); // canonical
      localStorage.setItem('userType', type);    // legacy (kept for backward-compat)
    } catch {}
    router.push(`/login?role=${type}`);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('userType');
      localStorage.removeItem('intent.role');
    } catch {}
    setMenuOpen(false);

    try {
      await supabaseClient.auth.signOut();
    } catch (err) {
      console.error('[❌ Home sign out failed]', err);
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      <header
        className="fixed inset-x-0 top-0 z-50 w-full h-16 px-6 bg-black/80 backdrop-blur text-white flex justify-between items-center border-b border-white/10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <Image src="/nettmark-logo.png" alt="Affliya" width={140} height={40} priority className="rounded-sm" />
        </Link>

        {/* Desktop primary nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm justify-center absolute left-1/2 -translate-x-1/2">
          <Link href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">
            For Businesses
          </Link>
          <Link href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">
            For Partners
          </Link>
          <Link href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">
            Pricing
          </Link>
        </nav>

        {/* Mobile menu toggle */}
        <div className="md:hidden">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="text-white p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00C2CB]/60 focus:ring-offset-2 focus:ring-offset-black"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Desktop auth button */}
        <nav className="hidden md:flex items-center gap-6">
          {user ? (
            <button onClick={handleLogout} className="text-white font-semibold hover:underline">
              Sign out
            </button>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors"
            >
              Login
            </button>
          )}
        </nav>
      </header>

      {/* Spacer for fixed header */}
      <div aria-hidden className="pointer-events-none" style={{ height: 'calc(4rem + env(safe-area-inset-top))' }} />

      {/* Mobile nav panel */}
      {menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 z-40 border-b border-white/10 bg-gradient-to-b from-black/95 via-black/92 to-black/90 backdrop-blur-xl">
          <div className="px-6 py-5 space-y-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Navigation
            </p>

            <div className="space-y-3">
              <Link
                href="/for-businesses"
                className="block text-base text-[#00C2CB] font-medium"
                onClick={() => setMenuOpen(false)}
              >
                For Businesses
              </Link>
              <Link
                href="/for-partners"
                className="block text-base text-[#00C2CB] font-medium"
                onClick={() => setMenuOpen(false)}
              >
                For Partners
              </Link>
              <Link
                href="/pricing"
                className="block text-base text-[#00C2CB] font-medium"
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>
            </div>

            <div className="border-t border-white/10 pt-4 mt-3 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Account
              </p>
              {user ? (
                <button
                  onClick={handleLogout}
                  className="block w-full text-left text-base text-[#ffefef] font-medium"
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/login');
                  }}
                  className="block w-full text-left text-base text-[#00C2CB] font-medium"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                  Nettmark connects your brand to thousands of affiliates ready to drive revenue.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <Link
                    href="/for-businesses"
                    className="px-6 py-3 rounded-lg bg-[#00C2CB] text-black font-semibold shadow-[0_0_40px_#00C2CB55] hover:bg-[#00b0b8] transition-colors text-center"
                  >
                    For Businesses
                  </Link>
                  <Link
                    href="/for-partners"
                    className="px-6 py-3 rounded-lg border border-white/15 text-white hover:bg-white/5 transition-colors text-center"
                  >
                    For Partners
                  </Link>
                  <Link
                    href="/pricing"
                    className="px-6 py-3 rounded-lg border border-white/15 text-white hover:bg-white/5 transition-colors text-center"
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

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/for-businesses" className="px-5 py-2.5 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]">
            I’m a Business
          </Link>
          <Link href="/for-partners" className="px-5 py-2.5 rounded-lg border border-white/15 text-white hover:bg-white/5">
            I’m a Partner
          </Link>
        </div>
      </section>

      {/* BRIDGE section, DIFFERENTIATORS, MOMENTUM, WHO ARE YOU, and FOOTER */}
      {/* (All unchanged from your current file; keeping them as-is to avoid disrupting your design) */}
      {/* … if you need tweaks in those sections later we can go through them one by one. */}

      {/* BRIDGE — Animated connection between Brands & Promoters */}
      {/* (keep rest of your original content here unchanged) */}
      {/* ---------- BEGIN ORIGINAL REMAINDER ---------- */}
      {/* I’m leaving everything below this comment exactly as in your file to keep this message shorter.
          When you paste, keep your existing content from the BRIDGE section downwards. The only
          important edits are:
            - handleLogout
            - mobile burger toggle
            - mobile menu panel
      */}
    </div>
  );
}