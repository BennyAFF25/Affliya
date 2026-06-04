"use client";

import React, { useState, useEffect, useMemo } from "react";
import { nmToast } from "@/components/ui/toast";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";
import { calculateWalletBalance } from "@/../utils/wallet/balance";
import { Badge, Card, ModeSelector, PreviewPanel, ReadinessBanner } from "@/../components/ui";

import { AdFormState, GenderOpt, PlacementKey } from "../types";


import { AdCampaignWizard } from "../components/AdCampaignWizard";
import { OrganicSubmissionForm } from "../components/OrganicSubmissionForm";
import { PreviewSidebar } from "../components/PreviewSidebar";

// --- Lightweight row types for Supabase queries
type OfferRow = {
  title?: string | null;
  logo_url?: string | null;
  business_email?: string | null;
  website?: string | null; // use website from offers table
  meta_page_id?: string | null;
  meta_ad_account_id?: string | null;
  meta_pixel_id?: string | null;
};

export default function PromoteOfferPage() {
  // Advanced bidding accordion state
  // Removed loading states
  const router = useRouter();
  const params = useParams();
  const offerId = params.offerId as string;

  const session = useSession();
  const userEmail = session?.user?.email || "";

  // ─────────────────────────────
  // Organic flow state (non-invasive)
  // ─────────────────────────────
  const [mode, setMode] = useState<"ad" | "organic">("ad");

  // Wallet balance state (real-time gating)
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState<boolean>(true);
  // ─────────────────────────────
  // Wallet balance loader
  // ─────────────────────────────
  useEffect(() => {
    if (!userEmail) return;

    const loadWallet = async () => {
      setWalletLoading(true);
      const { data, error } = await (supabase as any)
        .from("wallet_topups")
        .select("amount_net, credited_amount, amount_refunded, status")
        .eq("affiliate_email", userEmail);

      if (error) {
        console.error("[wallet load error]", error);
        setWalletBalance(0);
      } else {
        const { data: deductions, error: deductionErr } = await (supabase as any)
          .from("wallet_deductions")
          .select("amount")
          .eq("affiliate_email", userEmail);

        if (deductionErr) {
          console.error("[wallet deductions load error]", deductionErr);
        }

        const snapshot = calculateWalletBalance({
          topups: data || [],
          deductions: deductions || [],
        });
        setWalletBalance(snapshot.availableBalance);
      }
      setWalletLoading(false);
    };

    loadWallet();
  }, [userEmail]);

  // Organic method + fields
  const [ogMethod, setOgMethod] = useState<
    "social" | "email" | "forum" | "other"
  >("social");
  const [ogPlatform, setOgPlatform] = useState<string>("Facebook"); // for social
  const [ogCaption, setOgCaption] = useState<string>(""); // social caption OR email subject OR forum title/url
  const [ogContent, setOgContent] = useState<string>(""); // email body / forum body
  const [ogFile, setOgFile] = useState<File | null>(null); // optional media for social
  const userId = (session as any)?.user?.id as string | undefined;

  // ─────────────────────────────
  // Auth guard (avoid loop)
  // ─────────────────────────────
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) router.push("/");
  }, [session, router]);

  // ─────────────────────────────
  // Derived tracking link
  // ─────────────────────────────
  const trackingLink = useMemo(
    () => `https://www.nettmark.com/go/${offerId}___${userEmail}`,
    [offerId, userEmail],
  );

  // ─────────────────────────────
  // Simplified, Meta-aligned form state
  // (campaign → ad set → ad creative)
  // ─────────────────────────────
  // ─────────────────────────────
  // Simplified, Meta-aligned form state
  // (campaign → ad set → ad creative)
  // ─────────────────────────────
  const [form, setForm] = useState<AdFormState>({
    // Campaign
    campaign_name: "",
    objective: "OUTCOME_TRAFFIC",

    // Ad Set
    budget_amount_dollars: 10, // UI in dollars; we will save as cents in DB
    budget_type: "DAILY", // DAILY | LIFETIME
    start_time: "",
    end_time: "",
    location_countries: "AU", // comma-separated ISO codes (e.g., AU,US)
    age_min: 18,
    age_max: 65,
    gender: "" as GenderOpt, // '' = All, '1'=Male, '2'=Female
    interests_csv: "", // comma-separated

    // Placements (jsonb)
    placements: {
      facebook_feed: true,
      instagram_feed: true,
      instagram_reels: true,
      facebook_reels: false,
      facebook_stories: false,
      instagram_stories: false,
    } as Record<PlacementKey, boolean>,

    advantage_audience: false,

    // Ad Creative
    headline: "",
    caption: "",
    call_to_action: "LEARN_MORE",
    display_link: "",

    // Bidding
    bid_strategy: "LOWEST_COST" as "LOWEST_COST" | "BID_CAP",
    bid_cap_dollars: "" as number | "",
  });

  // ─────────────────────────────
  // Wallet gating derived values (safe – after form init)
  // ─────────────────────────────
  const requiredBudget = Number(form?.budget_amount_dollars || 0);
  const walletDeficit = Math.max(0, requiredBudget - walletBalance);
  const canRunWithWallet = walletBalance >= requiredBudget;

  // Media
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  // Thumbnail error state for submission validation
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  // Thumbnail validation (Meta does NOT accept SVG thumbnails)
  const ALLOWED_THUMB_MIME = ["image/jpeg", "image/png", "image/webp"];
  const MAX_THUMB_BYTES = 8 * 1024 * 1024; // 8MB

  function validateThumbnailFile(file: File): string | null {
    const name = (file?.name || "").toLowerCase();
    const type = file?.type || "";

    // Block SVG explicitly (Meta ingestion fails)
    if (type === "image/svg+xml" || name.endsWith(".svg")) {
      return "Thumbnail must be a PNG/JPG/WebP (SVG is not supported by Meta).";
    }

    // Block HEIC/HEIF (common iPhone format that often fails)
    if (
      type === "image/heic" ||
      type === "image/heif" ||
      name.endsWith(".heic") ||
      name.endsWith(".heif")
    ) {
      return "Thumbnail must be a PNG/JPG/WebP (HEIC/HEIF is not supported).";
    }

    if (!ALLOWED_THUMB_MIME.includes(type)) {
      return "Thumbnail must be a PNG/JPG/WebP image.";
    }

    if (file.size > MAX_THUMB_BYTES) {
      return "Thumbnail is too large. Please upload an image under 8MB.";
    }

    return null;
  }

  // Brand preview data (from offers table / offer-logos bucket)
  const [brandName, setBrandName] = useState<string>("Your Brand Name");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [offerMetaResolved, setOfferMetaResolved] = useState(false);
  const [offerMetaState, setOfferMetaState] = useState<{
    hasPage: boolean;
    hasAdAccount: boolean;
    hasPixel: boolean;
  }>({
    hasPage: false,
    hasAdAccount: false,
    hasPixel: false,
  });
  const [businessPaymentReady, setBusinessPaymentReady] = useState<boolean>(false);
  const [businessPaymentResolved, setBusinessPaymentResolved] = useState<boolean>(false);

  // Local preview URLs for selected files
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    };
  }, [videoPreviewUrl, thumbPreviewUrl]);

  useEffect(() => {
    if (session === undefined || session === null) return;

    const go = async () => {
      // 1) Offer core fields
      const { data: offer, error: offerErr } = await (supabase as any)
        .from("offers")
        .select(
          "title, logo_url, business_email, website, meta_page_id, meta_ad_account_id, meta_pixel_id",
        )
        .eq("id", offerId)
        .single();

      if (offerErr) {
        console.error("[offer fetch error]", offerErr);
        return;
      }

      // Preview title + logo
      setBrandName(offer?.title || "Your Brand Name");
      setBrandLogoUrl(offer?.logo_url || null);
      setOfferMetaState({
        hasPage: !!offer?.meta_page_id,
        hasAdAccount: !!(offer as OfferRow | null)?.meta_ad_account_id,
        hasPixel: !!(offer as OfferRow | null)?.meta_pixel_id,
      });
      setOfferMetaResolved(true);
      // Pre-fill Destination URL with the business website if available
      if (offer?.website) {
        setForm((p) => ({
          ...p,
          display_link: p.display_link || offer.website!,
        }));
      }

      // 2) Check business payment readiness for paid campaigns
      try {
        const res = await fetch(
          `/api/business/payment-readiness?offerId=${encodeURIComponent(offerId)}`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => ({}));
        setBusinessPaymentReady(Boolean(json?.hasPaymentMethod));
      } catch (e) {
        console.warn("[payment readiness check failed]", e);
        setBusinessPaymentReady(false);
      } finally {
        setBusinessPaymentResolved(true);
      }
    };

    go();
  }, [offerId, session]);

  // ─────────────────────────────
  // Local planning assumptions only. Meta reach is unavailable pre-approval
  // because the campaign/ad set is not created until the business approves.
  // ─────────────────────────────
  const [assumeCPM, setAssumeCPM] = useState<number>(10); // $10 CPM default
  const [assumeCTR, setAssumeCTR] = useState<number>(1); // 1% CTR default
  const [assumeCVR, setAssumeCVR] = useState<number>(3); // 3% CVR default

  const impressions = useMemo(() => {
    const budget = Number(form?.budget_amount_dollars || 0);
    return assumeCPM > 0 ? (budget / assumeCPM) * 1000 : 0;
  }, [form.budget_amount_dollars, assumeCPM]);

  const clicks = useMemo(
    () => impressions * (assumeCTR / 100),
    [impressions, assumeCTR],
  );
  const dailyConversions = useMemo(
    () => clicks * (assumeCVR / 100),
    [clicks, assumeCVR],
  );
  const monthlyConversions = useMemo(
    () => dailyConversions * 30,
    [dailyConversions],
  );

  const offerHasMetaLaunchSetup =
    offerMetaState.hasPage && offerMetaState.hasAdAccount;
  const offerHasSalesPixel = offerMetaState.hasPixel;
  const needsSalesPixel = form.objective === "OUTCOME_SALES";
  const isOrganicOnlyOffer = offerMetaResolved && !offerHasMetaLaunchSetup;
  const showMetaSetupWarning = offerMetaResolved && !offerHasMetaLaunchSetup;
  const showSalesPixelWarning = offerMetaResolved && offerHasMetaLaunchSetup && needsSalesPixel && !offerHasSalesPixel;
  const showBusinessPaymentWarning =
    businessPaymentResolved && !businessPaymentReady;
  const canLaunchPaidCampaign =
    offerHasMetaLaunchSetup && (!needsSalesPixel || offerHasSalesPixel) && businessPaymentReady;

  useEffect(() => {
    if ((isOrganicOnlyOffer || showBusinessPaymentWarning) && mode === "ad") {
      setMode("organic");
    }
  }, [isOrganicOnlyOffer, mode, showBusinessPaymentWarning]);

  // ─────────────────────────────
  // Helpers
  // ─────────────────────────────
  const onInput =
    (name: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const val =
        e.target.type === "number" ? Number(e.target.value) : e.target.value;
      setForm((prev) => ({ ...prev, [name]: val as any }));
    };

  const onPlacementToggle = (key: PlacementKey) => {
    setForm((p) => ({
      ...p,
      placements: { ...p.placements, [key]: !p.placements[key] },
    }));
  };

  // Apply estimator preset for CPM, CTR, CVR
  function applyEstimatorPreset(kind: "dtc" | "lead") {
    if (kind === "dtc") {
      setAssumeCPM(12);
      setAssumeCTR(1.5);
      setAssumeCVR(1.5);
    }
    if (kind === "lead") {
      setAssumeCPM(10);
      setAssumeCTR(1.0);
      setAssumeCVR(4.0);
    }
  }

  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Date helpers
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocalInput = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const incBudget = (amt: number) =>
    setForm((p) => ({
      ...p,
      budget_amount_dollars: Math.max(
        1,
        Number(p.budget_amount_dollars || 0) + amt,
      ),
    }));

  const setStartIn15m = () => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    setForm((p) => ({ ...p, start_time: toLocalInput(d) }));
  };

  const setEndIn7d = () => {
    const base = form.start_time ? new Date(form.start_time) : new Date();
    const d = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    setForm((p) => ({ ...p, end_time: toLocalInput(d) }));
  };

  // ─────────────────────────────
  // Organic submit (direct insert to organic_posts)
  // ─────────────────────────────
  const handleOrganicSubmit = async () => {
    try {
      if (!userEmail) {
        nmToast.error("You must be signed in.");
        return;
      }
      if (!userId) {
        nmToast.error("Missing user session.");
        return;
      }

      // Fetch business_email for this offer
      const { data: offerRow, error: offerErr } = await (supabase as any)
        .from("offers")
        .select("business_email")
        .eq("id", offerId)
        .single();
      if (offerErr || !offerRow?.business_email)
        throw new Error("Could not resolve business email for this offer.");
      const business_email = offerRow.business_email as string;

      // Optional upload (only for social with media)
      let image_url: string | null = null;
      let video_url: string | null = null;

      if (ogFile) {
        const bucket = "organic-posts"; // ← Supabase storage bucket name
        const ts = Date.now();
        const path = `${ts}-${sanitize(ogFile.name)}`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, ogFile, { upsert: true, contentType: ogFile.type });
        if (upErr) throw new Error(upErr.message || JSON.stringify(upErr));
        const { data: pubUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);
        let publicUrl = pubUrlData?.publicUrl || "";

        // Normalize to ensure `/public/` is present for public buckets
        if (
          publicUrl &&
          publicUrl.includes("/storage/v1/object/") &&
          !publicUrl.includes("/storage/v1/object/public/")
        ) {
          publicUrl = publicUrl.replace(
            "/storage/v1/object/",
            "/storage/v1/object/public/",
          );
        }

        // Debug aid
        console.log("[Organic Upload]", { bucket, path, publicUrl });

        if (ogFile.type.startsWith("image/")) image_url = publicUrl;
        if (ogFile.type.startsWith("video/")) video_url = publicUrl;
      }

      // Map fields by method
      let platform = ogPlatform;
      const caption = ogCaption;
      const content = ogContent;

      if (ogMethod === "email") {
        platform = "Email";
        // caption = subject, content = body (already set)
      } else if (ogMethod === "forum") {
        platform = "Forum";
        // caption = forum URL/title, content = body (already set)
      }

      // Consolidate details into caption for review (schema doesn't include `content` or `method`)
      let captionForInsert = caption;
      if (ogMethod === "email") {
        captionForInsert = `[EMAIL]\nSubject: ${caption || "(no subject)"}\n\nBody:\n${content || "(no body)"}`;
      } else if (ogMethod === "forum") {
        captionForInsert = `[FORUM]\nURL/Title: ${caption || "(no url/title)"}\n\nPost:\n${content || "(no content)"}`;
      } else if (ogMethod === "other") {
        captionForInsert = `[OTHER]\nSummary: ${caption || "(no summary)"}\n\nDetails:\n${content || "(no details)"}`;
      }

      // Insert to organic_posts (RLS expects affiliate_email to match auth.email())
      const { error: insertErr } = await (
        supabase.from("organic_posts") as any
      ).insert([
        {
          offer_id: offerId,
          user_id: userId,
          affiliate_email: userEmail,
          business_email,
          caption: captionForInsert,
          platform, // Facebook/Instagram/TikTok OR Email/Forum
          image_url,
          video_url,
          status: "pending",
        } as any,
      ]);
      if (insertErr)
        throw new Error(insertErr.message || JSON.stringify(insertErr));

      nmToast.success("Organic post submitted for review");
      // Reset organic fields
      setOgCaption("");
      setOgContent("");
      setOgFile(null);
    } catch (e: any) {
      const msg = e?.message || (typeof e === "string" ? e : JSON.stringify(e));
      console.error("[Organic Submit Error]", msg, e);
      nmToast.error(msg || "Failed to submit organic post");
    }
  };

  // ─────────────────────────────
  // Submit (Uploads → ad_ideas insert)
  // ─────────────────────────────
  const handleAdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      // UI-side safety: if Bid Cap selected, require a value
      if (form.bid_strategy === "BID_CAP") {
        const cap = Number(form.bid_cap_dollars);
        if (!cap || cap <= 0) {
          nmToast.error(
            "Please enter a valid bid cap amount when using Bid Cap.",
          );
          return;
        }
      }
      const isVideoCreative = !!videoFile;
      const isImageCreative = !!imageFile;

      if (!isVideoCreative && !isImageCreative) {
        nmToast.error("Please upload either a video or a photo");
        return;
      }

      if (isVideoCreative) {
        let thumbnailUrl: string | null = null;
        if (thumbnailFile) {
          thumbnailUrl = thumbnailFile.name;
        }
        if (!thumbnailUrl || thumbnailUrl.trim() === "") {
          setThumbnailError("Please upload a thumbnail before submitting.");
          return;
        }
      }

      setThumbnailError(null);

      // 0) Ensure budget does not exceed prefunded wallet
      const budgetDollars = Number(form.budget_amount_dollars || 0);
      if (!budgetDollars || budgetDollars <= 0) {
        nmToast.error("Please enter a valid daily budget");
        return;
      }

      const { data: walletRows, error: walletErr } = await (supabase as any)
        .from("wallet_topups")
        .select("amount_net, credited_amount, amount_refunded, status")
        .eq("affiliate_email", userEmail);

      if (walletErr) {
        console.error("[wallet_topups check error]", walletErr);
      }

      const { data: deductionRows, error: deductionErr } = await (supabase as any)
        .from("wallet_deductions")
        .select("amount")
        .eq("affiliate_email", userEmail);

      if (deductionErr) {
        console.error("[wallet_deductions check error]", deductionErr);
      }

      const walletTotal = calculateWalletBalance({
        topups: walletRows || [],
        deductions: deductionRows || [],
      }).availableBalance;

      if (walletTotal < budgetDollars) {
        nmToast.error(
          `Daily budget ($${budgetDollars.toFixed(2)}) exceeds your available wallet balance ($${walletTotal.toFixed(2)}).`,
        );
        return;
      }

      // 1) Get business email for this offer (needed for row)
      const { data: offerRow, error: offerErr } = await (supabase as any)
        .from("offers")
        .select("business_email")
        .eq("id", offerId)
        .single();
      if (offerErr || !offerRow)
        throw new Error("Failed to fetch offer/business email");

      const business_email = offerRow.business_email;

      if (!offerHasMetaLaunchSetup) {
        nmToast.error(
          "This offer is organic-only right now. The business needs to attach a Meta page and ad account before paid ads can run.",
        );
        return;
      }

      if (form.objective === "OUTCOME_SALES" && !offerHasSalesPixel) {
        nmToast.error(
          "This offer still needs a Meta pixel before Sales campaigns can be submitted.",
        );
        return;
      }

      // 2) Upload creative media to "ad-ideas-assets" bucket
      const ts = Date.now();

      let creativePublicUrl: string | null = null;
      let thumbPublicUrl: string | null = null;

      if (videoFile) {
        const videoPath = `videos/${ts}-${sanitize(videoFile.name)}`;
        const { error: upVidErr } = await supabase.storage
          .from("ad-ideas-assets")
          .upload(videoPath, videoFile, {
            upsert: true,
            contentType: videoFile.type,
          });
        if (upVidErr) throw upVidErr;
        creativePublicUrl = supabase.storage
          .from("ad-ideas-assets")
          .getPublicUrl(videoPath).data.publicUrl;
      } else if (imageFile) {
        const imagePath = `images/${ts}-${sanitize(imageFile.name)}`;
        const { error: upImgErr } = await supabase.storage
          .from("ad-ideas-assets")
          .upload(imagePath, imageFile, {
            upsert: true,
            contentType: imageFile.type,
          });
        if (upImgErr) throw upImgErr;
        creativePublicUrl = supabase.storage
          .from("ad-ideas-assets")
          .getPublicUrl(imagePath).data.publicUrl;
      }

      if (thumbnailFile) {
        const thumbPath = `thumbnails/${ts}-thumb-${sanitize(thumbnailFile.name)}`;
        const { error: upThumbErr } = await supabase.storage
          .from("ad-ideas-assets")
          .upload(thumbPath, thumbnailFile, {
            upsert: true,
            contentType: thumbnailFile.type,
          });
        if (!upThumbErr) {
          thumbPublicUrl = supabase.storage
            .from("ad-ideas-assets")
            .getPublicUrl(thumbPath).data.publicUrl;
        }
      }

      // Force stronger optimisation defaults (critical for spend)
      const optimisation_goal =
        form.objective === "OUTCOME_SALES" ? "OFFSITE_CONVERSIONS" : "REACH";

      const conversion_location =
        form.objective === "OUTCOME_SALES" ? "WEBSITE" : null;

      // 3) Build normalized fields for DB
      const interests = form.interests_csv
        ? form.interests_csv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const placements_selected = Object.entries(form.placements)
        .filter(([, v]) => v)
        .map(([k]) => k);

      // UI uses dollars; DB stores cents (int)
      const budget_amount = Math.round(
        Number(form.budget_amount_dollars || 0) * 100,
      );

      // 4) Insert into ad_ideas
      const insertPayload: any = {
        offer_id: offerId,
        affiliate_email: userEmail,
        business_email,
        // media
        file_url: creativePublicUrl,
        thumbnail_url: thumbPublicUrl,
        media_type: videoFile ? "VIDEO" : "IMAGE",
        type: videoFile ? "Video" : "Image",

        // campaign/adset/ad
        campaign_name: form.campaign_name || null,
        objective: form.objective || "OUTCOME_TRAFFIC",
        performance_goal: optimisation_goal,
        conversion_location,
        budget_amount: budget_amount || 0,
        budget_type: form.budget_type,
        start_time: form.start_time
          ? new Date(form.start_time).toISOString()
          : null,
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,

        // targeting
        location: form.location_countries, // store as CSV for now
        age_range: [String(form.age_min), String(form.age_max)], // reuse column (text[])
        gender:
          form.gender === "" ? "All" : form.gender === "1" ? "Male" : "Female",
        interests: interests, // jsonb in table

        // placements
        manual_placements: placements_selected, // jsonb in table
        placements_type: "MANUAL",
        advantage_audience: !!form.advantage_audience,

        // creative
        headline: form.headline || null,
        caption: form.caption || "",
        call_to_action: form.call_to_action || "LEARN_MORE",
        // display_link is what appears on the ad (brand/site URL)
        display_link: form.display_link || null,
        // tracking_link is the hidden redirect we use for attribution
        tracking_link: trackingLink,

        // bidding
        // NOTE: bid_cap is stored in DOLLARS in `ad_ideas`.
        // The server route should convert to cents ONCE right before sending to Meta.
        bid_strategy: form.bid_strategy,
        bid_cap:
          form.bid_strategy === "BID_CAP" ? Number(form.bid_cap_dollars) : null,

        // workflow
        status: "pending", // business will approve → then we push to Meta via server route
        meta_status: null,
      };

      console.log("[BID CAP DEBUG]", {
        bid_strategy: form.bid_strategy,
        bid_cap_dollars: form.bid_cap_dollars,
        bid_cap_saved_to_db: insertPayload.bid_cap,
      });

      const { error: insertErr } = await (
        supabase.from("ad_ideas") as any
      ).insert([insertPayload as any]);
      if (insertErr) throw insertErr;

      nmToast.success("Ad idea submitted for review");
      router.push("/affiliate/dashboard"); // back to dashboard after submit
    } catch (e: any) {
      console.error("[❌ Submit Error]", e);
      nmToast.error(e?.message || "Failed to submit ad idea");
    }
  };


  return (
    <div className="promote-theme min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 lg:py-8">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="lg:col-span-2 overflow-hidden border-[#00C2CB]/15 bg-[radial-gradient(circle_at_top_right,rgba(0,194,203,0.16),transparent_34%),var(--card)] p-5 sm:p-6" variant="elevated">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/10 text-lg font-semibold text-[#7ff5fb]">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt={`${brandName} logo`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  brandName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary">Promote offer</Badge>
                  {canLaunchPaidCampaign ? (
                    <Badge variant="success">Paid ready</Badge>
                  ) : isOrganicOnlyOffer ? (
                    <Badge variant="warning">Organic only</Badge>
                  ) : (
                    <Badge variant="muted">Readiness pending</Badge>
                  )}
                </div>
                <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {brandName}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                  Build a paid Meta campaign or submit an organic promotion for business review. Required uploads, wallet checks, and approvals remain enforced at submit.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm md:min-w-[260px]">
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Wallet</div>
                <div className="mt-1 font-semibold text-white">
                  {walletLoading ? "Checking…" : `$${walletBalance.toFixed(2)}`}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Budget</div>
                <div className="mt-1 font-semibold text-white">${requiredBudget.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <ModeSelector
            value={mode}
            onChange={(value) => setMode(value as "ad" | "organic")}
            options={[
              {
                value: "ad",
                label: isOrganicOnlyOffer || showBusinessPaymentWarning ? "Ads unavailable" : "Paid ad campaign",
                description: "Create a Meta-ready campaign idea with budget, targeting, creative, and uploads.",
                disabled: isOrganicOnlyOffer || showBusinessPaymentWarning,
                badge: <Badge variant={mode === "ad" ? "primary" : "muted"}>Paid</Badge>,
              },
              {
                value: "organic",
                label: "Organic submission",
                description: "Submit social, email, forum, or other non-paid promotion ideas for approval.",
                badge: <Badge variant={mode === "organic" ? "primary" : "muted"}>No spend</Badge>,
              },
            ]}
          />

          <div className="grid gap-3 md:grid-cols-2">
            {showMetaSetupWarning && (
              <ReadinessBanner tone="warning" title="Connect Meta to allow affiliates to launch campaigns.">
                This offer can still be promoted organically while Meta setup is pending.
              </ReadinessBanner>
            )}

            {showSalesPixelWarning && (
              <ReadinessBanner tone="info" title="Sales campaigns still need a Meta pixel">
                This offer is Meta-ready for traffic and engagement, but Sales requires a selected Meta pixel on the offer first.
              </ReadinessBanner>
            )}

            {showBusinessPaymentWarning && (
              <ReadinessBanner tone="warning" title="A payment method is required before paid campaigns can launch.">
                Affiliate commissions are charged only when a tracked sale occurs.
              </ReadinessBanner>
            )}

            {!walletLoading && mode === "ad" && !canRunWithWallet && (
              <ReadinessBanner tone="danger" title={`Wallet top-up needed: $${walletDeficit.toFixed(2)}`}>
                Your paid campaign budget is higher than the available wallet balance. The existing submit gate will route you to top up.
              </ReadinessBanner>
            )}

            {isOrganicOnlyOffer && mode === "organic" && (
              <ReadinessBanner tone="info" title="Organic-only offer">
                This offer is live in the marketplace, but paid ads are locked until the business connects Meta for it.
              </ReadinessBanner>
            )}
          </div>
        </div>

        <main className="min-w-0 space-y-4">
          {mode === "ad" && (
            canLaunchPaidCampaign ? (
              <AdCampaignWizard
                form={form}
                setForm={setForm}
                onInput={onInput}
                onPlacementToggle={onPlacementToggle}
                applyEstimatorPreset={applyEstimatorPreset}
                walletBalance={walletBalance}
                walletLoading={walletLoading}
                canRunWithWallet={canRunWithWallet}
                walletDeficit={walletDeficit}
                incBudget={incBudget}
                setStartIn15m={setStartIn15m}
                setEndIn7d={setEndIn7d}
                videoFile={videoFile}
                setVideoFile={setVideoFile}
                imageFile={imageFile}
                setImageFile={setImageFile}
                thumbnailFile={thumbnailFile}
                setThumbnailFile={setThumbnailFile}
                thumbnailError={thumbnailError}
                setThumbnailError={setThumbnailError}
                validateThumbnailFile={validateThumbnailFile}
                setVideoPreviewUrl={setVideoPreviewUrl}
                setThumbPreviewUrl={setThumbPreviewUrl}
                handleAdSubmit={handleAdSubmit}
                onNavigateToWallet={() => router.push("/affiliate/wallet")}
              />
            ) : (
              <ReadinessBanner tone="warning" title="Paid launch is temporarily locked.">
                You can continue with organic promotion now.
              </ReadinessBanner>
            )
          )}

          {mode === "organic" && (
            <OrganicSubmissionForm
              ogMethod={ogMethod}
              setOgMethod={setOgMethod}
              ogPlatform={ogPlatform}
              setOgPlatform={setOgPlatform}
              ogCaption={ogCaption}
              setOgCaption={setOgCaption}
              ogContent={ogContent}
              setOgContent={setOgContent}
              ogFile={ogFile}
              setOgFile={setOgFile}
              handleOrganicSubmit={handleOrganicSubmit}
            />
          )}
        </main>

        <PreviewPanel
          title="Preview & summary"
          description="A live summary of the selected promotion mode and attached creative."
          className="lg:sticky lg:top-6 lg:self-start"
        >
          <PreviewSidebar
            mode={mode}
            dailyConversions={dailyConversions}
            monthlyConversions={monthlyConversions}
            brandName={brandName}
            brandLogoUrl={brandLogoUrl}
            videoPreviewUrl={videoPreviewUrl}
            thumbPreviewUrl={thumbPreviewUrl}
            form={form}
            ogMethod={ogMethod}
            ogFile={ogFile}
            ogPlatform={ogPlatform}
            ogCaption={ogCaption}
          />
        </PreviewPanel>
      </div>
    </div>
  );
}
