"use client";

import React, { useEffect, useRef, useState } from "react";
import AffiliateSidebar from "./AffiliateSidebar";
import Topbar from "@/components/Topbar";
import {
  MobileNavSlider,
  MobileNavTab,
} from "@/components/navigation/MobileNavSlider";
import { useSessionContext } from "@supabase/auth-helpers-react";
import {
  LayoutDashboard,
  Store,
  Inbox,
  Wallet,
  Settings,
  LifeBuoy,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Toast } from "@/components/Toast";
import { useInboxNotifier } from "../../utils/hooks/useInboxNotifier";
import { supabase } from "../../utils/supabase/pages-client";

export default function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AffiliateLayoutShell>{children}</AffiliateLayoutShell>;
}

function AffiliateLayoutShell({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useSessionContext();
  const userEmail = session?.user?.email || "";
  const router = useRouter();
  const pathname = usePathname();
  const { toast, setToast, unreadCount } = useInboxNotifier(userEmail);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [affiliateRole, setAffiliateRole] = useState<"checking" | "affiliate" | "business" | "blocked" | "error">("checking");

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) { setAffiliateRole("checking"); return; }
    let current = true;
    setAffiliateRole("checking");
    void (async () => {
      const { data, error } = await supabase.from("profiles")
        .select("role").eq("id", userId).maybeSingle();
      if (!current) return;
      if (error) { setAffiliateRole("error"); return; }
      const role = String(data?.role || "").trim().toLowerCase();
      if (role === "affiliate") setAffiliateRole("affiliate");
      else if (role === "business") setAffiliateRole("business");
      else setAffiliateRole("blocked");
    })();
    return () => { current = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (affiliateRole === "business" && session?.user?.id) {
      router.replace("/business/my-business");
    }
  }, [affiliateRole, session?.user?.id, router]);
  const draftRoute=useRef<string|null>(null);
  if(!pathname.startsWith("/affiliate/dashboard/promote/"))draftRoute.current=null;
  else if(session?.user)draftRoute.current=pathname;
  const preserveDraft=draftRoute.current===pathname;


  useEffect(() => {
    if (isLoading || session !== null || preserveDraft) return;

    const queryString = window.location.search;
    const next = `${pathname}${queryString}`;
    router.replace(`/login/affiliate?next=${encodeURIComponent(next)}`);
  }, [isLoading, session, pathname, router, preserveDraft]);

  if (isLoading && !preserveDraft) {
    return (
      <div className="trial-theme flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        Loading…
      </div>
    );
  }

  if (session === null && !preserveDraft) {
    return (
      <div className="trial-theme flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        Redirecting to affiliate login…
      </div>
    );
  }

  if (session?.user && affiliateRole !== "affiliate") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]">
        {affiliateRole === "checking" || affiliateRole === "business"
          ? "Checking account access…"
          : affiliateRole === "error"
            ? "Could not verify your account role. Refresh and try again."
            : "This area is only available to affiliate accounts."}
      </div>
    );
  }

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
        className="fixed top-0 left-0 right-0 z-30 border-b"
        style={{
          backgroundColor: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        <div className="flex items-center justify-between px-2">
          <Topbar />
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
            <AffiliateSidebar />
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
