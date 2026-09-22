'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '@/../utils/supabase/pages-client';
import MarketingPageTracker from '@/components/marketing/MarketingPageTracker';
import { trackMetaStandardEvent } from '@/../utils/marketing/metaPixel';
import { trackRedditConversion } from '@/../utils/marketing/redditConversions';

function CreateAccountInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const roleParam = (sp.get('role') || '').toLowerCase();
  const normalizedRole =
    roleParam === 'affiliate'
      ? 'affiliate'
      : roleParam === 'business'
      ? 'business'
      : roleParam === 'partner'
      ? 'affiliate'
      : null;

  const role: 'business' | 'affiliate' = normalizedRole ?? 'business';
  const isBusiness = role === 'business';

  const onboardingPath =
    role === 'affiliate' ? '/onboarding/for-partners' : '/onboarding/for-business';

  useEffect(() => {
    try {
      localStorage.setItem('intent.role', role);
    } catch {}
  }, [role]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectQuery = `post=${encodeURIComponent(onboardingPath)}&role=${role}`;
  const authRedirect = `${origin}/auth-redirect?${redirectQuery}`;

  const baseUrl =
    (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim()) ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  async function postJson(path: string, payload: any) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          data: { role, username: trimmedUsername },
        },
      });

      if (error) throw error;

      console.log('[SIGNUP] signUp success', {
        hasUser: !!data?.user,
        userId: data?.user?.id || null,
      });

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

      if (role === 'business') {
        try {
          await postJson('/api/creator-referrals/attribute', {
            businessEmail: trimmedEmail,
          });
        } catch (creatorReferralErr) {
          console.warn('[SIGNUP] creator referral attribution deferred/failed:', creatorReferralErr);
        }
      }

      trackMetaStandardEvent('CompleteRegistration', {
        role,
        signup_method: 'email',
      });

      if (role === 'business') {
        const signupConversionId = `signup_${
          data?.user?.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`
        }`;

        trackRedditConversion({
          eventName: 'SignUp',
          conversionId: signupConversionId,
          email: trimmedEmail,
        });
      }

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

  const businessPoints = [
    'Create your offer in minutes',
    'Choose who can promote your business',
    'Review campaigns before they go live',
    'Track sales and commissions in one place',
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090a0a] text-white selection:bg-[#00C2CB]/30">
      <MarketingPageTracker
        eventType="create_account_start"
        pagePath="/create-account"
        audience={role}
        meta={{ role }}
      />

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-250px] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-[#00C2CB]/[0.08] blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>

      <main className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:py-14">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/50 backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00C2CB] opacity-35" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00C2CB]" />
              </span>
              {isBusiness ? 'Business account setup' : 'Affiliate account setup'}
            </div>

            <h1 className="mt-7 text-[64px] font-medium leading-[0.98] tracking-[-0.055em] text-white">
              {isBusiness ? (
                <>
                  Turn your offer into a <span className="text-[#00C2CB]">distribution opportunity.</span>
                </>
              ) : (
                <>
                  Find offers worth <span className="text-[#00C2CB]">promoting.</span>
                </>
              )}
            </h1>

            <p className="mt-6 max-w-lg text-[17px] leading-8 text-white/50">
              {isBusiness
                ? 'Create the account first. Then set your offer, commission and approval rules before anyone promotes your business.'
                : 'Create your account, browse available offers and start building campaigns around the products you want to promote.'}
            </p>

            <div className="mt-10 border-y border-white/[0.07]">
              {(isBusiness
                ? businessPoints
                : [
                    'Browse marketplace offers',
                    'Request access to brands you want to promote',
                    'Fund campaigns from your wallet',
                    'Track commissions and payouts',
                  ]
              ).map((item, index) => (
                <div key={item} className="flex items-center gap-4 border-b border-white/[0.06] py-4 last:border-b-0">
                  <span className="font-mono text-[10px] text-[#00C2CB]/55">0{index + 1}</span>
                  <span className="text-sm text-white/62">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center gap-3 text-xs text-white/34">
              <ShieldCheck className="h-4 w-4 text-[#00C2CB]/65" strokeWidth={1.6} />
              No card required to create an account.
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[560px] lg:mx-0 lg:ml-auto">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/48">
              <Sparkles className="h-3 w-3 text-[#00C2CB]" />
              {isBusiness ? 'Business account' : 'Affiliate account'}
            </div>
            <button
              type="button"
              onClick={goHome}
              className="text-xs text-white/38 transition hover:text-white/70"
            >
              Exit
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-[linear-gradient(155deg,rgba(255,255,255,.07),rgba(255,255,255,.025)_45%,rgba(0,194,203,.025))] p-1 shadow-[0_40px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl">
            <div className="rounded-[26px] border border-white/[0.045] bg-[#101212]/92 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#00C2CB]/70">
                    Step 1 of 2
                  </p>
                  <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] sm:text-[38px]">
                    Create your {isBusiness ? 'business' : 'affiliate'} account
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/45">
                    {isBusiness
                      ? 'Start with the basics. Your offer and promotion settings come next.'
                      : 'Start with the basics. You can browse and request offers immediately after onboarding.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goHome}
                  className="hidden shrink-0 text-xs text-white/32 transition hover:text-white/65 lg:block"
                  aria-label="Go home"
                >
                  Exit
                </button>
              </div>

              <div className="mt-7 h-px w-full bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />

              <form onSubmit={handleEmailSignup} className="mt-7 space-y-5">
                <Field label={isBusiness ? 'Business name' : 'Username'} hint={isBusiness ? 'Shown on your Nettmark profile and offers' : 'Your public Nettmark handle'}>
                  <input
                    type="text"
                    required
                    placeholder={isBusiness ? 'Your business name' : 'Your public handle'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white outline-none placeholder:text-white/22"
                  />
                </Field>

                <Field label="Email" hint={isBusiness ? 'Use the email you manage the business with' : 'Used for your account and payout notifications'}>
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white outline-none placeholder:text-white/22"
                  />
                </Field>

                <Field label="Password" hint="Use a password you don't reuse elsewhere">
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent px-4 py-3.5 pr-12 text-[15px] text-white outline-none placeholder:text-white/22"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute inset-y-0 right-3 my-auto grid h-8 w-8 place-items-center rounded-full text-white/35 transition hover:bg-white/[0.05] hover:text-white/70"
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                {err && (
                  <p className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3 text-sm leading-5 text-red-200/85">
                    {err}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-6 text-sm font-semibold text-[#051012] shadow-[0_14px_44px_rgba(0,194,203,.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#19d5dc] hover:shadow-[0_18px_55px_rgba(0,194,203,.22)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {submitting ? 'Creating account…' : 'Continue'}
                  {!submitting && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />}
                </button>
              </form>

              <div className="mt-7 flex items-start gap-3 border-t border-white/[0.06] pt-5 text-xs leading-5 text-white/32">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00C2CB]/70" />
                <p>
                  No card required to join. By continuing, you agree to our Terms and Privacy Policy. Fee-based charges only apply later when money moves through wallets or payouts.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <span className="text-xs font-medium text-white/68">{label}</span>
        <span className="hidden text-[10px] text-white/24 sm:block">{hint}</span>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-black/20 transition duration-200 focus-within:border-[#00C2CB]/45 focus-within:bg-black/30 focus-within:shadow-[0_0_0_3px_rgba(0,194,203,.06)]">
        {children}
      </div>
    </label>
  );
}

export default function CreateAccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090a0a]" />}>
      <CreateAccountInner />
    </Suspense>
  );
}
