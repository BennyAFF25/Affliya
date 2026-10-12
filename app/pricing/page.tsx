"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ArrowRight, CreditCard, ShieldCheck } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { logMarketingEvent } from "@/../utils/marketing/logEvent";
import { buildHrefWithAttribution, getAttributionFromWindow, persistAttribution } from "@/../utils/marketing/attribution";

const growthBenefits = [
  "Affiliates fund and run paid Meta ads for your brand",
  "Approve every campaign before it runs",
  "Launch approved campaigns through your connected Meta account",
  "Everything included in Free",
];

export default function PricingPage() {
  const router = useRouter();
  const createAccount = (role: "business" | "affiliate") => {
    try {
      localStorage.setItem("intent.role", role);
      localStorage.setItem("intent.flow", "signup");
    } catch {}
    if (role === "business") {
      // If the visitor reached Pricing from an ad landing page, preserve
      // the original acquisition src and UTMs through signup and checkout.
      const source = getAttributionFromWindow();
      const attribution = { ...source, src: source.src || "pricing" };
      persistAttribution(attribution);
      void logMarketingEvent({ eventType: "landing_cta_click", pagePath: "/pricing", audience: "business",
        meta: { ...attribution, cta_label: "Start 14-day free trial" } });
      router.push(buildHrefWithAttribution(
        "/create-account?role=business&plan=growth&src=" + encodeURIComponent(attribution.src),
        attribution,
      ));
      return;
    }
    router.push("/create-account?role=affiliate&src=pricing");
  };
  return (
    <div className="marketing-pricing-theme min-h-screen bg-[#0f0f0f] text-white">
      <MarketingHeader />
      <main className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 sm:py-16">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#63e8ee]">Simple plans</p>
          <h1 className="mt-3 text-[31px] font-semibold tracking-tight sm:text-[43px]">Put affiliates to work for your business.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Affiliates pay for their own ad spend. Your Growth subscription unlocks paid affiliate campaigns.</p>
        </header>
        <section className="mx-auto mt-10 max-w-[720px] rounded-[24px] border border-[#00C2CB]/35 bg-[#151718] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.25)] sm:p-8" aria-labelledby="growth-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="growth-heading" className="text-2xl font-semibold">Growth</h2>
            <span className="rounded-full bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-semibold text-[#63e8ee]">Recommended · 14-day trial</span>
          </div>
          <p className="mt-4 text-lg font-semibold text-white">14 days free, then A$49/month. Cancel anytime.</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">A$0 today. Card required. You won’t be charged until day 15 if you cancel before the trial ends. Taxes, where applicable, are shown at checkout.</p>
          <ul className="mt-6 space-y-3">
            {growthBenefits.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-slate-200">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00C2CB]" />{item}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => createAccount("business")} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 text-sm font-bold text-[#0f0f0f] hover:bg-[#19d5dc]">
            Start 14-day free trial <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">You choose the commission on verified sales. Nettmark also charges 2.2% on wallet top-ups and business payouts; Stripe processing fees may apply.</p>
        </section>
        <section className="mx-auto mt-4 max-w-[720px] rounded-[22px] border border-white/[0.09] bg-[#151718] p-5 sm:p-6" aria-labelledby="free-heading">
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="free-heading" className="text-lg font-semibold">Free</h2><p className="mt-1 text-xs text-slate-400">Organic affiliate promotion only. No paid affiliate ads.</p></div>
            <span className="text-sm font-medium text-slate-300">A$0/month</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">Your business can publish an offer and receive organic promotion, but affiliates cannot run paid Meta ads for you on Free.</p>
          <p className="mt-3 text-xs text-slate-500">Choose Free after account creation if Growth isn’t right for you.</p>
        </section>
        <section className="mx-auto mt-6 max-w-[720px] rounded-[22px] border border-white/[0.09] bg-[#151718] p-5 sm:p-6">
          <div className="flex gap-3">
            <CreditCard className="h-5 w-5 shrink-0 text-[#00C2CB]" />
            <div><h2 className="font-semibold">For partners / affiliates</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">No subscription and no card required to create an affiliate account. A 2.2% fee applies to wallet top-ups, plus payment-processing charges. Choose an offer, promote, and earn commissions.</p>
              <button type="button" className="mt-3 text-xs font-semibold text-[#63e8ee] hover:underline" onClick={() => createAccount("affiliate")}>Create partner account <ArrowRight className="inline h-3 w-3" /></button>
            </div>
          </div>
        </section>
        <p className="mx-auto mt-8 max-w-[720px] text-center text-xs leading-5 text-slate-400">
          <ShieldCheck className="mr-1 inline h-4 w-4 text-[#00C2CB]" />You approve every paid campaign. Meta charges your connected ad account, with eligible affiliate-funded spend reimbursed separately through Nettmark.
          <span className="ml-2">Already registered? <Link href="/login?role=business" className="font-semibold text-[#63e8ee] underline">Log in</Link>.</span>
        </p>
      </main>
    </div>
  );
}
