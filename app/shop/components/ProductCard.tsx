"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles, ShieldCheck } from "lucide-react";
import { SHOP_THEMES, type ShopThemeKey } from "../theme";

interface ProductCardProps {
  title: string;
  description?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  ctaHref: string;
  theme?: ShopThemeKey;
}

export function ProductCard({
  title,
  description,
  price,
  imageUrl,
  ctaHref,
  theme = "midnight",
}: ProductCardProps) {
  const themeStyles = SHOP_THEMES[theme] ?? SHOP_THEMES.midnight;
  const ctaTextColor = theme === "luminous" ? "#111827" : "#000";

  return (
    <motion.div
      className="group relative rounded-[32px] backdrop-blur-xl p-4 flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.45)]"
      style={{
        background: themeStyles.cardBackground,
        border: `1px solid ${themeStyles.cardBorder}`,
      }}
      whileHover={{ translateY: -8 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <div className="relative w-full overflow-hidden rounded-2xl bg-black/40 border border-white/5">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center text-white/40 text-sm">
            Image coming soon
          </div>
        )}
        <div className="absolute inset-0 opacity-70 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
          >
            {price || "View details"}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em]"
            style={{
              borderColor: themeStyles.cardBorder,
              color: themeStyles.accentSoft,
            }}
          >
            Nettmark
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-5 flex-1">
        <div className="space-y-2">
          <h3
            className="text-2xl font-semibold leading-tight"
            style={{ color: themeStyles.accent }}
          >
            {title}
          </h3>
          {description && (
            <p className="text-sm text-white/70 line-clamp-3">{description}</p>
          )}
        </div>
        <div
          className="grid grid-cols-2 gap-2 text-xs border rounded-2xl px-3 py-2"
          style={{
            borderColor: themeStyles.cardBorder,
            color: themeStyles.accentSoft,
          }}
        >
          <span className="inline-flex items-center gap-1">
            <Sparkles size={14} /> High-intent
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={14} /> Tracked payout
          </span>
        </div>
      </div>

      <Link
        href={ctaHref}
        className="mt-5 inline-flex items-center justify-between gap-2 rounded-2xl font-semibold py-3 px-4 transition"
        style={{ backgroundColor: themeStyles.accent, color: ctaTextColor }}
        prefetch={false}
      >
        Explore offer
        <ArrowUpRight size={18} />
      </Link>
    </motion.div>
  );
}
