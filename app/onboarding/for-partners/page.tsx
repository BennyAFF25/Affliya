'use client';
import Link from 'next/link';
import { ShieldCheck, Wallet, UserCog, Link2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';


export default function PartnerOnboardingPage() {
  const router = useRouter();
  async function finish() {
    try { await fetch('/api/profile/onboarding-complete', { method: 'POST' }); } catch {}
    router.replace('/affiliate/dashboard');
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white">
      {/* Top spacer to account for fixed site header if present */}
      <div aria-hidden className="h-16" />

      <section className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#7ff5fb]">
            <ShieldCheck size={14} /> Onboarding
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold">
            Welcome — let’s set up your <span className="text-[#00C2CB]">affiliate account</span>
          </h1>
          <p className="mt-3 text-white/70 max-w-2xl">
            Create your profile, connect payouts, and grab your tools. You’ll fund ad spend via a pre‑funded wallet, submit ad ideas for approval, and get paid commission on confirmed sales.
          </p>
          <div className="mt-4 flex gap-3 text-sm">
            <Link href="/" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">
              ← Back to Home
            </Link>
            <Link
              href="/affiliate/dashboard"
              className="px-3 py-1.5 rounded-md bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8] inline-flex items-center gap-1"
            >
              Skip for now <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Step 1: Payouts */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-[#00C2CB]/30 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-[#043a3d] text-[#7ff5fb] grid place-items-center border border-[#00C2CB]/40">
                <Wallet size={18} />
              </div>
              <div className="text-sm uppercase tracking-wider text-white/60">Step 1</div>
            </div>
            <h3 className="text-lg font-semibold">Connect payouts (Stripe)</h3>
            <p className="mt-2 text-sm text-white/70">
              Commissions are paid out to your bank automatically once a business confirms the sale. Connect your Stripe Express account to receive funds.
            </p>
            <div className="mt-4">
              <Link
                href="/onboarding/stripe"
                className="text-[#00C2CB] hover:text-[#7ff5fb] inline-flex items-center gap-1 text-sm"
              >
                Continue <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Step 2: Profile */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-[#00C2CB]/30 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-[#043a3d] text-[#7ff5fb] grid place-items-center border border-[#00C2CB]/40">
                <UserCog size={18} />
              </div>
              <div className="text-sm uppercase tracking-wider text-white/60">Step 2</div>
            </div>
            <h3 className="text-lg font-semibold">Complete your affiliate profile</h3>
            <p className="mt-2 text-sm text-white/70">
              Tell businesses what you specialise in (verticals, platforms, ad types). This helps you get approved faster and matched to the right offers.
            </p>
            <div className="mt-4">
              <Link
                href="/onboarding/profile"
                className="text-[#00C2CB] hover:text-[#7ff5fb] inline-flex items-center gap-1 text-sm"
              >
                Continue <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Step 3: Tools */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-[#00C2CB]/30 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-[#043a3d] text-[#7ff5fb] grid place-items-center border border-[#00C2CB]/40">
                <Link2 size={18} />
              </div>
              <div className="text-sm uppercase tracking-wider text-white/60">Step 3</div>
            </div>
            <h3 className="text-lg font-semibold">Get your tools &amp; start</h3>
            <p className="mt-2 text-sm text-white/70">
              Browse offers, submit organic posts or ad ideas for approval, and use dynamic tracking links. Your pre‑funded wallet covers ad spend.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                href="/affiliate/marketplace"
                className="text-[#00C2CB] hover:text-[#7ff5fb] inline-flex items-center gap-1 text-sm"
              >
                Go to Marketplace <ArrowRight size={16} />
              </Link>
              <Link
                href="/affiliate/dashboard"
                className="text-[#00C2CB] hover:text-[#7ff5fb] inline-flex items-center gap-1 text-sm"
              >
                Open Dashboard <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* Helper box */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h4 className="text-sm font-semibold mb-2">How it works</h4>
          <ul className="list-disc pl-5 text-sm text-white/70 space-y-1">
            <li>Pick an offer and submit an ad idea or organic post for approval.</li>
            <li>Once approved, ads go live from the business account. You fund the spend.</li>
            <li>When a sale is confirmed, your commission is paid out via Stripe automatically.</li>
          </ul>
          <div className="mt-4 flex gap-3">
            <button
              onClick={finish}
              className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]"
            >
              Go to Affiliate Dashboard
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}