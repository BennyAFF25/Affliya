"use client";

import { useState } from "react";
import Link from "next/link";
import BusinessSidebar from "./BusinessSidebar";
import Topbar from "@/components/Topbar";
import {
  MobileNavSlider,
  MobileNavTab,
} from "@/components/navigation/MobileNavSlider";
import {
  LayoutDashboard,
  Store,
  Building,
  Inbox,
  LifeBuoy,
  Settings as SettingsIcon,
} from "lucide-react";

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  const mobileTabs: MobileNavTab[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/business/dashboard",
      icon: <LayoutDashboard size={16} />,
    },
    {
      id: "my-business",
      label: "My Business",
      href: "/business/my-business",
      icon: <Building size={16} />,
    },
    {
      id: "marketplace",
      label: "Marketplace",
      href: "/business/marketplace",
      icon: <Store size={16} />,
    },
    {
      id: "inbox",
      label: "Inbox",
      href: "/business/inbox",
      icon: <Inbox size={16} />,
    },
    {
      id: "support",
      label: "Support",
      href: "/business/support",
      icon: <LifeBuoy size={16} />,
    },
    {
      id: "settings",
      label: "Settings",
      href: "/business/settings",
      icon: <SettingsIcon size={16} />,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen text-white bg-surface">
      {/* Fixed Topbar */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-[#121212] to-[#1a1a1a] border-b border-white/5">
        <div className="flex items-center justify-between px-2">
          <Topbar />

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="md:hidden flex flex-col items-center justify-center w-9 h-9 bg-black/30 border border-white/10 rounded-md"
          >
            <span className="block w-5 h-[2px] bg-white mb-[3px] rounded" />
            <span className="block w-5 h-[2px] bg-white mb-[3px] rounded" />
            <span className="block w-5 h-[2px] bg-white rounded" />
          </button>
        </div>

        {/* Mobile pill slider */}
        {mobileNavOpen && (
          <div className="md:hidden bg-black/30 border-t border-white/10 py-3 px-4">
            <MobileNavSlider tabs={mobileTabs} onNavigate={closeMobileNav} />
          </div>
        )}
      </header>

      {/* Shell under topbar */}
      <div className="pt-16 flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-64 fixed top-16 bottom-0 left-0">
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
