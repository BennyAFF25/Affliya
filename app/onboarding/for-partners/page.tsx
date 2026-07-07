"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Eye,
  X,
  BadgeDollarSign,
  Tag,
  LayoutGrid,
  MessageCircle,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

type Offer = {
  id: string;
  title: string;
  commission: number | null;
  type?: string | null;
  logo_url?: string | null;
  business_email?: string | null;
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

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const { session, isLoading } = useSessionContext();

  const [step, setStep] = useState(1);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [submittingOfferId, setSubmittingOfferId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [previewOffer, setPreviewOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session?.user) {
      router.replace("/login?role=affiliate&next=/onboarding/for-partners");
    }
  }, [isLoading, session, router]);

  useEffect(() => {
    if (!session?.user) return;
    const loadOffers = async () => {
      setLoadingOffers(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("offers")
        .select("id,title,commission,type,logo_url,business_email")
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) {
        console.error("[onboarding] offers load failed", error);
        setOffers([]);
      } else {
        setOffers((data || []) as Offer[]);
      }
      setLoadingOffers(false);
    };

    void loadOffers();
  }, [session?.user]);

  const progressLabel = useMemo(() => {
    if (step >= 4) return "Complete";
    return `Step ${step} of 4`;
  }, [step]);

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

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel],
    );
  };

  const submitFirstRequest = async (offer: Offer) => {
    if (!session?.user?.email) return;

    setSubmittingOfferId(offer.id);
    setRequestError(null);

    try {
      const email = session.user.email;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("affiliate_requests")
        .select("id")
        .eq("offer_id", offer.id)
        .eq("affiliate_email", email)
        .limit(1)
        .maybeSingle();

      if (!existing?.id) {
        const payload: {
          offer_id: string;
          affiliate_email: string;
          business_email?: string;
          status: "pending";
          notes: string | null;
        } = {
          offer_id: offer.id,
          affiliate_email: email,
          status: "pending",
          notes: selectedChannels.length
            ? `Preferred channels: ${selectedChannels.join(", ")}`
            : null,
        };

        if (offer.business_email) payload.business_email = offer.business_email;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("affiliate_requests")
          .insert(payload);

        if (error) {
          throw new Error(error.message || "Could not submit request.");
        }
      }

      await fetch("/api/profile/onboarding-complete", { method: "POST" }).catch(
        () => null,
      );

      setStep(4);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Could not submit request.");
    } finally {
      setSubmittingOfferId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#05080b] px-4 py-8 text-white sm:px-6 md:flex md:items-center md:justify-center md:py-12">
      <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-[var(--border)] bg-[#1a1a1a] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.5)] md:p-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[#1a1a1a] p-4 md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/50">{progressLabel}</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Start promoting with Nettmark</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                Choose an offer from the marketplace, request approval, then promote it through paid ads or organic content once approved.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAssistant}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-4 py-2 text-sm font-semibold text-[#7ff5fb] transition hover:bg-[#00C2CB]/15"
            >
              <MessageCircle className="h-4 w-4" />
              Stuck? Talk to the Nettmark bot
            </button>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
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

        {step === 1 && (
          <section className="mt-8 md:mt-10">
            <h2 className="text-2xl font-bold sm:text-3xl">How Nettmark works</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
            <button
              onClick={() => setStep(2)}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
            >
              Get started <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="mt-8 md:mt-10">
            <h2 className="text-2xl font-bold">How do you want to promote?</h2>
            <p className="mt-2 text-sm text-white/65">Pick what fits you. You can change this later.</p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {channels.map((channel) => {
                const checked = selectedChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    onClick={() => toggleChannel(channel)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      checked
                        ? "border-[#00C2CB]/60 bg-[#00C2CB]/12 text-white"
                        : "border-[var(--border)] bg-[#1a1a1a] text-white/80 hover:bg-[#202020]"
                    }`}
                  >
                    {channel}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep(3)}
              className="mt-6 rounded-xl border border-[var(--border)] bg-[#1a1a1a] px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-[#202020]"
            >
              Continue
            </button>
          </section>
        )}

        {step === 3 && (
          <section className="mt-8 md:mt-10">
            <h2 className="text-2xl font-bold">Choose your first offer</h2>
            <p className="mt-2 text-sm text-white/65">Browse offers, choose one you understand, and request approval before promoting it.</p>
            {requestError && <p className="mt-3 text-sm text-red-400">{requestError}</p>}

            {loadingOffers ? (
              <div className="mt-6 flex items-center gap-2 text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading offers...
              </div>
            ) : offers.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[#1a1a1a] p-5 text-sm text-white/75">
                No offers are available right now. Please try again in a minute.
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-lg border border-[var(--border)] bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-white/85"
                  >
                    Reload offers
                  </button>
                  <button
                    onClick={() => router.push('/affiliate/marketplace')}
                    className="rounded-lg border border-[var(--border)] bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-white/85"
                  >
                    Open marketplace
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
                {offers.map((offer) => {
                  const estimated = Math.round(Number(offer.commission || 0));
                  const image = offer.logo_url || "/Nettmark-icon.png";
                  return (
                    <article
                      key={offer.id}
                      className="rounded-2xl border border-white/12 bg-[#1a1a1a] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.26)]"
                    >
                      <img
                        src={image}
                        alt={offer.title}
                        className="h-36 w-full rounded-xl border border-white/10 object-cover"
                      />
                      <h3 className="mt-3 text-base font-semibold text-white">{offer.title}</h3>
                      <p className="mt-1 text-sm text-[#7ff5fb]">Earn up to ${estimated} per sale</p>
                      <div className="mt-3 space-y-1.5 text-xs text-white/70">
                        <p className="flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" />Commission: ${Number(offer.commission || 0)}</p>
                        <p className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Category: {offer.type || "General"}</p>
                        <p className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Estimated payout: ${estimated}</p>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          onClick={() => setPreviewOffer(offer)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[#1a1a1a] px-3 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-[#202020]"
                        >
                          <Eye className="h-4 w-4" /> View offer
                        </button>
                        <button
                          onClick={() => submitFirstRequest(offer)}
                          disabled={submittingOfferId === offer.id}
                          className="rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {submittingOfferId === offer.id
                            ? "Submitting..."
                            : "Request approval"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="mt-8 text-center md:mt-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/10">
              <CheckCircle2 className="h-7 w-7 text-[#7ff5fb]" />
            </div>
            <h2 className="mt-4 text-3xl font-bold">Request sent</h2>
            <p className="mt-2 text-sm text-white/70">The business will review your request.</p>
            <div className="mx-auto mt-5 max-w-md rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-left text-sm text-white/75">
              <p className="font-medium text-white">What happens next:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>The business approves or declines your request.</li>
                <li>If approved, the offer appears in your dashboard.</li>
                <li>Then you can submit a paid ad or organic post for review.</li>
              </ul>
            </div>
            <button
              onClick={() => router.replace("/affiliate/dashboard")}
              className="mt-6 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
            >
              Go to dashboard
            </button>
          </section>
        )}

        {previewOffer && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#1a1a1a] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{previewOffer.title}</h3>
                <button
                  onClick={() => setPreviewOffer(null)}
                  className="rounded-lg border border-[var(--border)] bg-[#1a1a1a] p-1.5 text-white/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <img
                src={previewOffer.logo_url || "/Nettmark-icon.png"}
                alt={previewOffer.title}
                className="mt-3 h-40 w-full rounded-xl border border-white/10 object-cover"
              />
              <div className="mt-3 space-y-2 text-sm text-white/75">
                <p className="flex items-center gap-2"><BadgeDollarSign className="h-4 w-4" />Commission: ${Number(previewOffer.commission || 0)}</p>
                <p className="flex items-center gap-2"><Tag className="h-4 w-4" />Category: {previewOffer.type || "General"}</p>
                <p className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" />Estimated payout: ${Math.round(Number(previewOffer.commission || 0))}</p>
              </div>
              <button
                onClick={() => {
                  setPreviewOffer(null);
                  submitFirstRequest(previewOffer);
                }}
                className="mt-4 w-full rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Request approval
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
