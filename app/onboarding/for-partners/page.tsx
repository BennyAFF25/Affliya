"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  MessageCircle,
  X,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

type Offer = {
  id: string;
  title: string;
  description?: string | null;
  commission: number | null;
  commission_value?: number | null;
  type?: string | null;
  logo_url?: string | null;
  hero_image_url?: string | null;
  image_urls?: string[] | null;
  business_email?: string | null;
  business_name?: string | null;
  price?: number | null;
  currency?: string | null;
  meta_page_id?: string | null;
  meta_ad_account_id?: string | null;
};

type PromotionMethod = "paid" | "organic" | "both" | "unsure";

const onboardingSteps = [
  "How it works",
  "Promotion preferences",
  "Choose an offer",
  "Request sent",
];

const promotionMethods: Array<{
  value: PromotionMethod;
  label: string;
  storedValues: string[];
}> = [
  { value: "paid", label: "Paid ads", storedValues: ["Paid ads"] },
  {
    value: "organic",
    label: "Organic content",
    storedValues: ["Organic posts"],
  },
  { value: "both", label: "Both", storedValues: ["Paid ads", "Organic posts"] },
  { value: "unsure", label: "Not sure yet", storedValues: ["Not sure yet"] },
];

const platformOptions = [
  { label: "TikTok", storedValue: "TikTok content" },
  { label: "Instagram", storedValue: "Instagram content" },
  { label: "YouTube", storedValue: "YouTube" },
];

function formatMoney(
  amount: number | null | undefined,
  currency?: string | null,
) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const normalizedCurrency = (currency || "USD").toUpperCase();

  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: Number(amount) >= 100 ? 0 : 2,
    }).format(Number(amount));
  } catch {
    return `${normalizedCurrency} ${Number(amount).toFixed(2)}`;
  }
}

function formatCommissionType(type?: string | null) {
  if (!type) return null;
  if (["one-time", "one_time", "one time"].includes(type.toLowerCase())) {
    return "One-time";
  }
  if (type.toLowerCase() === "recurring") return "Recurring";
  return type;
}

function getOfferImage(offer: Offer) {
  if (offer.hero_image_url) return offer.hero_image_url;
  if (Array.isArray(offer.image_urls) && offer.image_urls[0])
    return offer.image_urls[0];
  if (offer.logo_url) return offer.logo_url;
  return null;
}

function getPromotionLabel(offer: Offer) {
  const adsEnabled = Boolean(offer.meta_page_id && offer.meta_ad_account_id);
  return adsEnabled ? "Paid ads + organic" : "Organic content";
}

function getPayoutAmount(offer: Offer) {
  if (typeof offer.commission_value === "number") return offer.commission_value;
  if (typeof offer.price === "number" && typeof offer.commission === "number") {
    return (offer.price * offer.commission) / 100;
  }
  return null;
}

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const { session, isLoading } = useSessionContext();

  const [step, setStep] = useState(1);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [submittingOfferId, setSubmittingOfferId] = useState<string | null>(
    null,
  );
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
      let { data, error } = await (supabase as any)
        .from("offers")
        .select(
          "id,title,description,commission,commission_value,type,logo_url,hero_image_url,image_urls,business_email,business_name,price,currency,meta_page_id,meta_ad_account_id",
        )
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) {
        console.error("[onboarding] extended offers load failed", error);
        // Fallback keeps onboarding usable if an older database is missing newer image/payout columns.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fallback = await (supabase as any)
          .from("offers")
          .select("id,title,commission,type,logo_url,business_email")
          .order("created_at", { ascending: false })
          .limit(12);
        data = fallback.data;
        error = fallback.error;
      }

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

  const currentStepTitle = useMemo(() => {
    if (step === 2) return "Choose how you want to promote";
    if (step === 3) return "Choose your first offer";
    if (step === 4) return "Request sent";
    return "Start promoting with Nettmark";
  }, [step]);

  const selectedMethod = useMemo<PromotionMethod | null>(() => {
    const hasPaid = selectedChannels.includes("Paid ads");
    const hasOrganic = selectedChannels.includes("Organic posts");
    const unsure = selectedChannels.includes("Not sure yet");

    if (unsure) return "unsure";
    if (hasPaid && hasOrganic) return "both";
    if (hasPaid) return "paid";
    if (hasOrganic) return "organic";
    return null;
  }, [selectedChannels]);

  const showPlatforms =
    selectedMethod === "organic" || selectedMethod === "both";
  const canContinuePreferences = Boolean(selectedMethod);
  const progressPercent = (step / onboardingSteps.length) * 100;

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

  const choosePromotionMethod = (method: PromotionMethod) => {
    const option = promotionMethods.find((item) => item.value === method);
    if (!option) return;

    setSelectedChannels((prev) => {
      const platformSelections = prev.filter((value) =>
        platformOptions.some((platform) => platform.storedValue === value),
      );

      if (method === "paid" || method === "unsure") {
        return [...option.storedValues];
      }

      return [...option.storedValues, ...platformSelections];
    });
  };

  const togglePlatform = (storedValue: string) => {
    setSelectedChannels((prev) =>
      prev.includes(storedValue)
        ? prev.filter((value) => value !== storedValue)
        : [...prev, storedValue],
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
      setRequestError(
        err instanceof Error ? err.message : "Could not submit request.",
      );
    } finally {
      setSubmittingOfferId(null);
    }
  };

  const renderSelectableButton = ({
    label,
    selected,
    onClick,
  }: {
    label: string;
    selected: boolean;
    onClick: () => void;
  }) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
        selected
          ? "border-[#00C2CB] bg-[#00C2CB]/12 text-white shadow-[0_0_0_1px_rgba(0,194,203,0.18)]"
          : "border-white/10 bg-white/[0.035] text-white/78 hover:border-white/20 hover:bg-white/[0.055]"
      }`}
      aria-pressed={selected}
    >
      <span>{label}</span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected
            ? "border-[#00C2CB] bg-[#00C2CB] text-black"
            : "border-white/18 text-transparent"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );

  return (
    <main className="min-h-screen bg-[#05080b] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 text-white sm:px-6 sm:pt-8 lg:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[28px] border border-white/10 bg-[#111617]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:p-6 lg:p-8">
          {step === 1 ? (
            <section className="mx-auto max-w-2xl py-4 text-center sm:py-8">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10">
                <CheckCircle2 className="h-6 w-6 text-[#7ff5fb]" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Start promoting with Nettmark
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
                Choose an offer, request approval and submit your promotion for
                the business to review.
              </p>

              <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
                {[
                  "Choose an offer",
                  "Request approval",
                  "Submit your promotion",
                  "Track results",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                  >
                    <span className="text-xs font-semibold text-[#7ff5fb]">
                      {index + 1}
                    </span>
                    <p className="mt-1 text-xs font-medium leading-5 text-white/78">
                      {item}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Get started <ChevronRight className="h-4 w-4" />
              </button>
            </section>
          ) : (
            <>
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff5fb]">
                      Step {step} of 4
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                      {currentStepTitle}
                    </h1>
                  </div>
                  <p className="text-xs text-white/45">
                    {onboardingSteps[step - 1]}
                  </p>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#00C2CB] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {step === 2 && (
                <section>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      How do you want to promote?
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-white/60">
                      Choose what suits you. You can change this later.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {promotionMethods.map((method) =>
                        renderSelectableButton({
                          label: method.label,
                          selected: selectedMethod === method.value,
                          onClick: () => choosePromotionMethod(method.value),
                        }),
                      )}
                    </div>
                  </div>

                  {showPlatforms && (
                    <div className="mt-7 border-t border-white/10 pt-6">
                      <h3 className="text-xl font-semibold text-white">
                        Which platforms do you use?
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-white/60">
                        Select all that apply.
                      </p>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {platformOptions.map((platform) =>
                          renderSelectableButton({
                            label: platform.label,
                            selected: selectedChannels.includes(
                              platform.storedValue,
                            ),
                            onClick: () => togglePlatform(platform.storedValue),
                          }),
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-7 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!canContinuePreferences}
                      className={`min-h-12 rounded-xl px-5 py-3 text-sm font-semibold transition ${
                        canContinuePreferences
                          ? "bg-[#00C2CB] text-black hover:bg-[#28d3da]"
                          : "cursor-not-allowed border border-white/10 bg-white/[0.035] text-white/35"
                      }`}
                    >
                      Continue
                    </button>
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <p className="text-sm leading-6 text-white/65">
                    Browse available offers and request to work with a business.
                  </p>
                  {requestError && (
                    <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {requestError}
                    </p>
                  )}

                  {loadingOffers ? (
                    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                      <Loader2 className="h-4 w-4 animate-spin text-[#7ff5fb]" />
                      Loading offers...
                    </div>
                  ) : offers.length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/72">
                      No offers are available right now. Please try again in a
                      minute.
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/82 transition hover:bg-white/[0.04]"
                        >
                          Reload offers
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push("/affiliate/marketplace")}
                          className="min-h-11 rounded-xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
                        >
                          Open marketplace
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {offers.map((offer) => {
                        const image = getOfferImage(offer);
                        const payout = formatMoney(
                          getPayoutAmount(offer),
                          offer.currency,
                        );
                        const price = formatMoney(offer.price, offer.currency);
                        const commissionType = formatCommissionType(offer.type);

                        return (
                          <article
                            key={offer.id}
                            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_14px_35px_rgba(0,0,0,0.22)]"
                          >
                            {image ? (
                              <img
                                src={image}
                                alt={offer.title}
                                className="h-36 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-36 w-full items-center justify-center bg-[#0c1112] text-3xl font-bold text-[#7ff5fb]">
                                {(offer.title || "O").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="p-4">
                              <p className="text-xs font-medium text-white/45">
                                {offer.business_name || "Nettmark business"}
                              </p>
                              <h3 className="mt-1 line-clamp-2 text-base font-semibold text-white">
                                {offer.title}
                              </h3>
                              <p className="mt-2 text-lg font-bold text-[#7ff5fb]">
                                {payout
                                  ? `Earn ${payout} per sale`
                                  : `${Number(offer.commission || 0)}% commission`}
                              </p>

                              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/62">
                                {price && (
                                  <div className="rounded-xl bg-black/20 p-3">
                                    <dt className="text-white/38">
                                      Product price
                                    </dt>
                                    <dd className="mt-1 font-semibold text-white/82">
                                      {price}
                                    </dd>
                                  </div>
                                )}
                                <div className="rounded-xl bg-black/20 p-3">
                                  <dt className="text-white/38">Commission</dt>
                                  <dd className="mt-1 font-semibold text-white/82">
                                    {Number(offer.commission || 0)}%
                                  </dd>
                                </div>
                                <div className="rounded-xl bg-black/20 p-3">
                                  <dt className="text-white/38">Promotion</dt>
                                  <dd className="mt-1 font-semibold text-white/82">
                                    {getPromotionLabel(offer)}
                                  </dd>
                                </div>
                                {commissionType && (
                                  <div className="rounded-xl bg-black/20 p-3">
                                    <dt className="text-white/38">
                                      Commission type
                                    </dt>
                                    <dd className="mt-1 font-semibold text-white/82">
                                      {commissionType}
                                    </dd>
                                  </div>
                                )}
                              </dl>

                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => setPreviewOffer(offer)}
                                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white/82 transition hover:bg-white/[0.04]"
                                >
                                  <Eye className="h-4 w-4" /> View offer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => submitFirstRequest(offer)}
                                  disabled={submittingOfferId === offer.id}
                                  className="min-h-11 flex-1 rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {submittingOfferId === offer.id
                                    ? "Sending..."
                                    : "Request approval"}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {step === 4 && (
                <section className="mx-auto max-w-xl py-2 text-center sm:py-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/10">
                    <CheckCircle2 className="h-7 w-7 text-[#7ff5fb]" />
                  </div>
                  <h2 className="mt-4 text-3xl font-bold tracking-tight">
                    Request sent
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    The business will review your request. We’ll let you know
                    when they respond.
                  </p>

                  <div className="mx-auto mt-5 max-w-md rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left text-sm text-white/72">
                    <p className="font-semibold text-white">
                      What happens next
                    </p>
                    <ul className="mt-3 space-y-2">
                      <li className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7ff5fb]" />
                        <span>
                          The business approves or declines your request.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7ff5fb]" />
                        <span>
                          If approved, the offer appears in your dashboard.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7ff5fb]" />
                        <span>
                          You can then submit a paid ad or organic post for
                          review.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={() => router.replace("/affiliate/dashboard")}
                      className="min-h-12 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
                    >
                      Go to dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="min-h-12 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/82 transition hover:bg-white/[0.04]"
                    >
                      Browse more offers
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpenAssistant}
        aria-label="Talk to the Nettmark bot"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#00C2CB]/30 bg-[#0c1112] text-[#7ff5fb] shadow-[0_14px_40px_rgba(0,0,0,0.45)] transition hover:bg-[#00C2CB]/10 sm:bottom-6 sm:right-6"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {previewOffer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/12 bg-[#111617] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-white/45">
                  {previewOffer.business_name || "Nettmark business"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  {previewOffer.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOffer(null)}
                className="rounded-lg border border-white/10 p-2 text-white/80 transition hover:bg-white/[0.04]"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {getOfferImage(previewOffer) ? (
              <img
                src={getOfferImage(previewOffer) || ""}
                alt={previewOffer.title}
                className="mt-3 h-40 w-full rounded-xl border border-white/10 object-cover"
              />
            ) : (
              <div className="mt-3 flex h-40 w-full items-center justify-center rounded-xl border border-white/10 bg-[#0c1112] text-3xl font-bold text-[#7ff5fb]">
                {(previewOffer.title || "O").slice(0, 1).toUpperCase()}
              </div>
            )}

            <p className="mt-3 text-lg font-bold text-[#7ff5fb]">
              {formatMoney(getPayoutAmount(previewOffer), previewOffer.currency)
                ? `Earn ${formatMoney(
                    getPayoutAmount(previewOffer),
                    previewOffer.currency,
                  )} per sale`
                : `${Number(previewOffer.commission || 0)}% commission`}
            </p>
            {previewOffer.description && (
              <p className="mt-2 text-sm leading-6 text-white/68">
                {previewOffer.description}
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/62">
              {formatMoney(previewOffer.price, previewOffer.currency) && (
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-white/38">Product price</p>
                  <p className="mt-1 font-semibold text-white/82">
                    {formatMoney(previewOffer.price, previewOffer.currency)}
                  </p>
                </div>
              )}
              <div className="rounded-xl bg-black/20 p-3">
                <p className="text-white/38">Commission</p>
                <p className="mt-1 font-semibold text-white/82">
                  {Number(previewOffer.commission || 0)}%
                </p>
              </div>
              <div className="rounded-xl bg-black/20 p-3">
                <p className="text-white/38">Promotion</p>
                <p className="mt-1 font-semibold text-white/82">
                  {getPromotionLabel(previewOffer)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPreviewOffer(null);
                submitFirstRequest(previewOffer);
              }}
              disabled={submittingOfferId === previewOffer.id}
              className="mt-4 w-full rounded-xl bg-[#00C2CB] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submittingOfferId === previewOffer.id
                ? "Sending..."
                : "Request approval"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
