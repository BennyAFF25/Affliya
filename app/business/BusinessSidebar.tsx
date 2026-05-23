"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "utils/supabase/pages-client";
import {
  Home,
  Briefcase,
  Package,
  Mail,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

export default function BusinessSidebar() {
  const pathname = usePathname();
  const session = useSession();
  const user = session?.user;
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const checkBusinessNotifs = async () => {
      if (!user?.email) return;

      const [{ data: reqs }, { data: ads }] = await Promise.all([
        supabase.from("affiliate_requests").select("*").eq("status", "pending"),
        supabase.from("ad_ideas").select("*").eq("status", "pending"),
      ]);

      if ((reqs?.length ?? 0) > 0 || (ads?.length ?? 0) > 0) {
        setShowNotification(true);
      }
    };

    checkBusinessNotifs();
  }, [user]);

  const links: { name: string; href: string; icon: LucideIcon }[] = [
    { name: "Dashboard", href: "/business/dashboard", icon: Home },
    { name: "My Business", href: "/business/my-business", icon: Briefcase },
    { name: "Marketplace", href: "/business/marketplace", icon: Package },
    {
      name: "Manage Campaigns",
      href: "/business/manage-campaigns",
      icon: Package,
    },
    { name: "Inbox", href: "/business/inbox", icon: Mail },
    { name: "Settings", href: "/business/settings", icon: Settings },
    { name: "Support", href: "/business/support", icon: LifeBuoy },
  ];

  return (
    <>
      {/* Desktop sidebar wrapper now takes full height */}
      <div className="hidden h-full lg:block">
        <div className="relative h-full w-64 p-6 text-[var(--sidebar-foreground)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--sidebar)] via-[var(--card)] to-[var(--sidebar)]" />
          <div className="pointer-events-none absolute -left-6 top-10 h-48 w-48 rounded-full bg-[var(--primary)]/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 border-r border-[var(--sidebar-border)] shadow-[0_30px_90px_rgba(0,0,0,0.2)]" />
          <div className="relative">
            <ul className="mt-2 space-y-1">
              {links.map((link) => {
                const active = pathname === link.href;
                const Icon = link.icon;
                return (
                  <li key={link.href} className="relative">
                    {/* Section divider before Inbox */}
                    {link.name === "Inbox" && (
                      <div className="my-2 h-px bg-gradient-to-r from-transparent via-[var(--sidebar-border)] to-transparent" />
                    )}

                    <Link
                      href={link.href}
                      className={[
                        "group flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium backdrop-blur-sm transition-colors",
                        active
                          ? "border-[var(--primary)]/30 bg-[var(--primary)]/15 text-[var(--foreground)] ring-1 ring-[var(--primary)]/20"
                          : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--card)] hover:text-[var(--foreground)]",
                      ].join(" ")}
                    >
                      <Icon
                        size={18}
                        className={
                          active
                            ? "text-[var(--primary)]"
                            : "text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
                        }
                      />
                      <span className={active ? "tracking-wide" : ""}>
                        {link.name}
                      </span>
                      {/* Active pill on the right for clarity */}
                      {active && (
                        <span className="ml-auto rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/20 px-2 py-0.5 text-[10px] text-[var(--primary)]">
                          Active
                        </span>
                      )}
                    </Link>

                    {link.name === "Inbox" && showNotification && (
                      <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[var(--primary)] ring-2 ring-[var(--card)] shadow-[0_0_12px_2px_color-mix(in_oklab,var(--primary)_45%,transparent)]" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile pill slider nav */}
      <div className="flex gap-3 overflow-x-auto border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 lg:hidden">
        <Link
          href="/business/dashboard"
          className="whitespace-nowrap rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/20 px-4 py-2 text-sm text-[var(--primary)]"
        >
          Dashboard
        </Link>
        <Link
          href="/business/my-business"
          className="whitespace-nowrap rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/20 px-4 py-2 text-sm text-[var(--primary)]"
        >
          My Business
        </Link>
        <Link
          href="/business/marketplace"
          className="whitespace-nowrap rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/20 px-4 py-2 text-sm text-[var(--primary)]"
        >
          Marketplace
        </Link>
        <Link
          href="/business/manage-campaigns"
          className="whitespace-nowrap rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/20 px-4 py-2 text-sm text-[var(--primary)]"
        >
          Campaigns
        </Link>
        <Link
          href="/business/inbox"
          className="whitespace-nowrap rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/20 px-4 py-2 text-sm text-[var(--primary)]"
        >
          Inbox
        </Link>
        <Link
          href="/business/settings"
          className="whitespace-nowrap rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/20 px-4 py-2 text-sm text-[var(--primary)]"
        >
          Settings
        </Link>
        <Link
          href="/business/support"
          className="whitespace-nowrap rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/20 px-4 py-2 text-sm text-[var(--primary)]"
        >
          Support
        </Link>
      </div>
    </>
  );
}
