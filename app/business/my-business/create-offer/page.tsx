"use client";

import "@/globals.css";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/../components/ui";
import { v4 as uuidv4 } from "uuid";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

function CreateOfferPageInner() {
  const router = useRouter();
  const supabase = createPagesBrowserClient();

  const searchParams = useSearchParams();
  const isOnboard = searchParams?.get("onboard") === "1" || searchParams?.get("onboard") === "tracking";
  const [showOnboard, setShowOnboard] = useState(false);

  // Fire-and-forget emails (Resend). Never block the user flow.
  // NOTE: We no longer use the legacy `/api/email` router.
  const fireEmail = async (path: string, payload: Record<string, any>) => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        window.location.origin;

      await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("[Email send failed]", path, err);
    }
  };

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [siteHost, setSiteHost] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isOnboard || !userEmail) return;
      const { data, error } = await supabase
        .from("offers")
        .select("id")
        .eq("business_email", userEmail)
        .limit(1);

      if (!cancelled) setShowOnboard(!error && (!data || data.length === 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnboard, userEmail, supabase]);

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [commission, setCommission] = useState("");
  const [type, setType] = useState<"one-time" | "recurring">("one-time");
  const [price, setPrice] = useState("");
  const [commissionValue, setCommissionValue] = useState(0);
  const [currency, setCurrency] = useState("USD");
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

  // offer profile fields
  const [profileHeadline, setProfileHeadline] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [heroImageFiles, setHeroImageFiles] = useState<File[]>([]);
  const [heroImagePreviews, setHeroImagePreviews] = useState<string[]>([]);
  const [avgConversionRate, setAvgConversionRate] = useState("");
  const [avgEpc, setAvgEpc] = useState("");

  // payout structure fields
  const [payoutMode, setPayoutMode] = useState<"upfront" | "spread">("upfront");
  const [payoutInterval, setPayoutInterval] = useState<"monthly">("monthly");
  const [payoutCycles, setPayoutCycles] = useState<number>(12);

  const [step, setStep] = useState(1);

  const [metaConnections, setMetaConnections] = useState<
    {
      page_id: string;
      page_name: string | null;
      ad_account_id: string;
      ad_account_name: string | null;
      pixel_id: string | null;
    }[]
  >([]);

  // --- De-duplicate Meta connections for pages and ad accounts ---
  const uniquePages = React.useMemo(() => {
    const map = new Map<string, any>();
    metaConnections.forEach((c) => {
      if (c.page_id && !map.has(c.page_id)) map.set(c.page_id, c);
    });
    return Array.from(map.values());
  }, [metaConnections]);

  const uniqueAdAccounts = React.useMemo(() => {
    const map = new Map<string, any>();
    metaConnections.forEach((c) => {
      if (c.ad_account_id && !map.has(c.ad_account_id))
        map.set(c.ad_account_id, c);
    });
    return Array.from(map.values());
  }, [metaConnections]);

  const [availablePixels, setAvailablePixels] = useState<
    { id: string; name: string; ad_account_id: string }[]
  >([]);
  const [pixelsLoading, setPixelsLoading] = useState(false);

  const [pixelStatus, setPixelStatus] = useState<
    "idle" | "loading" | "ok" | "empty" | "error"
  >("idle");
  const [pixelStatusMsg, setPixelStatusMsg] = useState<string>("");
  const lastLoadedAdAccountRef = React.useRef<string>("");

  const [selectedPage, setSelectedPage] = useState("");
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [selectedPixel, setSelectedPixel] = useState<string>("");

  const hasMetaConnections = metaConnections.length > 0;

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Auto-calc commissionValue
  useEffect(() => {
    const parsedPrice = parseFloat(price);
    const parsedCommission = parseFloat(commission);
    if (!isNaN(parsedPrice) && !isNaN(parsedCommission)) {
      const calculated = (parsedPrice * parsedCommission) / 100;
      setCommissionValue(Math.round(calculated));
    } else {
      setCommissionValue(0);
    }
  }, [price, commission]);

  useEffect(() => {
    const fetchMetaConnections = async () => {
      if (!userEmail) return;

      const { data } = await supabase
        .from("meta_connections")
        .select("page_id, page_name, ad_account_id, ad_account_name, pixel_id")
        .eq("business_email", userEmail);

      if (data) setMetaConnections(data);
    };

    fetchMetaConnections();
  }, [userEmail, supabase]);

  // Pixel loader with robust response handling + visible status
  const loadPixels = async (overrideAdAccountId?: string) => {
    const adAccountId = overrideAdAccountId || selectedAdAccount;

    console.log("[🧪 loadPixels() ENTERED]", {
      adAccountId,
      selectedAdAccount,
      userEmail,
    });

    if (!adAccountId || !userEmail) {
      const msg = "Select an ad account first.";
      console.warn("[⚠️ Load Pixels] Missing ad account or user email", {
        adAccountId,
        userEmail,
      });
      setPixelStatus("error");
      setPixelStatusMsg(msg);
      return;
    }

    setPixelsLoading(true);
    setPixelStatus("loading");
    setPixelStatusMsg("Fetching pixels…");
    setAvailablePixels([]);

    const started = Date.now();

    try {
      const payload = {
        business_email: userEmail,
        ad_account_id: adAccountId,
      };

      console.log("[📡 Fetching Pixels] POST /api/meta/get-datasets", payload);

      // Primary: POST
      let res = await fetch("/api/meta/get-datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let raw = await res.text();
      console.log("[📥 Pixel API Raw Response]", { status: res.status, raw });

      // Fallback: GET with querystring if POST handler isn’t wired
      if (!res.ok) {
        const qs = new URLSearchParams({
          ad_account_id: adAccountId,
        }).toString();
        console.warn("[↩️ Pixel API POST failed, trying GET]", {
          status: res.status,
          qs,
        });
        res = await fetch(`/api/meta/get-datasets?${qs}`, { method: "GET" });
        raw = await res.text();
        console.log("[📥 Pixel API Raw Response (GET fallback)]", {
          status: res.status,
          raw,
        });
      }

      if (!res.ok) {
        setPixelStatus("error");
        setPixelStatusMsg(`Pixel fetch failed (HTTP ${res.status}).`);
        return;
      }

      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error("[❌ Pixel API JSON parse failed]", e);
        setPixelStatus("error");
        setPixelStatusMsg("Pixel response was not valid JSON.");
        return;
      }

      console.log("[🧠 Pixel API Parsed JSON]", json);

      const pixels = (json?.pixels ||
        json?.datasets ||
        json?.data ||
        []) as any[];
      console.log("[📊 Normalised pixels]", pixels);

      const normalised = (Array.isArray(pixels) ? pixels : [])
        .map((p: any) => ({
          id: String(p?.id || ""),
          name: String(p?.name || `Pixel ${p?.id || ""}`),
          ad_account_id: String(p?.ad_account_id || adAccountId),
        }))
        .filter((p) => p.id);

      setAvailablePixels(normalised);

      const tookMs = Date.now() - started;

      if (normalised.length === 0) {
        setPixelStatus("empty");
        setPixelStatusMsg(`No pixels found for this ad account. (${tookMs}ms)`);
        return;
      }

      // If user hasn't chosen one yet, auto-select first
      if (!selectedPixel) {
        setSelectedPixel(normalised[0].id);
      }

      setPixelStatus("ok");
      setPixelStatusMsg(`Loaded ${normalised.length} pixel(s). (${tookMs}ms)`);
    } catch (err) {
      console.error("[❌ Pixel Fetch Crash]", err);
      setPixelStatus("error");
      setPixelStatusMsg("Pixel fetch crashed. Check console.");
    } finally {
      setPixelsLoading(false);
    }
  };

  // Auto-load pixels whenever the ad account changes
  useEffect(() => {
    if (!userEmail) return;
    if (!selectedAdAccount) return;

    if (lastLoadedAdAccountRef.current === selectedAdAccount) return;
    lastLoadedAdAccountRef.current = selectedAdAccount;

    setSelectedPixel("");
    setAvailablePixels([]);
    setPixelStatus("idle");
    setPixelStatusMsg("");

    const t = setTimeout(() => {
      loadPixels(selectedAdAccount);
    }, 50);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdAccount, userEmail]);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault?.();

    if (!userEmail) return;
    const parsedEligibleProductIds = parseIdList(eligibleProductIdsText);
    const parsedEligibleVariantIds = parseIdList(eligibleVariantIdsText);

    if (!siteHost) {
      alert("Please select a Website Platform/Host.");
      return;
    }

    if (
      conversionScope === "specific_products" &&
      parsedEligibleProductIds.length === 0 &&
      parsedEligibleVariantIds.length === 0
    ) {
      alert(
        "Add at least one eligible product ID or variant ID for a product-scoped offer.",
      );
      setStep(2);
      return;
    }

    let uploadedLogoUrl: string | null = null;

    if (logoFile) {
      const filePath = `${Date.now()}_${logoFile.name}`;
      const { error } = await supabase.storage
        .from("offer-logos")
        .upload(filePath, logoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: logoFile.type,
        });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("offer-logos")
          .getPublicUrl(filePath);
        uploadedLogoUrl = urlData?.publicUrl || null;
        setLogoUrl(uploadedLogoUrl);
      } else {
        console.error("[❌ Logo Upload Error]", error.message);
      }
    }

    // multi-image upload for profile / carousel
    let uploadedHeroUrl: string | null = null;
    const uploadedImageUrls: string[] = [];

    if (heroImageFiles && heroImageFiles.length > 0) {
      for (const file of heroImageFiles) {
        const heroPath = `${Date.now()}_${file.name}`;
        const { error: heroError } = await supabase.storage
          .from("profile-images")
          .upload(heroPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (!heroError) {
          const { data: heroUrlData } = supabase.storage
            .from("profile-images")
            .getPublicUrl(heroPath);
          const publicUrl = heroUrlData?.publicUrl || null;
          if (publicUrl) {
            uploadedImageUrls.push(publicUrl);
            if (!uploadedHeroUrl) uploadedHeroUrl = publicUrl;
          }
        } else {
          console.error("[❌ Hero Image Upload Error]", heroError.message);
        }
      }
    }

    const metaPageId = selectedPage || null;
    const metaAdAccountId = selectedAdAccount || null;
    const metaPixelId = selectedPixel || null;

    // Resolve selected Meta asset names (for display + preventing cross-over confusion)
    const selectedPageObj = uniquePages.find((c) => c.page_id === selectedPage);
    const selectedAdAccountObj = uniqueAdAccounts.find(
      (c) => c.ad_account_id === selectedAdAccount,
    );
    const selectedPixelObj = availablePixels.find(
      (p) => p.id === selectedPixel,
    );

    const metaPageName = selectedPageObj?.page_name || null;
    const metaAdAccountName = selectedAdAccountObj?.ad_account_name || null;
    const metaPixelName = selectedPixelObj?.name || null;

    const finalPayoutMode = type === "recurring" ? payoutMode : "upfront";
    const finalPayoutInterval =
      type === "recurring" ? payoutInterval : "monthly";
    const finalPayoutCycles =
      type === "recurring" && payoutMode === "spread" ? payoutCycles : null;

    const newOffer = {
      id: uuidv4(),
      title: businessName,
      description,
      business_email: userEmail,
      website,
      commission: Number(commission),
      created_at: new Date().toISOString(),
      meta_ad_account_id: metaAdAccountId,
      meta_ad_account_name: metaAdAccountName,
      meta_page_id: metaPageId,
      meta_page_name: metaPageName,
      meta_pixel_id: metaPixelId,
      meta_pixel_name: metaPixelName,
      price: Number(price),
      commission_value: commissionValue,
      currency,
      conversion_scope: conversionScope,
      eligible_product_ids: parsedEligibleProductIds,
      eligible_variant_ids: parsedEligibleVariantIds,
      type,
      logo_url: uploadedLogoUrl,
      site_host: siteHost,
      profile_headline: profileHeadline || null,
      profile_bio: profileBio || null,
      hero_image_url: uploadedHeroUrl || null,
      image_urls: uploadedImageUrls.length ? uploadedImageUrls : null,
      avg_conversion_rate: avgConversionRate ? Number(avgConversionRate) : null,
      avg_epc: avgEpc ? Number(avgEpc) : null,
      payout_mode: finalPayoutMode,
      payout_interval: finalPayoutInterval,
      payout_cycles: finalPayoutCycles,
    };

    const { error: insertError } = await supabase
      .from("offers")
      .insert([newOffer]);
    if (insertError) {
      console.error("[❌ Offer Insert Error]", insertError.message);
      return;
    }

    // Emails: offer created (non-blocking)
    try {
      const cleanBusinessEmail = (userEmail || "").trim().toLowerCase();
      if (cleanBusinessEmail) {
        // Notify affiliates (broadcast handled server-side)
        void fireEmail("/api/emails/new-offer", {
          offerId: newOffer.id,
          offerTitle: newOffer.title,
          businessEmail: cleanBusinessEmail,
          website: newOffer.website,
          currency: newOffer.currency,
          commission: newOffer.commission,
          price: newOffer.price,
        });

        // Founder notify (internal)
        void fireEmail("/api/emails/founder-notify", {
          type: "offer_created",
          role: "business",
          email: cleanBusinessEmail,
          offerId: newOffer.id,
          offerTitle: newOffer.title,
        });
      }
    } catch (e) {
      console.warn("[Offer email trigger failed]", e);
    }

    if (isOnboard) {
      router.replace(
        `/business/setup-tracking?offerId=${newOffer.id}&onboard=1`,
      );
      return;
    }

    setBusinessName("");
    setDescription("");
    setWebsite("");
    setCommission("");
    setPrice("");
    setCurrency("USD");
    setConversionScope("store_wide");
    setEligibleProductIdsText("");
    setEligibleVariantIdsText("");
    setType("one-time");
    setLogoFile(null);
    setLogoUrl(null);
    setSiteHost("");

    setProfileHeadline("");
    setProfileBio("");
    setHeroImageFiles([]);
    setHeroImagePreviews([]);
    setAvgConversionRate("");
    setAvgEpc("");

    setPayoutMode("upfront");
    setPayoutInterval("monthly");
    setPayoutCycles(12);

    setSelectedPage("");
    setSelectedAdAccount("");
    setSelectedPixel("");

    router.push("/business/my-business");
  };

  return (
    <div className="create-offer-theme min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 lg:py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card variant="elevated" className="px-5 py-6 sm:px-6">
          <PageHeader
            eyebrow="Offer builder"
            title="Upload your offer"
            description="Create a clear, marketplace-ready offer affiliates can scan and request quickly."
          />
        </Card>

        <Card className="space-y-6 p-5 sm:p-6">
          {showOnboard && (
            <div className="mb-6 rounded-xl border border-[#1f2a2a] bg-[#0f1313] p-5">
              <div className="text-[#7ff5fb] text-xs tracking-wide">
                Onboarding • Step 2 of 3
              </div>
              <h2 className="mt-1 text-white text-lg font-semibold">
                Create your first offer
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                After you save, we’ll take you straight to{" "}
                <span className="text-[#00C2CB]">Setup Tracking</span> for this
                offer.
              </p>
              <div className="mt-3 text-xs text-gray-400">
                Need help?{" "}
                <Link
                  href="/business/setup-tracking"
                  className="text-[#7ff5fb] underline"
                >
                  View tracking instructions
                </Link>
              </div>
            </div>
          )}

          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-[#00C2CB]">
                Business Info
              </h2>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Business Name
                </label>
                <Input
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Business Name"

                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Product/Service Description
                </label>
                <Textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you offering?"

                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Website
                </label>
                <Input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"

                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Website Platform/Host
                </label>
                <Select
                  required
                  value={siteHost}
                  onChange={(e) => setSiteHost(e.target.value)}

                >
                  <option value="">Select platform/host</option>
                  <option value="Shopify">Shopify</option>
                  <option value="Wix">Wix</option>
                  <option value="WooCommerce">WooCommerce</option>
                  <option value="Squarespace">Squarespace</option>
                  <option value="Custom/Other">Custom/Other</option>
                </Select>
              </div>

              <div className="mt-8 border-t border-[#262626] pt-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#7ff5fb] uppercase tracking-wide">
                  Offer profile (optional)
                </h3>

                <div>
                  <label className="block font-semibold text-white mb-1">
                    Profile headline
                  </label>
                  <Input
                    value={profileHeadline}
                    onChange={(e) => setProfileHeadline(e.target.value)}
                    placeholder="Short hook affiliates will see first"

                  />
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">
                    Profile bio / story
                  </label>
                  <Textarea
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="Explain who you are, who this offer is for, and why it converts."

                    rows={4}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">
                    Profile / brand images
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setHeroImageFiles(files);
                      const previews = files.map((file) =>
                        URL.createObjectURL(file),
                      );
                      setHeroImagePreviews(previews);
                    }}

                  />
                  <p className="mt-1 text-xs text-gray-400">
                    These images will be used on your offer profile page (e.g.
                    product shots or brand hero images).
                  </p>

                  {heroImagePreviews.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-400 mb-1">Preview:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {heroImagePreviews.map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt={`Profile preview ${idx + 1}`}
                            className="w-full max-h-32 object-cover rounded-md border border-[#2a2a2a]"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Avg conversion rate (%){" "}
                      <span className="text-xs text-gray-500">(optional)</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={avgConversionRate}
                      onChange={(e) => setAvgConversionRate(e.target.value)}
                      placeholder="e.g. 3.5"

                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Avg EPC ({currency}){" "}
                      <span className="text-xs text-gray-500">(optional)</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={avgEpc}
                      onChange={(e) => setAvgEpc(e.target.value)}
                      placeholder="e.g. 1.20"

                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold text-[#00C2CB]">
                Offer Pricing
              </h2>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Product Value ($)
                </label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="200"

                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Commission (%)
                </label>
                <Input
                  type="number"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="30"

                />
              </div>

              <div className="text-sm text-white">
                Est. Commission Value:{" "}
                <span className="text-[#00C2CB] font-bold">
                  {commissionValue > 0
                    ? `${currency} $${commissionValue}`
                    : "—"}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Currency
                </label>
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}

                >
                  <option value="USD">USD</option>
                  <option value="AUD">AUD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                </Select>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Offer Type
                </label>
                <Select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "one-time" | "recurring")
                  }

                >
                  <option value="one-time">One-Time</option>
                  <option value="recurring">Recurring</option>
                </Select>
              </div>

              <div className="mt-4 space-y-4 border border-[#262626] rounded-lg p-4 bg-[#111111]">
                <h3 className="text-sm font-semibold text-[#7ff5fb] uppercase tracking-wide">
                  Commission scope
                </h3>

                <div>
                  <label className="block font-semibold text-white mb-1">
                    What should count for commission?
                  </label>
                  <Select
                    value={conversionScope}
                    onChange={(e) =>
                      setConversionScope(
                        e.target.value as "store_wide" | "specific_products",
                      )
                    }

                  >
                    <option value="store_wide">
                      Entire store / any product purchased
                    </option>
                    <option value="specific_products">
                      Only specific products or variants
                    </option>
                  </Select>
                  <p className="mt-2 text-xs text-gray-400">
                    <strong className="text-white">Entire store</strong> pays on the eligible order value no matter which product is bought. <strong className="text-white">Specific products</strong> only pays when Nettmark sees matching product or variant IDs in the tracked order.
                  </p>
                </div>

                {conversionScope === "specific_products" && (
                  <>
                    <div>
                      <label className="block font-semibold text-white mb-1">
                        Eligible product IDs
                      </label>
                      <Textarea
                        value={eligibleProductIdsText}
                        onChange={(e) => setEligibleProductIdsText(e.target.value)}
                        placeholder="Example: 1234567890 or gid://shopify/Product/1234567890"

                        rows={4}
                      />
                      <p className="mt-2 text-xs text-gray-400">
                        Use the store's real product IDs. One per line or comma-separated is fine. Shopify numeric IDs and full <code>gid://</code> IDs both work.
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-white mb-1">
                        Eligible variant IDs / SKUs (optional)
                      </label>
                      <Textarea
                        value={eligibleVariantIdsText}
                        onChange={(e) => setEligibleVariantIdsText(e.target.value)}
                        placeholder="Example: 987654321 or gid://shopify/ProductVariant/987654321 or SKU-RED-L"

                        rows={3}
                      />
                      <p className="mt-2 text-xs text-gray-400">
                        Add variant IDs if only certain variants should pay. SKUs can work too when your tracking payload includes them.
                      </p>
                    </div>

                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                      If a shopper buys something outside these IDs, Nettmark will still record the conversion for attribution, but it will <strong>skip payout</strong> for that order instead of overpaying the affiliate.
                    </div>

                    <p className="text-xs text-gray-400">
                      For product-scoped offers, make sure your checkout tracking sends line items, product IDs, or variant IDs with the conversion event. That's what lets payout stay truthful.
                    </p>
                  </>
                )}
              </div>

              {type === "recurring" && (
                <div className="mt-4 space-y-4 border border-[#262626] rounded-lg p-4 bg-[#111111]">
                  <h3 className="text-sm font-semibold text-[#7ff5fb] uppercase tracking-wide">
                    Recurring payout structure
                  </h3>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      How do you want to pay affiliates?
                    </label>
                    <Select
                      value={payoutMode}
                      onChange={(e) =>
                        setPayoutMode(e.target.value as "upfront" | "spread")
                      }

                    >
                      <option value="upfront">
                        Pay full commission upfront
                      </option>
                      <option value="spread">
                        Spread commission over time
                      </option>
                    </Select>
                  </div>

                  {payoutMode === "spread" && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Payout interval
                          </label>
                          <Select
                            value={payoutInterval}
                            onChange={(e) =>
                              setPayoutInterval(e.target.value as "monthly")
                            }

                          >
                            <option value="monthly">Monthly</option>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Number of payout cycles
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={payoutCycles}
                            onChange={(e) =>
                              setPayoutCycles(Number(e.target.value) || 1)
                            }

                          />
                        </div>
                      </div>

                      <div className="text-xs text-gray-400 mt-2">
                        Based on this offer and commission, each cycle would pay
                        approximately{" "}
                        <span className="text-[#7ff5fb] font-semibold">
                          {commissionValue > 0 && payoutCycles > 0
                            ? `${currency} $${(commissionValue / payoutCycles).toFixed(2)}`
                            : "—"}
                        </span>{" "}
                        to the affiliate.
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-2xl font-bold text-[#00C2CB]">
                Meta campaign setup
              </h2>

              <p className="text-sm text-gray-400 -mt-2">
                Connect Meta now if affiliates should be able to run paid ads for this offer. If you skip it, the offer will still be listed in the marketplace as organic-only.
              </p>

              {hasMetaConnections ? (
                <>
                  <div className="rounded-xl border border-[#1e3a3c] bg-[#071416] p-4 text-sm text-[#bff9fc]">
                    Page + ad account enable paid ads for this offer. If you leave them blank, the offer stays organic-only. A pixel is only required when affiliates run Sales or Conversion campaigns.
                  </div>

                  <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-4 text-sm text-gray-300">
                    This is where you choose which connected Meta assets this offer belongs to. Each offer can be mapped to its own page, ad account, and optional sales pixel.
                  </div>

                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Select Facebook Page <span className="text-xs text-gray-500">(offer asset)</span>
                    </label>
                    <Select
                      value={selectedPage}
                      onChange={(e) => {
                        console.log("[🧭 Page Selected]", e.target.value);
                        setSelectedPage(e.target.value);
                      }}

                    >
                      <option value="">Skip for now</option>
                      {uniquePages.map((conn) => (
                        <option key={conn.page_id} value={conn.page_id}>
                          {conn.page_name || conn.page_id}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Select Ad Account <span className="text-xs text-gray-500">(offer asset)</span>
                    </label>
                    <Select
                      value={selectedAdAccount}
                      onChange={(e) => {
                        const next = e.target.value;
                        console.log("[🏦 Ad Account Selected]", next);
                        setSelectedAdAccount(next);
                      }}

                    >
                      <option value="">Skip for now</option>
                      {uniqueAdAccounts.map((conn) => (
                        <option key={conn.ad_account_id} value={conn.ad_account_id}>
                          {conn.ad_account_name || conn.ad_account_id}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block font-semibold text-white">
                        Select Meta Pixel <span className="text-xs text-gray-500">(sales campaigns only)</span>
                      </label>

                      {pixelStatus !== "idle" && (
                        <span
                          className={
                            "text-[11px] px-2 py-1 rounded-full border " +
                            (pixelStatus === "ok"
                              ? "bg-[#00C2CB]/10 text-[#7ff5fb] border-[#00C2CB]/25"
                              : pixelStatus === "loading"
                                ? "bg-[#222]/60 text-gray-200 border-[#2a2a2a]"
                                : pixelStatus === "empty"
                                  ? "bg-[#f59e0b]/10 text-[#fbbf24] border-[#f59e0b]/25"
                                  : "bg-[#ef4444]/10 text-[#fecaca] border-[#ef4444]/25")
                          }
                        >
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

                    <div className="flex gap-3 mb-3 items-center flex-wrap">
                      <Button
                        type="button"
                        disabled={pixelsLoading || !selectedAdAccount || !userEmail}
                        onClick={() => {
                          console.log("[🔥 REFRESH PIXELS CLICKED]", {
                            selectedAdAccount,
                            userEmail,
                          });
                          lastLoadedAdAccountRef.current = "";
                          loadPixels(selectedAdAccount);
                        }}
                        variant={pixelsLoading || !selectedAdAccount ? "secondary" : "primary"}
                      >
                        {pixelsLoading ? "Loading…" : "Refresh Pixels"}
                      </Button>

                      {!selectedAdAccount && (
                        <span className="text-xs text-gray-400">
                          Select an ad account first
                        </span>
                      )}

                      {pixelStatusMsg && (
                        <span className="text-xs text-gray-400">
                          {pixelStatusMsg}
                        </span>
                      )}
                    </div>

                    <Select
                      value={selectedPixel}
                      onChange={(e) => setSelectedPixel(e.target.value)}

                      disabled={!selectedAdAccount}
                    >
                      <option value="">Skip pixel for now</option>
                      {availablePixels.map((pixel) => (
                        <option key={pixel.id} value={pixel.id}>
                          {pixel.name}
                        </option>
                      ))}
                    </Select>

                    <p className="mt-1 text-xs text-gray-400">
                      Save without a pixel if you only need traffic or engagement first. Sales campaigns will ask for one later.
                    </p>
                  </div>

                  {(!selectedPage || !selectedAdAccount) && (
                    <div className="rounded-xl border border-white/10 bg-[#121212] p-4 text-sm text-gray-300">
                      This offer will be created as <span className="font-semibold text-white">organic-only</span> until both a Meta page and ad account are attached.
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#101010] p-5 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Meta isn’t connected yet</h3>
                    <p className="mt-2 text-sm text-gray-400">
                      You can still save this offer now. It will be listed as organic-only until you connect a Meta page and ad account later.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button href="/business/my-business/connect-meta">
                      Connect Meta ads
                    </Button>
                    <span className="inline-flex items-center rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm text-gray-400">
                      Skip for now — this offer will be organic-only.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-2xl font-bold text-[#00C2CB]">
                Upload Logo or Product Image
              </h2>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}

              />
            </>
          )}

          <div className="flex justify-between pt-6">
            {step > 1 && (
              <Button
                type="button"
                onClick={() => setStep((prev) => Math.max(prev - 1, 1))}
                variant="secondary"
              >
                Back
              </Button>
            )}

            {step < 4 ? (
              <Button
                type="button"
                onClick={() => setStep((prev) => prev + 1)}
                className="ml-auto"
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                className="ml-auto"
              >
                Submit Offer
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function CreateOfferPage() {
  return (
    <Suspense
      fallback={
        <div className="create-offer-theme min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
          <span className="text-sm text-gray-400">
            Loading offer builder...
          </span>
        </div>
      }
    >
      <CreateOfferPageInner />
    </Suspense>
  );
}
