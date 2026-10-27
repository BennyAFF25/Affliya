"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useChatUnreadCount } from "@/components/inbox/useChatUnreadCount";
import Link from "next/link";
import { supabase } from "utils/supabase/pages-client";
import { getBusinessEntitlement } from "utils/businessEntitlements";
import { businessOfferOnboardingNudge, businessOfferOnboardingSessionKey, isBusinessOfferOnboardingExempt } from "utils/businessOfferOnboardingNudge";
import BusinessSidebar from "./BusinessSidebar";
import Topbar from "@/components/Topbar";
import PaidCampaignResumeBanner from "@/../components/business/PaidCampaignResumeBanner";
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
  const { session, isLoading } = useSessionContext();
  const router = useRouter();
  const pathname = usePathname();
  const isPlanScreen = pathname === "/business/choose-plan";
  const [planPending, setPlanPending] = useState<boolean | null>(null);
  const chatUnreadCount = useChatUnreadCount(session?.user?.id);

  useEffect(() => {
    if (isLoading || session !== null) return;

    const queryString = window.location.search;
    const next = `${pathname}${queryString}`;
    router.replace(`/login/business?next=${encodeURIComponent(next)}`);
  }, [isLoading, session, pathname, router]);

  useEffect(() => {
    if (!session?.user?.id || isPlanScreen) return;
    let active = true;
    setPlanPending(null);
    void fetch("/api/business-subscription/plan-step-status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not verify plan selection.");
        const data = await response.json();
        if (active) {
          setPlanPending(Boolean(data.required));
          if (data.required) router.replace("/business/choose-plan");
        }
      })
      .catch(() => { if (active) setPlanPending(true); });
    return () => { active = false; };
  }, [session?.user?.id, isPlanScreen, router]);

  const [offerNudge, setOfferNudge] = useState<{ userId: string; pathname: string; visible: boolean } | null>(null);
  useEffect(() => {
    const userId = session?.user?.id;
    const businessEmail = session?.user?.email;
    if (!userId || !businessEmail || planPending !== false) return;
    let active = true;
    const check = async () => {
      setOfferNudge(null);
      const currentPath = pathname + window.location.search;
      if (isBusinessOfferOnboardingExempt(currentPath)) return;
      try {
        const key = businessOfferOnboardingSessionKey(userId);
        const sessionFlag = sessionStorage.getItem(key) === "1";
        const [entitlement, offers] = await Promise.all([
          getBusinessEntitlement({ businessEmail, supabase }),
          supabase.from("offers").select("id", { count: "exact", head: true }).eq("business_email", businessEmail),
        ]);
        if (!active || offers.error || offers.count === null) return;
        const decision = businessOfferOnboardingNudge({ billingStatus: entitlement?.billingStatus,
          offerCount: offers.count, pathname: currentPath, sessionFlag });
        if (decision.shouldRedirect) {
          // Persist before navigation so returning to the dashboard cannot loop.
          sessionStorage.setItem(key, "1");
          router.replace("/onboarding/for-business");
        } else setOfferNudge({ userId, pathname, visible: decision.shouldShowBanner });
      } catch { /* Fail open on entitlement, offer query, or browser storage errors. */ }
    };
    void check();
    window.addEventListener("focus", check);
    return () => { active = false; window.removeEventListener("focus", check); };
  }, [session?.user?.id, session?.user?.email, pathname, planPending, router]);

  if (isLoading || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        {isLoading ? "Loading…" : "Redirecting to business login…"}
      </div>
    );
  }

  // Keep this step focused: no global sidebar, shortcuts or resume banners.
  if (isPlanScreen) return <div className="min-h-screen bg-[#0f0f0f]">{children}</div>;
  if (session?.user?.id && planPending !== false) return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0f0f] p-6 text-sm text-slate-300" role="status">
      {planPending ? "Complete your plan choice to continue. If this persists, refresh the page." : "Checking your Growth plan…"}
      <a href="/logout" className="ml-4 underline">Sign out</a>
    </main>
  );

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
      badge: chatUnreadCount,
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
            className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md border border-[var(--border)] bg-[var(--secondary)]/70 xl:hidden"
          >
            <span className="mb-[3px] block h-[2px] w-5 rounded bg-[var(--foreground)]" />
            <span className="mb-[3px] block h-[2px] w-5 rounded bg-[var(--foreground)]" />
            <span className="block h-[2px] w-5 rounded bg-[var(--foreground)]" />
          </button>
        </div>

        {/* Mobile pill slider */}
        {mobileNavOpen && (
          <div className="border-t border-[var(--border)] bg-[var(--card)]/95 px-4 py-3 xl:hidden">
            <MobileNavSlider tabs={mobileTabs} onNavigate={closeMobileNav} />
          </div>
        )}
      </header>

      {/* Shell under topbar */}
      <div className="flex min-h-0 flex-1 pt-16">
        {/* Desktop sidebar */}
        <div className="hidden xl:block w-64">
          <aside className="fixed bottom-0 left-0 top-16 w-64">
            <BusinessSidebar chatUnreadCount={chatUnreadCount} />
          </aside>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[var(--background)]">
          {offerNudge?.visible && offerNudge.userId === session?.user?.id && offerNudge.pathname === pathname && (
            <div role="status" className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#151718] px-4 py-3 text-sm !text-white shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
              <span>Finish your offer — affiliates can&apos;t find you yet</span>
              <Link href="/onboarding/for-business" className="inline-flex min-h-11 items-center rounded-full border border-[#00C2CB]/30 px-4 font-semibold !text-[#63e8ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB]">Finish offer</Link>
            </div>
          )}
          <PaidCampaignResumeBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
