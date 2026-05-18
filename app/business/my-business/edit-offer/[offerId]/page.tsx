"use client";
import React from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";

interface Offer {
  id: string;
  business_email: string;
  title: string;
  description: string;
  commission: number;
  type: string;
  price?: number | null;
  currency?: string | null;
  commission_value?: number | null;
  conversion_scope?: "store_wide" | "specific_products" | null;
  eligible_product_ids?: string[] | null;
  eligible_variant_ids?: string[] | null;
}

export default function EditOfferPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = Array.isArray(params.offerId)
    ? params.offerId[0]
    : params.offerId;

  const session = useSession();
  const user = session?.user;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [commission, setCommission] = useState("");
  const [type, setType] = useState("one-time");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [commissionValue, setCommissionValue] = useState("");
  const [conversionScope, setConversionScope] = useState<
    "store_wide" | "specific_products"
  >("store_wide");
  const [eligibleProductIdsText, setEligibleProductIdsText] = useState("");
  const [eligibleVariantIdsText, setEligibleVariantIdsText] = useState("");

  const parseIdList = (value: string) =>
    value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  useEffect(() => {
    const fetchOffer = async () => {
      if (!offerId || !user?.email) return;

      setLoading(true);
      setError(null);

      const { data, error } = await (supabase as any)
        .from("offers")
        .select(
          "id,business_email,title,description,commission,type,price,currency,commission_value,conversion_scope,eligible_product_ids,eligible_variant_ids",
        )
        .eq("id", offerId as string)
        .eq("business_email", user.email as string)
        .single();

      if (error || !data) {
        console.error("[EditOffer] failed to load offer", error);
        setError("Offer not found.");
        setLoading(false);
        return;
      }

      setOffer(data as Offer);
      setBusinessName(data.title || "");
      setDescription(data.description || "");
      setCommission(data.commission?.toString() || "");
      setPrice(data.price != null ? data.price.toString() : "");
      setCurrency(data.currency || "USD");
      setType(data.type || "one-time");
      setCommissionValue(
        data.commission_value != null ? data.commission_value.toString() : "",
      );
      setConversionScope(data.conversion_scope || "store_wide");
      setEligibleProductIdsText((data.eligible_product_ids || []).join("\n"));
      setEligibleVariantIdsText((data.eligible_variant_ids || []).join("\n"));
      setLoading(false);
    };

    fetchOffer();
  }, [offerId, user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !offerId) return;

    const parsedEligibleProductIds = parseIdList(eligibleProductIdsText);
    const parsedEligibleVariantIds = parseIdList(eligibleVariantIdsText);

    if (
      conversionScope === "specific_products" &&
      parsedEligibleProductIds.length === 0 &&
      parsedEligibleVariantIds.length === 0
    ) {
      setError(
        "Add at least one eligible product ID or variant ID for a product-scoped offer.",
      );
      return;
    }

    const { error } = await (supabase as any)
      .from("offers")
      .update({
        title: businessName,
        description,
        commission: Number(commission),
        type,
        price: price ? Number(price) : null,
        currency,
        commission_value: commissionValue ? Number(commissionValue) : null,
        conversion_scope: conversionScope,
        eligible_product_ids: parsedEligibleProductIds,
        eligible_variant_ids: parsedEligibleVariantIds,
      })
      .eq("id", offerId as string)
      .eq("business_email", user.email as string);

    if (error) {
      console.error("[EditOffer] failed to save offer", error);
      return;
    }

    router.push("/business/my-business");
  };

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-[var(--background)] p-8 text-[var(--foreground)]">
      <h1 className="mb-2 text-3xl font-semibold text-[var(--foreground)]">
        Edit Offer
      </h1>
      <p className="mb-8 text-[var(--muted-foreground)]">
        Fine‑tune your offer details and keep everything up to date.
      </p>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_0_40px_rgba(0,0,0,0.12)]">
        {loading ? (
          <p className="text-[var(--muted-foreground)]">Loading offer…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : offer ? (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
            {/* Business Name */}
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                required
              />
            </div>

            {/* Commission (%) */}
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                Commission (%)
              </label>
              <input
                type="number"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                required
              />
            </div>

            {/* Product Price */}
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                Product Price (Optional)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              >
                <option value="USD">USD</option>
                <option value="AUD">AUD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Commission Value */}
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                Commission Value (Optional)
              </label>
              <input
                type="number"
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              >
                <option value="one-time">One-Time</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--input-background)]/40 p-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                  Commission scope
                </label>
                <select
                  value={conversionScope}
                  onChange={(e) =>
                    setConversionScope(
                      e.target.value as "store_wide" | "specific_products",
                    )
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                >
                  <option value="store_wide">Entire store / any product purchased</option>
                  <option value="specific_products">Only specific products or variants</option>
                </select>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  <strong className="text-[var(--foreground)]">Entire store</strong> pays on the eligible order value no matter what product was bought. <strong className="text-[var(--foreground)]">Specific products</strong> only pays when tracked order data includes matching product or variant IDs.
                </p>
              </div>

              {conversionScope === "specific_products" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                      Eligible product IDs
                    </label>
                    <textarea
                      value={eligibleProductIdsText}
                      onChange={(e) => setEligibleProductIdsText(e.target.value)}
                      placeholder="Example: 1234567890 or gid://shopify/Product/1234567890"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                      rows={4}
                    />
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      One per line or comma-separated. Shopify numeric IDs and full <code>gid://</code> IDs both work.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                      Eligible variant IDs / SKUs (optional)
                    </label>
                    <textarea
                      value={eligibleVariantIdsText}
                      onChange={(e) => setEligibleVariantIdsText(e.target.value)}
                      placeholder="Example: 987654321 or gid://shopify/ProductVariant/987654321 or SKU-RED-L"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                      rows={3}
                    />
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      Add variant IDs if only certain variants should pay. SKUs can work too when your checkout payload includes them.
                    </p>
                  </div>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                    If a shopper buys something outside these IDs, Nettmark still records the conversion, but payout is skipped for that order instead of overpaying the affiliate.
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              className="rounded-full bg-[var(--primary)] px-6 py-2 font-semibold text-[var(--primary-foreground)] shadow-[0_0_20px_rgba(0,194,203,0.25)] transition-all hover:brightness-110 hover:shadow-[0_0_30px_rgba(0,194,203,0.35)]"
            >
              Save Changes
            </button>
          </form>
        ) : (
          <p className="text-[var(--muted-foreground)]">Offer not found.</p>
        )}
      </div>
    </div>
  );
}
