'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

type CheckResp = {
  error?: string;
  hasAccount: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
  accountId?: string;
};

export default function AffiliateSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<CheckResp | null>(null);

  async function refreshStatus() {
    try {
      setChecking(true);
      const res = await fetch('/api/stripe/affiliates/check-account', { cache: 'no-store' });
      const json: CheckResp = await res.json();
      if (json.error) throw new Error(json.error);
      setStatus(json);
    } catch (err: any) {
      toast.error(err.message || 'Failed to check status');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function startOnboarding() {
    try {
      setLoading(true);
      const res = await fetch('/api/stripe/affiliates/create-account', { method: 'POST' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      window.location.href = json.url; // Stripe Onboarding
    } catch (err: any) {
      toast.error(err.message || 'Failed to start onboarding');
    } finally {
      setLoading(false);
    }
  }

  async function resumeOnboarding() {
    // Re-use create-account; Stripe returns a fresh account_link if acct exists
    return startOnboarding();
  }

  const Badge = ({ children, tone = 'default' }:{children: React.ReactNode; tone?: 'ok'|'warn'|'bad'|'default'}) => {
    const map:any = {
      ok: 'text-[#7ff5fb] border-[#00C2CB40] bg-white/5 shadow-[0_0_20px_#00C2CB40]',
      warn: 'text-amber-300 border-amber-500/30 bg-white/5',
      bad: 'text-rose-300 border-rose-500/30 bg-white/5',
      default: 'text-white/70 border-white/10 bg-white/[0.04]',
    };
    return (
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${map[tone]}`}>
        {children}
      </span>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#121212]">
      <div className="relative max-w-4xl mx-auto px-6 py-10 space-y-10 text-white">
        {/* Teal glow accent */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 blur-3xl"
          style={{ background: 'radial-gradient(40% 60% at 50% 20%, rgba(0,194,203,0.22), rgba(0,0,0,0) 60%)' }}
        />
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#7ff5fb] to-[#00C2CB]">
          Affiliate settings
        </h1>
        <p className="text-sm text-white/70">
          Connect your bank to receive withdrawals. <span className="text-white/50">(Powered by Stripe)</span>
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.15)]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-white">Withdrawals <span className="text-white/70">(Stripe Connect)</span></h2>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshStatus}
              disabled={checking}
              className="rounded-full border border-[#00C2CB40] px-3 py-1 text-sm text-white/80 hover:bg-white/5 shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition"
            >
              {checking ? 'Checking…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {status ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={status.hasAccount ? 'ok' : 'default'}>
                  {status.hasAccount ? 'Account created' : 'No account yet'}
                </Badge>
                <Badge tone={status.onboardingComplete ? 'ok' : status.hasAccount ? 'warn' : 'default'}>
                  {status.onboardingComplete ? 'Onboarding complete' : status.hasAccount ? 'Action required' : 'Not started'}
                </Badge>
                <Badge tone={status.payoutsEnabled ? 'ok' : 'warn'}>
                  {status.payoutsEnabled ? 'Payouts enabled' : 'Payouts not enabled'}
                </Badge>
                {status.accountId && (
                  <Badge>acct: {status.accountId}</Badge>
                )}
              </div>

              {!status.hasAccount && (
                <div className="mt-4">
                  <button
                    onClick={startOnboarding}
                    disabled={loading}
                    className="rounded-full bg-[#00C2CB] px-5 py-2 text-black hover:bg-[#00b0b8] shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition"
                  >
                    {loading ? 'Opening Stripe…' : 'Enable withdrawals'}
                  </button>
                </div>
              )}

              {status.hasAccount && !status.onboardingComplete && (
                <div className="mt-4 space-y-2">
                  {!!status.requirementsDue?.length && (
                    <p className="text-sm text-amber-300">
                      Stripe needs: {status.requirementsDue.join(', ')}
                    </p>
                  )}
                  {status.disabledReason && (
                    <p className="text-sm text-rose-300">
                      Reason: {status.disabledReason}
                    </p>
                  )}
                  <button
                    onClick={resumeOnboarding}
                    disabled={loading}
                    className="rounded-full bg-[#00C2CB] px-5 py-2 text-black hover:bg-[#00b0b8] shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition"
                  >
                    {loading ? 'Opening Stripe…' : 'Resume onboarding'}
                  </button>
                </div>
              )}

              {status.onboardingComplete && (
                <div className="mt-4 text-sm text-white/70">
                  Your bank details are connected. You can withdraw from the <span className="text-[#7ff5fb] font-medium">Wallet</span> page.
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-white/70">Loading…</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_0_60px_0_rgba(0,194,203,0.15)]">
        <h3 className="text-base font-medium mb-2 text-white">Where to withdraw/top-up?</h3>
        <p className="text-sm text-white/70">
          • Top-ups and withdrawals live on the <span className="text-[#7ff5fb]">Wallet</span> page.<br />
          • This settings page is only for connecting or fixing your bank info.
        </p>
      </section>
      </div>
    </div>
  );
}