"use client";
import React from "react";
import Link from "next/link";
import { useSession } from "@supabase/auth-helpers-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  meta_page_id?: string | null;
  meta_page_name?: string | null;
  meta_ad_account_id?: string | null;
  meta_ad_account_name?: string | null;
  meta_pixel_id?: string | null;
  meta_pixel_name?: string | null;
}

type MetaConnection = {
  page_id: string;
  page_name: string | null;
  ad_account_id: string;
  ad_account_name: string | null;
  pixel_id: string | null;
};

type PixelOption = {
  id: string;
  name: string;
  ad_account_id: string;
};

function getMetaStatus(offer: Pick<Offer, "meta_page_id" | "meta_ad_account_id" | "meta_pixel_id">) {
  if (offer.meta_page_id && offer.meta_ad_account_id && offer.meta_pixel_id) {
    return {
      label: "Meta ready for sales",
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      helper: "Page, ad account, and pixel are attached.",
    };
  }

  if (offer.meta_page_id && offer.meta_ad_account_id) {
    return {
      label: "Meta ready",
      tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
      helper: "Traffic and engagement campaigns are ready. Sales campaigns still need a pixel.",
    };
  }

  if (offer.meta_page_id || offer.meta_ad_account_id || offer.meta_pixel_id) {
    return {
      label: "Meta partially ready",
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      helper: "Finish attaching the remaining Meta assets before launch.",
    };
  }

  return {
    label: "Meta not connected",
    tone: "border-white/10 bg-white/5 text-white/70",
    helper: "This offer can still be used, but it is not ready for Meta launch yet.",
  };
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
  const [saving, setSaving] = useState(false);
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
  const [metaConnections, setMetaConnections] = useState<MetaConnection[]>([]);
  const [availablePixels, setAvailablePixels] = useState<PixelOption[]>([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [selectedPixel, setSelectedPixel] = useState("");
  const [pixelStatus, setPixelStatus] = useState<
    "idle" | "loading" | "ok" | "empty" | "error"
  >("idle");
  const [pixelStatusMsg, setPixelStatusMsg] = useState("");
  const [pixelsLoading, setPixelsLoading] = useState(false);
  const lastLoadedAdAccountRef = useRef<string>("");

  const parseIdList = (value: string) =>
    value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const uniquePages = useMemo(() => {
    const map = new Map<string, MetaConnection>();
    metaConnections.forEach((c) => {
      if (c.page_id && !map.has(c.page_id)) map.set(c.page_id, c);
    });
    return Array.from(map.values());
  }, [metaConnections]);

  const uniqueAdAccounts = useMemo(() => {
    const map = new Map<string, MetaConnection>();
    metaConnections.forEach((c) => {
      if (c.ad_account_id && !map.has(c.ad_account_id)) map.set(c.ad_account_id, c);
    });
    return Array.from(map.values());
  }, [metaConnections]);

  useEffect(() => {
    const fetchOffer = async () => {
      if (!offerId || !user?.email) return;

      setLoading(true);
      setError(null);

      const { data, error } = await (supabase as any)
        .from("offers")
        .select(
          "id,business_email,title,description,commission,type,price,currency,commission_value,conversion_scope,eligible_product_ids,eligible_variant_ids,meta_page_id,meta_page_name,meta_ad_account_id,meta_ad_account_name,meta_pixel_id,meta_pixel_name",
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
      setSelectedPage(data.meta_page_id || "");
      setSelectedAdAccount(data.meta_ad_account_id || "");
      setSelectedPixel(data.meta_pixel_id || "");
      setLoading(false);
    };

    fetchOffer();
  }, [offerId, user?.email]);

  useEffect(() => {
    const fetchMetaConnections = async () => {
      if (!user?.email) return;

      const { data } = await (supabase as any)
        .from("meta_connections")
        .select("page_id, page_name, ad_account_id, ad_account_name, pixel_id")
        .eq("business_email", user.email as string);

      if (data) setMetaConnections(data as MetaConnection[]);
    };

    fetchMetaConnections();
  }, [user?.email]);

  const loadPixels = async (overrideAdAccountId?: string) => {
    const adAccountId = overrideAdAccountId || selectedAdAccount;
    if (!adAccountId || !user?.email) return;

    setPixelsLoading(true);
    setPixelStatus("loading");
    setPixelStatusMsg("Loading pixels from Meta…");

    try {
      const res = await fetch("/api/meta/get-datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_email: user.email,
          ad_account_id: adAccountId,
        }),
      });

      const json = await res.json().catch(() => null);
      const pixels = Array.isArray(json?.pixels) ? json.pixels : [];

      setAvailablePixels(pixels);
      if (pixels.length > 0) {
        setPixelStatus("ok");
        setPixelStatusMsg(`${pixels.length} pixel${pixels.length === 1 ? "" : "s"} available`);
        if (!pixels.some((pixel: PixelOption) => pixel.id === selectedPixel)) {
          setSelectedPixel("");
        }
      } else {
        setPixelStatus("empty");
        setPixelStatusMsg(json?.message || "No pixels found for this ad account.");
        setSelectedPixel("");
      }
      lastLoadedAdAccountRef.current = adAccountId;
    } catch (err) {
      console.error("[EditOffer] failed to load pixels", err);
      setPixelStatus("error");
      setPixelStatusMsg("Could not load pixels right now.");
    } finally {
      setPixelsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedAdAccount) {
      setAvailablePixels([]);
      setSelectedPixel("");
      setPixelStatus("idle");
      setPixelStatusMsg("");
      lastLoadedAdAccountRef.current = "";
      return;
    }

    if (lastLoadedAdAccountRef.current !== selectedAdAccount) {
      void loadPixels(selectedAdAccount);
    }
  }, [selectedAdAccount]);

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

    if ((selectedPage && !selectedAdAccount) || (!selectedPage && selectedAdAccount)) {
      setError("Choose both a Meta page and ad account, or leave both empty for now.");
      return;
    }

    const selectedPageObj = uniquePages.find((c) => c.page_id === selectedPage);
    const selectedAdAccountObj = uniqueAdAccounts.find(
      (c) => c.ad_account_id === selectedAdAccount,
    );
    const selectedPixelObj = availablePixels.find((p) => p.id === selectedPixel);

    setSaving(true);
    setError(null);

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
        meta_page_id: selectedPage || null,
        meta_page_name: selectedPageObj?.page_name || null,
        meta_ad_account_id: selectedAdAccount || null,
        meta_ad_account_name: selectedAdAccountObj?.ad_account_name || null,
        meta_pixel_id: selectedPixel || null,
        meta_pixel_name: selectedPixelObj?.name || null,
      })
      .eq("id", offerId as string)
      .eq("business_email", user.email as string);

    setSaving(false);

    if (error) {
      console.error("[EditOffer] failed to save offer", error);
      setError("Could not save your changes right now.");
      return;
    }

    router.push("/business/my-business");
  };

  const metaStatus = getMetaStatus({
    meta_page_id: selectedPage || null,
    meta_ad_account_id: selectedAdAccount || null,
    meta_pixel_id: selectedPixel || null,
  });

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-[var(--background)] p-8 text-[var(--foreground)]">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-[var(--foreground)]">
            Edit Offer
          </h1>
          <p className="text-[var(--muted-foreground)]">
            Fine‑tune your offer details and attach Meta assets whenever this offer is ready for campaign launch.
          </p>
        </div>
        <Link
          href="/business/my-business/connect-meta"
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--input-background)]"
        >
          Manage Meta connections
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_0_40px_rgba(0,0,0,0.12)]">
        {loading ? (
          <p className="text-[var(--muted-foreground)]">Loading offer…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : offer ? (
          <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
            <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${metaStatus.tone}`}>
              {metaStatus.label}
            </div>
            <p className="-mt-5 text-sm text-[var(--muted-foreground)]">{metaStatus.helper}</p>

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
                  </div>
                </>
              )}
            </div>

            <div id="meta-setup" className="rounded-2xl border border-[var(--border)] bg-[var(--input-background)]/30 p-5 space-y-5 scroll-mt-24">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Meta setup</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Attach Meta assets to this offer</h2>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Add a page and ad account when you want this offer launch-ready for Meta. Add a pixel only when you need Sales or Conversion campaigns.
                </p>
              </div>

              {metaConnections.length > 0 ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                      Meta page
                    </label>
                    <select
                      value={selectedPage}
                      onChange={(e) => setSelectedPage(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                    >
                      <option value="">Skip for now</option>
                      {uniquePages.map((conn) => (
                        <option key={conn.page_id} value={conn.page_id}>
                          {conn.page_name || conn.page_id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                      Meta ad account
                    </label>
                    <select
                      value={selectedAdAccount}
                      onChange={(e) => setSelectedAdAccount(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                    >
                      <option value="">Skip for now</option>
                      {uniqueAdAccounts.map((conn) => (
                        <option key={conn.ad_account_id} value={conn.ad_account_id}>
                          {conn.ad_account_name || conn.ad_account_id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="block text-xs font-medium tracking-wide text-[var(--muted-foreground)]">
                        Meta pixel
                      </label>
                      {pixelStatus !== "idle" && (
                        <span className={`rounded-full border px-2 py-1 text-[11px] ${
                          pixelStatus === "ok"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                            : pixelStatus === "empty"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                              : pixelStatus === "loading"
                                ? "border-white/10 bg-white/5 text-white/70"
                                : "border-red-500/30 bg-red-500/10 text-red-200"
                        }`}>
                          {pixelStatus === "loading"
                            ? "Loading"
                            : pixelStatus === "ok"
                              ? "Pixels found"
                              : pixelStatus === "empty"
                                ? "No pixels"
                                : "Error"}
                        </span>
                      )}
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={pixelsLoading || !selectedAdAccount || !user?.email}
                        onClick={() => {
                          lastLoadedAdAccountRef.current = "";
                          void loadPixels(selectedAdAccount);
                        }}
                        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pixelsLoading ? "Loading…" : "Refresh pixels"}
                      </button>
                      {pixelStatusMsg && (
                        <span className="text-xs text-[var(--muted-foreground)]">{pixelStatusMsg}</span>
                      )}
                    </div>

                    <select
                      value={selectedPixel}
                      onChange={(e) => setSelectedPixel(e.target.value)}
                      disabled={!selectedAdAccount}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Skip pixel for now</option>
                      {availablePixels.map((pixel) => (
                        <option key={pixel.id} value={pixel.id}>
                          {pixel.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      Traffic and engagement can work without a pixel. Sales campaigns will require one later.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--muted-foreground)]">
                  No Meta assets connected yet. Connect Meta first, then come back here to finish this offer’s campaign setup.
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[var(--primary)] px-6 py-2 font-semibold text-[var(--primary-foreground)] shadow-[0_0_20px_rgba(0,194,203,0.25)] transition-all hover:brightness-110 hover:shadow-[0_0_30px_rgba(0,194,203,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        ) : (
          <p className="text-[var(--muted-foreground)]">Offer not found.</p>
        )}
      </div>
    </div>
  );
}
