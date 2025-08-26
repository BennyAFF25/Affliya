'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Link2, Wallet, Cpu, Briefcase, Users, ArrowRight, Twitter, Linkedin, Mail } from 'lucide-react';

export default function Home() {
  const { session, isLoading } = useSessionContext();
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
    router.push(`/create-account?role=${type}`);
  };

  const handleLogout = async () => {
    localStorage.removeItem('userType');
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      <header
        className="fixed inset-x-0 top-0 z-50 w-full h-16 px-6 bg-black/80 backdrop-blur text-white flex justify-between items-center border-b border-white/10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <Image src="/nettmark-logo.png" alt="Affliya" width={140} height={40} priority className="rounded-sm" />
        </Link>

        {/* Desktop primary nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm justify-center absolute left-1/2 -translate-x-1/2">
          <Link href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">For Businesses</Link>
          <Link href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">For Partners</Link>
          <Link href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">Pricing</Link>
        </nav>

        <div className="md:hidden">
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {user ? (
            <button onClick={handleLogout} className="text-white font-semibold hover:underline">Sign out</button>
          ) : (
            <>
              <button onClick={() => handleLogin('business')} className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors">Business Login</button>
              <button onClick={() => handleLogin('affiliate')} className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8] transition-colors">Affiliate Login</button>
            </>
          )}
        </nav>
      </header>

      <div aria-hidden className="pointer-events-none" style={{ height: 'calc(4rem + env(safe-area-inset-top))' }} />

      {menuOpen && (
        <div
          className="md:hidden px-6 py-4 space-y-4 bg-black/90 backdrop-blur border-b border-white/10 text-white"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* Mobile primary nav */}
          <Link href="/for-businesses" className="block w-full text-left text-[#00C2CB] font-medium">For Businesses</Link>
          <Link href="/for-partners" className="block w-full text-left text-[#00C2CB] font-medium">For Partners</Link>
          <Link href="/pricing" className="block w-full text-left text-[#00C2CB] font-medium">Pricing</Link>

          <div className="border-t border-white/10 pt-4" />

          {user ? (
            <button onClick={handleLogout} className="block w-full text-left text-[#00C2CB] font-medium">Sign out</button>
          ) : (
            <>
              <button onClick={() => handleLogin('business')} className="block w-full text-left text-[#00C2CB] font-medium">Business Login</button>
              <button onClick={() => handleLogin('affiliate')} className="block w-full text-left text-[#00C2CB] font-medium">Affiliate Login</button>
            </>
          )}
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
                  Grow Faster with <span className="text-[#7ff5fb]">Performance‑Based</span><br className="hidden md:block" /> Promotion
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

              {/* Right: Visual placeholder (you can replace src later) */}
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

      {/* WHAT IS NETTMARK: high-level overview (no side-specific details) */}
      <section id="bridge" className="relative mx-auto max-w-7xl px-4 sm:px-6 mt-16 md:mt-24 mb-16 md:mb-24">
        <div className="text-center mb-12">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            What is <span className="text-[#00C2CB]">Nettmark</span>?
          </h3>
          <p className="mt-3 text-white/70 max-w-3xl mx-auto">
            Nettmark is a performance platform that connects brands with trusted promoters under a single shared system for
            tracking, policy guardrails, and payouts. It makes growth predictable and safe—without the usual mess of
            spreadsheets, ad‑hoc links, or blind spend.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">Pillar 01</div>
            <h4 className="mt-1 font-semibold text-lg">Brand‑Safe Growth</h4>
            <p className="mt-2 text-sm text-white/70">
              Clear rules and built‑in guardrails ensure promotions stay on‑brand and within policy—whether paid or organic.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md">
            <div className="text-xs uppercase tracking-widest text-white/50">Pillar 02</div>
            <h4 className="mt-1 font-semibold text-lg">Unified Tracking</h4>
            <p className="mt-2 text-sm text-white/70">
              One source of truth for clicks, carts, and conversions. Real‑time visibility replaces random links and screenshots.
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

        {/* Lightweight routing – let visitors self‑identify without explaining both sides here */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/for-businesses" className="px-5 py-2.5 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]">
            I’m a Business
          </Link>
          <Link href="/for-partners" className="px-5 py-2.5 rounded-lg border border-white/15 text-white hover:bg-white/5">
            I’m a Partner
          </Link>
        </div>
      </section>

      {/* BRIDGE — Animated connection between Brands & Promoters */}
      <section className="relative w-full overflow-hidden py-12 md:py-16 px-4 sm:px-6">
        {/* subtle radial glow background */}
        <div className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent_70%)]">
          <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_50%,#00C2CB22,transparent_60%)]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          {/* first-to-market pill */}
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#7ff5fb] shadow-[0_0_24px_rgba(0,194,203,0.25)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00C2CB] animate-pulse" />
              First to market: brand‑safe performance bridge
            </span>
          </div>

          <h3 className="text-center text-3xl md:text-4xl font-extrabold">
            Bridging the gap between <span className="text-[#00C2CB]">Brands</span> and
            <span className="text-[#00C2CB]"> Promoters</span>
          </h3>
          <p className="mt-3 text-center text-white/70 max-w-3xl mx-auto">
            Nettmark unites both sides in a single, trusted system—shared tracking, policy guardrails, and transparent payouts.
          </p>

          {/* Animated bridge graphic */}
          <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-6">
            {/* Brand node */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 grid place-items-center shadow">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-[#7ff5fb]">
                  <path d="M3 7h18M7 3v18" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <div className="text-sm text-white/80">Brand</div>
            </div>

            {/* Bridge line */}
            <div className="relative h-[72px] sm:h-[84px] w-full md:w-[520px]">
              {/* arc */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 520 84" fill="none">
                <path d="M4 80 C 170 10, 350 10, 516 80" stroke="#0bd2da33" strokeWidth="2" />
              </svg>
              {/* traveling packets */}
              <div className="absolute left-0 top-0 h-full w-full">
                <span className="packet" />
                <span className="packet packet--2" />
                <span className="packet packet--3" />
              </div>
            </div>

            {/* Promoter node */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 grid place-items-center shadow">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-[#7ff5fb]">
                  <path d="M3 10l7-4v12l-7-4Zm9 3h9M12 8h9" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <div className="text-sm text-white/80">Promoter</div>
            </div>
          </div>

          {/* Sub points */}
          <div className="mt-8 grid md:grid-cols-3 gap-4 text-sm text-white/80">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-3">
              <ShieldCheck size={18} className="text-[#00C2CB]" />
              <span>Brand‑safe guardrails</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-3">
              <Link2 size={18} className="text-[#00C2CB]" />
              <span>Unified tracking & visibility</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-3">
              <Wallet size={18} className="text-[#00C2CB]" />
              <span>Outcome‑based payouts</span>
            </div>
          </div>
        </div>

        {/* bridge animation styles */}
        <style jsx>{`
          .packet {
            position: absolute;
            top: 58px; /* sits on the arc visually */
            height: 8px;
            width: 8px;
            border-radius: 9999px;
            background: #00C2CB;
            box-shadow: 0 0 18px rgba(0,194,203,0.65);
            animation: travel 3.2s linear infinite;
          }
          .packet--2 { animation-delay: .9s; opacity: .8; }
          .packet--3 { animation-delay: 1.8s; opacity: .6; }
          @media (min-width: 640px){
            .packet{ top: 66px; }
          }
          @keyframes travel {
            0% { transform: translateX(0) translateY(0); }
            25% { transform: translateX(130px) translateY(-40px); }
            50% { transform: translateX(260px) translateY(-52px); }
            75% { transform: translateX(390px) translateY(-40px); }
            100% { transform: translateX(520px) translateY(0); }
          }
        `}</style>
      </section>

      {/* DIFFERENTIATORS — Sweep Grid (new animation + fresh copy) */}
      <section id="difference" className="relative mx-auto max-w-7xl px-4 sm:px-6 mt-20 md:mt-28 mb-20 md:mb-28">
        <div className="text-center mb-10">
          <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Why teams choose <span className="text-[#00C2CB]">Nettmark</span>
          </h3>
          <p className="mt-3 text-white/70 max-w-3xl mx-auto">
            Purpose‑built infrastructure for performance growth — from account‑hosted ads to policy‑aware links and an
            auditable revenue ledger.
          </p>
        </div>

        {/* moving sweep background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="sweep" />
        </div>

        {/* Feature grid (no pipeline/bridge to avoid repetition) */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Card A */}
          <div className="df-card" style={{ animationDelay: '0ms' }}>
            <div className="df-icon"><Cpu size={18} /></div>
            <div className="df-title">Account‑hosted ads</div>
            <div className="df-sub">Run paid campaigns directly from the brand ad account — creators bring the creative, you keep control.</div>
          </div>

          {/* Card B */}
          <div className="df-card" style={{ animationDelay: '120ms' }}>
            <div className="df-icon"><ShieldCheck size={18} /></div>
            <div className="df-title">Policy‑aware links</div>
            <div className="df-sub">Auto‑enforced rules (geo, placement, messaging). Links deactivate the moment traffic breaks policy.</div>
          </div>

          {/* Card C */}
          <div className="df-card" style={{ animationDelay: '240ms' }}>
            <div className="df-icon"><Link2 size={18} /></div>
            <div className="df-title">Frictionless approvals</div>
            <div className="df-sub">One‑click review for ad ideas or organic plans with instant provisioning of safe tracking.</div>
          </div>

          {/* Card D */}
          <div className="df-card" style={{ animationDelay: '360ms' }}>
            <div className="df-icon"><Wallet size={18} /></div>
            <div className="df-title">Transparent revshare ledger</div>
            <div className="df-sub">Every click, cart, and payout reconciled in a shared ledger — no screenshots, no disputes.</div>
          </div>
        </div>

        {/* styles for sweep + cards */}
        <style jsx>{`
          .sweep{position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 0%,rgba(0,194,203,.10) 35%,rgba(127,245,251,.10) 50%,rgba(0,194,203,.10) 65%,transparent 100%);filter:blur(28px);animation:sweepMove 9s linear infinite}
          @keyframes sweepMove{0%{transform:translateX(-15%) rotate(8deg)}100%{transform:translateX(15%) rotate(8deg)}}

          .df-card{position:relative;border-radius:18px;padding:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);backdrop-filter:blur(2px);box-shadow:0 8px 30px rgba(0,0,0,.35);transition:transform .25s ease, box-shadow .25s ease, border-color .25s ease, background .25s ease;animation:dfIn .5s ease both}
          .df-card:hover{transform:translateY(-3px);box-shadow:0 16px 44px rgba(0,194,203,.2);border-color:rgba(0,194,203,.25);background:rgba(0,194,203,.06)}
          @keyframes dfIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

          .df-icon{display:grid;place-items:center;height:38px;width:38px;border-radius:10px;background:rgba(0,194,203,.12);border:1px solid rgba(0,194,203,.25);color:#7ff5fb;box-shadow:0 0 18px rgba(0,194,203,.25);margin-bottom:.45rem}
          .df-title{font-weight:700}
          .df-sub{font-size:.92rem;color:rgba(255,255,255,.72)}
        `}</style>
      </section>

      {/* HYPE / MOMENTUM — compact separator implementation */}
      <section id="momentum" aria-label="Momentum" className="relative mx-auto max-w-7xl px-4 sm:px-6 my-12 md:my-16 isolate overflow-x-hidden">
        {/* badge */}
        <div className="relative z-30 flex justify-center mb-3 px-4">
          <span className="inline-flex flex-wrap justify-center text-center items-center gap-2 rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] leading-tight font-semibold tracking-wide text-[#7ff5fb] shadow-[0_0_18px_rgba(0,194,203,0.25)] max-w-[min(92vw,56rem)] whitespace-normal">
            Momentum — what teams say they want from Nettmark
          </span>
        </div>

        {/* single, slim ticker row without any surrounding box */}
        <div className="relative overflow-hidden">
          <div className="ticker-slim">
            <div className="track-slim">
              {[
                'First‑to‑market bridge','Account‑hosted ads','Policy‑enforced links','No screenshots — one truth','Pay for outcomes, not promises','Creator‑ready workflows','Brand‑safe by design','Privacy‑conscious tracking','Shared revshare ledger','Unified carts & conversions','Safe access for partners','High‑LTV brand focus','Real‑time visibility','Frictionless approvals','Audit‑friendly by default'
              ].map((t, i) => (
                <span key={`caps-${i}`} className="capsule-slim"><span className="dot-slim" />{t}</span>
              ))}
              {[
                'First‑to‑market bridge','Account‑hosted ads','Policy‑enforced links','No screenshots — one truth','Pay for outcomes, not promises','Creator‑ready workflows','Brand‑safe by design','Privacy‑conscious tracking','Shared revshare ledger','Unified carts & conversions','Safe access for partners','High‑LTV brand focus','Real‑time visibility','Frictionless approvals','Audit‑friendly by default'
              ].map((t, i) => (
                <span key={`capsb-${i}`} className="capsule-slim"><span className="dot-slim alt" />{t}</span>
              ))}
            </div>
          </div>
        </div>

        <style jsx>{`
          /* compact one-row marquee to avoid overlay issues */
          .ticker-slim{ position:relative; }
          .ticker-slim::before,
          .ticker-slim::after{
            content:""; position:absolute; top:0; bottom:0; width:14vw; pointer-events:none; z-index:2;
          }
          .ticker-slim::before{ left:0; background:linear-gradient(to right, rgba(0,0,0,1), rgba(0,0,0,0)); }
          .ticker-slim::after{ right:0; background:linear-gradient(to left, rgba(0,0,0,1), rgba(0,0,0,0)); }
          @media (min-width:640px){
            .ticker-slim::before, .ticker-slim::after{ width:9vw; }
          }

          .track-slim{
            display:flex;
            gap:.8rem;
            white-space:nowrap;
            align-items:center;
            animation:slideLeft 26s linear infinite;
          }
          @keyframes slideLeft{
            from{transform:translateX(0)}
            to{transform:translateX(-50%)}
          }

          .capsule-slim{
            display:inline-flex;
            align-items:center;
            gap:.5rem;
            padding:.55rem .95rem;
            border-radius:9999px;
            background:rgba(255,255,255,.05);
            border:1px solid rgba(255,255,255,.09);
            color:#eafcff;
            font-weight:650;
            letter-spacing:.1px
          }
          .capsule-slim:hover{
            background:rgba(0,194,203,.09);
            border-color:rgba(0,194,203,.28);
            color:#e9feff
          }

          .dot-slim{
            height:.45rem;
            width:.45rem;
            border-radius:9999px;
            background:#00C2CB;
            box-shadow:0 0 10px rgba(0,194,203,.45)
          }
          .dot-slim.alt{
            background:#7ff5fb;
            box-shadow:0 0 10px rgba(127,245,251,.45)
          }

          /* Respect accessibility preferences */
          @media (prefers-reduced-motion: reduce){
            .track-slim{ animation: none; }
          }
        `}</style>
      </section>

      {/* WHO ARE YOU — pick a path */}
      <section id="who" className="relative mx-auto max-w-7xl px-4 sm:px-6 mb-20 md:mb-24">
        <div className="text-center mb-10">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">Who are <span className="text-[#00C2CB]">you</span>?</h3>
          <p className="mt-3 text-white/70 max-w-2xl mx-auto">Choose your path and we’ll take you to the right experience. You can also jump straight into onboarding with one click.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Business card */}
          <div className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md hover:border-[#00C2CB]/30 hover:bg-[#00C2CB]/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 grid place-items-center rounded-xl bg-[#00C2CB]/15 border border-[#00C2CB]/30 text-[#7ff5fb] shadow-[0_0_18px_rgba(0,194,203,0.25)]">
                <Briefcase size={20} />
              </div>
              <h4 className="text-xl font-semibold">I’m a Business</h4>
            </div>
            <p className="mt-3 text-white/70">Connect your ad account, set commissions and approve promoters with guardrails and unified tracking.</p>
            <ul className="mt-4 space-y-1 text-white/75 text-sm">
              <li>• Account‑hosted ads (you keep control)</li>
              <li>• Brand‑safe links and placements</li>
              <li>• Real‑time revenue & payout ledger</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/for-businesses" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white hover:bg-white/5">
                Learn more <ArrowRight size={16} />
              </Link>
              <button onClick={() => handleLogin('business')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8]">
                Start as Business
              </button>
            </div>
          </div>

          {/* Partner card */}
          <div className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md hover:border-[#00C2CB]/30 hover:bg-[#00C2CB]/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 grid place-items-center rounded-xl bg-[#00C2CB]/15 border border-[#00C2CB]/30 text-[#7ff5fb] shadow-[0_0_18px_rgba(0,194,203,0.25)]">
                <Users size={20} />
              </div>
              <h4 className="text-xl font-semibold">I’m a Partner / Affiliate</h4>
            </div>
            <p className="mt-3 text-white/70">Browse offers, launch ads through brand accounts or submit organic plans — get paid on outcomes.</p>
            <ul className="mt-4 space-y-1 text-white/75 text-sm">
              <li>• Ready‑to‑promote offers</li>
              <li>• One‑click approvals & safe tracking</li>
              <li>• Recurring revenue from real brands</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/for-partners" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white hover:bg:white/5 hover:bg-white/5">
                Learn more <ArrowRight size={16} />
              </Link>
              <button onClick={() => handleLogin('affiliate')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8]">
                Start as Partner
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative mt-24 border-t border-white/10 bg-black/40 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="absolute -top-px inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00C2CB]/40 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 md:py-12">
          <div className="grid gap-8 md:grid-cols-4">
            {/* Brand + short pitch */}
            <div className="md:col-span-1">
              <Link href="/" className="inline-flex items-center gap-2">
                <Image src="/nettmark-logo.png" alt="Nettmark" width={130} height={36} className="rounded-sm" />
              </Link>
              <p className="mt-3 text-sm text-white/70 max-w-xs">
                The brand‑safe performance bridge. Run paid or organic promotions with unified tracking and transparent payouts.
              </p>
              <div className="mt-4 flex items-center gap-3 text-white/70">
                <a href="https://twitter.com/" target="_blank" rel="noreferrer" className="hover:text-[#7ff5fb] transition-colors" aria-label="Twitter">
                  <Twitter size={18} />
                </a>
                <a href="https://linkedin.com/" target="_blank" rel="noreferrer" className="hover:text-[#7ff5fb] transition-colors" aria-label="LinkedIn">
                  <Linkedin size={18} />
                </a>
                <a href="mailto:hello@nettmark.app" className="hover:text-[#7ff5fb] transition-colors" aria-label="Email">
                  <Mail size={18} />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <div className="text-xs uppercase tracking-widest text-white/50">Product</div>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                <li><Link href="/for-businesses" className="hover:text-[#7ff5fb]">For Businesses</Link></li>
                <li><Link href="/for-partners" className="hover:text-[#7ff5fb]">For Partners</Link></li>
                <li><Link href="/pricing" className="hover:text-[#7ff5fb]">Pricing</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <div className="text-xs uppercase tracking-widest text-white/50">Company</div>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                <li><a href="mailto:hello@nettmark.app" className="hover:text-[#7ff5fb]">Contact</a></li>
                <li><Link href="/" className="hover:text-[#7ff5fb]">About</Link></li>
              </ul>
            </div>

            {/* Get started */}
            <div>
              <div className="text-xs uppercase tracking-widest text-white/50">Get Started</div>
              <p className="mt-3 text-sm text-white/70">Jump straight into the right flow.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => handleLogin('business')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00C2CB] text-black font-semibold shadow hover:bg-[#00b0b8]">
                  Business Login
                </button>
                <button onClick={() => handleLogin('affiliate')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white hover:bg-white/5">
                  Affiliate Login
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50">
            <div>© {new Date().getFullYear()} Nettmark. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-[#7ff5fb]">Terms</Link>
              <span className="text-white/20">•</span>
              <Link href="/privacy" className="hover:text-[#7ff5fb]">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}