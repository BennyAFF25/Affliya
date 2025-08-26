'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

function CreateAccountInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const roleParam = (sp.get('role') || '').toLowerCase();
  // accept legacy "partner" but normalize to "affiliate"
  const normalizedRole = roleParam === 'affiliate' ? 'affiliate' : roleParam === 'business' ? 'business' : roleParam === 'partner' ? 'affiliate' : null;
  const role: 'business' | 'affiliate' = (normalizedRole ?? 'business');

  const onboardingPath = role === 'affiliate' ? '/onboarding/for-partners' : '/onboarding/for-business';

  useEffect(() => {
    try { localStorage.setItem('intent.role', role); } catch {}
  }, [role]);

  const [username, setUsername] = useState(''); // used on signup only
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ─────────────────────────────────
  // Shared helpers
  // ─────────────────────────────────
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectQuery = `post=${encodeURIComponent(onboardingPath)}&role=${role}`;
  const authRedirect = `${origin}/auth-redirect?${redirectQuery}`;

  // ─────────────────────────────────
  // SIGNUP (existing)
  // ─────────────────────────────────
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      if (!username.trim()) throw new Error('Please choose a username.');
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: authRedirect,
          data: { role, username: username.trim() }, // stored in user_metadata
        },
      });
      if (error) throw error;

      // If confirm emails are OFF, this will complete right away
      router.replace(`/auth-redirect?${redirectQuery}`);
    } catch (e: any) {
      setErr(e?.message || 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authRedirect,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      // Redirect handled by Supabase → auth-redirect
    } catch (e: any) {
      setErr(e?.message || 'Google sign-up failed');
      setSubmitting(false);
    }
  };

  const goHome = () => {
    try { localStorage.removeItem('intent.role'); } catch {}
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      router.replace('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(60%_80%_at_50%_0%,#0b2a2b_0%,#090909_40%,#000_100%)] text-white px-6">
      {/* Outer glow card */}
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-[#00C2CB]/40 to-transparent blur-xl opacity-60 pointer-events-none" />
        <div className="relative w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 text-[#7ff5fb] text-xs font-semibold">
                Setting up a <span className="text-white/90">{role === 'affiliate' ? 'affiliate' : 'business'}</span> account
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                Create your account
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Get instant access after a quick signup. You can switch roles later in settings.
              </p>
            </div>

            {/* Home Button Only */}
            <div className="shrink-0 flex items-center">
              <button
                type="button"
                onClick={goHome}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-black/30 hover:bg-black/40"
                aria-label="Go home"
              >
                Home
              </button>
            </div>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogleSignup}
            disabled={submitting}
            className="w-full mb-5 rounded-xl bg-[#00C2CB] text-black font-semibold py-3 hover:bg-[#00b0b8] transition disabled:opacity-60"
          >
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/0 px-2 text-xs text-white/40">
                or with email
              </span>
            </div>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-white/60">Username</label>
              <input
                type="text"
                required
                placeholder="Your public handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-[#00C2CB]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-white/60">Email</label>
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-[#00C2CB]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-white/60">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 pr-12 outline-none focus:border-[#00C2CB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute inset-y-0 right-2 my-1 px-2 rounded-lg text-xs text-white/70 hover:text-white/90 hover:bg-white/10"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-white/10 hover:bg-white/15 transition py-3 font-medium disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create account'}
            </button>
          </form>

          {err && (
            <p className="mt-4 text-sm text-red-300 border border-red-300/20 rounded-lg px-3 py-2 bg-red-500/5">
              {err}
            </p>
          )}

          <p className="mt-6 text-xs text-white/50">
            By continuing, you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CreateAccountPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <CreateAccountInner />
    </Suspense>
  );
}