"use client";

import Link from "next/link";
import { User, Briefcase } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";

export default function LoginPage() {
  return (
    <div className="marketing-login-theme min-h-screen w-full flex flex-col bg-gradient-to-br from-[#00363a] via-black to-black">
      <MarketingHeader />
      <div className="flex-grow flex items-center justify-center px-4 pb-8">
        <div className="relative w-full max-w-md">
          {/* Soft glow behind card */}
          <div
            className="pointer-events-none absolute -inset-x-10 -top-16 h-56 blur-3xl opacity-60"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 10%, rgba(0,194,203,0.32), transparent 65%)",
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

            <h1 className="text-2xl font-semibold text-white mb-1">Login</h1>
            <p className="text-xs text-white/65 mb-6">
              Select whether you&apos;re logging in as a business or affiliate
              partner. No subscription setup needed.
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
                    <span className="text-sm font-medium">
                      Affiliate portal
                    </span>
                    <span className="text-[11px] text-white/50">
                      Run campaigns, track clicks & payouts.
                    </span>
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
                    <span className="text-[11px] text-white/50">
                      Manage offers, tracking & affiliate payouts.
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-[#7ff5fb]">Login →</span>
              </Link>
            </div>

            <div className="pt-4 space-y-3 text-center">
              <p className="text-[11px] text-white/50">
                Don&apos;t have an account yet?
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  href="/create-account?role=affiliate"
                  className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-white/80 hover:border-[#00C2CB80] hover:text-white transition"
                >
                  Create affiliate account
                </Link>
                <Link
                  href="/create-account?role=business"
                  className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-white/80 hover:border-[#00C2CB80] hover:text-white transition"
                >
                  Create business account
                </Link>
              </div>
              <Link
                href="/pricing"
                className="inline-block text-[11px] text-[#00C2CB] hover:text-[#7ff5fb] hover:underline"
              >
                See fee-based pricing
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
