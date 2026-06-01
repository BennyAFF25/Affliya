"use client";

import { useMemo, useState } from "react";
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

type TrackingStack = "shopify" | "woocommerce" | "wix" | "custom";

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const { session, isLoading } = useSessionContext();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [offerName, setOfferName] = useState("");
  const [productImage, setProductImage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [description, setDescription] = useState("");

  const [trackingStack, setTrackingStack] = useState<TrackingStack>("shopify");
  const [trackingInstalled, setTrackingInstalled] = useState(false);

  const progressLabel = useMemo(() => {
    if (step >= 4) return "Complete";
    return `Step ${step} of 4`;
  }, [step]);

  if (!isLoading && !session?.user) {
    router.replace("/login?role=business&next=/onboarding/for-business");
  }

  const canPreview =
    offerName.trim() &&
    websiteUrl.trim() &&
    commissionAmount.trim() &&
    description.trim();

  const handlePublish = async () => {
    if (!session?.user?.email) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        title: offerName.trim(),
        description: description.trim(),
        business_email: session.user.email,
        website: websiteUrl.trim(),
        commission: Number(commissionAmount || 0),
        price: Number(commissionAmount || 0),
        commission_value: Number(commissionAmount || 0),
        type: "one-time",
        created_at: new Date().toISOString(),
        logo_url: productImage.trim() || null,
        site_host: trackingStack,
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

      setStep(5);
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
                <label className="text-sm text-white/80">Product Image URL
                  <input value={productImage} onChange={(e) => setProductImage(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
                <label className="text-sm text-white/80 md:col-span-2">Website URL
                  <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
                <label className="text-sm text-white/80">Commission Amount
                  <input value={commissionAmount} onChange={(e) => setCommissionAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
                <label className="text-sm text-white/80 md:col-span-2">Description
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none" />
                </label>
              </div>
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
              <h2 className="text-2xl font-bold">Track clicks, leads and sales.</h2>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["shopify", "Shopify"],
                  ["woocommerce", "WooCommerce"],
                  ["wix", "Wix"],
                  ["custom", "Custom Website"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTrackingStack(value as TrackingStack)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      trackingStack === value
                        ? "border-[#00C2CB]/60 bg-[#00C2CB]/12 text-white"
                        : "border-[var(--border)] bg-[#1a1a1a] text-white/80"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-[var(--border)] bg-[#202020] p-4 text-sm text-white/75">
                Install the tracking snippet on your checkout/thank-you path so Nettmark can track conversions accurately.
              </div>
              <button
                onClick={() => {
                  setTrackingInstalled(true);
                  setStep(4);
                }}
                className="mt-6 rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Tracking Installed
              </button>
            </section>
          )}

          {step === 4 && (
            <section className="mt-8 md:mt-10">
              <h2 className="text-2xl font-bold">Publish Offer</h2>
              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[#202020] p-4 text-sm text-white/80">
                <p className="flex items-center gap-2"><Store className="h-4 w-4" /> {offerName || "Offer name"}</p>
                <p className="mt-2 flex items-center gap-2"><LinkIcon className="h-4 w-4" /> {websiteUrl || "Website URL"}</p>
                <p className="mt-2 flex items-center gap-2"><BadgeDollarSign className="h-4 w-4" /> Commission: ${commissionAmount || "0"}</p>
                <p className="mt-2 flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4" /> {description || "Description"}</p>
                <p className="mt-2 text-xs text-white/60">Tracking: {trackingStack} {trackingInstalled ? "installed" : "pending"}</p>
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

          {step === 5 && (
            <section className="mt-8 text-center md:mt-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/10">
                <CheckCircle2 className="h-7 w-7 text-[#7ff5fb]" />
              </div>
              <h2 className="mt-4 text-3xl font-bold">Offer Live</h2>
              <p className="mt-2 text-sm text-white/70">Your first offer is published and visible to affiliates.</p>
              <button
                onClick={() => router.replace("/business/dashboard")}
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
