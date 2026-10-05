"use client";
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
export default function BusinessTrialFirstContinuation({ context, busy, error, onGrowth, onFree, onRetry }: Props) {
  const ready = Boolean(context.price && context.trialEligible === true && context.checkoutEnabled);
  return <main className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
    <section className="mx-auto max-w-lg rounded-[24px] border border-white/[0.09] bg-[#151718] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:p-6" data-funnel={context.business_onboarding_funnel} style={{ color: "#f5f7f8" }}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C2CB] text-[#0f0f0f]" aria-hidden="true">✓</div>
      <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.025em]">Your offer is live.</h1>
      <p className="mt-2 text-sm leading-5 text-[#94a3b8]">{context.participationMode === "private"
        ? "Your offer is saved for your invited affiliates. Now get ready for paid promotion."
        : "You're ready to receive affiliate requests. Now get ready for campaigns funded by affiliates."}</p>
      <div className="mt-5 rounded-[19px] border border-white/[0.09] bg-[#101415] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5ae5eb]">Nettmark Growth</p>
        <h2 className="mt-2 text-base font-semibold">Let affiliates advertise your business with their own money.</h2>
        <p className="mt-2 text-sm leading-5 text-[#cbd5e1]">Growth enables paid campaign approval and launch through your connected Meta account. You review campaigns before they go live.</p>
        <p className="mt-2 text-xs leading-5 text-[#94a3b8]">Campaigns still need an affiliate, tracking and launch setup. Meta bills your ad account; Nettmark reimburses eligible spend from affiliate funding separately.</p>
      </div>
      {context.price && <p className="mt-4 text-sm leading-5 text-[#cbd5e1]" data-testid="billing-terms">
        <strong>{formatZero(context.price.currency)} today.</strong> Your {context.trialDays}-day trial begins after you confirm in Stripe.
        {" "}Then {context.price.formatted}/{growthPricePeriod(context.price)}, billed automatically unless you cancel before the trial ends. Card required. Cancel anytime in billing settings.
        {" "}{context.price.taxNotice}
      </p>}
      {(context.billingError || !context.checkoutEnabled) && <p className="mt-4 text-sm leading-5 text-amber-200" role="status">
        {context.billingError || "Growth checkout is currently unavailable. You can continue with Free."}
      </p>}
      <button type="button" onClick={onGrowth} disabled={!!busy || !ready}
        className="mt-4 min-h-11 w-full rounded-full bg-[#00C2CB] px-4 py-3 text-sm font-bold text-[#0f0f0f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C2CB] disabled:opacity-50">
        {busy === "growth" ? "Opening secure checkout…" : "Start my free trial"}
      </button>
      <button type="button" onClick={onFree} disabled={!!busy}
        className="mt-3 min-h-11 w-full rounded-full border border-white/[0.11] bg-white/[0.02] px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C2CB] disabled:opacity-50">
        {busy === "free" ? "Continuing…" : "Continue with Free"}
      </button>
      <p className="mt-2 text-center text-xs leading-5 text-[#94a3b8]">Free keeps affiliate requests and organic promotion available. Upgrade later when you're ready.</p>
      {context.billingError && <button type="button" onClick={onRetry} disabled={!!busy} className="mt-3 min-h-11 w-full rounded-full border border-white/[0.11] text-sm underline">Retry Growth details</button>}
      {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
    </section>
  </main>;
}
function formatZero(currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, currencyDisplay: "code" }).format(0);
}
