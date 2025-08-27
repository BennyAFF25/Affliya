'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const roleParam = (sp.get('role') || '').toLowerCase();
  // accept legacy "partner" but normalize to "affiliate"
  const role: 'business' | 'affiliate' =
    roleParam === 'affiliate' || roleParam === 'partner' ? 'affiliate' : 'business';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Google login
  const handleGoogleLogin = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      try { localStorage.setItem('intent.role', role); } catch {}
      const nextParam = sp.get('next');
      // Build /auth-redirect?role=${role}[&post=...]
      let authRedirect = `${origin}/auth-redirect?role=${role}`;
      if (nextParam) {
        authRedirect += `&post=${encodeURIComponent(nextParam)}`;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authRedirect,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message || 'Google login failed');
      setSubmitting(false);
    }
  };

  // Email login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const origin = window.location.origin;
      try { localStorage.setItem('intent.role', role); } catch {}
      const nextParam = sp.get('next');
      let authRedirect = `${origin}/auth-redirect?role=${role}`;
      if (nextParam) {
        authRedirect += `&post=${encodeURIComponent(nextParam)}`;
      }
      window.location.href = authRedirect;
    } catch (e: any) {
      setErr(e?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const goHome = () => router.replace('/');
  const goCreate = () => router.replace('/create-account');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(60%_80%_at_50%_0%,#0b2a2b_0%,#090909_40%,#000_100%)] text-white px-6">
      <div className="relative w-full max-w-md">
        {/* Outer glow */}
        <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-[#00C2CB]/40 to-transparent blur-xl opacity-60 pointer-events-none" />
        <div className="relative w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
          
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
              <p className="mt-1 text-sm text-white/60">Log in to your account</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={goHome}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-black/30 hover:bg-black/40"
              >
                Home
              </button>
              <button
                type="button"
                onClick={goCreate}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-black/30 hover:bg-black/40"
              >
                Create account
              </button>
            </div>
          </div>

          {/* Google login */}
          <button
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full mb-5 rounded-xl bg-[#00C2CB] text-black font-semibold py-3 hover:bg-[#00b0b8] transition disabled:opacity-60"
          >
            Sign in with Google
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/0 px-2 text-xs text-white/40">
                or with email
              </span>
            </div>
          </div>

          {/* Email login form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
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
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          {err && (
            <p className="mt-4 text-sm text-red-300 border border-red-300/20 rounded-lg px-3 py-2 bg-red-500/5">
              {err}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}