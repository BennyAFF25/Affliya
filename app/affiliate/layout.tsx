"use client";

import { useState } from "react";
import AffiliateSidebar from "./AffiliateSidebar";
import Topbar from "@/components/Topbar";
import {
  MobileNavSlider,
  MobileNavTab,
} from "@/components/navigation/MobileNavSlider";
import { useSession } from "@supabase/auth-helpers-react";
import {
  LayoutDashboard,
  Store,
  Inbox,
  Wallet,
  Settings,
  LifeBuoy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/Toast";
import { useInboxNotifier } from "../../utils/hooks/useInboxNotifier";

export default function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AffiliateLayoutShell>{children}</AffiliateLayoutShell>;
}

function AffiliateLayoutShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const userEmail = session?.user?.email || "";
  const router = useRouter();
  const { toast, setToast, unreadCount } = useInboxNotifier(userEmail);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  const mobileTabs: MobileNavTab[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/affiliate/dashboard",
      icon: <LayoutDashboard size={16} />,
    },
    {
      id: "marketplace",
      label: "Marketplace",
      href: "/affiliate/marketplace",
      icon: <Store size={16} />,
    },
    {
      id: "my-shop",
      label: "My Shop",
      href: "/affiliate/dashboard/my-shop",
      icon: <Store size={16} />,
    },
    {
      id: "inbox",
      label: "Inbox",
      href: "/affiliate/inbox",
      icon: <Inbox size={16} />,
      badge: unreadCount,
    },
    {
      id: "wallet",
      label: "Wallet",
      href: "/affiliate/wallet",
      icon: <Wallet size={16} />,
    },
    {
      id: "support",
      label: "Support",
      href: "/affiliate/support",
      icon: <LifeBuoy size={16} />,
    },
    {
      id: "settings",
      label: "Settings",
      href: "/affiliate/settings",
      icon: <Settings size={16} />,
    },
  ];

  return (
    <div className="trial-theme flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Fixed Topbar at the top */}
      <div
        className="fixed top-0 left-0 right-0 z-30 border-b bg-gradient-to-b from-[var(--sidebar)] to-[#1f1f1f]"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between px-2">
          <Topbar {...({ unreadCount } as any)} />
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col items-center justify-center w-9 h-9 rounded-md border border-[color:var(--border)] bg-[var(--secondary)]/70"
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            <span className="block w-5 h-[2px] bg-[var(--foreground)] mb-[3px] rounded" />
            <span className="block w-5 h-[2px] bg-[var(--foreground)] mb-[3px] rounded" />
            <span className="block w-5 h-[2px] bg-[var(--foreground)] rounded" />
          </button>
        </div>

        {/* Mobile pill slider */}
        {mobileNavOpen && (
          <div
            className="md:hidden border-t py-3 px-4"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <MobileNavSlider tabs={mobileTabs} onNavigate={closeMobileNav} />
          </div>
        )}
      </div>

      {/* Sidebar + content row, pushed down under Topbar */}
      <div className="flex flex-1 pt-[64px] min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-64">
          <div
            className="hidden md:block fixed left-0 top-[64px] bottom-0 w-64 border-r"
            style={{
              backgroundColor: "var(--sidebar)",
              color: "var(--sidebar-foreground)",
              borderColor: "var(--sidebar-border)",
            }}
          >
            <AffiliateSidebar {...({ unreadCount } as any)} />
          </div>
        </div>

        {/* Scrollable main content area */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
        >
          {children}
        </main>
      </div>

      {/* Global Inbox Toast */}
      <Toast
        open={!!toast}
        title={toast?.title || ""}
        body={toast?.body}
        actionLabel="Check inbox"
        onAction={() => router.push("/affiliate/inbox")}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
