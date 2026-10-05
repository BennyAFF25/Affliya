"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { Check, CreditCard, Megaphone, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { supabase } from "utils/supabase/pages-client";
import { logProductEvent } from "../../../utils/productEvents";
import BusinessTrialFirstContinuation, { growthPricePeriod, type BusinessContinuationContext } from "../../../components/business/BusinessTrialFirstContinuation";

export default function ChooseBusinessPlanPage() {
  const router = useRouter();
  const { session, isLoading } = useSessionContext();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [context, setContext] = useState<BusinessContinuationContext | null>(null);
  const [busy, setBusy] = useState<"free" | "growth" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [returnPending, setReturnPending] = useState(false);
  const viewed = useRef<string | null>(null);
  const resumeSubscription = context?.trialEligible === false;

  useEffect(() => {
    if (isLoading) return;
    if (!session?.user?.email) { router.replace("/login?role=business&next=/business/choose-plan"); return; }
    let cancelled = false;
    setContext(null);
    setError(null);
    void (async () => {
      try {
        const { data, error: profileError } = await supabase.from("business_profiles").select("id")
          .eq("business_email", session.user.email).limit(1).maybeSingle();
        if (profileError || !data?.id) throw new Error("We couldn't find your business profile. Please retry.");
        const response = await fetch(`/api/business-subscription/trial-eligibility?businessId=${encodeURIComponent(data.id)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load Growth details.");
        if (cancelled) return;
        setBusinessId(data.id);
        setContext(result);
        if (viewed.current !== data.id) {
          const logged = await logProductEvent({ eventType: "plan_choice_viewed", actorRole: "business", offerId: result.offerId,
            meta: { source: "business_onboarding", screen: result.treatment ? "trial_first" : "plan_choice", pathname: "/business/choose-plan" } });
          if (logged && !cancelled) viewed.current = data.id;
        }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your business."); }
    })();
    return () => { cancelled = true; };
  }, [isLoading, session?.user?.email, router, reload]);

  useEffect(() => {
    if (!businessId || !context) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("subscription") !== "checkout_returned") return;
    const sessionId = query.get("session_id");
    if (!sessionId) { setError("Missing checkout confirmation. No trial has been confirmed."); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setReturnPending(true);
    let attempts = 0;
    const verify = async () => {
      try {
        const response = await fetch(`/api/business-subscription/get-session?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || result.status !== "complete") throw new Error(result.error || "Checkout is not complete. You can retry or continue with Free.");
        if (cancelled) return;
        if (result.billingStatus === "subscription_trialing" || result.billingStatus === "subscription_active") {
          router.replace(`/business/my-business?subscription=${result.billingStatus === "subscription_trialing" ? "trial_confirmed" : "active"}`);
          return;
        }
        if (++attempts < 8) { timer = setTimeout(() => void verify(), 1500); return; }
        router.replace("/business/my-business?subscription=processing");
      } catch (err) {
        if (!cancelled) { setReturnPending(false); setError(err instanceof Error ? err.message : "Could not verify checkout. Please retry."); }
      }
    };
    void verify();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [businessId, context, router]);

  const chooseFree = async () => {
    if (busy || returnPending) return;
    setBusy("free"); setError(null);
    try {
      const response = await fetch("/api/business-subscription/choose-free", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) });
      if (!response.ok) throw new Error("Could not select Free. Please retry.");
      router.replace("/business/my-business");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not select Free."); setBusy(null); }
  };
  const chooseGrowth = async () => {
    if (!businessId || busy || returnPending || !context?.price || context.trialEligible === null) return;
    setBusy("growth"); setError(null);
    void logProductEvent({ eventType: "plan_growth_clicked", actorRole: "business", offerId: context.offerId, meta: { source: "plan_choice", intended_action: resumeSubscription ? "paid_subscription" : "free_trial" } });
    try {
      const response = await fetch("/api/business-subscription/create-checkout-session", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, returnTo: "/business/choose-plan", requireTrial: !resumeSubscription, intendedAction: resumeSubscription ? "continue_growth_subscription" : "start_growth_trial" }) });
      const result = await response.json();
      if (result.status === "already_subscribed" || result.status === "grandfathered") { router.replace("/business/my-business"); return; }
      if (!response.ok || !result.url) throw new Error(result.error || result.message || "Could not start checkout.");
      window.location.assign(result.url);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not start checkout."); setBusy(null); }
  };
  if (returnPending) return <main className="min-h-screen p-6"><p role="status">Confirming your checkout… Your offer is saved.</p></main>;
  if (!context) return <main className="min-h-screen p-6"><p role={error ? "alert" : "status"}>{error || "Loading your next step…"}</p>{error && <button className="mt-4 min-h-11 rounded-full border px-5" onClick={() => setReload(n => n + 1)}>Retry</button>}</main>;
  if (context.treatment && context.trialEligible !== false) return <BusinessTrialFirstContinuation context={context} busy={busy} error={error} onGrowth={() => void chooseGrowth()} onFree={() => void chooseFree()} onRetry={() => setReload(n => n + 1)} />;
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#121212] px-4 py-10 text-[#f5f7f8] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="plan-orb plan-orb-left" />
        <div className="plan-orb plan-orb-right" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#16c8d5]/25 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[980px] pb-12 pt-4 sm:pt-8">
        <div className="plan-enter plan-enter-1 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#16c8d5]/35 bg-[#16c8d5]/[0.06] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#20d4df] shadow-[0_0_28px_rgba(22,200,213,0.08)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#20d4df] shadow-[0_0_10px_rgba(32,212,223,0.9)]" />
            {resumeSubscription ? "Your Growth trial ended" : "Your offer is live"}
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-[42px] sm:leading-[1.08]">
            {resumeSubscription ? "Choose how you want to continue" : "How should affiliates promote you?"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#969da7] sm:text-[15px]">
            {resumeSubscription
              ? "Keep organic distribution free, or continue Growth to keep affiliate-funded advertising enabled through your Meta account."
              : "Start free with organic distribution, or unlock affiliate-funded advertising through your Meta account for more growth."}
          </p>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2">
          <section className="plan-card plan-enter plan-enter-2 flex min-h-[500px] flex-col rounded-[24px] border border-[#313438] bg-[#1a1a1a]/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-[13px] border border-[#34383d] bg-[#202224] text-[#b9c0c8]">
              <Megaphone className="h-5 w-5" />
            </div>

            <div className="mt-7">
              <h2 className="text-[23px] font-semibold tracking-tight text-white">Organic</h2>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-[38px] font-semibold leading-none tracking-[-0.04em] text-white">$0</span>
                <span className="pb-1 text-sm text-[#7f8790]">forever</span>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-6 text-[#a0a7af]">
                Affiliates can promote your offers organically and earn commission when they create sales.
              </p>
            </div>

            <div className="my-6 h-px bg-[#2a2d30]" />

            <div className="space-y-3.5 text-sm text-[#b8bec5]">
              {[
                "Organic affiliate promotion",
                "Offer discovery and tracking",
                "No cost, forever",
                "A simple way to start distributing",
              ].map((item) => (
                <p key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0 text-[#1fd0dc]" strokeWidth={2.4} />
                  {item}
                </p>
              ))}
            </div>

            <button
              onClick={chooseFree}
              disabled={!!busy}
              className="plan-secondary mt-auto w-full rounded-[14px] border border-[#3a3e42] bg-[#1b1c1d] px-5 py-3.5 text-sm font-semibold text-[#f4f5f6] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "free" ? "Continuing..." : "Continue free"}
            </button>
          </section>

          <section className="plan-card plan-growth-card plan-enter plan-enter-3 relative flex min-h-[500px] flex-col overflow-hidden rounded-[24px] border border-[#16c8d5]/70 bg-[#191b1c]/95 p-6 shadow-[0_22px_75px_rgba(0,0,0,0.28),0_0_45px_rgba(22,200,213,0.08)] sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#16c8d5]/[0.08] blur-3xl" />
            <div className="absolute right-6 top-6 rounded-full border border-[#16c8d5]/55 bg-[#0f292b]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#22d6e1]">
              Growth
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[13px] border border-[#16c8d5]/30 bg-[#16c8d5]/[0.08] text-[#22d6e1] shadow-[0_0_24px_rgba(22,200,213,0.08)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-[#28d8e2]">
                {resumeSubscription ? "Continue Growth" : `${context?.trialDays || ""} days free`}
              </span>
            </div>

            <div className="relative mt-7">
              <h2 className="text-[23px] font-semibold tracking-tight text-white">Organic + Paid</h2>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-[38px] font-semibold leading-none tracking-[-0.04em] text-white">{context?.price?.formatted || "Pricing unavailable"}</span>
                <span className="pb-1 text-sm text-[#7f8790]">
                  {resumeSubscription ? `/ ${context?.price ? growthPricePeriod(context.price) : "billing period"}` : `/ ${context?.price ? growthPricePeriod(context.price) : "billing period"} after trial`}
                </span>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-6 text-[#a0a7af]">
                Let affiliates use their own ad budgets to advertise your products through your Meta account.
              </p>
            </div>

            <div className="relative my-6 h-px bg-[#2d3335]" />

            <div className="relative space-y-3.5 text-sm text-[#c2c7cc]">
              {[
                "Everything in Organic",
                "Affiliate-funded paid advertising",
                "You approve campaigns before launch",
                "Review paid campaigns before they go live",
              ].map((item) => (
                <p key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0 text-[#1fd0dc]" strokeWidth={2.4} />
                  {item}
                </p>
              ))}
            </div>

            <button
              onClick={chooseGrowth}
              disabled={!!busy || !businessId || !context?.price || context.trialEligible === null || !context.checkoutEnabled}
              className="plan-primary relative mt-auto w-full overflow-hidden rounded-[14px] bg-[#16c8d5] px-5 py-3.5 text-sm font-bold text-[#061113] shadow-[0_10px_32px_rgba(22,200,213,0.18)] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="relative z-10">
                {busy === "growth"
                  ? "Opening secure checkout..."
                  : resumeSubscription
                    ? "Continue subscription"
                    : `Start ${context?.trialDays || ""}-day free trial`}
              </span>
            </button>
            <p className="relative mt-3 text-center text-[11px] text-[#7d858d]">
              {resumeSubscription
                ? `Continue at ${context?.price?.formatted || "the verified checkout price"}/${context?.price ? growthPricePeriod(context.price) : "billing period"}. Cancel anytime.`
                : `Card required. ${context?.trialDays || ""} days free. Then ${context?.price?.formatted || "pricing unavailable"}/${context?.price ? growthPricePeriod(context.price) : "billing period"} unless cancelled. ${context?.price?.taxNotice || ""}`}
            </p>
          </section>
        </div>

        <div className="plan-enter plan-enter-4 mt-5 grid overflow-hidden rounded-[20px] border border-[#2d3033] bg-[#191919]/95 md:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Switch plans anytime",
              copy: "Upgrade or downgrade whenever you need.",
            },
            {
              icon: CreditCard,
              title: "No setup fee",
              copy: "Start distributing in minutes.",
            },
            {
              icon: ShieldCheck,
              title: "Cancel anytime",
              copy: "No long-term contracts.",
            },
          ].map(({ icon: Icon, title, copy }, index) => (
            <div
              key={title}
              className={`flex items-center gap-4 px-6 py-5 ${index > 0 ? "border-t border-[#2d3033] md:border-l md:border-t-0" : ""}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16c8d5]/[0.07] text-[#1fd0dc]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#eef1f2]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#7f8790]">{copy}</p>
              </div>
            </div>
          ))}
        </div>

        {context?.billingError && <p className="mt-5 text-center text-sm text-amber-200" role="status">{context.billingError} <button className="min-h-11 underline" onClick={() => setReload(n => n + 1)}>Retry</button></p>}
        {error && (
          <p className="plan-enter mt-5 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>

      <style jsx>{`
        .plan-orb {
          position: absolute;
          border-radius: 9999px;
          border: 1px solid rgba(22, 200, 213, 0.09);
          filter: blur(0.1px);
          opacity: 0.7;
        }

        .plan-orb-left {
          width: 620px;
          height: 620px;
          left: -390px;
          top: -170px;
          background: radial-gradient(circle at 65% 55%, rgba(22, 200, 213, 0.055), transparent 58%);
        }

        .plan-orb-right {
          width: 720px;
          height: 720px;
          right: -470px;
          bottom: -260px;
          background: radial-gradient(circle at 30% 30%, rgba(22, 200, 213, 0.055), transparent 60%);
        }

        .plan-enter {
          opacity: 0;
          transform: translateY(14px);
          animation: planEnter 560ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .plan-enter-1 { animation-delay: 40ms; }
        .plan-enter-2 { animation-delay: 120ms; }
        .plan-enter-3 { animation-delay: 190ms; }
        .plan-enter-4 { animation-delay: 270ms; }

        .plan-card {
          transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease, background-color 220ms ease;
        }

        .plan-card:hover {
          transform: translateY(-4px);
          border-color: rgba(116, 124, 132, 0.52);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.3);
        }

        .plan-growth-card:hover {
          border-color: rgba(31, 208, 220, 0.92);
          box-shadow: 0 26px 75px rgba(0, 0, 0, 0.3), 0 0 48px rgba(22, 200, 213, 0.12);
        }

        .plan-secondary:hover:not(:disabled) {
          border-color: rgba(31, 208, 220, 0.38);
          background: #202223;
        }

        .plan-primary::after {
          content: "";
          position: absolute;
          top: -100%;
          left: -34%;
          width: 22%;
          height: 300%;
          transform: rotate(20deg);
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34), transparent);
          transition: left 650ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .plan-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #20d4df;
          box-shadow: 0 14px 38px rgba(22, 200, 213, 0.24);
        }

        .plan-primary:hover:not(:disabled)::after {
          left: 115%;
        }

        @keyframes planEnter {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .plan-enter {
            opacity: 1;
            transform: none;
            animation: none;
          }

          .plan-card,
          .plan-primary,
          .plan-secondary {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}
