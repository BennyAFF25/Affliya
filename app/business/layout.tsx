"use client";

import { useState } from "react";
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
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Fixed Topbar */}
      <header className="fixed left-0 right-0 top-0 z-30 border-b border-[var(--sidebar-border)] bg-[var(--sidebar)] backdrop-blur">
        <div className="flex items-center justify-between px-2">
          <div className="min-w-0 flex-1">
            <Topbar />
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md border border-[var(--border)] bg-[var(--secondary)]/70 2xl:hidden"
          >
            <span className="mb-[3px] block h-[2px] w-5 rounded bg-[var(--foreground)]" />
            <span className="mb-[3px] block h-[2px] w-5 rounded bg-[var(--foreground)]" />
            <span className="block h-[2px] w-5 rounded bg-[var(--foreground)]" />
          </button>
        </div>

        {/* Mobile pill slider */}
        {mobileNavOpen && (
          <div className="border-t border-[var(--border)] bg-[var(--card)]/95 px-4 py-3 2xl:hidden">
            <MobileNavSlider tabs={mobileTabs} onNavigate={closeMobileNav} />
          </div>
        )}
      </header>

      {/* Shell under topbar */}
      <div className="flex min-h-0 flex-1 pt-16">
        {/* Desktop sidebar */}
        <aside className="fixed bottom-0 left-0 top-16 hidden w-64 2xl:block">
          <BusinessSidebar />
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[var(--background)] 2xl:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}
