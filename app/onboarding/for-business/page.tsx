"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import {
  CheckCircle2,
  ChevronRight,
  Store,
  Link as LinkIcon,
  BadgeDollarSign,
  FileText,
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);

  const progressLabel = useMemo(() => {
    if (step >= 3) return "Complete";
    return `Step ${step} of 3`;
  }, [step]);

  if (!isLoading && !session?.user) {
    router.replace("/login?role=business&next=/onboarding/for-business");
  }

  const canPreview =
    offerName.trim() &&
    websiteUrl.trim() &&
    productPrice.trim() &&
    commissionPercent.trim() &&
    description.trim() &&
    logoFile &&
    productImageFiles.length > 0;

  const commissionPreviewAmount = useMemo(() => {
    const priceValue = Number(productPrice || 0);
    const commissionValue = Number(commissionPercent || 0);
    if (!Number.isFinite(priceValue) || !Number.isFinite(commissionValue)) return 0;
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
          throw new Error(imageError.message || "Could not upload product image.");
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

      const payload: any = {
        title: offerName.trim(),
        description: description.trim(),
        business_email: session.user.email,
        website: websiteUrl.trim(),
        commission: commissionValue,
        price: priceValue,
        commission_value: Math.round((priceValue * commissionValue) / 100),
        type: "one-time",
        created_at: new Date().toISOString(),
        logo_url: uploadedLogoUrl,
        hero_image_url: uploadedHeroUrl,
        image_urls: uploadedImageUrls.length ? uploadedImageUrls : null,
      };

      const { error: insertError } = await (supabase as any)
        .from("offers")
        .insert([payload]);

      if (insertError) {
        throw new Error(insertError.message || "Could not publish offer.");
      }

      await fetch("/api/profile/onboarding-complete", { method: "POST" }).catch(
        () => null,
      );

      setStep(4);
    } catch (err: any) {
      setError(err?.message || "Could not publish offer.");
    } finally {
      setSubmitting(false);
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
                Let’s get your first offer in front of affiliates.
              </p>
              <button
                onClick={() => setStep(2)}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Create First Offer <ChevronRight className="h-4 w-4" />
              </button>
            </section>
          )}

          {step === 2 && (
            <section className="mt-8 md:mt-10">
              <h2 className="text-2xl font-bold">Create Offer</h2>
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-white/80">Offer Name
                  <input value={offerName} onChange={(e) => setOfferName(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
                <label className="text-sm text-white/80">Upload Logo
                  <input type="file" accept="image/*" onChange={onLogoChange} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-[#00C2CB] file:px-3 file:py-1.5 file:text-black" />
                </label>
                <label className="text-sm text-white/80 md:col-span-2">Website URL
                  <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
                <label className="text-sm text-white/80">Product Price
                  <input value={productPrice} onChange={(e) => setProductPrice(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
                <label className="text-sm text-white/80">Commission Percentage
                  <input value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} type="number" min="0" max="100" step="0.01" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
                <div className="md:col-span-2 rounded-xl border border-[#00C2CB]/35 bg-[#00C2CB]/10 px-3 py-2.5 text-sm text-[#7ff5fb]">
                  Estimated affiliate payout per sale: <span className="font-semibold text-white">${commissionPreviewAmount.toFixed(2)}</span>
                </div>
                <label className="text-sm text-white/80 md:col-span-2">Upload Product Images
                  <input type="file" accept="image/*" multiple onChange={onProductImagesChange} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-[#00C2CB] file:px-3 file:py-1.5 file:text-black" />
                </label>
                <label className="text-sm text-white/80 md:col-span-2">Description
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
              </div>
              {(logoPreview || productImagePreviews.length > 0) && (
                <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-5">
                  {logoPreview && (
                    <div className="rounded-lg border border-[var(--border)] bg-[#202020] p-1">
                      <img src={logoPreview} alt="Logo preview" className="h-16 w-full rounded object-cover" />
                      <p className="mt-1 text-[10px] text-white/60">Logo</p>
                    </div>
                  )}
                  {productImagePreviews.map((src, i) => (
                    <div key={`${src}-${i}`} className="rounded-lg border border-[var(--border)] bg-[#202020] p-1">
                      <img src={src} alt={`Product preview ${i + 1}`} className="h-16 w-full rounded object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setStep(3)}
                disabled={!canPreview}
                className="mt-6 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Preview Offer
              </button>
            </section>
          )}

          {step === 3 && (
            <section className="mt-8 md:mt-10">
              <h2 className="text-2xl font-bold">Publish Offer</h2>
              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[#202020] p-4 text-sm text-white/80">
                <p className="flex items-center gap-2"><Store className="h-4 w-4" /> {offerName || "Offer name"}</p>
                <p className="mt-2 flex items-center gap-2"><LinkIcon className="h-4 w-4" /> {websiteUrl || "Website URL"}</p>
                <p className="mt-2 flex items-center gap-2"><BadgeDollarSign className="h-4 w-4" /> Price: ${productPrice || "0"}</p>
                <p className="mt-2 flex items-center gap-2"><BadgeDollarSign className="h-4 w-4" /> Commission: {commissionPercent || "0"}%</p>
                <p className="mt-2 flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4" /> {description || "Description"}</p>
                <p className="mt-2 text-xs text-white/60">After publish: go to My Business and complete tracking to unlock requests.</p>
              </div>
              {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
              <button
                onClick={handlePublish}
                disabled={submitting}
                className="mt-6 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Publishing..." : "Publish Offer"}
              </button>
            </section>
          )}

          {step === 4 && (
            <section className="mt-8 text-center md:mt-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/10">
                <CheckCircle2 className="h-7 w-7 text-[#7ff5fb]" />
              </div>
              <h2 className="mt-4 text-3xl font-bold">Offer Live</h2>
              <p className="mt-2 text-sm text-white/70">Your first offer is live in marketplace as Coming soon. Next, open My Business and set up tracking to unlock affiliate requests.</p>
              <button
                onClick={() => router.replace("/business/my-business")}
                className="mt-6 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Go To Dashboard
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
