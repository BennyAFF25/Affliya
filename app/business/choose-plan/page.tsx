"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { Check, Megaphone, Sparkles } from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

export default function ChooseBusinessPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isLoading } = useSessionContext();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"free" | "growth" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session?.user?.email) {
      router.replace("/login?role=business&next=/business/choose-plan");
      return;
    }
    void (async () => {
      const { data, error: profileError } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("business_email", session.user.email)
        .limit(1)
        .maybeSingle();
      if (profileError || !data?.id) {
        setError("We couldn't find your business profile. Please refresh and try again.");
        return;
      }
      setBusinessId(data.id);
    })();
  }, [isLoading, router, session?.user?.email]);

  useEffect(() => {
    if (searchParams.get("subscription") !== "checkout_returned") return;
    void fetch("/api/business-subscription/choose-free", { method: "POST" }).finally(() => {
      router.replace("/business/my-business?trial=started");
    });
  }, [router, searchParams]);

  const chooseFree = async () => {
    setBusy("free");
    setError(null);
    try {
      const res = await fetch("/api/business-subscription/choose-free", { method: "POST" });
      if (!res.ok) throw new Error("Could not select the free plan.");
      router.replace("/business/my-business");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select the free plan.");
      setBusy(null);
    }
  };

  const chooseGrowth = async () => {
    if (!businessId) return;
    setBusy("growth");
    setError(null);
    try {
      const res = await fetch("/api/business-subscription/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          returnTo: "/business/choose-plan",
          intendedAction: "start_growth_trial",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.url) throw new Error(json?.error || json?.message || "Could not start checkout.");
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#05080b] px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff5fb]">Your offer is live</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">How should affiliates promote you?</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60">Choose organic distribution for free, or let affiliates use their own ad budgets with Growth.</p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-[28px] border border-white/10 bg-[#101516] p-6">
            <Megaphone className="h-6 w-6 text-white/70" />
            <h2 className="mt-5 text-2xl font-bold">Organic</h2>
            <p className="mt-1 text-3xl font-bold">$0 <span className="text-sm font-normal text-white/45">forever</span></p>
            <p className="mt-4 text-sm leading-6 text-white/58">Affiliates can promote your offers organically and earn commission when they create sales.</p>
            <div className="mt-5 space-y-2 text-sm text-white/70">
              <p className="flex gap-2"><Check className="h-4 w-4 text-[#7ff5fb]" /> Organic affiliate promotion</p>
              <p className="flex gap-2"><Check className="h-4 w-4 text-[#7ff5fb]" /> Offer discovery and tracking</p>
            </div>
            <button onClick={chooseFree} disabled={!!busy} className="mt-7 w-full rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-semibold disabled:opacity-50">{busy === "free" ? "Continuing..." : "Continue free"}</button>
          </section>

          <section className="rounded-[28px] border border-[#00C2CB]/45 bg-[#101516] p-6 shadow-[0_0_40px_rgba(0,194,203,0.08)]">
            <div className="inline-flex rounded-full bg-[#00C2CB]/12 px-3 py-1 text-xs font-semibold text-[#7ff5fb]">14 days free</div>
            <Sparkles className="mt-5 h-6 w-6 text-[#7ff5fb]" />
            <h2 className="mt-3 text-2xl font-bold">Organic + Paid</h2>
            <p className="mt-1 text-3xl font-bold">$49 <span className="text-sm font-normal text-white/45">/ month after trial</span></p>
            <p className="mt-4 text-sm leading-6 text-white/58">Let affiliates use their own ad budgets to advertise your products through your Meta account.</p>
            <div className="mt-5 space-y-2 text-sm text-white/70">
              <p className="flex gap-2"><Check className="h-4 w-4 text-[#7ff5fb]" /> Everything in Organic</p>
              <p className="flex gap-2"><Check className="h-4 w-4 text-[#7ff5fb]" /> Affiliate-funded paid advertising</p>
              <p className="flex gap-2"><Check className="h-4 w-4 text-[#7ff5fb]" /> You approve campaigns before launch</p>
            </div>
            <button onClick={chooseGrowth} disabled={!!busy || !businessId} className="mt-7 w-full rounded-2xl bg-[#00C2CB] px-5 py-3.5 text-sm font-semibold text-black disabled:opacity-50">{busy === "growth" ? "Opening secure checkout..." : "Start 14-day free trial"}</button>
            <p className="mt-3 text-center text-xs text-white/38">Card required. $0 today. Then $49/month unless cancelled.</p>
          </section>
        </div>

        {error && <p className="mt-5 text-center text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}
