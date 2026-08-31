"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, MessageCircle, Store, X } from "lucide-react";
import { logProductEvent } from "@/../utils/productEvents";
import type { ContentLibraryAsset } from "@/../utils/contentLibrary";

type PromotionPreference = "paid" | "organic" | "both" | "guided";

type PartnerOffer = {
  id: string;
  title: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  subscriptionLabel?: string | null;
  commissionLabel?: string | null;
};

type ReadyPromotion = {
  offer: {
    id: string;
    title: string;
  };
  campaign: {
    id: string;
    trackingLink: string;
  };
  creative: {
    id: string;
    title?: string | null;
    caption?: string | null;
    mediaUrl: string;
    mediaType: string;
    thumbnailUrl?: string | null;
  };
};

const preferenceCards: Array<{
  value: PromotionPreference;
  title: string;
  description: string;
}> = [
  {
    value: "paid",
    title: "Paid ads",
    description: "We’ll get your first Nettmark promotion ready now, then you can expand into paid campaigns from the dashboard.",
  },
  {
    value: "organic",
    title: "Organic content",
    description: "Start with ready-made content, your unique link, and everything needed to share right away.",
  },
  {
    value: "both",
    title: "Both",
    description: "Start with the fastest organic path first, then reuse the same offer and content for paid reach later.",
  },
  {
    value: "guided",
    title: "Help me get started",
    description: "We’ll guide you to the easiest first promotion so you can start distributing immediately.",
  },
];

const onboardingSteps = [
  "Choose how you want to promote",
  "Get your first offer",
  "Choose your content",
  "Start promoting",
];

function safeAssetUrl(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

export default function AffiliateOnboardingV1() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [preference, setPreference] = useState<PromotionPreference | null>(null);
  const [offer, setOffer] = useState<PartnerOffer | null>(null);
  const [brandCreatives, setBrandCreatives] = useState<ContentLibraryAsset[]>([]);
  const [selectedCreative, setSelectedCreative] = useState<ContentLibraryAsset | null>(null);
  const [readyPromotion, setReadyPromotion] = useState<ReadyPromotion | null>(null);
  const [previewCreative, setPreviewCreative] = useState<ContentLibraryAsset | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [activatingOffer, setActivatingOffer] = useState(false);
  const [creatingPromotion, setCreatingPromotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewedCreativeEventSent, setViewedCreativeEventSent] = useState(false);

  const progressLabel = useMemo(() => (step >= 5 ? "Complete" : `Step ${Math.min(step, 4)} of 4`), [step]);
  const progressPercent = useMemo(() => {
    if (step >= 5) return 100;
    if (step <= 1) return 25;
    if (step === 2) return 50;
    if (step === 3) return 75;
    return 90;
  }, [step]);

  useEffect(() => {
    void logProductEvent({
      eventType: "onboarding_started",
      actorRole: "affiliate",
      meta: { source: "for-partners-v1" },
    });
  }, []);

  useEffect(() => {
    if (step < 3 || offer) return;

    const loadOffer = async () => {
      setLoadingOffer(true);
      setError(null);
      try {
        const res = await fetch("/api/onboarding/partner-programme", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Could not load the Nettmark Partner Programme.");
        }

        setOffer(json.offer as PartnerOffer);
        setBrandCreatives((json.assets || []) as ContentLibraryAsset[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Could not load the Nettmark Partner Programme.");
      } finally {
        setLoadingOffer(false);
      }
    };

    void loadOffer();
  }, [offer, step]);

  useEffect(() => {
    if (step !== 4 || viewedCreativeEventSent || !offer?.id) return;
    setViewedCreativeEventSent(true);
    void logProductEvent({
      eventType: "first_creative_viewed",
      actorRole: "affiliate",
      offerId: offer.id,
      promotionType: "organic",
      meta: { assetCount: brandCreatives.length },
    });
  }, [brandCreatives.length, offer?.id, step, viewedCreativeEventSent]);

  const preferredCreatives = useMemo(
    () => [...brandCreatives].sort((a, b) => Number(Boolean(b.organic_preapproved)) - Number(Boolean(a.organic_preapproved))),
    [brandCreatives],
  );

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text);
      setError(success);
      window.setTimeout(() => {
        setError((prev) => (prev === success ? null : prev));
      }, 1800);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  async function continueFromPreference() {
    if (!preference) {
      setError("Choose how you want to promote first.");
      return;
    }

    setError(null);
    void logProductEvent({
      eventType: "promotion_preference_selected",
      actorRole: "affiliate",
      promotionType: preference === "paid" ? "paid" : "organic",
      meta: { preference },
    });
    setStep(3);
  }

  async function activatePartnerOffer() {
    setActivatingOffer(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/partner-programme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not activate the Nettmark Partner Programme.");
      }

      setOffer((json.offer || offer) as PartnerOffer);
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not activate the Nettmark Partner Programme.");
    } finally {
      setActivatingOffer(false);
    }
  }

  async function makeFirstPromotionReady() {
    if (!selectedCreative) {
      setError("Choose a creative first.");
      return;
    }

    setCreatingPromotion(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/ready-first-promotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessCreativeId: selectedCreative.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not prepare your first promotion.");
      }

      setReadyPromotion(json as ReadyPromotion);
      setStep(5);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not prepare your first promotion.");
    } finally {
      setCreatingPromotion(false);
    }
  }

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

  const readyCreativeUrl = safeAssetUrl(readyPromotion?.creative.mediaUrl);
  const readyPosterUrl = safeAssetUrl(readyPromotion?.creative.thumbnailUrl || null);
  const previewCreativeUrl = safeAssetUrl(previewCreative?.media_url);
  const previewPosterUrl = safeAssetUrl(previewCreative?.thumbnail_url);

  return (
    <main className="min-h-screen px-4 py-8 text-white sm:px-6 sm:py-10" style={{ background: "#05080b" }}>
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#0b1015] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="border-b border-white/10 bg-gradient-to-br from-[#102124] via-[#0b1015] to-[#05080b] p-6 sm:p-8">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#7ff5fb]/70">Affiliate onboarding</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Start promoting with Nettmark
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                We&apos;ll help you create your first real promotion now — choose how you want to promote and we&apos;ll guide you the rest of the way.
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
                    idx + 1 < step || step >= 5
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
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your first promotion starts here</h2>
              <div className="rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/10 p-4 text-sm text-[#d8fdff]">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl border border-[#00C2CB]/25 bg-[#06191c] p-2 text-[#7ff5fb]">
                    <Store className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">This is your fast start — not the whole marketplace.</p>
                    <p className="mt-1 text-[#d8fdff]/85">
                      We&apos;ll start you with the Nettmark Partner Programme so you can begin immediately, then you can explore and promote more marketplace offers from your dashboard.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">1. Choose how to promote</p>
                  <p className="mt-2 text-sm text-white/60">Pick the path that fits you best.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">2. Get your first offer</p>
                  <p className="mt-2 text-sm text-white/60">Start with the Nettmark Partner Programme.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">3. Choose your content</p>
                  <p className="mt-2 text-sm text-white/60">Use ready-made creative from Nettmark&apos;s content library.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">4. Start promoting</p>
                  <p className="mt-2 text-sm text-white/60">Get your tracking link, caption, and creative ready to share.</p>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                className="rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]"
              >
                Get started
              </button>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">How do you want to promote?</h2>
                <p className="mt-2 text-sm text-white/65">For this first run, we&apos;ll guide you through the fastest organic activation path so you finish with something real and attributable.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {preferenceCards.map((card) => {
                  const active = preference === card.value;
                  return (
                    <button
                      key={card.value}
                      type="button"
                      onClick={() => {
                        setPreference(card.value);
                        setError(null);
                      }}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-[#00C2CB] bg-[#00C2CB]/15 text-[#d8fdff]"
                          : "border-white/15 bg-white/5 text-white/85 hover:border-[#00C2CB]/35"
                      }`}
                    >
                      <p className="text-sm font-semibold">{card.title}</p>
                      <p className="mt-2 text-sm text-white/65">{card.description}</p>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={continueFromPreference}
                className="rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]"
              >
                Continue
              </button>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Your first offer</h2>
                <p className="mt-2 text-sm text-white/65">Start with Nettmark&apos;s own partner programme so you can begin promoting immediately instead of waiting on approvals.</p>
                <p className="mt-2 text-sm text-white/50">Once you&apos;re through this quick-start flow, you&apos;ll be able to browse the wider marketplace and promote other approved offers too.</p>
              </div>

              {loadingOffer ? (
                <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 text-sm text-white/65">Loading Nettmark Partner Programme…</div>
              ) : offer ? (
                <article className="rounded-[2rem] border border-[#00C2CB]/20 bg-gradient-to-br from-[#0d1b1e] via-[#0b1015] to-[#0a0d10] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <div className="inline-flex rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7ff5fb]">
                        Nettmark Partner Programme
                      </div>
                      <h3 className="mt-4 text-3xl font-semibold text-white">{offer.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-white/70">
                        {offer.description || "Help businesses discover Nettmark, share a ready-made promotion, and let Nettmark handle the tracking for you."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-white/75">Ready-made content available</span>
                        <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-white/75">Tracking handled by Nettmark</span>
                        <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-white/75">Start immediately</span>
                      </div>
                    </div>

                    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Offer details</p>
                      <div className="mt-3 space-y-3 text-sm text-white/80">
                        <div>
                          <p className="text-white/55">Subscription</p>
                          <p className="font-semibold text-white">{offer.subscriptionLabel || "Monthly Nettmark subscription"}</p>
                        </div>
                        <div>
                          <p className="text-white/55">Commission</p>
                          <p className="font-semibold text-white">{offer.commissionLabel || "Recurring commission handled by Nettmark"}</p>
                        </div>
                        <div>
                          <p className="text-white/55">Ready-to-use creative</p>
                          <p className="font-semibold text-white">{preferredCreatives.length} organic creative{preferredCreatives.length === 1 ? "" : "s"} ready now</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={activatePartnerOffer}
                      disabled={activatingOffer}
                      className="rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8] disabled:opacity-60"
                    >
                      {activatingOffer ? "Preparing…" : "Start with this offer"}
                    </button>
                    <Link
                      href="/affiliate/marketplace"
                      className="rounded-full border border-white/10 bg-[#111317] px-6 py-3 text-sm font-semibold text-white/80 hover:bg-[#15191c]"
                    >
                      Explore the marketplace
                    </Link>
                  </div>
                </article>
              ) : (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
                  We couldn&apos;t load the Nettmark Partner Programme right now.
                </div>
              )}
            </section>
          )}

          {step === 4 && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Choose your first promotion</h2>
                <p className="mt-2 text-sm text-white/65">Use a ready-made Nettmark creative. If it&apos;s already pre-approved for organic use, you can start promoting immediately.</p>
                <p className="mt-2 text-sm text-white/50">You can preview each creative before choosing it, and you can always come back later for more Nettmark content or other marketplace offers.</p>
              </div>

              {preferredCreatives.length === 0 ? (
                <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 text-sm text-white/65">
                  No organic Nettmark creatives are ready yet. You can head to the dashboard or marketplace while content is being prepared.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {preferredCreatives.map((asset) => {
                    const selected = selectedCreative?.id === asset.id;
                    const mediaUrl = safeAssetUrl(asset.media_url);
                    const posterUrl = safeAssetUrl(asset.thumbnail_url);
                    return (
                      <div
                        key={asset.id}
                        className={`overflow-hidden rounded-3xl border text-left transition ${
                          selected
                            ? "border-[#00C2CB] bg-[#0d1f21] shadow-[0_0_24px_rgba(0,194,203,0.16)]"
                            : "border-white/12 bg-white/[0.03] hover:border-[#00C2CB]/35"
                        }`}
                      >
                        <div className="aspect-[4/3] bg-black">
                          {asset.media_type === "video" ? (
                            mediaUrl ? (
                              <video className="h-full w-full object-cover" poster={posterUrl || undefined} muted playsInline>
                                <source src={mediaUrl} />
                              </video>
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-white/45">Preview unavailable</div>
                            )
                          ) : mediaUrl ? (
                            <img src={mediaUrl} alt={asset.title || "Brand creative"} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-white/45">Preview unavailable</div>
                          )}
                        </div>
                        <div className="space-y-3 p-4">
                          <div>
                            <div className="text-base font-semibold text-white">{asset.title || "Untitled creative"}</div>
                            <div className="mt-1 line-clamp-3 text-sm text-white/65">{asset.caption || "Ready-to-use Nettmark partner content."}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/70">
                              {asset.media_type === "video" ? "Video" : "Image"}
                            </span>
                            {asset.organic_preapproved && (
                              <span className="rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-2.5 py-1 text-[11px] text-[#7ff5fb]">
                                Organic pre-approved
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCreative(asset);
                                void logProductEvent({
                                  eventType: "first_creative_selected",
                                  actorRole: "affiliate",
                                  offerId: offer?.id,
                                  businessCreativeId: asset.id,
                                  promotionType: "organic",
                                  meta: { mediaType: asset.media_type },
                                });
                              }}
                              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                                selected
                                  ? "bg-[#00C2CB] text-black"
                                  : "bg-[#111317] text-white/85 hover:bg-[#15191c]"
                              }`}
                            >
                              {selected ? "Selected" : "Choose this creative"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewCreative(asset)}
                              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-transparent px-4 py-2 text-xs font-semibold text-white/75 transition hover:border-[#00C2CB]/35 hover:text-white"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview content
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={makeFirstPromotionReady}
                  disabled={!selectedCreative || creatingPromotion}
                  className="rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8] disabled:opacity-60"
                >
                  {creatingPromotion ? "Preparing your promotion…" : "Make this my first promotion"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-full border border-white/10 bg-[#111317] px-6 py-3 text-sm font-semibold text-white/80 hover:bg-[#15191c]"
                >
                  Back
                </button>
              </div>
            </section>
          )}

          {step >= 5 && readyPromotion && (
            <section className="space-y-5">
              <div className="text-4xl">🚀</div>
              <div>
                <h2 className="text-3xl font-semibold">Your first promotion is ready</h2>
                <p className="mt-2 text-white/70">You now have immediate access to the Nettmark Partner Programme, a ready-to-use creative, and your own attributable tracking link.</p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="overflow-hidden rounded-3xl border border-white/12 bg-white/[0.03]">
                  <div className="aspect-[4/3] bg-black">
                    {readyPromotion.creative.mediaType === "video" ? (
                      readyCreativeUrl ? (
                        <video className="h-full w-full object-cover" poster={readyPosterUrl || undefined} controls muted playsInline>
                          <source src={readyCreativeUrl} />
                        </video>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-white/45">Preview unavailable</div>
                      )
                    ) : readyCreativeUrl ? (
                      <img src={readyCreativeUrl} alt={readyPromotion.creative.title || "Selected creative"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/45">Preview unavailable</div>
                    )}
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Offer</p>
                      <p className="mt-1 text-xl font-semibold text-white">{readyPromotion.offer.title}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Suggested caption</p>
                      <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/80">
                        {readyPromotion.creative.caption || "Use your Nettmark tracking link and this creative to start promoting right away."}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Your Nettmark link</p>
                      <div className="mt-2 break-all rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#7ff5fb]">
                        {readyPromotion.campaign.trackingLink}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-white/12 bg-white/[0.03] p-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Actions</p>
                    <div className="mt-3 grid gap-3">
                      <button
                        type="button"
                        onClick={() => copyText(readyPromotion.creative.caption || "", "Caption copied")}
                        className="rounded-2xl border border-white/12 bg-[#111317] px-4 py-3 text-left text-sm font-semibold text-white/85 hover:bg-[#15191c]"
                      >
                        Copy caption
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(readyPromotion.campaign.trackingLink, "Tracking link copied")}
                        className="rounded-2xl border border-white/12 bg-[#111317] px-4 py-3 text-left text-sm font-semibold text-white/85 hover:bg-[#15191c]"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            `${readyPromotion.creative.caption || ""}\n\n${readyPromotion.campaign.trackingLink}`.trim(),
                            "Promotion copied",
                          )
                        }
                        className="rounded-2xl border border-white/12 bg-[#111317] px-4 py-3 text-left text-sm font-semibold text-white/85 hover:bg-[#15191c]"
                      >
                        Copy everything
                      </button>
                      {readyCreativeUrl && (
                        <a
                          href={readyCreativeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-white/12 bg-[#111317] px-4 py-3 text-left text-sm font-semibold text-white/85 hover:bg-[#15191c]"
                        >
                          Download / use creative
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/10 p-4 text-sm text-[#d8fdff]">
                    <p className="font-semibold">Want to take it further?</p>
                    <p className="mt-1 text-[#d8fdff]/85">Once you land on the dashboard, you can also turn this offer into a paid campaign using Nettmark&apos;s existing workflow.</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => readyPromotion?.campaign?.id && router.push(`/affiliate/dashboard/manage-campaigns/${readyPromotion.campaign.id}`)}
                      className="rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]"
                    >
                      Open campaign
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="rounded-full border border-white/10 bg-[#111317] px-6 py-3 text-sm font-semibold text-white/80 hover:bg-[#15191c]"
                    >
                      Get more content
                    </button>
                    <Link
                      href="/affiliate/marketplace"
                      className="rounded-full border border-white/10 bg-[#111317] px-6 py-3 text-center text-sm font-semibold text-white/80 hover:bg-[#15191c]"
                    >
                      Explore more offers
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {error && <p className="mt-4 text-sm text-[#7ff5fb]">{error}</p>}
        </div>
      </div>

      {previewCreative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#0b1015] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <button
              type="button"
              onClick={() => setPreviewCreative(null)}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/12 bg-black/30 p-2 text-white/75 transition hover:text-white"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="min-h-[280px] bg-black">
                {previewCreative?.media_type === "video" ? (
                  previewCreativeUrl ? (
                    <video className="h-full w-full object-contain" poster={previewPosterUrl || undefined} controls playsInline>
                      <source src={previewCreativeUrl} />
                    </video>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/45">Preview unavailable</div>
                  )
                ) : previewCreativeUrl ? (
                  <img src={previewCreativeUrl} alt={previewCreative.title || "Creative preview"} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/45">Preview unavailable</div>
                )}
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Previewing</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{previewCreative.title || "Untitled creative"}</h3>
                  <p className="mt-2 text-sm text-white/65">This is the actual promotional content your affiliate will be able to use for their first Nettmark promotion.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/70">
                    {previewCreative.media_type === "video" ? "Video" : "Image"}
                  </span>
                  {previewCreative.organic_preapproved && (
                    <span className="rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-2.5 py-1 text-[11px] text-[#7ff5fb]">
                      Organic pre-approved
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Suggested caption</p>
                  <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/80">
                    {previewCreative.caption || "Ready-to-use Nettmark partner content."}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCreative(previewCreative);
                      void logProductEvent({
                        eventType: "first_creative_selected",
                        actorRole: "affiliate",
                        offerId: offer?.id,
                        businessCreativeId: previewCreative.id,
                        promotionType: "organic",
                        meta: { mediaType: previewCreative.media_type, source: "preview_modal" },
                      });
                      setPreviewCreative(null);
                    }}
                    className="rounded-full bg-[#00C2CB] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#00b0b8]"
                  >
                    Choose this creative
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewCreative(null)}
                    className="rounded-full border border-white/10 bg-[#111317] px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-[#15191c]"
                  >
                    Close preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
