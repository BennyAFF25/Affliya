'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

export default function BusinessLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Enter your email and password.');
      setLoading(false);
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch (signOutErr) {
      console.warn('[Business login] signOut before login failed (safe to ignore)', signOutErr);
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError) {
        console.error('[Business login] signIn error', signInError);
        setError(signInError.message || 'Login failed. Check your credentials.');
        return;
      }

      if (data?.user) {
        const profileData = { id: data.user.id, email: trimmedEmail, role: 'business' };
        await supabase.from('profiles').upsert([profileData] as any);
        router.push('/auth-redirect');
      }
    } catch (err: any) {
      console.error('[Business login] unexpected error', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px black inset !important;
          -webkit-text-fill-color: white !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      <header className="flex items-center justify-between h-16 px-4 sm:px-6 bg-black text-white border-b border-gray-700">
        <img src="/nettmark-logo.png" alt="Logo" width={140} height={40} className="mr-4" />

        {/* Desktop nav */}
        <nav className="hidden md:flex space-x-8 flex-1 justify-center">
          <a href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold whitespace-nowrap">
            For Businesses
          </a>
          <a href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold whitespace-nowrap">
            For Partners
          </a>
          <a href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold whitespace-nowrap">
            Pricing
          </a>
        </nav>

        <button
          onClick={() => router.push('/')}
          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold py-2 px-4 rounded whitespace-nowrap"
        >
          Home
        </button>
      </header>
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#0b1a1b] via-[#0b0b0b] to-black px-4 pt-6">
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
                    Business portal
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/60">
                For brands only
              </span>
            </div>

            <h1 className="text-2xl font-semibold text-white mb-1">
              Business Login
            </h1>
            <p className="text-xs text-white/65 mb-6">
              Sign in to manage offers, campaigns, and payouts for your brand.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoComplete="email"
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
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-[11px] text-white/50 hover:text-[#00C2CB]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                {loading ? 'Loading...' : 'Login'}
              </button>

              {/* Trust line */}
              <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/50">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[9px]">
                  🔒
                </span>
                Your login is secured with Nettmark authentication.
              </p>

              {error && (
                <p className="text-[11px] text-rose-400 mt-2 text-center">
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