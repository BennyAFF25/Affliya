'use client';

import Link from 'next/link';
import Image from 'next/image';
import { User, Briefcase } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-[#00363a] via-black to-black">
      <header className="fixed top-0 inset-x-0 z-50 bg-black bg-opacity-90 backdrop-blur-sm border-b border-white/10">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
          <div className="w-full h-16 flex items-center justify-between border-b border-white/10 lg:border-none">
            <div className="flex items-center">
              <Link href="/" className="flex items-center -ml-2">
                <Image 
                  src="/nettmark-logo.png" 
                  alt="Affliya" 
                  width={140} 
                  height={40} 
                  priority 
                  className="rounded-sm" 
                />
              </Link>
              <div className="flex justify-center absolute left-1/2 -translate-x-1/2 space-x-8">
                <Link href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-medium">
                  For Businesses
                </Link>
                <Link href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-medium">
                  For Partners
                </Link>
                <Link href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-medium">
                  Pricing
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <Link
                href="/"
                className="inline-block rounded-md border border-transparent bg-[#00C2CB] py-2 px-4 text-base font-medium text-black hover:bg-[#00b0b8]"
              >
                Home
              </Link>
            </div>
          </div>
        </nav>
      </header>
      <div aria-hidden="true" className="h-20" />
      <div className="flex-grow flex items-center justify-center px-4 pb-8">
        <div className="relative w-full max-w-md">
          {/* Soft glow behind card */}
          <div
            className="pointer-events-none absolute -inset-x-10 -top-16 h-56 blur-3xl opacity-60"
            style={{
              background:
                'radial-gradient(60% 80% at 50% 10%, rgba(0,194,203,0.32), transparent 65%)',
            }}
          />

          <div className="relative w-full rounded-2xl border border-white/10 bg-[#05070a] px-8 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.7)] opacity-0 translate-y-5 animate-fade-in-up">
            {/* Accent bar */}
            <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-[#00C2CB] via-[#7ff5fb] to-[#00C2CB]" />

            {/* Mini header / badge row */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00C2CB]/10 border border-[#00C2CB]/40 text-[#7ff5fb] text-sm">
                  ✦
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                    Nettmark
                  </span>
                  <span className="text-xs text-white/70">
                    Choose your portal
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/60">
                Secure access
              </span>
            </div>

            <h1 className="text-2xl font-semibold text-white mb-1">
              Login
            </h1>
            <p className="text-xs text-white/65 mb-6">
              Select whether you&apos;re logging in as a business or affiliate partner.
            </p>

            <div className="flex flex-col space-y-3 w-full">
              <Link
                href="/login/affiliate"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white flex items-center justify-between hover:border-[#00C2CB80] hover:bg-[#02090a] transition"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB]/10 text-[#7ff5fb]">
                    <User size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Affiliate portal</span>
                    <span className="text-[11px] text-white/50">Run campaigns, track clicks & payouts.</span>
                  </div>
                </div>
                <span className="text-[11px] text-[#7ff5fb]">Login →</span>
              </Link>

              <Link
                href="/login/business"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white flex items-center justify-between hover:border-[#00C2CB80] hover:bg-[#02090a] transition"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB]/10 text-[#7ff5fb]">
                    <Briefcase size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Business portal</span>
                    <span className="text-[11px] text-white/50">Manage offers, tracking & affiliate payouts.</span>
                  </div>
                </div>
                <span className="text-[11px] text-[#7ff5fb]">Login →</span>
              </Link>
            </div>

            <div className="pt-4 text-[11px] text-white/50 text-center">
              Don&apos;t have an account?{' '}
              <Link href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] hover:underline">
                View pricing to get started
              </Link>
            </div>

            <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/50">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[9px]">
                🔒
              </span>
              Your login is secured with Nettmark authentication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}