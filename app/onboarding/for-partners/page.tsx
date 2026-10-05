"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Search } from "lucide-react";
import AcceptTermsModal from "@/components/AcceptTermsModal";
import { logProductEvent } from "@/../utils/productEvents";
import {
  affiliateOnboardingPath, isApproved, onboardingCommission, type OnboardingOffer, type PromotionMode,
} from "@/../utils/affiliate/onboarding";

const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#19d1d8] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C2CB]";

function CommissionSummary({ offer }: { offer: OnboardingOffer }) {
  const commission = onboardingCommission(offer);
  return <>
    <p className="text-sm font-medium text-[#00C2CB]">{commission.label}</p>
    {commission.detail && <p className="mt-1 text-xs leading-5 text-white/55">{commission.detail}</p>}
  </>;
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
  const startedRef = useRef(false);
  const [error, setError] = useState("");
  const [pendingTitle, setPendingTitle] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [userId, setUserId] = useState("");
  const [reload, setReload] = useState(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const requestedOfferId = params.get("offerId") || "";
  const requestedMode = params.get("mode") === "ad" ? "ad" : "organic";
  const entryIntent = useRef(affiliateOnboardingPath(params.get("offerId"), params.get("mode")));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch("/api/onboarding/affiliate-offers", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          const intent = entryIntent.current;
          const query = new URLSearchParams({ role: "affiliate" });
          const requestedId = new URL(intent, "https://nettmark.local").searchParams.get("offerId");
          if (requestedId) query.set("offerId", requestedId);
          if (intent.includes("mode=ad")) query.set("mode", "ad");
          router.replace("/create-account?" + query.toString());
          return;
        }
        if (response.status === 403) { router.replace("/auth-redirect"); return; }
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(data.error || "Could not load marketplace offers.");
        setOffers(data.offers);
        setUserId(data.userId);
        setTermsAccepted(data.termsAccepted);
        if (!startedRef.current) {
          startedRef.current = true;
          void logProductEvent({ eventType: "onboarding_started", actorRole: "affiliate", meta: { source: "marketplace_onboarding_v1" } });
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load marketplace offers.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [reload, router]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return offers.filter(offer => (offer.title + " " + offer.description).toLowerCase().includes(query));
  }, [offers, search]);
  const selected = offers.find(offer => offer.id === selectedId);

  useEffect(() => {
    setSelectedId(requestedOfferId);
    setMode(requestedMode);
    setPendingTitle("");
  }, [requestedOfferId, requestedMode]);

  useEffect(() => {
    if (loading || !termsAccepted) return;
    stepHeading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [selected?.id, loading, termsAccepted]);

  function chooseAnotherBrand() {
    if (busyRef.current) return;
    setSelectedId("");
    setPendingTitle("");
    setError("");
    router.replace(affiliateOnboardingPath(null, mode), { scroll: false });
  }

  function choose(offer: OnboardingOffer) {
    if (busyRef.current) return;
    setSelectedId(offer.id);
    setError("");
    setPendingTitle("");
    router.replace(affiliateOnboardingPath(offer.id, mode), { scroll: false });
  }

  async function complete(destination: "promote" | "dashboard") {
    const response = await fetch("/api/profile/onboarding-complete", { method: "POST" });
    if (!response.ok) throw new Error("Could not save your progress. Please try again.");
    void logProductEvent({
      eventType: "onboarding_completed", actorRole: "affiliate",
      offerId: selected?.id || null, promotionType: mode === "ad" ? "paid" : "organic",
      meta: { source: "marketplace_onboarding_v1", destination },
    });
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
        await complete("promote");
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
    try { await complete("dashboard"); router.push("/affiliate/dashboard"); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const waiting = selected?.requestStatus === "pending";
  const needsAccess = selected && !isApproved(selected.requestStatus) && selected.participationMode !== "open";
  const actionLabel = waiting ? "Waiting for approval" : needsAccess ? "Request access" : "Create my promotion";

  return (
    <main className="min-h-screen bg-[#0b0f10] px-4 py-6 pb-44 text-white sm:px-6 sm:py-10 sm:pb-44">
      {!!userId && !termsAccepted && <AcceptTermsModal userId={userId} onAccepted={() => setTermsAccepted(true)} />}
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">Nettmark<span className="text-[#00C2CB]">.</span></Link>
          {userId && <button type="button" onClick={leaveForDashboard} disabled={busy || !termsAccepted} className="min-h-11 text-xs text-white/55 hover:text-white disabled:opacity-40">Explore my dashboard</button>}
        </header>

        {!loading && selected && <button type="button" onClick={chooseAnotherBrand} disabled={busy} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 text-sm font-semibold text-white disabled:opacity-40">
          <ArrowLeft className="h-4 w-4 text-[#00C2CB]" aria-hidden="true" />Choose another brand
        </button>}

        <div className="mb-6 mt-6 max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00C2CB]">{selected ? "Step 2 · Your promotion" : "Step 1 · Choose a brand"}</p>
          <h1 ref={stepHeading} tabIndex={-1} className="mt-3 text-[25px] font-semibold tracking-tight outline-none sm:text-4xl">
            {selected ? waiting ? "Your request is pending" : "How would you like to promote?" : "Who would you like to promote?"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/55">
            {selected ? waiting ? "You can choose another brand while the business reviews your request." : needsAccess ? "Request access first. Once the business approves, you can prepare your promotion." : "Start with an organic post, or prepare a paid campaign. You’ll create the content next." : "Choose a brand to get started. We’ll guide you through your first promotion."}
          </p>
        </div>

        {error && <div role="alert" className="mb-5 rounded-2xl border border-red-400/25 bg-red-400/5 p-4 text-sm text-red-200">{error}<button type="button" onClick={() => setReload(value => value + 1)} className="ml-3 underline">Reload offers</button></div>}

        {loading ? <div role="status" className="flex items-center gap-3 py-12 text-white/60"><Loader2 className="h-5 w-5 animate-spin" />Loading marketplace offers…</div> : selected ? (
          <section aria-label="Selected brand" className="mx-auto max-w-2xl rounded-[24px] border border-white/[0.09] bg-[#151718] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/5 text-[#00C2CB]">
                {selected.logoUrl ? <img src={selected.logoUrl} alt="" className="h-9 w-9 rounded-full object-contain" /> : selected.title.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">{selected.title}</h2>
                <div className="mt-1"><CommissionSummary offer={selected} /></div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/55">{selected.description || "Prepare a promotion around this offer."}</p>

            {waiting ? <div role="status" className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="flex items-center gap-2 text-[#00C2CB]"><Check className="h-5 w-5" aria-hidden="true" /><p className="font-semibold">{pendingTitle ? "Request sent to " + pendingTitle : "Waiting for business approval"}</p></div>
              <p className="mt-2 text-sm leading-6 text-white/55">The business needs to approve your access before you can prepare this promotion.</p>
            </div> : (
              <>
                <h3 className="mt-5 text-sm font-semibold">Choose your promotion type</h3>
                <div role="group" aria-label="Promotion type" className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(["organic", "ad"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} disabled={busy}
                    onClick={() => { setMode(value); router.replace(affiliateOnboardingPath(selected.id, value), { scroll: false }); }}
                    className={"flex min-h-16 items-center justify-between gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB] " + (mode === value ? "border-[#00C2CB] bg-[#00C2CB]/10" : "border-white/10 bg-black/10")}>
                    <span><span className="block text-sm font-semibold">{value === "organic" ? "Organic post" : "Paid campaign"}</span><span className="mt-1 block text-xs leading-5 text-white/55">{value === "organic" ? "Share with your audience. No ad spend." : "Create an ad. Choose a budget later."}</span></span>
                    {mode === value && <Check className="h-5 w-5 shrink-0 text-[#00C2CB]" aria-hidden="true" />}
                  </button>)}
                </div>
                <p className="mt-4 text-xs leading-5 text-white/55">{needsAccess ? "Business approval is required to access this offer." : mode === "organic" ? selected.readyOrganicCount && selected.readyOrganicCount > 0 ? "Brand content is available. Use it or prepare your own post; edited copy goes to the business for review." : "Prepare your own post, with AI help if available. The business reviews your content before it can go live." : "Your campaign goes to the business for review. Nothing launches or spends money at this step."}</p>
              </>
            )}
            <p className="mt-4 text-xs leading-5 text-white/40">Commissions depend on eligible, verified results and the offer’s terms.</p>
          </section>
        ) : (
          <>
            <label className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#151718] px-4">
              <Search className="h-4 w-4 text-white/40" aria-hidden="true" />
              <span className="sr-only">Search offers</span>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search brands or products" className="min-h-12 w-full bg-transparent text-sm outline-none placeholder:text-white/35" />
            </label>
            {!filtered.length ? <section className="rounded-[24px] border border-white/10 bg-[#151718] p-6">
              <h2 className="font-semibold">{offers.length ? "No matching offers" : "No offers available yet"}</h2>
              <p className="mt-2 text-sm text-white/55">{offers.length ? "Try another search." : "Check the marketplace again later. You can explore your dashboard now."}</p>
              {offers.length > 0 && <button onClick={() => setSearch("")} className="mt-4 min-h-11 text-sm text-[#00C2CB]">Clear search</button>}
            </section> : <div className="grid gap-4 md:grid-cols-2">
              {filtered.map(offer => {
                const approved = isApproved(offer.requestStatus);
                const pending = offer.requestStatus === "pending";
                return (
                  <button key={offer.id} type="button" disabled={busy} onClick={() => choose(offer)}
                    className="rounded-[24px] border border-white/[0.09] bg-[#151718] p-5 text-left shadow-[0_22px_60px_rgba(0,0,0,0.22)] transition hover:border-[#00C2CB]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB]">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/5 text-[#00C2CB]">
                        {offer.logoUrl ? <img src={offer.logoUrl} alt="" className="h-9 w-9 rounded-full object-contain" /> : offer.title.slice(0, 1)}
                      </div>
                      <h2 className="text-base font-semibold">{offer.title}</h2>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/55">{offer.description || "Choose this brand to prepare your promotion."}</p>
                    <div className="mt-4"><CommissionSummary offer={offer} /></div>
                    <p className="mt-2 text-xs text-white/55">{approved ? "Access approved" : pending ? "Approval pending" : offer.participationMode === "open" ? "Open to affiliates" : "Business approval required"}</p>
                    <span className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-4 text-sm font-semibold">{pending ? "View request" : "Choose brand"}<ArrowRight className="h-4 w-4 text-[#00C2CB]" aria-hidden="true" /></span>
                  </button>
                );
              })}
            </div>}
          </>
        )}
      </div>

      {!loading && selected && <footer aria-label="Next step" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#101415] px-4 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.2)] sm:px-6" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <p className="text-xs leading-5 text-white/55">{waiting ? "Choose another brand above while you wait." : needsAccess ? "Next: send your access request to the business." : mode === "organic" ? "Next: create your post. Nothing is published yet." : "Next: create your campaign. No ad spend yet."}</p>
          <button type="button" onClick={continuePromotion} disabled={busy || !termsAccepted || waiting} className={primary + " w-full"}>
            {busy ? needsAccess ? "Sending request…" : "Opening…" : actionLabel}
            {!busy && !waiting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </footer>}
    </main>
  );
}

export default function AffiliateOnboardingPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#0b0f10] p-8 text-white/60">Loading…</main>}><AffiliateOnboarding /></Suspense>;
}
