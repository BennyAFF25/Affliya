'use client';

import type { ReactNode } from 'react';
import BusinessSidebar from './BusinessSidebar';
import Topbar from '@/components/Topbar';

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-[#0e0e0e] text-white">
      {/* Global topbar fixed across full width */}
      <header className="fixed top-0 inset-x-0 h-16 bg-[#0e0e0e] z-50 flex items-center">
        <Topbar />
      </header>

      {/* Below the topbar: sidebar + scrollable content */}
      <div className="pt-16 h-full flex">
        {/* Fixed sidebar under the topbar */}
        <aside className="w-64 flex-shrink-0 bg-[#050505] border-none fixed top-16 bottom-0 left-0">
          <BusinessSidebar />
        </aside>

        {/* Scrollable content area to the right of the fixed sidebar */}
        <main className="flex-1 ml-64 overflow-y-auto bg-[#0e0e0e]">
          {children}
        </main>
      </div>
    </div>
  );
}
