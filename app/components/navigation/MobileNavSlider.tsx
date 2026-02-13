"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';

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

export function MobileNavSlider({ tabs, onNavigate, className = '' }: MobileNavSliderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = (href: string) => {
    router.push(href);
    onNavigate?.();
  };

  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide ${className}`}>
      {tabs.map((tab) => {
        const isActive = pathname?.startsWith(tab.href);
        return (
          <button
            key={tab.id}
            onClick={() => handleClick(tab.href)}
            className={`flex min-w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-[#00C2CB] bg-[#00C2CB] text-black shadow-[0_8px_20px_rgba(0,194,203,0.35)]'
                : 'border-white/10 bg-[#1c1c1c] text-white/80 hover:border-white/30'
            }`}
          >
            {tab.icon && <span className={`text-sm ${isActive ? 'text-black' : 'text-[#00C2CB]'}`}>{tab.icon}</span>}
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-white'
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
