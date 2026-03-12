"use client";
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

  useEffect(() => {
    const fetchOffer = async () => {
      if (!offerId || !user?.email) return;

      setLoading(true);
      setError(null);

      const { data, error } = await (supabase as any)
        .from("offers")
        .select(
          "id,business_email,title,description,commission,type,price,currency,commission_value",
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
      setLoading(false);
    };

    fetchOffer();
  }, [offerId, user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !offerId) return;

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
