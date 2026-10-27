"use client";
import React from "react";
import { ArrowRight, Check } from "lucide-react";
import type { GrowthPrice } from "../../utils/businessOnboardingFunnel";

export type BusinessContinuationContext = {
  business_onboarding_funnel: string; treatment: boolean; offerId: string | null;
  participationMode: string; trialEligible: boolean | null; trialDays: number;
  price: GrowthPrice | null; billingError: string | null; checkoutEnabled: boolean;
  planFirst?: boolean; planSelectionComplete?: boolean;
};
export function growthPricePeriod(price: GrowthPrice) {
  return price.intervalCount === 1 ? price.interval : `${price.intervalCount} ${price.interval}s`;
}
type Props = {
  context: BusinessContinuationContext; busy: "free" | "growth" | null; error: string | null;
  onGrowth: () => void; onFree: () => void; onRetry: () => void; selectedPlan?: "free" | "growth";
};
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C2CB]";

export default function BusinessTrialFirstContinuation({ context, busy, error, onGrowth, onFree, onRetry, selectedPlan = "growth" }: Props) {
  const ready = Boolean(context.price && context.trialEligible === true && context.checkoutEnabled);
  const price = context.price?.formatted || "A$49";
  const trialDays = context.trialDays || 14;
  return (
    <main className="min-h-screen bg-[#0f0f0f] px-4 py-8 text-white sm:px-6 sm:py-12" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div className="mx-auto max-w-[980px]" data-funnel={context.business_onboarding_funnel}>
        <header className="mb-7 max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#63e8ee]">{context.planFirst ? "Step 2 of 3 · Choose your plan" : "Final setup step"}</p>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight sm:text-[40px]">{context.planFirst ? "Start your 14-day free trial" : "Your offer is live. Start Growth."}</h1>
          <p className="mt-3 text-sm leading-6 text-[#94a3b8]">So affiliates can run paid ads for your business with their own money. You approve campaigns before launch.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-[1.3fr_0.8fr]">
          <section className="rounded-[24px] border border-[#00C2CB]/40 bg-[#151718] p-5 sm:p-7" aria-labelledby="growth-plan">
            <div className="flex items-center justify-between gap-3">
              <h2 id="growth-plan" className="text-xl font-semibold">The 14-Day Affiliate-Funded Launch</h2>
              <span className="rounded-full bg-[#00C2CB]/10 px-3 py-1 text-[10px] font-semibold text-[#63e8ee]">{selectedPlan === "growth" ? "Selected · Recommended" : "Recommended"}</span>
            </div>
            <p className="mt-4 text-lg font-semibold" data-testid="billing-terms">
              A$0 today, then {price}/{context.price ? growthPricePeriod(context.price) : "month"} after {trialDays} days.
            </p>
            <p className="mt-2 text-xs leading-5 text-[#94a3b8]">Cancel anytime. {context.price?.taxNotice || "Checkout confirms your final price."}</p>
            <ul className="mt-6 space-y-3">
              {[
                "Affiliates fund and run Meta ads for your brand",
                "Approve every campaign before it runs",
                "Launch approved ads through your Meta account",
                "Everything in Free",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-200">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00C2CB]" />{item}
                </li>
              ))}
            </ul>
            <button type="button" onClick={onGrowth} disabled={!!busy || !ready} aria-busy={busy === "growth"}
              className={`mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-5 text-sm font-bold text-[#0f0f0f] hover:bg-[#16d3dc] disabled:opacity-50 ${focus}`}>
              {busy === "growth" ? "Opening secure checkout…" : "Start my affiliate-funded launch, 14 days free"} <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-xs text-[#cbd5e1]">A$49/mo after day 14 only if you stay. Card required.</p>
            <p className="mt-2 text-center text-xs text-[#94a3b8]">We ask for a card to keep fake brands out, so affiliates can trust every offer.</p>
          </section>
          <section className="rounded-[24px] border border-white/[0.09] bg-[#151718] p-5 sm:p-6" aria-labelledby="free-plan">
            <h2 id="free-plan" className="text-lg font-semibold">Free</h2>
            <p className="mt-2 text-xs text-[#94a3b8]">Organic affiliates only, no paid ads</p>
            <p className="mt-4 text-sm font-semibold text-slate-200">A$0/month</p>
            {selectedPlan === "free" && <p className="mt-2 text-xs text-[#63e8ee]">Selected</p>}
            <ul className="mt-5 space-y-3 text-xs leading-5 text-[#94a3b8]">
              <li>Listed in the affiliate marketplace</li>
              <li>Organic affiliate promotions</li>
              <li className="font-semibold text-amber-200">No paid affiliate Meta ads</li>
            </ul>
            <button type="button" onClick={onFree} disabled={!!busy}
              className={`mt-6 min-h-11 w-full text-xs font-semibold text-[#63e8ee] underline underline-offset-4 disabled:opacity-50 ${focus}`}>
              {busy === "free" ? "Continuing…" : "Continue with Free (no paid ads)"}
            </button>
          </section>
        </div>
        <section className="mt-5 rounded-[22px] border border-white/[0.09] bg-[#151718] p-5" aria-label="How affiliate-funded advertising works">
          <h2 className="text-sm font-semibold text-white">How affiliate-funded advertising works</h2>
          <div className="mt-3 grid gap-3 text-xs leading-5 text-[#94a3b8] sm:grid-cols-3">
            <div><strong className="text-white">Affiliates</strong> fund the spend from their Nettmark wallet and prepare campaigns.</div>
            <div><strong className="text-white">Your business</strong> connects Meta, reviews each submission, and pays commission on verified sales.</div>
            <div><strong className="text-white">Nettmark</strong> tracks sales and reimburses eligible Meta spend from affiliate funding to your business.</div>
          </div>
        </section>
        {(context.billingError || !context.checkoutEnabled) && (
          <p className="mt-4 text-xs leading-5 text-amber-200" role="status">{context.billingError || "Growth checkout is temporarily unavailable. Free remains available."}</p>
        )}
        {context.billingError && <button type="button" onClick={onRetry} className={`mt-3 text-xs text-[#63e8ee] underline ${focus}`}>Retry Growth details</button>}
        {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
      </div>
    </main>
  );
}
