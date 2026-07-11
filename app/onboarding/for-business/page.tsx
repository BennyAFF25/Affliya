"use client";

import React, { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import {
  CheckCircle2,
  ChevronRight,
  Store,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const { session, isLoading } = useSessionContext();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [offerName, setOfferName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [offerType, setOfferType] = useState<"one-time" | "recurring">(
    "one-time",
  );
  const [conversionScope, setConversionScope] = useState<
    "store_wide" | "specific_products"
  >("store_wide");
  const [eligibleProductIdsText, setEligibleProductIdsText] = useState("");
  const [eligibleVariantIdsText, setEligibleVariantIdsText] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>(
    [],
  );

  const progressItems = ["Offer details", "Review", "Publish"];
  const progressPercent =
    step === 1 ? 12 : step === 2 ? 42 : step === 3 ? 72 : 100;

  if (!isLoading && !session?.user) {
    router.replace("/login?role=business&next=/onboarding/for-business");
  }

  const parseIdList = (value: string) =>
    value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const canPreview =
    offerName.trim() &&
    websiteUrl.trim() &&
    productPrice.trim() &&
    commissionPercent.trim() &&
    description.trim() &&
    logoFile &&
    productImageFiles.length > 0 &&
    (conversionScope === "store_wide" ||
      parseIdList(eligibleProductIdsText).length > 0 ||
      parseIdList(eligibleVariantIdsText).length > 0);

  const commissionPreviewAmount = useMemo(() => {
    const priceValue = Number(productPrice || 0);
    const commissionValue = Number(commissionPercent || 0);
    if (!Number.isFinite(priceValue) || !Number.isFinite(commissionValue))
      return 0;
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

      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not publish offer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05080b] px-4 py-6 text-white sm:px-6 lg:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[28px] border border-white/10 bg-[#111617]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:p-6 lg:p-8">
          <div className="mb-7 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
              {progressItems.map((item, index) => {
                const isActive =
                  (step === 1 && index === 0) ||
                  (step === 2 && index === 0) ||
                  (step === 3 && index === 1) ||
                  (step >= 4 && index === 2);
                const isComplete =
                  (step >= 3 && index === 0) || (step >= 4 && index <= 1);

                return (
                  <span
                    key={item}
                    className={
                      isActive || isComplete
                        ? "text-[#7ff5fb]"
                        : "text-white/40"
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

          {step === 1 && (
            <section className="mx-auto max-w-2xl py-8 text-center sm:py-12">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10">
                <Store className="h-6 w-6 text-[#7ff5fb]" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Create your first offer
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
                Add the product you want affiliates to promote and choose the
                commission they can earn.
              </p>
              <button
                onClick={() => setStep(2)}
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Create offer <ChevronRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-xs text-white/45">
                Takes around 2 minutes.
              </p>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff5fb]">
                  Offer details
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Tell affiliates what they can promote
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Keep it simple. You can edit the offer later.
                </p>
              </div>

              <div className="space-y-8">
                <div className="border-t border-white/10 pt-6">
                  <h3 className="text-sm font-semibold text-white">
                    Offer details
                  </h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-white/82">
                      Offer name
                      <input
                        value={offerName}
                        onChange={(e) => setOfferName(e.target.value)}
                        placeholder="Example: Summer skincare bundle"
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                      />
                    </label>
                    <label className="block text-sm font-medium text-white/82">
                      Website URL
                      <input
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://yourstore.com/product"
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                      />
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
                      <div>
                        <p className="text-sm font-medium text-white/82">
                          Business logo
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3">
                          <label
                            htmlFor="business-logo-upload"
                            className="cursor-pointer rounded-lg bg-[#00C2CB] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#28d3da]"
                          >
                            Upload file
                          </label>
                          <input
                            id="business-logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={onLogoChange}
                            className="sr-only"
                          />
                          <span className="min-w-0 truncate text-xs text-white/50">
                            {logoFile?.name || "PNG or JPG"}
                          </span>
                        </div>
                        {logoPreview && (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                            <span className="text-xs text-white/55">
                              Logo added
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-white/82">
                          Product images
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3">
                          <label
                            htmlFor="product-images-upload"
                            className="cursor-pointer rounded-lg bg-[#00C2CB] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#28d3da]"
                          >
                            Add images
                          </label>
                          <input
                            id="product-images-upload"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={onProductImagesChange}
                            className="sr-only"
                          />
                          <span className="min-w-0 truncate text-xs text-white/50">
                            {productImageFiles.length
                              ? `${productImageFiles.length} image${
                                  productImageFiles.length === 1 ? "" : "s"
                                } added`
                              : "PNG or JPG"}
                          </span>
                        </div>
                        {productImagePreviews.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {productImagePreviews.slice(0, 4).map((src, i) => (
                              <img
                                key={`${src}-${i}`}
                                src={src}
                                alt={`Product preview ${i + 1}`}
                                className="h-10 w-10 rounded-lg border border-white/10 object-cover"
                              />
                            ))}
                            {productImagePreviews.length > 4 && (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs text-white/55">
                                +{productImagePreviews.length - 4}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <label className="block text-sm font-medium text-white/82 md:col-span-2">
                      Description
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        placeholder="Briefly describe what affiliates will promote."
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                      />
                    </label>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-6">
                  <h3 className="text-sm font-semibold text-white">
                    Commission
                  </h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-white/82">
                      Product price
                      <input
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="100.00"
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                      />
                    </label>
                    <label className="block text-sm font-medium text-white/82">
                      Commission percentage
                      <input
                        value={commissionPercent}
                        onChange={(e) => setCommissionPercent(e.target.value)}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="20"
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                      />
                      <span className="mt-1 block text-xs text-white/45">
                        The percentage an affiliate earns from a tracked sale.
                      </span>
                    </label>

                    <div className="rounded-xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-4 py-3 text-sm text-[#dffcff] md:col-span-2">
                      Affiliate earns approximately{" "}
                      <span className="font-semibold text-white">
                        {currency} ${commissionPreviewAmount.toFixed(2)}
                      </span>{" "}
                      per sale
                    </div>

                    <label className="block text-sm font-medium text-white/82">
                      Currency
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                      >
                        <option value="USD">USD</option>
                        <option value="AUD">AUD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="CAD">CAD</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-white/82">
                      Offer type
                      <select
                        value={offerType}
                        onChange={(e) =>
                          setOfferType(
                            e.target.value as "one-time" | "recurring",
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                      >
                        <option value="one-time">One-time</option>
                        <option value="recurring">Recurring</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-6">
                  <h3 className="text-sm font-semibold text-white">
                    Eligible sales
                  </h3>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <label className="block text-sm font-medium text-white/82">
                      Commission scope
                      <select
                        value={conversionScope}
                        onChange={(e) =>
                          setConversionScope(
                            e.target.value as
                              "store_wide" | "specific_products",
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                      >
                        <option value="store_wide">Whole store</option>
                        <option value="specific_products">
                          Specific product or SKU
                        </option>
                      </select>
                    </label>
                    <p className="mt-2 text-xs leading-5 text-white/50">
                      Choose whether commission applies to the whole store or
                      one product.
                    </p>

                    {conversionScope === "specific_products" && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="block text-sm font-medium text-white/82">
                          Product IDs
                          <textarea
                            value={eligibleProductIdsText}
                            onChange={(e) =>
                              setEligibleProductIdsText(e.target.value)
                            }
                            rows={3}
                            placeholder="One per line or comma-separated"
                            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                          />
                        </label>
                        <label className="block text-sm font-medium text-white/82">
                          Variant IDs or SKUs
                          <textarea
                            value={eligibleVariantIdsText}
                            onChange={(e) =>
                              setEligibleVariantIdsText(e.target.value)
                            }
                            rows={3}
                            placeholder="Example: SKU-RED-L"
                            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0c1112] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#00C2CB]/70 focus:ring-2 focus:ring-[#00C2CB]/15"
                          />
                        </label>
                        <p className="text-xs leading-5 text-white/48 md:col-span-2">
                          Only needed when commission applies to selected
                          products.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {error && <p className="mt-5 text-sm text-red-400">{error}</p>}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/45">
                  You can preview before publishing.
                </p>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canPreview}
                  className="inline-flex items-center justify-center rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Preview offer
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff5fb]">
                  Review
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Review your offer
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Check the details before affiliates can see it.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1fr,0.85fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                        Offer name
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {offerName || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                        Website
                      </p>
                      <p className="mt-1 break-all text-sm text-white/78">
                        {websiteUrl || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                        Product price
                      </p>
                      <p className="mt-1 text-sm text-white/78">
                        {currency} ${productPrice || "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                        Commission
                      </p>
                      <p className="mt-1 text-sm text-white/78">
                        {commissionPercent || "0"}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                        Estimated payout
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#7ff5fb]">
                        {currency} ${commissionPreviewAmount.toFixed(2)} per
                        sale
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                        Offer type
                      </p>
                      <p className="mt-1 text-sm text-white/78">
                        {offerType === "recurring" ? "Recurring" : "One-time"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                        Commission scope
                      </p>
                      <p className="mt-1 text-sm text-white/78">
                        {conversionScope === "store_wide"
                          ? "Whole store"
                          : "Specific product or SKU"}
                      </p>
                      {conversionScope === "specific_products" && (
                        <div className="mt-2 space-y-1 text-xs leading-5 text-white/55">
                          <p>
                            Product IDs:{" "}
                            {parseIdList(eligibleProductIdsText).join(", ") ||
                              "—"}
                          </p>
                          <p>
                            Variant IDs / SKUs:{" "}
                            {parseIdList(eligibleVariantIdsText).join(", ") ||
                              "—"}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                        Description
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/78">
                        {description || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0c1112] p-4 sm:p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">
                    Images
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {logoPreview && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="h-24 w-full rounded-lg object-cover"
                        />
                        <p className="mt-2 text-xs text-white/55">Logo</p>
                      </div>
                    )}
                    {productImagePreviews.slice(0, 3).map((src, i) => (
                      <div
                        key={`${src}-${i}`}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-2"
                      >
                        <img
                          src={src}
                          alt={`Product preview ${i + 1}`}
                          className="h-24 w-full rounded-lg object-cover"
                        />
                        <p className="mt-2 text-xs text-white/55">
                          Product image
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="mt-5 text-sm text-red-400">{error}</p>}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center justify-center rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-white/82 transition hover:bg-white/[0.04] hover:text-white"
                >
                  Edit offer
                </button>
                <button
                  onClick={handlePublish}
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Publishing..." : "Publish offer"}
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="mx-auto max-w-xl py-8 text-center sm:py-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/10">
                <CheckCircle2 className="h-7 w-7 text-[#7ff5fb]" />
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">
                Your offer is live
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Affiliates can now view it and request to promote it.
              </p>
              <button
                onClick={() => router.replace("/business/my-business")}
                className="mt-6 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
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
