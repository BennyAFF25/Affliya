"use client";
import { ArrowRight, ChartNoAxesColumnIncreasing, Check, ShieldCheck, Zap } from "lucide-react";
import type { GrowthPrice } from "../../utils/businessOnboardingFunnel";

export type BusinessContinuationContext = {
  business_onboarding_funnel: string; treatment: boolean; offerId: string | null;
  participationMode: string; trialEligible: boolean | null; trialDays: number;
  price: GrowthPrice | null; billingError: string | null; checkoutEnabled: boolean;
};
export function growthPricePeriod(price: GrowthPrice) {
  return price.intervalCount === 1 ? price.interval : `${price.intervalCount} ${price.interval}s`;
}
type Props = {
  context: BusinessContinuationContext; busy: "free" | "growth" | null; error: string | null;
  onGrowth: () => void; onFree: () => void; onRetry: () => void;
};
const benefits = [
  { icon: Zap, label: "Approve paid affiliate campaigns" },
  { icon: ChartNoAxesColumnIncreasing, label: "Launch through your connected Meta account" },
  { icon: ShieldCheck, label: "Review campaigns before they go live" },
];
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C2CB]";

export default function BusinessTrialFirstContinuation({ context, busy, error, onGrowth, onFree, onRetry }: Props) {
  const ready = Boolean(context.price && context.trialEligible === true && context.checkoutEnabled);
  return (
    <main className="min-h-screen bg-[#0f0f0f] px-4 py-6 sm:px-6 sm:py-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <section
        className="mx-auto w-full max-w-lg rounded-[24px] border border-white/[0.09] bg-[#151718] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.25)] sm:p-7"
        data-funnel={context.business_onboarding_funnel}
        style={{ color: "#f5f7f8" }}
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#00C2CB] text-[#0f0f0f]" aria-hidden="true">
          <Check className="h-5 w-5" strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[34px]">Your offer is live.</h1>
        <p className="mt-2 text-base leading-6 text-[#94a3b8]">
          {context.participationMode === "private"
            ? "Start your Growth trial to unlock paid campaigns with your invited affiliates."
            : "Start your Growth trial to unlock paid affiliate campaigns."}
        </p>

        <div className="mt-5 rounded-[19px] border border-[#00C2CB]/25 bg-[#101415] p-4 shadow-[inset_0_0_24px_rgba(0,194,203,0.025)] sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5ae5eb]">Nettmark Growth</p>
          <h2 className="mt-2 text-[20px] font-semibold leading-7 tracking-[-0.02em] sm:text-[22px]">
            Let affiliates advertise your business with their own money.
          </h2>
          <ul className="mt-4 space-y-3">
            {benefits.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00C2CB]/10 text-[#19d4dd]" aria-hidden="true">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 text-sm leading-5 text-[#cbd5e1]">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {context.price && (
          <div className="mt-5" data-testid="billing-terms">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[32px] font-semibold leading-tight tracking-[-0.025em] sm:text-[38px]" data-testid="trial-today-price">
              <span className="text-[#00C2CB]">$0</span><span>Today</span>
            </p>
            <p className="mt-1 text-sm leading-5 text-[#94a3b8]">
              {context.trialDays}-day free trial <span aria-hidden="true">•</span> then {context.price.formatted}/{growthPricePeriod(context.price)}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#94a3b8]">Card required. Cancel anytime.</p>
            <p className="mt-1 text-[11px] leading-4 text-[#94a3b8]">
              Billed automatically unless you cancel before the trial ends. {context.price.taxNotice}
            </p>
          </div>
        )}

        {(context.billingError || !context.checkoutEnabled) && (
          <p className="mt-4 text-sm leading-5 text-amber-200" role="status">
            {context.billingError || "Growth checkout is currently unavailable. You can continue with Free."}
          </p>
        )}
        <button
          type="button" onClick={onGrowth} disabled={!!busy || !ready} aria-busy={busy === "growth"}
          className={`mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#00C2CB] px-4 py-3 text-sm font-bold text-[#0f0f0f] shadow-[0_10px_24px_rgba(0,194,203,0.16)] transition-colors hover:bg-[#14d5de] disabled:opacity-50 ${focus}`}
        >
          {busy === "growth" ? "Opening secure checkout…" : "Start my free trial"}
          {busy !== "growth" && <ArrowRight className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />}
        </button>
        <button
          type="button" onClick={onFree} disabled={!!busy} aria-busy={busy === "free"}
          className={`mt-3 min-h-12 w-full rounded-full border border-white/[0.16] bg-white/[0.02] px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/[0.04] disabled:opacity-50 ${focus}`}
        >
          {busy === "free" ? "Continuing…" : "Continue with Free"}
        </button>
        <p className="mt-2 text-center text-xs leading-5 text-[#94a3b8]">
          Free keeps affiliate requests and organic promotion available.
        </p>
        <details className="mt-3 text-xs leading-5 text-[#94a3b8]">
          <summary className={`mx-auto w-fit cursor-pointer rounded-sm text-center underline decoration-white/20 underline-offset-4 ${focus}`}>
            How affiliate-funded advertising works
          </summary>
          <p className="mt-2">
            Campaigns still need an affiliate, tracking and launch setup. Meta bills your ad account; Nettmark reimburses eligible spend from affiliate funding separately.
          </p>
          <p className="mt-2">Your trial begins after you confirm in Stripe. Cancel anytime in billing settings.</p>
        </details>
        {context.billingError && (
          <button type="button" onClick={onRetry} disabled={!!busy} className={`mt-3 min-h-11 w-full rounded-full border border-white/[0.11] text-sm underline ${focus}`}>
            Retry Growth details
          </button>
        )}
        {error && <p className="mt-4 text-sm leading-5 text-red-300" role="alert">{error}</p>}
      </section>
    </main>
  );
}
