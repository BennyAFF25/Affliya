"use client";

import { useMemo, useState } from "react";
import { nmToast } from "@/components/ui/toast";
import { AdFormState, PlacementKey } from "../types";
import { CountryMultiSelect, DateTimeField, Chip, Disclosure } from "./AdFormFields";
import { INPUT } from "../constants";

interface AdCampaignWizardProps {
  form: AdFormState;
  setForm: React.Dispatch<React.SetStateAction<AdFormState>>;
  onInput: (
    name: keyof AdFormState
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onPlacementToggle: (key: PlacementKey) => void;
  applyEstimatorPreset: (kind: "dtc" | "lead") => void;
  walletBalance: number;
  walletLoading: boolean;
  canRunWithWallet: boolean;
  walletDeficit: number;
  incBudget: (amt: number) => void;
  setStartIn15m: () => void;
  setEndIn7d: () => void;
  reachDaily: number | null;
  reachMonthly: number | null;
  interestsIgnored: boolean;
  videoFile: File | null;
  setVideoFile: (file: File | null) => void;
  thumbnailFile: File | null;
  setThumbnailFile: (file: File | null) => void;
  thumbnailError: string | null;
  setThumbnailError: (value: string | null) => void;
  validateThumbnailFile: (file: File) => string | null;
  setVideoPreviewUrl: (url: string | null) => void;
  setThumbPreviewUrl: (url: string | null) => void;
  handleAdSubmit: () => Promise<void>;
  onNavigateToWallet: () => void;
}

export function AdCampaignWizard(props: AdCampaignWizardProps) {
  const {
    form,
    setForm,
    onInput,
    onPlacementToggle,
    applyEstimatorPreset,
    walletBalance,
    walletLoading,
    canRunWithWallet,
    walletDeficit,
    incBudget,
    setStartIn15m,
    setEndIn7d,
    reachDaily,
    reachMonthly,
    interestsIgnored,
    videoFile,
    setVideoFile,
    thumbnailFile,
    setThumbnailFile,
    thumbnailError,
    setThumbnailError,
    validateThumbnailFile,
    setVideoPreviewUrl,
    setThumbPreviewUrl,
    handleAdSubmit,
    onNavigateToWallet,
  } = props;

  const [step, setStep] = useState(1);
  const [showAdvancedBidding, setShowAdvancedBidding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { id: 1, label: "Campaign" },
    { id: 2, label: "Ad set" },
    { id: 3, label: "Ad" },
    { id: 4, label: "Review" },
  ];

  const canProceed = () => {
    if (step === 1) {
      return !!form.campaign_name && !!form.objective;
    }

    if (step === 2) {
      return (
        Number(form.budget_amount_dollars) > 0 &&
        !!form.location_countries &&
        form.age_min >= 13 &&
        form.age_max >= form.age_min
      );
    }

    if (step === 3) {
      return !!videoFile && !!thumbnailFile;
    }

    return true;
  };

  const StepPill = ({ active }: { active: boolean }) => (
    <span className={["h-2 w-2 rounded-full", active ? "bg-[#00C2CB]" : "bg-[#2b2b2b]"].join(" ")} />
  );

  const onSubmitClick = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await handleAdSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative bg-[#141414] border border-[#232323] rounded-2xl shadow-xl overflow-hidden w-full max-w-full mx-auto">
      <div className="px-4 sm:px-8 py-5 border-b border-[#232323] bg-gradient-to-r from-[#101616] to-[#121212]">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#00C2CB]">Create New Ad Campaign</h1>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1">Step {step} of 4 · Mobile + desktop ready</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {steps.map((s) => (
              <StepPill key={s.id} active={step >= s.id} />
            ))}
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-[#1f1f1f] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00C2CB] to-[#7ff5fb]" style={{ width: `${(step / 4) * 100}%` }} />
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6 space-y-4 sm:space-y-6">
        <div className="flex justify-between gap-2 text-[11px] sm:text-sm overflow-x-auto pb-1">
          {steps.map((s) => {
            const active = step === s.id;
            return (
              <button key={s.id} onClick={() => setStep(s.id)} className="flex-1 flex justify-center">
                <span
                  className={[
                    "inline-flex items-center justify-center px-3 sm:px-4 py-2 rounded-full border transition whitespace-nowrap",
                    active ? "border-[#00C2CB] text-[#00C2CB]" : "border-transparent text-gray-400 hover:text-white",
                  ].join(" ")}
                >
                  {s.id}. {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-4 sm:space-y-6">
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Campaign name</span>
              <input
                placeholder="e.g. Affliya – Launch"
                className={`${INPUT} w-full text-base`}
                value={form.campaign_name}
                onChange={onInput("campaign_name")}
              />
            </label>

            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Objective</span>
              <select
                className={`${INPUT} w-full text-base`}
                value={form.objective}
                onChange={onInput("objective")}
              >
                <option value="OUTCOME_AWARENESS">Awareness</option>
                <option value="OUTCOME_TRAFFIC">Traffic</option>
                <option value="OUTCOME_ENGAGEMENT">Engagement</option>
                <option value="OUTCOME_LEADS">Leads</option>
                <option value="OUTCOME_SALES">Sales</option>
                <option value="OUTCOME_VIDEO_VIEWS">Video Views</option>
                <option value="OUTCOME_REACH">Reach</option>
              </select>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1 min-w-0">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Budget (AUD)</span>
                <input
                  type="number"
                  min={1}
                  className={`${INPUT} w-full text-base`}
                  value={form.budget_amount_dollars}
                  onChange={onInput("budget_amount_dollars")}
                />
              </label>
              <label className="flex-1 min-w-0">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Type</span>
                <select
                  className={`${INPUT} w-full text-base`}
                  value={form.budget_type}
                  onChange={onInput("budget_type")}
                >
                  <option value="DAILY">Daily</option>
                  <option value="LIFETIME">Lifetime</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 -mt-1 overflow-x-auto">
              <span className="text-[11px] text-gray-500 mr-1">Quick add:</span>
              <Chip onClick={() => incBudget(5)}>+ $5</Chip>
              <Chip onClick={() => incBudget(10)}>+ $10</Chip>
              <Chip onClick={() => incBudget(20)}>+ $20</Chip>
            </div>
            <div className="mt-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Wallet guard</p>
                  {walletLoading ? (
                    <span className="text-gray-400">Checking wallet balance…</span>
                  ) : canRunWithWallet ? (
                    <span className="text-emerald-400">Wallet balance: ${walletBalance.toFixed(2)} — ready to run this ad</span>
                  ) : (
                    <span className="text-red-400">Wallet balance: ${walletBalance.toFixed(2)}. You need ${walletDeficit.toFixed(2)} more to run this ad.</span>
                  )}
                </div>
                {!walletLoading && !canRunWithWallet && (
                  <span className="text-[11px] px-2 py-1 rounded-full border border-red-500/40 text-red-300">Action needed</span>
                )}
              </div>
              {!walletLoading && !canRunWithWallet && (
                <span className="block mt-2 text-xs text-gray-400">Top up your wallet before submitting this campaign.</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 min-w-0">
                <DateTimeField label="Start" value={form.start_time} onChange={(v) => setForm((p) => ({ ...p, start_time: v }))} />
                <div className="flex gap-2 mt-1">
                  <Chip onClick={setStartIn15m}>Start in 15m</Chip>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <DateTimeField label="End" value={form.end_time} onChange={(v) => setForm((p) => ({ ...p, end_time: v }))} />
                <div className="flex gap-2 mt-1">
                  <Chip onClick={setEndIn7d}>+7 days</Chip>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Countries</span>
                <CountryMultiSelect value={form.location_countries} onChange={(csv) => setForm((p) => ({ ...p, location_countries: csv }))} />
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Age range</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={13}
                      className={`${INPUT} mt-0 w-20`}
                      value={form.age_min}
                      onChange={onInput("age_min")}
                    />
                    <input
                      type="number"
                      min={form.age_min}
                      className={`${INPUT} mt-0 w-20`}
                      value={form.age_max}
                      onChange={onInput("age_max")}
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Gender</span>
                  <select className={`${INPUT} mt-0 w-full`} value={form.gender} onChange={onInput("gender")}>
                    <option value="">All</option>
                    <option value="1">Male</option>
                    <option value="2">Female</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Interests (comma-separated)</span>
                <textarea
                  className={`${INPUT} w-full text-base`}
                  placeholder="fitness, skincare, ecom"
                  value={form.interests_csv}
                  onChange={onInput("interests_csv")}
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Placements</span>
                <div className="text-xs text-gray-300 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const defaults: Record<PlacementKey, boolean> = {
                        facebook_feed: true,
                        instagram_feed: true,
                        instagram_reels: true,
                        facebook_reels: false,
                        facebook_stories: false,
                        instagram_stories: false,
                      };
                      setForm((p) => ({ ...p, placements: defaults }));
                    }}
                    className="px-2 py-1 rounded-md border border-[#2a2a2a] hover:bg-[#151515]"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { key: "facebook_feed", label: "Facebook Feed" },
                    { key: "instagram_feed", label: "Instagram Feed" },
                    { key: "instagram_reels", label: "Instagram Reels" },
                    { key: "facebook_reels", label: "Facebook Reels" },
                    { key: "facebook_stories", label: "Facebook Stories" },
                    { key: "instagram_stories", label: "Instagram Stories" },
                  ] as { key: PlacementKey; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onPlacementToggle(key)}
                    className={`px-3 py-2 rounded-lg border text-left text-sm ${
                      form.placements[key] ? "border-[#00C2CB] bg-[#0b1f20] text-white" : "border-[#2a2a2a] text-gray-300 hover:border-[#00C2CB]/30"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <button
                type="button"
                onClick={() => applyEstimatorPreset("dtc")}
                className="px-3 py-2 rounded-lg border border-[#2a2a2a] text-left hover:bg-[#151515]"
              >
                <div className="font-semibold text-white">DTC</div>
                <div className="text-gray-400 text-xs">CPM $12 / CTR 1.5% / CVR 1.5%</div>
              </button>
              <button
                type="button"
                onClick={() => applyEstimatorPreset("lead")}
                className="px-3 py-2 rounded-lg border border-[#2a2a2a] text-left hover:bg-[#151515]"
              >
                <div className="font-semibold text-white">Lead gen</div>
                <div className="text-gray-400 text-xs">CPM $10 / CTR 1% / CVR 4%</div>
              </button>
            </div>

            <div className="mt-4">
              <div
                role="button"
                tabIndex={0}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer rounded-xl border border-[#00C2CB]/40 bg-gradient-to-r from-[#081f22] to-[#0e0e0e] hover:border-[#00C2CB] transition"
                onClick={() => setShowAdvancedBidding((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowAdvancedBidding((v) => !v);
                  }
                }}
              >
                <span className="text-[#00C2CB] font-bold tracking-wide">
                  Advanced bidding
                  <span className="ml-2 text-xs font-normal text-gray-400">(optional)</span>
                </span>
                <span
                  className={["text-[#00C2CB] transition-transform duration-200", showAdvancedBidding ? "rotate-180" : "rotate-0"].join(" ")}>
                  ▾
                </span>
              </div>
              {showAdvancedBidding && (
                <div
                  className="mt-3 px-5 py-4 rounded-xl border border-[#00C2CB]/30 bg-[#0b1415] space-y-5"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div>
                    <div className="text-[#00C2CB] font-semibold text-sm tracking-wide mb-3">Bid strategy</div>
                    <div className="space-y-2">
                      <label
                        className={[
                          "flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition",
                          form.bid_strategy === "LOWEST_COST"
                            ? "border-[#00C2CB] bg-[#062a2d]"
                            : "border-[#2a2a2a] hover:border-[#00C2CB]/40",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="bid_strategy"
                          value="LOWEST_COST"
                          checked={form.bid_strategy === "LOWEST_COST"}
                          onChange={() =>
                            setForm((p) => ({
                              ...p,
                              bid_strategy: "LOWEST_COST",
                              bid_cap_dollars: "",
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>
                          <strong>Lowest cost</strong>{" "}
                          <span className="text-gray-400 text-xs">(recommended — Meta bids freely)</span>
                        </span>
                      </label>

                      <label
                        className={[
                          "flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition",
                          form.bid_strategy === "BID_CAP"
                            ? "border-[#00C2CB] bg-[#062a2d]"
                            : "border-[#2a2a2a] hover:border-[#00C2CB]/40",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="bid_strategy"
                          value="BID_CAP"
                          checked={form.bid_strategy === "BID_CAP"}
                          onChange={() =>
                            setForm((p) => ({
                              ...p,
                              bid_strategy: "BID_CAP",
                              bid_cap_dollars: p.bid_cap_dollars === "" ? "" : Number(p.bid_cap_dollars),
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>
                          <strong>Bid cap</strong>{" "}
                          <span className="text-gray-400 text-xs">(advanced — control auction aggressiveness)</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {form.bid_strategy === "BID_CAP" && (() => {
                    const cap = Number(form.bid_cap_dollars || 0);
                    let helperText = "Meta will not bid above this amount per auction.";
                    let helperClass = "text-gray-400";

                    if (cap > 0 && cap < 0.5) {
                      helperText = "Too low may limit delivery.";
                      helperClass = "text-amber-400";
                    }

                    if (cap >= 10) {
                      helperText = "May exceed Meta placement limits.";
                      helperClass = "text-red-400";
                    }

                    return (
                      <div className="space-y-1">
                        <div className="text-[#00C2CB] font-semibold text-sm tracking-wide mb-1">Bid cap</div>
                        <div className="relative rounded-lg overflow-hidden border border-[#00C2CB]/50 focus-within:border-[#00C2CB] focus-within:shadow-[0_0_0_3px_rgba(0,194,203,0.25)] transition">
                          <div className="absolute inset-y-0 left-0 flex items-center px-4 bg-[#00C2CB] text-black font-semibold text-xs">AUD</div>
                          <input
                            type="number"
                            min={0.01}
                            step={0.01}
                            placeholder="3.00"
                            className="w-full bg-surface pl-16 pr-3 py-2 text-white focus:outline-none"
                            value={form.bid_cap_dollars}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                bid_cap_dollars: e.target.value === "" ? "" : Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                        <p className={`text-xs font-medium ${helperClass}`}>{helperText}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {(reachDaily !== null || reachMonthly !== null) && (
              <div className="mt-2 p-3 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
                <div className="text-xs text-gray-400 mb-1">Estimated Reach (unique users)</div>
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[11px] text-gray-400">Daily</div>
                    <div className="text-lg font-bold text-[#00C2CB]">
                      {reachDaily !== null ? reachDaily.toLocaleString() : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Monthly</div>
                    <div className="text-lg font-bold text-[#00C2CB]">
                      {reachMonthly !== null ? reachMonthly.toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
                {interestsIgnored && (
                  <span className="block mt-1 text-[11px] text-gray-500">
                    Some typed interests were ignored because they didn’t match official Meta interest IDs.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 sm:space-y-6">
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Headline</span>
              <input
                placeholder="Your headline"
                className={`${INPUT} w-full text-base`}
                value={form.headline}
                onChange={onInput("headline")}
              />
            </label>

            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Caption</span>
              <textarea
                placeholder="Say something compelling…"
                className={`${INPUT} w-full text-base`}
                value={form.caption}
                onChange={onInput("caption")}
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1 min-w-0">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Call to Action</span>
                <select
                  className={`${INPUT} w-full text-base`}
                  value={form.call_to_action}
                  onChange={onInput("call_to_action")}
                >
                  <option value="LEARN_MORE">Learn More</option>
                  <option value="SHOP_NOW">Shop Now</option>
                  <option value="SIGN_UP">Sign Up</option>
                </select>
              </label>
              <label className="flex-1 min-w-0">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Destination URL</span>
                <input
                  placeholder="https://your-landing-page.com"
                  className={`${INPUT} w-full text-base`}
                  value={form.display_link}
                  onChange={onInput("display_link")}
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Upload Video</span>
                <input
                  type="file"
                  accept="video/*"
                  className={`${INPUT} w-full text-base`}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setVideoFile(file);
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setVideoPreviewUrl(url);
                      setThumbPreviewUrl(null);
                    } else {
                      setVideoPreviewUrl(null);
                    }
                  }}
                />
              </label>

              <label className="block">
                <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Optional Thumbnail</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className={`${INPUT} w-full text-base`}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (!file) {
                      setThumbnailFile(null);
                      setThumbPreviewUrl(null);
                      setThumbnailError(null);
                      return;
                    }
                    const err = validateThumbnailFile(file);
                    if (err) {
                      e.currentTarget.value = "";
                      setThumbnailFile(null);
                      setThumbPreviewUrl(null);
                      setThumbnailError(err);
                      nmToast.error(err);
                      return;
                    }
                    setThumbnailError(null);
                    setThumbnailFile(file);
                    const url = URL.createObjectURL(file);
                    setThumbPreviewUrl(url);
                  }}
                />
              </label>
            </div>

            {thumbnailError || !thumbnailFile ? (
              <div className="mt-3 px-3 py-2 border border-[#00C2CB]/50 text-[#00C2CB] text-sm rounded-md bg-[#001F20]/30">
                {thumbnailError ? thumbnailError : "Please upload a PNG/JPG/WebP thumbnail before submitting."}
              </div>
            ) : null}

            <Disclosure title="How to craft a high‑performing Meta ad (tips & disclaimers)">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Hook in 3 seconds:</strong> Front-load the problem and benefit. Keep captions under ~125 characters for feed placements.
                </li>
                <li>
                  <strong>Clear CTA:</strong> Your button must match intent (e.g., “Shop Now” for sales, “Learn More” for top-funnel).
                </li>
                <li>
                  <strong>Mobile-first creative:</strong> Upload 1080×1350 or 1080×1920 where possible; keep safe margins for subtitles.
                </li>
                <li>
                  <strong>Destination vs Display link:</strong> Destination should be your <em>tracking link</em>; Display can be your brand URL.
                </li>
                <li>
                  <strong>Budget realism:</strong> If CPM is high, broaden placements or interests; avoid stacking too many narrow interests.
                </li>
                <li>
                  <strong>Compliance:</strong> Don’t include restricted claims. You’re responsible for adhering to Meta’s ad policies.
                </li>
              </ul>
            </Disclosure>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid gap-3">
              <div className="p-4 sm:p-6 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
                <div className="text-xs uppercase text-gray-400 tracking-wide mb-1">Campaign</div>
                <div className="text-lg font-semibold text-[#00C2CB]">{form.campaign_name || "Untitled"}</div>
                <div className="text-sm text-gray-300">Objective: {form.objective.replace("OUTCOME_", "")}</div>
              </div>

              <div className="p-4 sm:p-6 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
                <div className="text-xs uppercase text-gray-400 tracking-wide mb-1">Budget</div>
                <div className="text-lg font-semibold text-[#00C2CB]">${Number(form.budget_amount_dollars || 0).toFixed(2)}</div>
                <div className="text-sm text-gray-300">Type: <span className="text-[#00C2CB]">{form.budget_type}</span></div>
                {form.bid_strategy === "BID_CAP" && (
                  <div className="text-sm text-gray-300 mt-1">
                    Bid cap:{" "}
                    <span className="text-[#00C2CB]">
                      {form.bid_cap_dollars ? `$${Number(form.bid_cap_dollars).toFixed(2)}` : "—"}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
                <div className="text-xs uppercase text-gray-400 tracking-wide mb-1">Targeting</div>
                <div className="text-sm text-gray-300">
                  {form.location_countries} • {form.age_min}-{form.age_max} • {form.gender === "" ? "All" : form.gender === "1" ? "Male" : "Female"}
                </div>
                {form.interests_csv && (
                  <div className="text-sm text-gray-400 mt-1">
                    Interests: <span className="text-[#00C2CB]">{form.interests_csv}</span>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
                <div className="text-xs uppercase text-gray-400 tracking-wide mb-1">Creative</div>
                <div className="text-lg font-semibold text-[#00C2CB]">{form.headline || "No headline"}</div>
                <div className="text-sm text-gray-400">{form.caption || "No caption"}</div>
                <div className="text-sm mt-1 text-gray-300">
                  <div className="flex flex-wrap items-start gap-1 min-w-0">
                    <span>CTA:</span>
                    <span className="text-[#00C2CB]">{form.call_to_action?.replace("_", " ")}</span>
                    <span aria-hidden>→</span>
                    <a
                      href={form.display_link || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-[#00C2CB] hover:text-[#00b0b8] inline-block max-w-full min-w-0 whitespace-normal break-all"
                    >
                      {form.display_link || "—"}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 sm:px-8 py-5 border-t border-[#232323] bg-[#111111]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-md border border-[#2a2a2a] text-gray-300 hover:bg-[#151515]"
            >
              Back
            </button>
          )}

          {step < 4 && (
            <button
              disabled={!canProceed()}
              onClick={() => setStep(step + 1)}
              className={`sm:ml-auto w-full sm:w-auto px-6 py-2 rounded-md transition ${
                canProceed() ? "bg-[#00C2CB] text-black hover:bg-[#00b0b8]" : "bg-[#1a1a1a] text-gray-500 cursor-not-allowed"
              }`}
            >
              Next
            </button>
          )}

          {step === 4 && (
            canRunWithWallet ? (
              <button
                onClick={onSubmitClick}
                disabled={isSubmitting}
                className={`sm:ml-auto w-full sm:w-auto px-6 py-2 rounded-md transition flex items-center justify-center gap-2 ${
                  isSubmitting ? "bg-[#1a1a1a] text-gray-400 cursor-not-allowed" : "bg-[#00C2CB] text-black hover:bg-[#00b0b8]"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-gray-500 border-t-[#00C2CB] animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Ad Idea"
                )}
              </button>
            ) : (
              <button
                onClick={onNavigateToWallet}
                className="sm:ml-auto w-full sm:w-auto px-6 py-2 rounded-md transition bg-[#1a1a1a] text-[#00C2CB] border border-[#00C2CB]/40 hover:bg-[#0f1f20]"
              >
                Top Up Wallet
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// stage2-check
