"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";

interface ProductCardProps {
  title: string;
  description?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  ctaHref: string;
}

export function ProductCard({
  title,
  description,
  price,
  imageUrl,
  ctaHref,
}: ProductCardProps) {
  const priceBadge = price || "View details";

  return (
    <motion.div
      className="group rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.4)] transition-colors"
      whileHover={{ translateY: -6 }}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70" />
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
            {priceBadge}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-white/80">
            Nettmark
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-4 flex-1">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          {description && (
            <p className="text-sm text-white/60 line-clamp-3">{description}</p>
          )}
        </div>
        <div className="mt-auto border-t border-white/5 pt-3 text-xs text-white/60 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-white/70">
            <Sparkles size={14} /> Verified listing
          </span>
          <span className="text-white/40">/go redirect</span>
        </div>
      </div>

      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00C2CB] text-black font-semibold py-2 hover:bg-[#00b0b8] transition"
        prefetch={false}
      >
        Explore offer <ArrowUpRight size={16} />
      </Link>
    </motion.div>
  );
}
