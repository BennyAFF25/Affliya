'use client';

// app/onboarding/for-business/page.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ShieldCheck, Briefcase, Link2, Cpu, ArrowRight } from 'lucide-react';


// Small helper loader
function DotLoader() {
  return (
    <div className="flex items-center gap-2 text-white/60 text-sm">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse" />
      Loading…
    </div>
  );
}

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gate: must be logged in and have/assume business role
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) {
          // Not signed in → go create a business account
          router.replace('/create-account?role=business');
          return;
        }

        // Try read profile to infer role (if present)
        const { data: profile } = await supabase
          .from('profiles')
          .select('roles, active_role')
          .eq('id', user.id)
          .maybeSingle();

        const activeRole = profile?.active_role || (profile?.roles?.includes('business') ? 'business' : null);

        // If they explicitly picked partner, shunt to partner onboarding
        if (activeRole && activeRole !== 'business') {
          router.replace('/onboarding/for-partners');
          return;
        }

        // If they already finished onboarding, you might direct to dashboard here.
        // For now we simply allow them to view the steps.
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Unable to check session');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  if (checking) {
    return (
      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white grid place-items-center">
        <DotLoader />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a1b] via-[#0b0b0b] to-black text-white grid place-items-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm">
          <p className="text-red-300 font-medium">{error}</p>
          <div className="mt-3 flex gap-3">
            <Link href="/" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">Back to Home</Link>
            <Link href="/create-account?role=business" className="px-3 py-1.5 rounded-md bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]">Create account</Link>
          </div>
        </div>
      </main>
    );
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
            Welcome — let’s set up your <span className="text-[#00C2CB]">business account</span>
          </h1>
          <p className="mt-3 text-white/70 max-w-2xl">
            You’ll keep full control of your Meta ad account, only pay commission on confirmed
            conversions, and let partners fund the ad spend via pre-funded wallets.
          </p>
          <div className="mt-4 flex gap-3 text-sm">
            <Link href="/" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">
              ← Back to Home
            </Link>
            <Link
              href="/business/dashboard"
              className="px-3 py-1.5 rounded-md bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8] inline-flex items-center gap-1"
            >
              Skip for now <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-[#00C2CB]/30 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-[#043a3d] text-[#7ff5fb] grid place-items-center border border-[#00C2CB]/40">
                <Briefcase size={18} />
              </div>
              <div className="text-sm uppercase tracking-wider text-white/60">Step 1</div>
            </div>
            <h3 className="text-lg font-semibold">Connect your Meta business assets</h3>
            <p className="mt-2 text-sm text-white/70">
              Link your Facebook Page and Ad Account so you can review &amp; approve partner-submitted ad ideas before anything goes live.
            </p>
            <div className="mt-4">
              <Link
                href="/onboarding/connect-meta"
                className="text-[#00C2CB] hover:text-[#7ff5fb] inline-flex items-center gap-1 text-sm"
              >
                Continue <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-[#00C2CB]/30 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-[#043a3d] text-[#7ff5fb] grid place-items-center border border-[#00C2CB]/40">
                <Link2 size={18} />
              </div>
              <div className="text-sm uppercase tracking-wider text-white/60">Step 2</div>
            </div>
            <h3 className="text-lg font-semibold">Create or connect your Stripe account</h3>
            <p className="mt-2 text-sm text-white/70">
              Payouts &amp; commissions are automated and compliant. You’ll only be charged after a partner-driven sale is confirmed.
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

          {/* Step 3 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-[#00C2CB]/30 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-[#043a3d] text-[#7ff5fb] grid place-items-center border border-[#00C2CB]/40">
                <Cpu size={18} />
              </div>
              <div className="text-sm uppercase tracking-wider text-white/60">Step 3</div>
            </div>
            <h3 className="text-lg font-semibold">Add lightweight tracking to your site</h3>
            <p className="mt-2 text-sm text-white/70">
              Drop in a simple snippet so clicks, add‑to‑carts, and conversions are tracked. Partners get dynamic links; you get clear attribution.
            </p>
            <div className="mt-4">
              <Link
                href="/onboarding/tracking"
                className="text-[#00C2CB] hover:text-[#7ff5fb] inline-flex items-center gap-1 text-sm"
              >
                Continue <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* Helper box */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h4 className="text-sm font-semibold mb-2">What happens next?</h4>
          <ul className="list-disc pl-5 text-sm text-white/70 space-y-1">
            <li>Partners submit ad ideas. You approve or reject with one click.</li>
            <li>Approved ads run from your Meta account. Partners fund the ad spend.</li>
            <li>You pay commission only on confirmed conversions via Stripe.</li>
          </ul>
          <div className="mt-4 flex gap-3">
            <Link
              href="/business/dashboard"
              className="px-4 py-2 rounded-md bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]"
            >
              Go to Dashboard
            </Link>
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