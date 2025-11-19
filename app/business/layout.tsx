'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import BusinessSidebar from './BusinessSidebar';
import Topbar from '@/components/Topbar';

export default function BusinessLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="h-screen overflow-hidden bg-[#0e0e0e] text-white">
      {/* Fixed Topbar */}
      <header className="fixed top-0 inset-x-0 h-16 bg-[#1F1F1F] z-50 flex items-center justify-between px-2">
        <Topbar />

        {/* Hamburger (mobile only) */}
        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          className="md:hidden flex flex-col items-center justify-center w-7 h-7 bg-[#1A1A1A] rounded-md border border-white/15"
          aria-label="Open navigation"
        >
          <span className="block w-4 h-[2px] bg-white mb-0.5" />
          <span className="block w-4 h-[2px] bg-white mb-0.5" />
          <span className="block w-4 h-[2px] bg-white" />
        </button>
      </header>

      {/* Mobile pill-style nav directly under topbar */}
      {mobileNavOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-[#111111] border-b border-white/5 py-2 px-3 flex overflow-x-auto gap-2">
          <Link
            href="/business/dashboard"
            onClick={closeMobileNav}
            className="px-4 py-1.5 rounded-full bg-[#222222] text-white border border-white/10 text-sm whitespace-nowrap hover:bg-[#333333]"
          >
            Dashboard
          </Link>
          <Link
            href="/business/my-business"
            onClick={closeMobileNav}
            className="px-4 py-1.5 rounded-full bg-[#222222] text-white border border-white/10 text-sm whitespace-nowrap hover:bg-[#333333]"
          >
            My Business
          </Link>
          <Link
            href="/business/marketplace"
            onClick={closeMobileNav}
            className="px-4 py-1.5 rounded-full bg-[#222222] text-white border border-white/10 text-sm whitespace-nowrap hover:bg-[#333333]"
          >
            Marketplace
          </Link>
          <Link
            href="/business/manage-campaigns"
            onClick={closeMobileNav}
            className="px-4 py-1.5 rounded-full bg-[#222222] text-white border border-white/10 text-sm whitespace-nowrap hover:bg-[#333333]"
          >
            Manage Campaigns
          </Link>
          <Link
            href="/business/inbox"
            onClick={closeMobileNav}
            className="px-4 py-1.5 rounded-full bg-[#222222] text-white border border-white/10 text-sm whitespace-nowrap hover:bg-[#333333]"
          >
            Inbox
          </Link>
          <Link
            href="/business/settings"
            onClick={closeMobileNav}
            className="px-4 py-1.5 rounded-full bg-[#222222] text-white border border-white/10 text-sm whitespace-nowrap hover:bg-[#333333]"
          >
            Settings
          </Link>
          <Link
            href="/business/support"
            onClick={closeMobileNav}
            className="px-4 py-1.5 rounded-full bg-[#222222] text-white border border-white/10 text-sm whitespace-nowrap hover:bg-[#333333]"
          >
            Support
          </Link>
        </div>
      )}

      {/* Main shell under the topbar */}
      <div className="pt-16 h-full flex">
        {/* Desktop sidebar (same as your original) */}
        <aside className="hidden md:block w-64 flex-shrink-0 bg-[#050505] fixed top-16 bottom-0 left-0">
          <BusinessSidebar />
        </aside>

        {/* Scrollable content; shifted right on desktop */}
        <main className="flex-1 overflow-y-auto bg-[#0e0e0e] md:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}