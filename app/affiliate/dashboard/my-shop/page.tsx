"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";
import {
  SHOP_THEMES,
  type ShopThemeKey,
  type ThemePaletteJson,
} from "../../../shop/theme";
import {
  Eye,
  MousePointerClick,
  Sparkles as SparklesIcon,
  Link2,
  Palette as PaletteIcon,
  Image as ImageIcon,
  UploadCloud,
  RotateCcw,
  LayoutGrid,
} from "lucide-react";

interface ShopRow {
  offer_id: string;
  custom_image_url: string | null;
  custom_price: string | null;
  custom_description: string | null;
  display_order: number | null;
}

interface OfferRow {
  id: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  business_email: string | null;
}

interface ShopStats {
  views24h: number;
  clicks24h: number;
}

const THEME_OPTIONS: Array<{
  key: ShopThemeKey;
  label: string;
  preview: string;
}> = [
  {
    key: "midnight",
    label: "Midnight",
    preview: "linear-gradient(135deg,#04141a,#051b24)",
  },
  {
    key: "luminous",
    label: "Luminous",
    preview: "linear-gradient(135deg,#fdfbfb,#ebedee)",
  },
  {
    key: "neon",
    label: "Muted Neon",
    preview: "linear-gradient(135deg,#120c1f,#041a21)",
  },
  {
    key: "custom",
    label: "Custom",
    preview: "linear-gradient(135deg,#f4f4f5,#e2e8f0)",
  },
];

const DEFAULT_CUSTOM_PALETTE: ThemePaletteJson = {
  heroBackground: "linear-gradient(135deg, #f4f4f5 0%, #e2e8f0 100%)",
  heroOverlay:
    "radial-gradient(circle at top, rgba(0,0,0,0.05), transparent 60%)",
  cardBackground: "#ffffff",
  cardBorder: "rgba(15,23,42,0.08)",
  accent: "#0f172a",
  accentSoft: "#475569",
};

export default function MyShopPage() {
  const { session } = useSessionContext();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ShopRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<ShopThemeKey>("midnight");
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroBlurb, setHeroBlurb] = useState("");
  const [stats, setStats] = useState<ShopStats>({ views24h: 0, clicks24h: 0 });
  const [customPalette, setCustomPalette] = useState<ThemePaletteJson>(
    DEFAULT_CUSTOM_PALETTE,
  );
  const [initialTheme, setInitialTheme] = useState<ShopThemeKey>("midnight");
  const [initialHeroImageUrl, setInitialHeroImageUrl] = useState<string | null>(
    null,
  );
  const [initialHeroBlurb, setInitialHeroBlurb] = useState("");
  const [initialPalette, setInitialPalette] = useState<ThemePaletteJson>(
    DEFAULT_CUSTOM_PALETTE,
  );
  const [shopAccessStatus, setShopAccessStatus] = useState<
    "none" | "pending" | "approved" | "rejected"
  >("none");
  const [requestingAccess, setRequestingAccess] = useState(false);

  const initialMetadataHandle =
    (session?.user?.user_metadata as any)?.username || "";
  const [handle, setHandle] = useState<string>(initialMetadataHandle);
  const [handleSaved, setHandleSaved] = useState<boolean>(
    !!initialMetadataHandle,
  );
  const [handleSaving, setHandleSaving] = useState(false);
  const shopLink =
    handleSaved && handle ? `https://www.nettmark.com/shop/${handle}` : null;

  useEffect(() => {
    if (!session?.user?.email) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data: approved } = await supabase
          .from("affiliate_requests")
          .select("offer_id")
          .eq("affiliate_email", session.user.email)
          .eq("status", "approved");

        const offerIds = approved?.map((row) => row.offer_id) || [];

        if (offerIds.length === 0) {
          setOffers([]);
          setOverrides({});
        } else {
          const { data: offerRows } = await supabase
            .from("offers")
            .select("id, title, description, logo_url, business_email")
            .in("id", offerIds);

          const { data: overrideRows } = await supabase
            .from("affiliate_shop_items")
            .select(
              "offer_id, custom_image_url, custom_price, custom_description, display_order",
            )
            .eq("affiliate_email", session.user.email)
            .in("offer_id", offerIds);

          const overrideMap: Record<string, ShopRow> = {};
          overrideRows?.forEach((row) => {
            overrideMap[row.offer_id] = row;
          });

          setOffers((offerRows || []) as OfferRow[]);
          setOverrides(overrideMap);
        }

        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const { data: hitRows } = await supabase
          .from("shop_hits")
          .select("views, clicks, event_date")
          .eq("affiliate_email", session.user.email)
          .gte("event_date", dayAgo);

        const views24h =
          hitRows?.reduce((sum, row) => sum + (row.views ?? 0), 0) ?? 0;
        const clicks24h =
          hitRows?.reduce((sum, row) => sum + (row.clicks ?? 0), 0) ?? 0;
        setStats({ views24h, clicks24h });

        const { data: settingsRow } = await supabase
          .from("affiliate_shop_settings")
          .select("theme, hero_image_url, hero_blurb, theme_json")
          .eq("affiliate_email", session.user.email)
          .maybeSingle();

        if (settingsRow) {
          const palette = {
            ...DEFAULT_CUSTOM_PALETTE,
            ...(settingsRow.theme_json || {}),
          };
          const nextTheme = (settingsRow.theme as ShopThemeKey) || "midnight";
          setTheme(nextTheme);
          setHeroImageUrl(settingsRow.hero_image_url || null);
          setHeroBlurb(settingsRow.hero_blurb || "");
          setCustomPalette(palette);
          setInitialTheme(nextTheme);
          setInitialHeroImageUrl(settingsRow.hero_image_url || null);
          setInitialHeroBlurb(settingsRow.hero_blurb || "");
          setInitialPalette(palette);
        } else {
          setTheme("midnight");
          setHeroImageUrl(null);
          setHeroBlurb("");
          setCustomPalette(DEFAULT_CUSTOM_PALETTE);
          setInitialTheme("midnight");
          setInitialHeroImageUrl(null);
          setInitialHeroBlurb("");
          setInitialPalette(DEFAULT_CUSTOM_PALETTE);
        }

        let resolvedHandle =
          (session?.user?.user_metadata as any)?.username || "";
        if (session?.user?.id) {
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", session.user.id)
            .maybeSingle();
          if (profileRow?.username) {
            resolvedHandle = profileRow.username;
          }
        }
        setHandle(resolvedHandle);
        setHandleSaved(!!resolvedHandle);

        const { data: shopRequests } = await supabase
          .from("affiliate_shop_requests")
          .select("status")
          .eq("affiliate_email", session.user.email);

        if (shopRequests?.some((row) => row.status === "approved")) {
          setShopAccessStatus("approved");
        } else if (shopRequests?.some((row) => row.status === "pending")) {
          setShopAccessStatus("pending");
        } else if (shopRequests?.some((row) => row.status === "rejected")) {
          setShopAccessStatus("rejected");
        } else {
          setShopAccessStatus("none");
        }
      } catch (err: any) {
        console.error("[MyShop] load failed", err);
        setError("Failed to load shop data.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [session?.user?.email, session?.user?.id]);

  const rows = useMemo(() => {
    return offers
      .map((offer) => ({
        offer,
        override: overrides[offer.id],
      }))
      .sort((a, b) => {
        const orderA = a.override?.display_order ?? 0;
        const orderB = b.override?.display_order ?? 0;
        return orderA - orderB || a.offer.title.localeCompare(b.offer.title);
      });
  }, [offers, overrides]);

  const featuredProduct = rows[0]?.offer.title ?? "—";

  const themeSettingsDirty =
    theme !== initialTheme ||
    heroImageUrl !== initialHeroImageUrl ||
    heroBlurb !== initialHeroBlurb ||
    (theme === "custom" &&
      JSON.stringify(customPalette) !== JSON.stringify(initialPalette));

  const statCards = [
    { label: "Views (24h)", value: stats.views24h, Icon: Eye },
    { label: "Clicks (24h)", value: stats.clicks24h, Icon: MousePointerClick },
    {
      label: "Featured product",
      value: featuredProduct || "—",
      Icon: SparklesIcon,
    },
  ];

  const hasApprovedOffers = offers.length > 0;
  const shopEnabled = shopAccessStatus === "approved";
  const pendingShopRequest = shopAccessStatus === "pending";

  const handleHandleSave = async () => {
    if (!handle.trim()) {
      setError("Handle cannot be empty.");
      return;
    }
    setHandleSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/my-shop/handle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json?.message || json?.error || "Failed to save handle",
        );
      }
      setHandle(json.handle);
      setHandleSaved(true);
      if (session?.user?.user_metadata) {
        (session.user.user_metadata as any).username = json.handle;
      }
      setMessage("Handle updated");
    } catch (err: any) {
      console.error("[MyShop] handle save failed", err);
      setError(err.message || "Failed to save handle");
    } finally {
      setHandleSaving(false);
    }
  };

  const updateOverride = (offerId: string, patch: Partial<ShopRow>) => {
    setOverrides((prev) => ({
      ...prev,
      [offerId]: {
        offer_id: offerId,
        custom_image_url: prev[offerId]?.custom_image_url ?? null,
        custom_price: prev[offerId]?.custom_price ?? null,
        custom_description: prev[offerId]?.custom_description ?? null,
        display_order: prev[offerId]?.display_order ?? 0,
        ...patch,
      },
    }));
  };

  const handleImageUpload = async (offerId: string, file: File | null) => {
    if (!file || !session?.user) return;
    setUploadingImage(offerId);
    setError(null);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${session.user.id}/${offerId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await (supabase as any).storage
        .from("shop-images")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = (supabase as any).storage
        .from("shop-images")
        .getPublicUrl(filePath);
      updateOverride(offerId, { custom_image_url: data.publicUrl });
      setMessage("Image updated");
    } catch (err: any) {
      console.error("[MyShop] image upload failed", err);
      setError("Image upload failed.");
    } finally {
      setUploadingImage(null);
    }
  };

  const handleHeroUpload = async (file: File | null) => {
    if (!file || !session?.user) return;
    setHeroUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${session.user.id}/hero-${Date.now()}.${ext}`;
      const { error: uploadError } = await (supabase as any).storage
        .from("shop-images")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = (supabase as any).storage
        .from("shop-images")
        .getPublicUrl(filePath);
      setHeroImageUrl(data.publicUrl);
      setMessage("Hero image updated");
    } catch (err: any) {
      console.error("[MyShop] hero upload failed", err);
      setError("Hero image upload failed.");
    } finally {
      setHeroUploading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const items = Object.values(overrides);
      const res = await fetch("/api/affiliate-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          themeSettings: {
            theme,
            hero_image_url: heroImageUrl,
            hero_blurb: heroBlurb,
            palette: theme === "custom" ? customPalette : null,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Save failed");
      }

      setInitialTheme(theme);
      setInitialHeroImageUrl(heroImageUrl || null);
      setInitialHeroBlurb(heroBlurb);
      setInitialPalette(
        theme === "custom" ? customPalette : DEFAULT_CUSTOM_PALETTE,
      );
      setMessage("Shop updated");
    } catch (err: any) {
      console.error("[MyShop] save failed", err);
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!shopLink) return;
    try {
      await navigator.clipboard.writeText(shopLink);
      setMessage("Link copied");
    } catch (err) {
      setError("Copy failed");
    }
  };

  const handleRequestAccess = async () => {
    if (!hasApprovedOffers) {
      setError(
        "You need at least one approved offer before requesting access.",
      );
      return;
    }
    const businessEmails = Array.from(
      new Set(
        offers
          .map((offer) => offer.business_email)
          .filter((email): email is string => !!email),
      ),
    );
    if (businessEmails.length === 0) {
      setError("Approved offers are missing business contacts.");
      return;
    }
    setRequestingAccess(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/my-shop/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessEmails }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Request failed");
      }
      setShopAccessStatus("pending");
      setMessage("Request sent to your approved brands.");
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setRequestingAccess(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface text-white p-6">Loading…</div>
    );
  }

  if (!shopEnabled) {
    return (
      <div className="min-h-screen bg-surface text-white px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#020a12] via-[#04121d] to-[#030a14] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.5)]">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              NettmarkShop
            </p>
            <h1 className="text-3xl font-bold text-white mt-1">My Shop</h1>
            <p className="text-sm text-white/70 mt-2">
              Request storefront approval so you can share a single link for all
              of your offers.
            </p>
          </header>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
              {message}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#030b15] via-[#041121] to-[#02060b] p-6 space-y-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                Request storefront access
              </p>
              <p className="text-sm text-white/70">
                Your NettmarkShop link lets you showcase every approved offer in
                one place for organic campaigns and bio links. Businesses you
                already work with need to approve this before it goes live.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              “This affiliate is requesting to have a shop link which will
              display your offer and others they work with on a storefront used
              for organic campaigns and social media links.”
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={
                  !hasApprovedOffers || requestingAccess || pendingShopRequest
                }
                className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-5 py-2 text-sm font-semibold text-black shadow-[0_12px_35px_rgba(0,194,203,0.35)] disabled:opacity-60"
              >
                {pendingShopRequest
                  ? "Request sent"
                  : requestingAccess
                    ? "Sending request…"
                    : "Send request"}
              </button>
              {!hasApprovedOffers && (
                <span className="text-xs text-white/60">
                  You need at least one approved offer first.
                </span>
              )}
            </div>
            {pendingShopRequest && (
              <p className="text-xs text-white/60">
                Your brands have been notified. We’ll unlock My Shop
                automatically once one approves.
              </p>
            )}
            {shopAccessStatus === "rejected" && (
              <p className="text-xs text-red-300">
                Your last request was declined. Update your offers and try
                again.
              </p>
            )}
          </div>

          {!hasApprovedOffers && (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center space-y-3">
              <p className="text-white/70 text-sm">
                You don’t have any approved offers yet. Browse the marketplace
                and request to promote a product before applying for a
                storefront.
              </p>
              <Link
                href="/affiliate/marketplace"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
              >
                Browse marketplace
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-white px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#020a12] via-[#04121d] to-[#030a14] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.5)] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              NettmarkShop
            </p>
            <h1 className="text-3xl font-bold text-white">My Shop</h1>
            <p className="text-sm text-white/70 mt-1 max-w-2xl">
              Craft the public storefront your followers see. Tweak handle,
              theme, imagery, and copy — everything updates live in the preview.
            </p>
          </div>
          <div className="hidden sm:flex flex-col text-sm text-white/60">
            <span className="font-semibold text-white">Live preview</span>
            <span>Updates automatically as you edit.</span>
          </div>
        </header>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#01070d] via-[#04121e] to-[#01070d] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)] space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                  <Link2 size={14} className="text-[#00C2CB]" />
                </span>
                Shop handle
              </p>
              <p className="text-sm text-white/60">
                Pick a public slug — lowercase letters, numbers, and dashes
                only.
              </p>
            </div>
            {handleSaved && shopLink && (
              <span className="text-xs font-semibold text-emerald-300">
                Active
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value.toLowerCase());
                setHandleSaved(false);
              }}
              placeholder="your-handle"
              className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm focus:border-[#00C2CB]"
            />
            <button
              type="button"
              onClick={handleHandleSave}
              disabled={handleSaving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-5 py-2 text-sm font-semibold text-black shadow-[0_12px_35px_rgba(0,194,203,0.35)] hover:bg-[#00b0b8] disabled:opacity-60"
            >
              {handleSaving ? "Saving…" : "Save handle"}
            </button>
          </div>
          <div className="flex flex-col gap-2 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
            <span className="break-all">
              {handleSaved && shopLink
                ? shopLink
                : "Handle must be saved before your shop is public."}
            </span>
            {handleSaved && shopLink && (
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/10"
              >
                Copy link
              </button>
            )}
          </div>
        </div>

        {handleSaved && shopLink ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-xs text-white/60 break-all">{shopLink}</span>
            <button
              onClick={copyLink}
              className="rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
            >
              Copy link
            </button>
          </div>
        ) : null}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
            {message}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {statCards.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#050d14] via-[#02070a] to-[#050d14] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.5)]"
            >
              <div className="text-xs text-white/60 uppercase tracking-wide flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                  <Icon size={13} className="text-[#00C2CB]" />
                </span>
                {label}
              </div>
              <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#03101a] via-[#041827] to-[#020b13] p-5 space-y-4 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                  <PaletteIcon size={14} className="text-[#00C2CB]" />
                </span>
                Themes
              </p>
              <p className="text-sm text-white/60">
                Pick a storefront vibe. Themes update the hero gradient and
                product cards instantly.
              </p>
            </div>
            <span className="text-xs text-white/50">Choose one</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTheme(opt.key)}
                className={`rounded-2xl border p-3 text-left transition ${
                  theme === opt.key
                    ? "border-[#00C2CB] bg-[#00c2cb1f] shadow-[0_15px_40px_rgba(0,194,203,0.25)]"
                    : "border-white/10 bg-black/20 hover:border-white/30"
                }`}
              >
                <div
                  className="mb-3 h-20 w-full rounded-xl"
                  style={{ backgroundImage: opt.preview }}
                />
                <p className="text-sm font-semibold">
                  {SHOP_THEMES[opt.key].name}
                </p>
                <p className="text-xs text-white/60">{opt.label}</p>
              </button>
            ))}
          </div>
        </div>

        {theme === "custom" && (
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#040d13] via-[#050f16] to-[#040d13] p-4 space-y-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                Custom palette
              </span>
              <p className="text-sm text-white/60">
                Tune your storefront colors. Gradient fields accept plain colors
                or full CSS gradients.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "accent", label: "Accent color" },
                { key: "accentSoft", label: "Accent soft" },
                { key: "cardBackground", label: "Card background" },
                { key: "cardBorder", label: "Card border" },
              ].map((field) => (
                <label
                  key={field.key}
                  className="text-xs text-white/50 flex flex-col gap-1"
                >
                  {field.label}
                  <input
                    type="color"
                    value={(customPalette as any)[field.key] || "#ffffff"}
                    onChange={(e) =>
                      setCustomPalette((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="h-10 w-full rounded border border-white/10 bg-black/30 cursor-pointer"
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white/50">
                Hero background (color or gradient)
                <input
                  type="text"
                  value={customPalette.heroBackground || ""}
                  onChange={(e) =>
                    setCustomPalette((prev) => ({
                      ...prev,
                      heroBackground: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  placeholder="linear-gradient(...)"
                />
              </label>
              <label className="text-xs text-white/50">
                Hero overlay (optional)
                <input
                  type="text"
                  value={customPalette.heroOverlay || ""}
                  onChange={(e) =>
                    setCustomPalette((prev) => ({
                      ...prev,
                      heroOverlay: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  placeholder="radial-gradient(...)"
                />
              </label>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#050f18] via-[#03101a] to-[#050f18] p-5 space-y-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                  <ImageIcon size={14} className="text-[#00C2CB]" />
                </span>
                Hero customization
              </p>
              <p className="text-sm text-white/60">
                Drop a hero background and add a short blurb to set
                expectations.
              </p>
            </div>
            {heroImageUrl && (
              <button
                type="button"
                onClick={() => setHeroImageUrl(null)}
                className="text-xs text-white/60 hover:text-white"
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => document.getElementById("heroUpload")?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white shadow-[0_10px_35px_rgba(0,0,0,0.35)] hover:bg-white/10"
                disabled={heroUploading || !handleSaved}
              >
                <UploadCloud size={16} />
                {heroUploading
                  ? "Uploading…"
                  : handleSaved
                    ? "Upload hero image"
                    : "Set handle first"}
              </button>
              <input
                id="heroUpload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleHeroUpload(e.target.files?.[0] || null)}
              />
            </div>
            {heroImageUrl && (
              <div className="rounded-2xl border border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImageUrl}
                  alt="Hero background"
                  className="w-full max-h-64 object-cover"
                />
              </div>
            )}
            <label className="text-xs text-white/50">
              Hero blurb
              <textarea
                className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                maxLength={240}
                rows={3}
                value={heroBlurb}
                onChange={(e) => setHeroBlurb(e.target.value)}
                placeholder="Share a short intro or highlight for visitors…"
              />
            </label>
          </div>
        </div>

        {!handleSaved ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/70">
            Set your shop handle above to unlock product customization and
            generate your NettmarkShop link.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/70">
            No approved offers yet. Once a business approves you, the offers
            will appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map(({ offer, override }) => (
              <div
                key={offer.id}
                className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#040c14] via-[#050f18] to-[#02060b] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.55)] space-y-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                        <LayoutGrid size={13} className="text-[#00C2CB]" />
                      </span>
                      Offer card
                    </p>
                    <h3 className="text-lg font-semibold">{offer.title}</h3>
                    <p className="text-sm text-white/60">
                      {offer.description || "No description yet."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateOverride(offer.id, {
                        custom_price: null,
                        custom_description: null,
                        custom_image_url: null,
                        display_order: 0,
                      })
                    }
                    className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white"
                  >
                    <RotateCcw size={12} />
                    Reset all
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    {override?.custom_image_url || offer.logo_url ? (
                      <img
                        src={override?.custom_image_url || offer.logo_url || ""}
                        alt={offer.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                        No image
                      </div>
                    )}
                  </div>
                  <label className="text-xs text-white/60 cursor-pointer">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px]">
                      <UploadCloud size={14} />
                      {uploadingImage === offer.id
                        ? "Uploading…"
                        : "Upload image"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleImageUpload(offer.id, e.target.files?.[0] || null)
                      }
                      disabled={uploadingImage === offer.id}
                    />
                  </label>
                  {override?.custom_image_url && (
                    <button
                      type="button"
                      onClick={() =>
                        updateOverride(offer.id, { custom_image_url: null })
                      }
                      className="text-xs text-white/60 hover:text-white"
                    >
                      Reset image
                    </button>
                  )}
                </div>
                <label className="text-xs text-white/60">
                  Short description
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                    value={override?.custom_description ?? ""}
                    onChange={(e) =>
                      updateOverride(offer.id, {
                        custom_description: e.target.value,
                      })
                    }
                    rows={2}
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        {handleSaved && (rows.length > 0 || themeSettingsDirty) && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-[#00C2CB] px-6 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save shop"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
