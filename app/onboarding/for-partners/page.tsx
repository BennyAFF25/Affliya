"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2, Search } from "lucide-react";
import AcceptTermsModal from "@/components/AcceptTermsModal";
import {
  affiliateOnboardingPath, isApproved, type OnboardingOffer, type PromotionMode,
} from "@/../utils/affiliate/onboarding";

const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#19d1d8] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C2CB]";

function commissionLabel(offer: OnboardingOffer) {
  if (offer.commission != null && offer.commission > 0) return offer.commission + "% commission";
  if (offer.commissionValue != null && offer.commissionValue > 0 && offer.currency) {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency: offer.currency }).format(offer.commissionValue) + " commission";
    } catch { return offer.currency + " " + offer.commissionValue + " commission"; }
  }
  return "See offer terms";
}

function AffiliateOnboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const [offers, setOffers] = useState<OnboardingOffer[]>([]);
  const [selectedId, setSelectedId] = useState(params.get("offerId") || "");
  const [mode, setMode] = useState<PromotionMode>(params.get("mode") === "ad" ? "ad" : "organic");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [pendingTitle, setPendingTitle] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [userId, setUserId] = useState("");
  const [reload, setReload] = useState(0);
  const intent = affiliateOnboardingPath(params.get("offerId"), params.get("mode"));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch("/api/onboarding/affiliate-offers", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          const query = new URLSearchParams({ role: "affiliate" });
          const requestedId = new URL(intent, "https://nettmark.local").searchParams.get("offerId");
          if (requestedId) query.set("offerId", requestedId);
          if (intent.includes("mode=ad")) query.set("mode", "ad");
          router.replace("/create-account?" + query.toString());
          return;
        }
        if (response.status === 403) { router.replace("/auth-redirect"); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load marketplace offers.");
        setOffers(data.offers);
        setUserId(data.userId);
        setTermsAccepted(data.termsAccepted);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load marketplace offers.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [intent, reload, router]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return offers.filter(offer => (offer.title + " " + offer.description).toLowerCase().includes(query));
  }, [offers, search]);
  const selected = offers.find(offer => offer.id === selectedId);

  function choose(offer: OnboardingOffer) {
    if (busyRef.current) return;
    setSelectedId(offer.id);
    setError("");
    setPendingTitle("");
    router.replace(affiliateOnboardingPath(offer.id, mode), { scroll: false });
  }

  async function complete() {
    const response = await fetch("/api/profile/onboarding-complete", { method: "POST" });
    if (!response.ok) throw new Error("Could not save your progress. Please try again.");
  }

  async function continuePromotion() {
    if (!selected || !termsAccepted || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/affiliate/offers/" + selected.id + "/start", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || data.error || "Could not start this promotion.");
      const status = data.participation?.status;
      if (status === "pending") {
        setOffers(current => current.map(offer => offer.id === selected.id ? { ...offer, requestStatus: "pending" } : offer));
        setPendingTitle(selected.title);
      } else if (isApproved(status)) {
        await complete();
        router.push("/affiliate/dashboard/promote/" + selected.id + "?mode=" + mode + "&source=onboarding");
      } else { throw new Error("Could not verify offer access. Please try again."); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function leaveForDashboard() {
    if (busyRef.current || !termsAccepted) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try { await complete(); router.push("/affiliate/dashboard"); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#0b0f10] px-4 py-7 text-white sm:px-6 sm:py-12">
      {!!userId && !termsAccepted && <AcceptTermsModal userId={userId} onAccepted={() => setTermsAccepted(true)} />}
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">Nettmark<span className="text-[#00C2CB]">.</span></Link>
          {userId && <button type="button" onClick={leaveForDashboard} disabled={busy || !termsAccepted} className="text-sm text-white/55 hover:text-white disabled:opacity-40">Explore my dashboard</button>}
        </header>
        <div className="mb-8 mt-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#00C2CB]">Your first promotion</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Pick a brand. Make something worth sharing.</h1>
          <p className="mt-4 text-base leading-7 text-white/55">Choose an offer, prepare your promotion, then share it when it’s ready. Start organically with no ad spend, or build a paid campaign.</p>
        </div>

        {pendingTitle && (
          <section role="status" className="mb-6 rounded-3xl border border-[#00C2CB]/25 bg-[#151718] p-6">
            <div className="flex items-center gap-2 text-[#00C2CB]"><Check className="h-5 w-5" /><h2 className="font-semibold">Request sent to {pendingTitle}</h2></div>
            <p className="mt-3 text-sm leading-6 text-white/60">The business needs to approve your access before you can prepare this promotion. You can choose an open offer while you wait.</p>
            <button type="button" onClick={() => { setPendingTitle(""); setSelectedId(""); setSearch(""); }} className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-[#00C2CB]">Choose another brand</button>
          </section>
        )}
        {error && <div role="alert" className="mb-5 rounded-2xl border border-red-400/25 bg-red-400/5 p-4 text-sm text-red-200">{error}<button type="button" onClick={() => setReload(value => value + 1)} className="ml-3 underline">Reload offers</button></div>}
        {loading ? <div role="status" className="flex items-center gap-3 py-12 text-white/60"><Loader2 className="h-5 w-5 animate-spin" />Loading marketplace offers…</div> : (
          <>
            <label className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#151718] px-4">
              <Search className="h-4 w-4 text-white/40" aria-hidden="true" />
              <span className="sr-only">Search offers</span>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search brands or products" className="min-h-12 w-full bg-transparent text-sm outline-none placeholder:text-white/35" />
            </label>
            {!filtered.length ? <section className="rounded-3xl border border-white/10 bg-[#151718] p-8">
              <h2 className="font-semibold">{offers.length ? "No matching offers" : "No offers available yet"}</h2>
              <p className="mt-2 text-sm text-white/55">{offers.length ? "Try another search." : "Check the marketplace again later. You can explore your dashboard now."}</p>
              {offers.length > 0 && <button onClick={() => setSearch("")} className="mt-4 text-sm text-[#00C2CB]">Clear search</button>}
            </section> : <div className="grid gap-4 md:grid-cols-2">
              {filtered.map(offer => {
                const active = selectedId === offer.id;
                const approved = isApproved(offer.requestStatus);
                const pending = offer.requestStatus === "pending";
                return (
                  <button key={offer.id} type="button" aria-pressed={active} disabled={busy} onClick={() => choose(offer)}
                    className={"rounded-3xl border bg-[#151718] p-6 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB] " + (active ? "border-[#00C2CB]" : "border-white/10 hover:border-white/30")}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-[#00C2CB]">
                          {offer.logoUrl ? <img src={offer.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" /> : offer.title.slice(0, 1)}
                        </div>
                        <h2 className="text-base font-semibold">{offer.title}</h2>
                      </div>
                      <div className={"grid h-5 w-5 shrink-0 place-items-center rounded-full border " + (active ? "border-[#00C2CB] bg-[#00C2CB] text-black" : "border-white/20")}>{active && <Check className="h-3.5 w-3.5" />}</div>
                    </div>
                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/55">{offer.description || "Open the offer to prepare your own promotion."}</p>
                    <p className="mt-5 text-sm font-medium text-[#00C2CB]">{commissionLabel(offer)}{offer.type === "recurring" ? " · Recurring offer" : ""}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/65">
                      <span className="rounded-full bg-white/5 px-3 py-1.5">{approved ? "Access approved" : pending ? "Approval pending" : offer.participationMode === "open" ? "Open to affiliates" : "Business approval required"}</span>
                      <span className="rounded-full bg-white/5 px-3 py-1.5">{offer.readyOrganicCount && offer.readyOrganicCount > 0 ? "Preapproved organic content" : "Prepare your own copy"}</span>
                    </div>
                  </button>
                );
              })}
            </div>}
            {selected && !pendingTitle && (
              <section className="mt-6 rounded-3xl border border-white/10 bg-[#151718] p-6 sm:p-7">
                <p className="text-sm text-white/55">Next: {selected.title}</p>
                <div role="group" aria-label="Promotion type" className="mt-4 flex flex-wrap gap-2">
                  {(["organic", "ad"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} disabled={busy}
                    onClick={() => { setMode(value); router.replace(affiliateOnboardingPath(selected.id, value), { scroll: false }); }}
                    className={"rounded-full border px-4 py-2 text-sm " + (mode === value ? "border-[#00C2CB] bg-[#00C2CB]/10 text-[#00C2CB]" : "border-white/15 text-white/55")}>
                    {value === "organic" ? "Organic · no ad spend" : "Paid campaign"}
                  </button>)}
                </div>
                <p className="mt-4 text-sm leading-6 text-white/55">{mode === "organic" ? "Use brand content or prepare your own post. Edited copy goes to the business for review." : "Draft a campaign for business review. You’ll choose the media and budget before submitting."}</p>
                <button type="button" onClick={continuePromotion} disabled={busy || !termsAccepted || selected.requestStatus === "pending"} className={primary + " mt-5"}>
                  {busy ? "Opening…" : selected.requestStatus === "pending" ? "Waiting for business approval" : isApproved(selected.requestStatus) || selected.participationMode === "open" ? "Prepare my promotion" : "Request access"}
                  {!busy && selected.requestStatus !== "pending" && <ArrowRight className="h-4 w-4" />}
                </button>
                <p className="mt-3 text-xs leading-5 text-white/40">Commissions depend on eligible, verified results and the offer’s terms.</p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function AffiliateOnboardingPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#0b0f10] p-8 text-white/60">Loading…</main>}><AffiliateOnboarding /></Suspense>;
}
