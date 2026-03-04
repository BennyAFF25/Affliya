"use client";

import { useState } from "react";
import { Share2, Link2 } from "lucide-react";

interface ShopHeroProps {
  name: string;
  avatarUrl?: string | null;
  shopUrl: string;
  tagline?: string | null;
  stats?: { label: string; value: string }[];
}

export function ShopHero({
  name,
  avatarUrl,
  shopUrl,
  tagline,
  stats = [],
}: ShopHeroProps) {
  const [copied, setCopied] = useState(false);

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
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-r from-[#031319] via-[#02070a] to-[#041926] p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_rgba(0,194,203,0.4),_transparent_55%)]" />
      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-24 w-24 rounded-[28px] object-cover border border-white/20"
              />
            ) : (
              <div className="h-24 w-24 rounded-[28px] bg-white/10 text-3xl font-semibold grid place-items-center">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
                NettmarkShop
              </p>
              <h1 className="text-4xl font-bold text-white mt-2">{name}</h1>
              <p className="text-sm text-white/70 mt-2 max-w-xl">
                {tagline ||
                  "Curated offers with instant Nettmark tracking + payouts."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="text-xs text-white/60 break-all">{shopUrl}</div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                <Share2 size={16} /> {copied ? "Link copied" : "Share link"}
              </button>
              <a
                href={shopUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00b0b8]"
              >
                <Link2 size={16} /> Open storefront
              </a>
            </div>
          </div>
        </div>

        {stats.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur"
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                  {stat.label}
                </p>
                <p className="text-2xl font-semibold text-white mt-1">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
