'use client';

import { useState } from 'react';
import Link from 'next/link';
import BusinessSidebar from './BusinessSidebar';
import Topbar from '@/components/Topbar';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="flex flex-col min-h-screen text-white bg-[#0e0e0e]">
      {/* Fixed Topbar */}
      <header className="fixed top-0 inset-x-0 h-16 bg-[#1F1F1F] z-30 flex items-center justify-between px-2">
        <Topbar />

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          className="md:hidden flex flex-col items-center justify-center w-9 h-9 bg-[#1A1A1A] rounded-md border border-white/15"
        >
          <span className="block w-5 h-[2px] bg-white mb-[3px]" />
          <span className="block w-5 h-[2px] bg-white mb-[3px]" />
          <span className="block w-5 h-[2px] bg-white" />
        </button>
      </header>

      {/* Mobile pill slider */}
      {mobileNavOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-[#111111] border-b border-white/10 py-3 px-4 flex overflow-x-auto gap-3">
          <Link
            href="/business/dashboard"
            onClick={closeMobileNav}
            className="px-4 py-2 rounded-full bg-[#222222] text-white text-sm border border-white/10 whitespace-nowrap hover:bg-[#333333]"
          >
            Dashboard
          </Link>

          <Link
            href="/business/my-business"
            onClick={closeMobileNav}
            className="px-4 py-2 rounded-full bg-[#222222] text-white text-sm border border-white/10 whitespace-nowrap hover:bg-[#333333]"
          >
            My Business
          </Link>

          <Link
            href="/business/marketplace"
            onClick={closeMobileNav}
            className="px-4 py-2 rounded-full bg-[#222222] text-white text-sm border border-white/10 whitespace-nowrap hover:bg-[#333333]"
          >
            Marketplace
          </Link>

          <Link
            href="/business/manage-campaigns"
            onClick={closeMobileNav}
            className="px-4 py-2 rounded-full bg-[#222222] text-white text-sm border border-white/10 whitespace-nowrap hover:bg-[#333333]"
          >
            Campaigns
          </Link>

          <Link
            href="/business/inbox"
            onClick={closeMobileNav}
            className="px-4 py-2 rounded-full bg-[#222222] text-white text-sm border border-white/10 whitespace-nowrap hover:bg-[#333333]"
          >
            Inbox
          </Link>

          <Link
            href="/business/settings"
            onClick={closeMobileNav}
            className="px-4 py-2 rounded-full bg-[#222222] text-white text-sm border border-white/10 whitespace-nowrap hover:bg-[#333333]"
          >
            Settings
          </Link>

          <Link
            href="/business/support"
            onClick={closeMobileNav}
            className="px-4 py-2 rounded-full bg-[#222222] text-white text-sm border border-white/10 whitespace-nowrap hover:bg-[#333333]"
          >
            Support
          </Link>
        </div>
      )}

      {/* Shell under topbar */}
      <div className="pt-16 flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-64 fixed top-16 bottom-0 left-0 bg-[#050505]">
          <BusinessSidebar />
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto md:ml-64 bg-[#0e0e0e]">
          {children}
        </main>
      </div>
    </div>
  );
}