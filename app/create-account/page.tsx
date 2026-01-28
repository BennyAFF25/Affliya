'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

function CreateAccountInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const roleParam = (sp.get('role') || '').toLowerCase();
  // accept legacy "partner" but normalize to "affiliate"
  const normalizedRole =
    roleParam === 'affiliate'
      ? 'affiliate'
      : roleParam === 'business'
      ? 'business'
      : roleParam === 'partner'
      ? 'affiliate'
      : null;

  const role: 'business' | 'affiliate' = normalizedRole ?? 'business';

  const onboardingPath =
    role === 'affiliate' ? '/onboarding/for-partners' : '/onboarding/for-business';

  useEffect(() => {
    try {
      localStorage.setItem('intent.role', role);
    } catch {}
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

  // Absolute base URL for API calls (works in prod + local)
  const baseUrl =
    (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim()) ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  async function postJson(path: string, payload: any) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // keepalive helps avoid fetch being dropped on navigation in some browsers
        // (payload is small, so it’s safe)
        keepalive: true as any,
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => '');
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      console.log(`[EMAIL POST] ${path} -> ${res.status}`, json);
      return { ok: res.ok, status: res.status, json };
    } catch (e: any) {
      console.error(`[EMAIL POST ERROR] ${path}`, e?.message || e);
      return { ok: false, status: 0, json: { error: e?.message || String(e) } };
    }
  }

  // ─────────────────────────────────
  // SIGNUP
  // ─────────────────────────────────
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    try {
      if (!trimmedUsername) throw new Error('Please choose a username.');
      if (!trimmedEmail) throw new Error('Please enter an email.');

      console.log('[SIGNUP] starting', { role, email: trimmedEmail, username: trimmedUsername });

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: authRedirect,
          data: { role, username: trimmedUsername }, // stored in user_metadata
        },
      });

      if (error) throw error;

      console.log('[SIGNUP] signUp success', {
        hasUser: !!data?.user,
        userId: data?.user?.id || null,
      });

      // ✅ SEND EMAILS IMMEDIATELY AFTER SIGNUP SUCCESS (DO NOT DEPEND ON data.user)
      // This fixes the exact “founder email sends but user welcome doesn’t” scenario.
      try {
        const tasks: Promise<any>[] = [];

        if (role === 'affiliate') {
          tasks.push(
            postJson('/api/emails/affiliate-signup', {
              to: trimmedEmail,
              affiliateEmail: trimmedEmail,
              username: trimmedUsername,
            })
          );
        }

        if (role === 'business') {
          tasks.push(
            postJson('/api/emails/business-signup', {
              to: trimmedEmail,
              businessEmail: trimmedEmail,
              businessName: trimmedUsername,
            })
          );
        }

        // Founder notify (always)
        tasks.push(
          postJson('/api/emails/founder-notify', {
            type: 'signup',
            role,
            email: trimmedEmail,
          })
        );

        await Promise.allSettled(tasks);
        console.log('[SIGNUP] email dispatch finished');
      } catch (emailErr) {
        console.error('[SIGNUP] email dispatch failed:', emailErr);
      }

      // Insert into profiles after signup (if we have a user id)
      if (data?.user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              email: trimmedEmail,
              role,
            },
            { onConflict: 'id' }
          );

        if (profileError) {
          console.error('[PROFILE INSERT ERROR]', profileError);
          throw profileError;
        }

        // ─────────────────────────────────
        // Merge pre-signup Stripe revenue (if exists)
        // ─────────────────────────────────
        const { data: preRevenueRow, error: preErr } = await supabase
          .from('pre_signup_revenue')
          .select('*')
          .eq('email', trimmedEmail)
          .maybeSingle();

        if (preErr && (preErr as any).code !== 'PGRST116') {
          console.error('[PRE-SIGNUP REVENUE FETCH ERROR]', preErr);
        }

        if (preRevenueRow) {
          const { error: mergeErr } = await supabase
            .from('profiles')
            .update({
              revenue_stripe_customer_id: preRevenueRow.revenue_stripe_customer_id,
              revenue_stripe_subscription_id: preRevenueRow.revenue_stripe_subscription_id,
              revenue_subscription_status: preRevenueRow.revenue_subscription_status,
              revenue_current_period_end: preRevenueRow.revenue_current_period_end
                ? new Date(preRevenueRow.revenue_current_period_end).toISOString()
                : null,
            })
            .eq('id', data.user.id);

          if (mergeErr) {
            console.error('[PRE-SIGNUP REVENUE MERGE ERROR]', mergeErr);
            throw mergeErr;
          }

          await supabase.from('pre_signup_revenue').delete().eq('email', trimmedEmail);
        }
      } else {
        console.warn(
          '[SIGNUP] No user id returned from signUp (email-confirm flow likely). Skipping profile upsert for now.'
        );
      }

      // ✅ Redirect only AFTER emails were attempted
      router.replace(onboardingPath);
    } catch (e: any) {
      console.error('[SIGNUP] failed:', e);
      setErr(e?.message || 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  };

  const goHome = () => {
    try {
      localStorage.removeItem('intent.role');
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      router.replace('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(60%_80%_at_50%_0%,#0b2a2b_0%,#090909_40%,#000_100%)] text-white px-6">
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-[#00C2CB]/40 to-transparent blur-xl opacity-60 pointer-events-none" />
        <div className="relative w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 text-[#7ff5fb] text-xs font-semibold">
                Setting up a{' '}
                <span className="text-white/90">
                  {role === 'affiliate' ? 'affiliate' : 'business'}
                </span>{' '}
                account
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-1 text-sm text-white/60">
                Get instant access after a quick signup. You can switch roles later in settings.
              </p>
            </div>

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