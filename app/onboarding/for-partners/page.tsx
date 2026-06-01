"use client";

import { useEffect, useMemo, useState } from "react";
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
  "Facebook Ads",
  "TikTok Content",
  "Instagram Content",
  "YouTube",
  "Email Marketing",
  "Not Sure Yet",
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
      const { data: existing } = await (supabase as any)
        .from("affiliate_requests")
        .select("id")
        .eq("offer_id", offer.id)
        .eq("affiliate_email", email)
        .limit(1)
        .maybeSingle();

      if (!existing?.id) {
        const payload: any = {
          offer_id: offer.id,
          affiliate_email: email,
          status: "pending",
          notes: selectedChannels.length
            ? `Preferred channels: ${selectedChannels.join(", ")}`
            : null,
        };

        if (offer.business_email) payload.business_email = offer.business_email;

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
    } catch (err: any) {
      setRequestError(err?.message || "Could not submit request.");
    } finally {
      setSubmittingOfferId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#05080b] px-4 py-8 text-white sm:px-6 md:flex md:items-center md:justify-center md:py-12">
      <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-[var(--border)] bg-[#1a1a1a] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.5)] md:p-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[#1a1a1a] p-4 md:p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-white/50">{progressLabel}</p>

        {step === 1 && (
          <section className="mt-8 md:mt-10">
            <h1 className="text-3xl font-bold sm:text-4xl">Welcome to Nettmark</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
              Earn commissions by promoting products and software brands.
            </p>
            <p className="mt-2 max-w-2xl text-sm text-white/65 sm:text-base">
              Choose how you want to promote offers and we will help you get started.
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
            >
              Get Started <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="mt-8 md:mt-10">
            <h2 className="text-2xl font-bold">How do you want to promote?</h2>
            <p className="mt-2 text-sm text-white/65">Personalization only.</p>
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
            <p className="mt-2 text-sm text-white/65">Request promotion to start onboarding completion.</p>
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
                          <Eye className="h-4 w-4" /> View Offer
                        </button>
                        <button
                          onClick={() => submitFirstRequest(offer)}
                          disabled={submittingOfferId === offer.id}
                          className="rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {submittingOfferId === offer.id
                            ? "Submitting..."
                            : "Request Promotion"}
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
            <h2 className="mt-4 text-3xl font-bold">Request Sent</h2>
            <p className="mt-2 text-sm text-white/70">The business will review your request.</p>
            <div className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-white/75">
              <p>Browse more offers</p>
              <p>Learn campaign creation</p>
              <p>Explore organic promotion</p>
            </div>
            <button
              onClick={() => router.replace("/affiliate/dashboard")}
              className="mt-6 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
            >
              Go To Dashboard
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
                Request Promotion
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
