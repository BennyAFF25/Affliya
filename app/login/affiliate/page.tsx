'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

export default function AffiliateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/auth-redirect');
  };

  return (
    <>
      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:hover,
        textarea:-webkit-autofill,
        textarea:-webkit-autofill:focus,
        select:-webkit-autofill {
          -webkit-box-shadow: 0 0 0px 1000px #0b0b0b inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      <header className="fixed top-0 left-0 w-full h-16 z-30 bg-black bg-opacity-70 backdrop-blur-md border-b border-white/10 flex items-center px-8">
        {/* Logo */}
        <div className="flex items-center h-full">
          <img
            src="/nettmark-logo.png"
            alt="Nettmark"
            width={140}
            height={40}
            className="object-contain"
          />
        </div>
        {/* Centered nav */}
        <nav className="absolute left-1/2 top-0 -translate-x-1/2 h-full flex items-center space-x-10">
          <a
            href="/business"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold text-base transition-colors"
          >
            For Businesses
          </a>
          <a
            href="/partners"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold text-base transition-colors"
          >
            For Partners
          </a>
          <a
            href="/pricing"
            className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold text-base transition-colors"
          >
            Pricing
          </a>
        </nav>
        {/* Right side Home button */}
        <div className="ml-auto flex items-center h-full">
          <a
            href="/"
            className="px-5 py-2 rounded-lg bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_30px_#00C2CB80] transition-all text-base"
          >
            Home
          </a>
        </div>
      </header>
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0b1a1b] via-[#0b0b0b] to-black px-4 pt-20">
        <div className="relative w-full max-w-md">
          {/* Soft glow behind card */}
          <div
            className="pointer-events-none absolute -inset-x-10 -top-16 h-56 blur-3xl opacity-60"
            style={{
              background:
                'radial-gradient(60% 80% at 50% 10%, rgba(0,194,203,0.32), transparent 65%)',
            }}
          />

          <div className="relative rounded-2xl border border-white/10 bg-[#05070a] px-8 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.7)]">
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
                    Affiliate portal
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/60">
                For partners only
              </span>
            </div>

            <h1 className="text-2xl font-semibold text-white mb-1">
              Affiliate Login
            </h1>
            <p className="text-xs text-white/65 mb-6">
              Access your campaigns, payouts and tracking in one place.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 pr-16 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-[#00C2CB]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-[11px] text-white/50 hover:text-[#00C2CB]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <p className="text-right text-[11px] text-white/60">
                <a
                  href="/auth/reset-password"
                  className="text-[#00C2CB] hover:text-[#7ff5fb] hover:underline"
                >
                  Forgot your password?
                </a>
              </p>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-full bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#00b0b8] shadow-[0_0_20px_#00C2CB40] hover:shadow-[0_0_28px_#00C2CB80] transition disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Login'}
              </button>

              {/* Trust line */}
              <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/50">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[9px]">
                  🔒
                </span>
                Your login is secured with Nettmark authentication.
              </p>

              {error && (
                <p className="text-[11px] text-rose-400 mt-2">
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      </main>
    </>
  );
}