'use client';

import { PASSWORD_ERROR, USERNAME_HINT, validPassword, validUsername } from '../../utils/auth/credentials';
import PasswordRules from '../../components/PasswordRules';
import { resolveBusinessPlanChoice } from '../../utils/businessPlanChoice';
import React from "react";

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '@/../utils/supabase/pages-client';
import MarketingPageTracker from '@/components/marketing/MarketingPageTracker';
import { trackMetaStandardEvent } from '@/../utils/marketing/metaPixel';
import { trackRedditConversion } from '@/../utils/marketing/redditConversions';
import { logProductEvent } from "@/../utils/productEvents";
import { affiliateOnboardingPath } from '@/../utils/affiliate/onboarding';
import { extractAttributionFromSearchParams, buildHrefWithAttribution, persistAttribution } from '@/../utils/marketing/attribution';

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

  const businessAttribution = extractAttributionFromSearchParams(new URLSearchParams(sp.toString()));
  const onboardingPath = role === 'affiliate'
    ? affiliateOnboardingPath(sp.get('offerId'), sp.get('mode'))
    : buildHrefWithAttribution(`/business/choose-plan?plan=${resolveBusinessPlanChoice(sp.get('plan'))}`, businessAttribution);

  useEffect(() => {
    try {
      localStorage.setItem('intent.role', role);
      if (isBusiness) persistAttribution(businessAttribution);
    } catch {}
  }, [role, isBusiness, sp]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const signupInFlight = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectQuery = `returnTo=${encodeURIComponent(onboardingPath)}&role=${role}`;
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
    if (signupInFlight.current) return;
    signupInFlight.current = true;
    setErr(null);
    setSubmitting(true);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    try {
      if (!validPassword(password)) throw new Error(PASSWORD_ERROR);
      if (!trimmedUsername) {
        throw new Error(isBusiness ? 'Please enter your business name.' : 'Please choose a username.');
      }
      if (!isBusiness && !validUsername(trimmedUsername)) {
        throw new Error('Username must be 3–24 characters using letters, numbers, dots, underscores or hyphens.');
      }
      if (!trimmedEmail) throw new Error('Please enter an email.');

      console.log('[SIGNUP] starting', { role, email: trimmedEmail, username: trimmedUsername });

      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: authRedirect,
            data: { role, username: trimmedUsername, ...(isBusiness ? { business_plan_first_v2: true } : {}) },
          },
        }),
      });
      const { data, error } = await signupResponse.json();
      if (!signupResponse.ok || error) throw new Error(error || 'Sign up failed');
      if (data?.session) {
        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) throw sessionError;
      }

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

        void Promise.allSettled(tasks);
      } catch (emailErr) {
        console.error('[SIGNUP] email dispatch failed:', emailErr);
      }

      // Both business and affiliate accounts may require email confirmation.
      // Auth-trigger provisioning already happened even without a session.
      if (!data?.session) {
        setConfirmationSent(true);
        trackMetaStandardEvent('CompleteRegistration', { role, signup_method: 'email' });
        return;
      }

      // Auth signup now provisions a profile atomically via the database
      // trigger. The browser must NEVER upsert profiles (requires forbidden
      // UPDATE of role/email and could rewrite an established identity).
      if (data?.user?.id) {
        const { data: persistedProfile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profileError || persistedProfile?.role !== role) {
          console.error('[SIGNUP] profile provision verification failed', {
            error: profileError?.code || 'profile_missing_or_wrong_role',
          });
          throw new Error('Your account was created, but setup could not be verified. Please sign in again or contact support.');
        }
        if (role === 'business') {
          void logProductEvent({
            eventType: 'business_signup_completed',
            actorRole: 'business',
            meta: { source: 'email_signup', ...businessAttribution },
          });
        }
        // Pre-signup revenue is safely merged by trg_merge_pre_signup_revenue
        // AFTER INSERT ON profiles. Do not duplicate the financial merge
        // or attempt to read the restricted pre_signup_revenue table here.
      }

      if (role === 'business') {
        void postJson('/api/creator-referrals/attribute', {
          businessEmail: trimmedEmail,
        }).catch(() => console.warn("[SIGNUP] creator referral attribution deferred"));
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
      signupInFlight.current = false;
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
                ? 'Create your account, start The 14-Day Affiliate-Funded Launch with a card, then publish your offer. Growth is A$49/month afterward; cancel anytime.'
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
              {isBusiness ? '14 days free, then A$49/month. Card required for Growth. Cancel anytime.' : 'No card required to create an account.'}
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
              className="min-h-11 min-w-11 text-xs text-white/38 transition hover:text-white/70"
            >
              Exit
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-[linear-gradient(155deg,rgba(255,255,255,.07),rgba(255,255,255,.025)_45%,rgba(0,194,203,.025))] p-1 shadow-[0_40px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl">
            <div className="rounded-[26px] border border-white/[0.045] bg-[#101212]/92 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#00C2CB]/70">
                    Step 1 of {role === "business" ? 3 : 2}
                  </p>
                  <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] sm:text-[38px]">
                    Create your {isBusiness ? 'business' : 'affiliate'} account
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/45">
                    {isBusiness
                      ? 'Next: choose The 14-Day Affiliate-Funded Launch, then set up your first offer.'
                      : 'Choose a brand and prepare your first promotion. You can add your public name and payout details later.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goHome}
                  className="hidden min-h-11 min-w-11 shrink-0 text-xs text-white/32 transition hover:text-white/65 lg:block"
                  aria-label="Go home"
                >
                  Exit
                </button>
              </div>

              <div className="mt-7 h-px w-full bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />

              {confirmationSent ? (
                <div role="status" className="mt-7 space-y-4 rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/5 p-5">
                  <h3 className="text-lg font-semibold">Check your email</h3>
                  <p className="text-sm leading-6 text-white/65">Open the confirmation link sent to {email.trim()} to continue setting up your account.</p>
                  <a href={isBusiness ? "/login/business" : `/login/affiliate?next=${encodeURIComponent(onboardingPath)}`} className="inline-block text-sm text-[#00C2CB]">Already confirmed? Sign in</a>
                </div>
              ) : <form onSubmit={handleEmailSignup} className="mt-7 space-y-5">
                <Field
                  label={isBusiness ? "Business name" : "Username"}
                  hint={
                    isBusiness
                      ? "Shown on your Nettmark profile and offers"
                      : "Shown to businesses instead of your email address"
                  }
                >
                  <input
                    type="text"
                    required
                    placeholder={isBusiness ? "Your business name" : "e.g. sarahpromotes"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white outline-none placeholder:text-white/22"
                    autoComplete={isBusiness ? "organization" : "username"}
                  />
                </Field>

                {!isBusiness && <p className="text-xs text-white/55">{USERNAME_HINT}</p>}

                <Field label="Email" hint={isBusiness ? 'Use the email you manage the business with' : 'Used for your account and payout notifications'}>
                  <input
                    type="email"
                    required
                    placeholder="you@email.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white outline-none placeholder:text-white/22"
                  />
                </Field>

                <Field label="Password" hint="Use a password you don't reuse elsewhere">
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent px-4 py-3.5 pr-12 text-[15px] text-white outline-none placeholder:text-white/22"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute inset-y-0 right-1 my-auto grid min-h-11 min-w-11 place-items-center rounded-full text-white/35 transition hover:bg-white/[0.05] hover:text-white/70"
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                <PasswordRules password={password} />

                {err && (
                  <p role="alert" className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3 text-sm leading-5 text-red-200/85">
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
              </form>}

              <div className="mt-7 flex items-start gap-3 border-t border-white/[0.06] pt-5 text-xs leading-5 text-white/32">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00C2CB]/70" />
                <p>
                  {isBusiness
                    ? 'Next: start The 14-Day Affiliate-Funded Launch, then set up your offer. Growth requires a card and costs A$49/month after the trial unless you cancel. Free (Organic affiliates only, no paid ads) remains available at the next step. By continuing, you agree to our'
                    : 'No card required to join. By continuing, you agree to our'}
                  {' '}<a className="underline" href="/legal/privacy/terms-of-service">Terms</a> and <a className="underline" href="/legal/privacy">Privacy Policy</a>.
                  {!isBusiness && ' Fee-based charges only apply later when money moves through wallets or payouts.'}
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
