"use client";

import React, { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Package2,
  Percent,
  Rocket,
  Store,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const { session, isLoading } = useSessionContext();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [offerName, setOfferName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [participationMode, setParticipationMode] = useState<
    "open" | "approval_required" | "private"
  >("open");
  const [offerType, setOfferType] = useState<"one-time" | "recurring">(
    "one-time",
  );
  const [conversionScope, setConversionScope] = useState<
    "store_wide" | "specific_products"
  >("store_wide");
  const [eligibleProductIdsText, setEligibleProductIdsText] = useState("");
  const [eligibleVariantIdsText, setEligibleVariantIdsText] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);

  const progressItems = ["Product", "Commission", "Go live"];
  const progressPercent =
    step === 1 ? 8 : step === 2 ? 34 : step === 3 ? 67 : step === 4 ? 100 : 100;

  if (!isLoading && !session?.user) {
    router.replace("/login?role=business&next=/onboarding/for-business");
  }

  const parseIdList = (value: string) =>
    value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const productStepComplete = Boolean(
    offerName.trim() &&
      websiteUrl.trim() &&
      description.trim() &&
      logoFile &&
      productImageFiles.length > 0,
  );

  const commissionStepComplete = Boolean(
    productPrice.trim() &&
      commissionPercent.trim() &&
      (conversionScope === "store_wide" ||
        parseIdList(eligibleProductIdsText).length > 0 ||
        parseIdList(eligibleVariantIdsText).length > 0),
  );

  const commissionPreviewAmount = useMemo(() => {
    const priceValue = Number(productPrice || 0);
    const commissionValue = Number(commissionPercent || 0);
    if (!Number.isFinite(priceValue) || !Number.isFinite(commissionValue)) {
      return 0;
    }
    return (priceValue * commissionValue) / 100;
  }, [productPrice, commissionPercent]);

  const onLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setLogoFile(null);
      setLogoPreview("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }

    setError(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const onProductImagesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (!files.length) {
      setProductImageFiles([]);
      setProductImagePreviews([]);
      return;
    }

    const invalid = files.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      setError("Product images must be image files.");
      return;
    }

    setError(null);
    setProductImageFiles(files);
    setProductImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const handlePublish = async () => {
    if (!session?.user?.email) return;
    setSubmitting(true);
    setError(null);

    try {
      let uploadedLogoUrl: string | null = null;
      if (logoFile) {
        const logoPath = `${Date.now()}_${logoFile.name}`;
        const { error: logoError } = await supabase.storage
          .from("offer-logos")
          .upload(logoPath, logoFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: logoFile.type,
          });

        if (logoError) {
          throw new Error(logoError.message || "Could not upload logo.");
        }

        const { data: logoData } = supabase.storage
          .from("offer-logos")
          .getPublicUrl(logoPath);
        uploadedLogoUrl = logoData?.publicUrl || null;
      }

      let uploadedHeroUrl: string | null = null;
      const uploadedImageUrls: string[] = [];

      for (const file of productImageFiles) {
        const imagePath = `${Date.now()}_${file.name}`;
        const { error: imageError } = await supabase.storage
          .from("profile-images")
          .upload(imagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (imageError) {
          throw new Error(
            imageError.message || "Could not upload product image.",
          );
        }

        const { data: imageData } = supabase.storage
          .from("profile-images")
          .getPublicUrl(imagePath);

        const publicUrl = imageData?.publicUrl || null;
        if (publicUrl) {
          uploadedImageUrls.push(publicUrl);
          if (!uploadedHeroUrl) uploadedHeroUrl = publicUrl;
        }
      }

      const priceValue = Number(productPrice || 0);
      const commissionValue = Number(commissionPercent || 0);
      const eligibleProductIds = parseIdList(eligibleProductIdsText);
      const eligibleVariantIds = parseIdList(eligibleVariantIdsText);

      if (
        conversionScope === "specific_products" &&
        eligibleProductIds.length === 0 &&
        eligibleVariantIds.length === 0
      ) {
        throw new Error(
          "Add at least one eligible product ID, variant ID, or SKU.",
        );
      }

      const payload: Record<string, unknown> = {
        title: offerName.trim(),
        description: description.trim(),
        business_email: session.user.email,
        website: websiteUrl.trim(),
        commission: commissionValue,
        price: priceValue,
        currency,
        participation_mode: participationMode,
        commission_value: Math.round((priceValue * commissionValue) / 100),
        type: offerType,
        conversion_scope: conversionScope,
        eligible_product_ids:
          conversionScope === "specific_products" ? eligibleProductIds : null,
        eligible_variant_ids:
          conversionScope === "specific_products" ? eligibleVariantIds : null,
        created_at: new Date().toISOString(),
        logo_url: uploadedLogoUrl,
        hero_image_url: uploadedHeroUrl,
        image_urls: uploadedImageUrls.length ? uploadedImageUrls : null,
      };

      const { error: insertError } = await (
        supabase as unknown as {
          from: (table: string) => {
            insert: (
              values: Record<string, unknown>[],
            ) => Promise<{ error: { message?: string } | null }>;
          };
        }
      )
        .from("offers")
        .insert([payload]);

      if (insertError) {
        throw new Error(insertError.message || "Could not publish offer.");
      }

      await fetch("/api/profile/onboarding-complete", { method: "POST" }).catch(
        () => null,
      );

      setStep(5);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not publish offer.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "mt-1.5 w-full rounded-2xl border border-white/10 bg-[#0b1011] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15";

  return (
    <main className="min-h-screen bg-[#05080b] px-3 py-4 text-white sm:px-6 lg:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-[30px] border border-white/10 bg-[#101516]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:p-6 lg:p-8">
          {step < 5 && (
            <div className="mb-7 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/38">
                {progressItems.map((item, index) => {
                  const activeIndex = step <= 2 ? 0 : step === 3 ? 1 : 2;
                  const isActive = index === activeIndex;
                  const isComplete = index < activeIndex;

                  return (
                    <span
                      key={item}
                      className={
                        isActive || isComplete ? "text-[#7ff5fb]" : "text-white/36"
                      }
                    >
                      {item}
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#00C2CB] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <section className="mx-auto max-w-xl py-9 text-center sm:py-12">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10">
                <Store className="h-6 w-6 text-[#7ff5fb]" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff5fb]">
                Get your business live
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Put your first product in front of affiliates
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/64 sm:text-base">
                Show affiliates what to promote, choose what they earn, then go live.
              </p>
              <button
                onClick={() => setStep(2)}
                className="mt-7 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#00C2CB] px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Get started <ChevronRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-xs text-white/38">About 2 minutes.</p>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00C2CB]/10 text-[#7ff5fb]">
                  <Package2 className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff5fb]">
                  Product
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  What should affiliates promote?
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Add the essentials. You can change any of this later.
                </p>
              </div>

              <div className="space-y-5">
                <label className="block text-sm font-medium text-white/82">
                  Product or offer name
                  <input
                    value={offerName}
                    onChange={(e) => setOfferName(e.target.value)}
                    placeholder="Example: Summer skincare bundle"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-white/82">
                  Where can customers buy it?
                  <input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourstore.com/product"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-white/82">
                  Short description
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="A quick description of what affiliates will promote."
                    className={inputClass}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-center gap-2">
                      <ImagePlus className="h-4 w-4 text-[#7ff5fb]" />
                      <p className="text-sm font-medium text-white/82">Business logo</p>
                    </div>
                    <label
                      htmlFor="business-logo-upload"
                      className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-[#0b1011] px-3.5 py-3 text-xs text-white/58 transition hover:border-[#00C2CB]/45"
                    >
                      <span className="truncate">
                        {logoFile?.name || "Choose logo"}
                      </span>
                      <span className="font-semibold text-[#7ff5fb]">Upload</span>
                    </label>
                    <input
                      id="business-logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={onLogoChange}
                      className="sr-only"
                    />
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="mt-3 h-14 w-14 rounded-xl border border-white/10 object-cover"
                      />
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-center gap-2">
                      <ImagePlus className="h-4 w-4 text-[#7ff5fb]" />
                      <p className="text-sm font-medium text-white/82">Product image</p>
                    </div>
                    <label
                      htmlFor="product-images-upload"
                      className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-[#0b1011] px-3.5 py-3 text-xs text-white/58 transition hover:border-[#00C2CB]/45"
                    >
                      <span>
                        {productImageFiles.length
                          ? `${productImageFiles.length} added`
                          : "Choose image"}
                      </span>
                      <span className="font-semibold text-[#7ff5fb]">Upload</span>
                    </label>
                    <input
                      id="product-images-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onProductImagesChange}
                      className="sr-only"
                    />
                    {productImagePreviews.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-hidden">
                        {productImagePreviews.slice(0, 3).map((src, i) => (
                          <img
                            key={`${src}-${i}`}
                            src={src}
                            alt={`Product preview ${i + 1}`}
                            className="h-14 w-14 rounded-xl border border-white/10 object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {error && <p className="mt-5 text-sm text-red-400">{error}</p>}

              <button
                onClick={() => {
                  setError(null);
                  setStep(3);
                }}
                disabled={!productStepComplete}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00C2CB] px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </section>
          )}

          {step === 3 && (
            <section>
              <div className="mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00C2CB]/10 text-[#7ff5fb]">
                  <Percent className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff5fb]">
                  Commission
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  What should someone earn for bringing you a customer?
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  You only pay this commission when an eligible tracked sale is made.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-white/82">
                  Product price
                  <input
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="100.00"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-white/82">
                  Affiliate commission
                  <div className="relative">
                    <input
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(e.target.value)}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="20"
                      className={`${inputClass} pr-10`}
                    />
                    <span className="pointer-events-none absolute right-4 top-[18px] text-sm text-white/42">
                      %
                    </span>
                  </div>
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[#7ff5fb]">
                  Affiliate earns
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-white">
                  {currency} ${commissionPreviewAmount.toFixed(2)}
                  <span className="ml-2 text-sm font-normal text-white/50">per sale</span>
                </p>
                <p className="mt-2 text-xs leading-5 text-white/48">
                  You keep the customer and fulfil the order as normal.
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((value) => !value)}
                  className="flex w-full items-center justify-between px-4 py-4 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-white/82">Advanced settings</p>
                    <p className="mt-0.5 text-xs text-white/40">
                      Defaults are already set for most businesses.
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-white/40 transition ${
                      advancedOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {advancedOpen && (
                  <div className="space-y-4 border-t border-white/8 px-4 pb-4 pt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-white/72">
                        Currency
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className={inputClass}
                        >
                          <option value="USD">USD</option>
                          <option value="AUD">AUD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="CAD">CAD</option>
                        </select>
                      </label>

                      <label className="block text-sm font-medium text-white/72">
                        Offer type
                        <select
                          value={offerType}
                          onChange={(e) =>
                            setOfferType(e.target.value as "one-time" | "recurring")
                          }
                          className={inputClass}
                        >
                          <option value="one-time">One-time</option>
                          <option value="recurring">Recurring</option>
                        </select>
                      </label>
                    </div>

                    <label className="block text-sm font-medium text-white/72">
                      Participation
                      <select
                        value={participationMode}
                        onChange={(e) =>
                          setParticipationMode(
                            e.target.value as
                              | "open"
                              | "approval_required"
                              | "private",
                          )
                        }
                        className={inputClass}
                      >
                        <option value="open">Open — affiliates can start immediately</option>
                        <option value="approval_required">
                          Approval required — review each affiliate first
                        </option>
                        <option value="private">Private — keep this offer restricted</option>
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-white/72">
                      Commission applies to
                      <select
                        value={conversionScope}
                        onChange={(e) =>
                          setConversionScope(
                            e.target.value as "store_wide" | "specific_products",
                          )
                        }
                        className={inputClass}
                      >
                        <option value="store_wide">Whole store</option>
                        <option value="specific_products">Specific product or SKU</option>
                      </select>
                    </label>

                    {conversionScope === "specific_products" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-white/72">
                          Product IDs
                          <textarea
                            value={eligibleProductIdsText}
                            onChange={(e) => setEligibleProductIdsText(e.target.value)}
                            rows={3}
                            placeholder="One per line or comma-separated"
                            className={inputClass}
                          />
                        </label>
                        <label className="block text-sm font-medium text-white/72">
                          Variant IDs or SKUs
                          <textarea
                            value={eligibleVariantIdsText}
                            onChange={(e) => setEligibleVariantIdsText(e.target.value)}
                            rows={3}
                            placeholder="Example: SKU-RED-L"
                            className={inputClass}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && <p className="mt-5 text-sm text-red-400">{error}</p>}

              <div className="mt-7 grid grid-cols-[auto_1fr] gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.03]"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    setStep(4);
                  }}
                  disabled={!commissionStepComplete}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00C2CB] px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  See my offer <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <div className="mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00C2CB]/10 text-[#7ff5fb]">
                  <Rocket className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff5fb]">
                  Go live
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Here&apos;s what affiliates will see
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  One final look, then your offer is live on Nettmark.
                </p>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1011]">
                {productImagePreviews[0] && (
                  <img
                    src={productImagePreviews[0]}
                    alt="Offer preview"
                    className="h-44 w-full object-cover sm:h-56"
                  />
                )}

                <div className="p-5">
                  <div className="flex items-start gap-3">
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Business logo"
                        className="h-11 w-11 rounded-xl border border-white/10 object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xl font-bold tracking-tight text-white">
                        {offerName}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/52">
                        {description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Product price
                      </p>
                      <p className="mt-1 text-base font-semibold text-white">
                        {currency} ${productPrice}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/8 p-3.5">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[#7ff5fb]/70">
                        Affiliate earns
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#7ff5fb]">
                        {currency} ${commissionPreviewAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/48">
                    <span className="rounded-full border border-white/8 bg-white/[0.025] px-3 py-1.5">
                      {commissionPercent}% commission
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/[0.025] px-3 py-1.5">
                      {participationMode === "open"
                        ? "Open to affiliates"
                        : participationMode === "approval_required"
                          ? "Approval required"
                          : "Private"}
                    </span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <p className="text-sm font-medium text-white/82">
                      Affiliates can now discover this offer and start distributing it.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/42">
                      They can promote organically or use their own ad budget where your offer allows it.
                    </p>
                  </div>
                </div>
              </div>

              {error && <p className="mt-5 text-sm text-red-400">{error}</p>}

              <div className="mt-7 grid grid-cols-[auto_1fr] gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.03]"
                >
                  Edit
                </button>
                <button
                  onClick={handlePublish}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00C2CB] px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Publishing..." : "Publish offer"}
                </button>
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="mx-auto max-w-xl py-9 text-center sm:py-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/10">
                <CheckCircle2 className="h-7 w-7 text-[#7ff5fb]" />
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">
                Your offer is live
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/64">
                Affiliates can now discover it, promote it and bring new customers to your business.
              </p>
              <button
                onClick={() => router.replace("/business/my-business")}
                className="mt-6 w-full max-w-xs rounded-2xl bg-[#00C2CB] px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Go to business dashboard
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
