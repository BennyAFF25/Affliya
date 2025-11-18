'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import BusinessSidebar from './BusinessSidebar';
import Topbar from '@/components/Topbar';

export default function BusinessLayout({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-[#0e0e0e] text-white">
      {/* Global topbar fixed across full width */}
      <header className="fixed top-0 inset-x-0 h-16 bg-[#0e0e0e] z-50 flex items-center">
        <Topbar />
      </header>

      {/* Main shell under the topbar */}
      <div className="pt-16 h-full flex">
        {/* Desktop sidebar (fixed) */}
        <aside className="hidden md:block w-64 flex-shrink-0 bg-[#050505] fixed top-16 bottom-0 left-0">
          <BusinessSidebar />
        </aside>

        {/* Mobile sidebar toggle button */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden fixed bottom-5 left-5 z-40 inline-flex items-center justify-center rounded-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black shadow-lg h-12 w-12 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00C2CB] focus:ring-offset-[#0e0e0e]"
          aria-label="Open navigation"
        >
          <span className="sr-only">Open navigation</span>
          <span className="block w-6 h-[2px] bg-black mb-[5px] rounded" />
          <span className="block w-6 h-[2px] bg-black mb-[5px] rounded" />
          <span className="block w-6 h-[2px] bg-black rounded" />
        </button>

        {/* Mobile slide-out sidebar */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Panel */}
            <div className="absolute top-16 bottom-0 left-0 w-64 bg-[#050505] shadow-2xl">
              <BusinessSidebar />
            </div>
          </div>
        )}

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto bg-[#0e0e0e] md:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}
