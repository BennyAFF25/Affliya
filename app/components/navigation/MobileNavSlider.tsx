"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

export interface MobileNavTab {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: number;
}

interface MobileNavSliderProps {
  tabs: MobileNavTab[];
  onNavigate?: () => void;
  className?: string;
}

export function MobileNavSlider({
  tabs,
  onNavigate,
  className = "",
}: MobileNavSliderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = (href: string) => {
    router.push(href);
    onNavigate?.();
  };

  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = pathname?.startsWith(tab.href);
        return (
          <button
            key={tab.id}
            onClick={() => handleClick(tab.href)}
            className={`flex min-w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_8px_20px_rgba(0,194,203,0.35)]"
                : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
            }`}
          >
            {tab.icon && (
              <span
                className={`text-sm ${isActive ? "text-[var(--primary-foreground)]" : "text-[var(--primary)]"}`}
              >
                {tab.icon}
              </span>
            )}
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  isActive
                    ? "bg-[var(--primary-foreground)]/15 text-[var(--primary-foreground)]"
                    : "bg-[var(--card)] text-[var(--foreground)]"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
