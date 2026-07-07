"use client";

import Link from "next/link";
import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/../utils/supabase/pages-client";
import { MessageCircle } from "lucide-react";

type Offer = {
  id: string;
  title: string;
  commission: number | null;
  type?: string | null;
  logo_url?: string | null;
  commission_value?: number | null;
  business_email?: string | null;
  description?: string | null;
  website?: string | null;
};

const channels = [
  "Paid ads",
  "Organic posts",
  "TikTok content",
  "Instagram content",
  "YouTube",
  "Not sure yet",
];

const onboardingSteps = [
  "Browse offers",
  "Request approval",
  "Promote after approval",
  "Track results",
];

export default function AffiliateOnboardingV1() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [requestingOfferId, setRequestingOfferId] = useState<string | null>(null);
  const [requestedOfferTitle, setRequestedOfferTitle] = useState<string>("");
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progressLabel = useMemo(() => (step === 4 ? "Complete" : `Step ${step} of 4`), [step]);
  const progressPercent = useMemo(() => (step >= 4 ? 100 : (step / 4) * 100), [step]);

  useEffect(() => {
    if (step !== 3) return;
    const loadOffers = async () => {
      setLoadingOffers(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: offerErr } = await (supabase as any)
        .from("offers")
        .select("id,title,commission,type,logo_url,commission_value,business_email,description,website")
        .limit(24);

      if (offerErr) {
        setError(offerErr.message || "Could not load offers");
        setOffers([]);
      } else {
        setOffers((data || []) as Offer[]);
      }
      setLoadingOffers(false);
    };

    void loadOffers();
  }, [step]);

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  };

  const submitFirstRequest = async (offer: Offer) => {
    setError(null);
    setRequestingOfferId(offer.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const email = user?.email;
    if (!email) {
      setError("You need to be logged in to request an offer.");
      setRequestingOfferId(null);
      return;
    }

    if (!offer.business_email) {
      setError("This offer is missing business details. Please choose another offer or contact support.");
      setRequestingOfferId(null);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: reqErr } = await (supabase as any)
      .from("affiliate_requests")
      .upsert(
        {
          offer_id: offer.id,
          affiliate_email: email,
          business_email: offer.business_email,
          status: "pending",
          notes: selectedChannels.length
            ? `Onboarding channels: ${selectedChannels.join(", ")}`
            : "Onboarding request",
        },
        { onConflict: "offer_id,affiliate_email" },
      );

    if (reqErr) {
      setError(reqErr.message || "Failed to submit request.");
      setRequestingOfferId(null);
      return;
    }

    try {
      await fetch("/api/profile/onboarding-complete", { method: "POST" });
    } catch (err) {
      console.warn("[PartnerOnboarding] onboarding-complete failed", err);
    }

    setRequestedOfferTitle(offer.title || "Offer");
    setRequestingOfferId(null);
    setStep(4);
  };

  function handleOpenAssistant() {
    if (typeof window === "undefined") return;

    const chatbase = (
      window as Window & {
        chatbase?: ((command: string, ...args: unknown[]) => unknown) & {
          open?: () => unknown;
        };
      }
    ).chatbase;

    if (typeof chatbase?.open === "function") {
      chatbase.open();
      return;
    }

    if (typeof chatbase === "function") {
      chatbase("open");
    }
  }

  return (
    <main
      className="min-h-screen px-4 py-8 text-white sm:px-6 sm:py-10"
      style={{ background: "#05080b" }}
    >
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#0b1015] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="border-b border-white/10 bg-gradient-to-br from-[#102124] via-[#0b1015] to-[#05080b] p-6 sm:p-8">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#7ff5fb]/70">Affiliate onboarding</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Start promoting with Nettmark
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                Choose an offer from the marketplace, request approval, then promote it through paid ads or organic content once approved.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAssistant}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-4 py-2 text-sm font-semibold text-[#7ff5fb] transition hover:bg-[#00C2CB]/15"
            >
              <MessageCircle className="h-4 w-4" />
              Stuck? Talk to the Nettmark bot
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">{progressLabel}</p>
              <p className="text-xs text-white/55">{Math.round(progressPercent)}%</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#00C2CB] transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {onboardingSteps.map((label, idx) => (
                <div
                  key={label}
                  className={`rounded-2xl border px-3 py-3 text-xs ${
                    idx + 1 <= step
                      ? "border-[#00C2CB]/30 bg-[#00C2CB]/10 text-[#d8fdff]"
                      : "border-white/10 bg-white/[0.03] text-white/45"
                  }`}
                >
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    Step {idx + 1}
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
        {step === 1 && (
          <section className="space-y-5">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How Nettmark works</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">1. Browse offers</p>
                <p className="mt-2 text-sm text-white/60">Find a business you want to promote.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">2. Request approval</p>
                <p className="mt-2 text-sm text-white/60">The business must approve you before you promote.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">3. Promote and track</p>
                <p className="mt-2 text-sm text-white/60">Use paid ads or organic content, then track clicks and commissions.</p>
              </div>
            </div>
            <button onClick={() => setStep(2)} className="rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]">Get started</button>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <h2 className="text-2xl font-semibold">How do you want to promote?</h2>
            <p className="text-sm text-white/65">Pick what fits you. You can change this later.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {channels.map((channel) => {
                const active = selectedChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    onClick={() => toggleChannel(channel)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      active
                        ? "border-[#00C2CB] bg-[#00C2CB]/15 text-[#7ff5fb]"
                        : "border-white/15 bg-white/5 text-white/80 hover:border-[#00C2CB]/40"
                    }`}
                  >
                    {channel}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(3)} className="rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]">Continue</button>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-5">
            <h2 className="text-2xl font-semibold">Choose your first offer</h2>
            <p className="text-sm text-white/65">Browse offers, choose one you understand, and request approval before promoting it.</p>
            {loadingOffers ? (
              <p className="text-sm text-white/65">Loading offers…</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {offers.length === 0 && (
                  <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 text-sm text-white/65 sm:col-span-2 lg:col-span-3">
                    No offers are available yet. Check the marketplace again soon or ask the Nettmark bot for help.
                  </div>
                )}
                {offers.map((offer) => (
                  <article key={offer.id} className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                    <Link href={`/affiliate/marketplace/${offer.id}`} className="block">
                      <div className="mb-3 h-28 w-full overflow-hidden rounded-xl bg-black/20">
                        {offer.logo_url ? (
                          <img src={offer.logo_url} alt={offer.title} className="h-full w-full object-contain p-4" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-white/45">No product image</div>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold leading-tight hover:text-[#00C2CB]">{offer.title}</h3>
                    </Link>

                    <p className="mt-1 text-sm text-[#00C2CB]">Earn up to ${offer.commission_value ?? Math.round((offer.commission || 0) * 2)} per sale</p>
                    <p className="mt-1 text-xs text-white/55">Category: {offer.type || "General"}</p>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setPreviewOfferId((prev) => (prev === offer.id ? null : offer.id))}
                        className="flex-1 rounded-xl border border-white/20 px-3 py-2 text-center text-xs font-medium text-white/90 hover:border-[#00C2CB]/40"
                      >
                        {previewOfferId === offer.id ? "Hide preview" : "View offer"}
                      </button>
                      <button
                        onClick={() => submitFirstRequest(offer)}
                        disabled={requestingOfferId === offer.id}
                        className="flex-1 rounded-xl bg-[#00C2CB] px-3 py-2 text-xs font-semibold text-black hover:bg-[#00b0b8] disabled:opacity-60"
                      >
                        {requestingOfferId === offer.id ? "Submitting…" : "Request approval"}
                      </button>
                    </div>

                    {previewOfferId === offer.id && (
                      <div className="mt-3 rounded-xl border border-white/12 bg-[#11161f] p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Offer preview</p>
                        <p className="mt-2 line-clamp-4 text-xs text-white/70">{offer.description || "No description provided yet."}</p>
                        <div className="mt-2 flex gap-2">
                          {offer.website ? (
                            <a href={offer.website} target="_blank" rel="noreferrer" className="rounded-lg border border-white/20 px-2 py-1 text-[11px] text-white/90 hover:border-[#00C2CB]/40">Open brand site</a>
                          ) : null}
                          <Link href={`/affiliate/marketplace/${offer.id}`} className="rounded-lg border border-white/20 px-2 py-1 text-[11px] text-white/90 hover:border-[#00C2CB]/40">Full offer page</Link>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <div className="text-4xl">🚀</div>
            <h2 className="text-3xl font-semibold">Request sent</h2>
            <p className="text-white/70">
              The business will review your request for {requestedOfferTitle}. You can track the request from your main affiliate dashboard.
            </p>
            <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-sm text-white/75">
              <p className="font-medium text-white">What happens next:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>The business approves or declines your request.</li>
                <li>If approved, the offer appears in your approved offers area.</li>
                <li>Then you can submit an organic post or paid campaign for review.</li>
              </ul>
            </div>
            <button onClick={() => router.push("/affiliate/dashboard")} className="rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]">Go to dashboard</button>
          </section>
        )}

        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        </div>
      </div>
    </main>
  );
}
