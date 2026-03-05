"use client";

import { useState } from "react";
import { Share2, Link2 } from "lucide-react";
import type { ShopThemeKey, ThemePaletteJson } from "../theme";
import { resolveTheme } from "../theme";

interface ShopHeroProps {
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
  shopUrl: string;
  tagline?: string | null;
  heroBlurb?: string | null;
  heroImageUrl?: string | null;
  theme?: ShopThemeKey;
  customPalette?: ThemePaletteJson | null;
}

export function ShopHero({
  name,
  handle,
  avatarUrl,
  shopUrl,
  tagline,
  heroBlurb,
  heroImageUrl,
  theme = "midnight",
  customPalette = null,
}: ShopHeroProps) {
  const [copied, setCopied] = useState(false);
  const themeStyles = resolveTheme(theme, customPalette);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shopUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy shop link", error);
    }
  };

  return (
    <section
      className="relative overflow-hidden rounded-[36px] border p-6 sm:p-10 shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
      style={{
        borderColor: themeStyles.cardBorder,
        background: themeStyles.heroBackground,
      }}
    >
      {themeStyles.heroOverlay && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: themeStyles.heroOverlay }}
        />
      )}
      {heroImageUrl && (
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage: `url(${heroImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div className="relative flex flex-col gap-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-28 w-28 rounded-[32px] object-cover border"
                style={{ borderColor: themeStyles.cardBorder }}
              />
            ) : (
              <div
                className="h-28 w-28 rounded-[32px] grid place-items-center text-3xl font-semibold"
                style={{
                  backgroundColor: "rgba(0,0,0,0.15)",
                  color: themeStyles.accent,
                }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                <span>Trusted Nettmark storefront</span>
                {handle && (
                  <span
                    className="rounded-full px-3 py-1 text-[11px] tracking-[0.2em] normal-case"
                    style={{ border: `1px solid ${themeStyles.cardBorder}` }}
                  >
                    @{handle}
                  </span>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white">
                {name}
              </h1>
              <p className="text-base sm:text-lg text-white/80 max-w-2xl">
                {tagline ||
                  "Hand-picked offers from top Nettmark partners. Every product ships directly from the brand."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div
              className="text-xs break-all rounded-2xl border px-4 py-2"
              style={{
                borderColor: themeStyles.cardBorder,
                backgroundColor: "rgba(0,0,0,0.25)",
                color: "#f9fafb",
              }}
            >
              {shopUrl}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
                style={{
                  borderColor: themeStyles.cardBorder,
                  color: "#f9fafb",
                }}
              >
                <Share2 size={16} />
                {copied ? "Link copied" : "Share with friends"}
              </button>
              <a
                href={shopUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: themeStyles.accent,
                  color: theme === "luminous" ? "#111827" : "#000",
                }}
              >
                <Link2 size={16} /> Visit shop
              </a>
            </div>
          </div>
        </div>

        {heroBlurb && (
          <div
            className="rounded-3xl border px-4 py-5 text-sm leading-relaxed"
            style={{
              borderColor: themeStyles.cardBorder,
              color: "#f4f4f5",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            {heroBlurb}
          </div>
        )}
      </div>
    </section>
  );
}
