"use client";

import { useEffect, useState } from "react";
import { brandInitials } from "./brandInitials";

type BrandLogoProps = {
  src?: string | null;
  name: string;
  size?: "sm" | "md";
  className?: string;
  alt?: string;
  fit?: "contain" | "cover";
};

const SIZE = { sm: "h-11 w-11 text-[13px]", md: "h-12 w-12 text-sm" } as const;

export default function BrandLogo({ src, name, size = "md", className = "", alt, fit = "contain" }: BrandLogoProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const frame = `relative shrink-0 overflow-hidden rounded-xl border border-white/10 ${SIZE[size]} ${className}`;

  if (src && !broken) {
    return (
      <div className={`${frame} flex items-center justify-center bg-[var(--secondary)]`}>
        <img
          src={src}
          alt={alt ?? `${name} logo`}
          onError={() => setBroken(true)}
          className={fit === "cover" ? "h-full w-full object-cover" : "h-full w-full object-contain p-1.5"}
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt ?? `${name} logo placeholder`}
      data-brand-logo-placeholder=""
      className={`${frame} grid place-items-center bg-gradient-to-br from-[#141a1c] via-[#1a2426] to-[#0e4a4e]`}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-full border border-[#00c2cb]/20" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-3 -right-3 h-8 w-8 rounded-full bg-[#00c2cb]/15 blur-md" />
      <span className="relative font-semibold tracking-tight text-white/95">{brandInitials(name)}</span>
    </div>
  );
}
