import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nettmark Analytics Access",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MarketingLoginGatewayPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,194,203,0.15),transparent_35%),linear-gradient(180deg,#091114_0%,#06090d_55%,#030405_100%)] px-5 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7ff5fb]/80">Internal only</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Nettmark analytics access</h1>
        <p className="mt-4 text-sm leading-6 text-white/70 sm:text-base">
          This is the clean entry link for your internal marketing dashboard.
        </p>

        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">
          <p>1) Sign in to your Nettmark account.</p>
          <p>2) Open the dashboard link.</p>
          <p className="text-xs text-white/50">Only whitelisted emails can view the analytics page.</p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#00b0b8]"
          >
            Log in
          </Link>
          <Link
            href="/internal/marketing"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
          >
            Open analytics dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
