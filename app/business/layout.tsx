'use client';

import { useState } from 'react';
import Link from 'next/link';
import BusinessSidebar from './BusinessSidebar';
import Topbar from '@/components/Topbar';
import { MobileNavSlider, MobileNavTab } from '@/components/navigation/MobileNavSlider';
import { LayoutDashboard, Store, Building, Inbox, LifeBuoy, Settings as SettingsIcon } from 'lucide-react';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  const mobileTabs: MobileNavTab[] = [
    { id: 'dashboard', label: 'Dashboard', href: '/business/dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'my-business', label: 'My Business', href: '/business/my-business', icon: <Building size={16} /> },
    { id: 'marketplace', label: 'Marketplace', href: '/business/marketplace', icon: <Store size={16} /> },
    { id: 'inbox', label: 'Inbox', href: '/business/inbox', icon: <Inbox size={16} /> },
    { id: 'support', label: 'Support', href: '/business/support', icon: <LifeBuoy size={16} /> },
    { id: 'settings', label: 'Settings', href: '/business/settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <div className="flex flex-col min-h-screen text-white bg-surface">
      {/* Fixed Topbar */}
      <header className="fixed top-0 inset-x-0 h-16 bg-surface-deep z-30 flex items-center justify-between px-2">
        <Topbar />

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          className="md:hidden flex flex-col items-center justify-center w-9 h-9 bg-surface-deep rounded-md border border-white/15"
        >
          <span className="block w-5 h-[2px] bg-white mb-[3px]" />
          <span className="block w-5 h-[2px] bg-white mb-[3px]" />
          <span className="block w-5 h-[2px] bg-white" />
        </button>
      </header>

      {/* Mobile pill slider */}
      {mobileNavOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-surface-deep border-b border-white/10 py-3 px-4">
          <MobileNavSlider tabs={mobileTabs} onNavigate={closeMobileNav} />
        </div>
      )}

      {/* Shell under topbar */}
      <div className="pt-16 flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-64 fixed top-16 bottom-0 left-0 bg-[#050505]">
          <BusinessSidebar />
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto md:ml-64 bg-surface">
          {children}
        </main>
      </div>
    </div>
  );
}
