"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "utils/supabase/pages-client";
import {
  Home,
  Package,
  Mail,
  Settings,
  LifeBuoy,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";

export default function AffiliateSidebar() {
  const pathname = usePathname();
  const [hasNotification, setHasNotification] = useState(false);

  const { session, isLoading } = useSessionContext();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/");
    }
  }, [isLoading, session, router]);

  const user = session?.user;

  useEffect(() => {
    const fetchNotifications = async () => {
      const email = user?.email;
      if (!email) return;

      const [{ data: approvedPromos }, { data: approvedAds }] =
        await Promise.all([
          supabase
            .from("affiliate_requests")
            .select("id")
            .eq("affiliate_email", email)
            .eq("status", "approved"),
          supabase
            .from("ad_ideas")
            .select("id")
            .eq("affiliate_email", email)
            .eq("status", "approved"),
        ]);

      setHasNotification(
        (approvedPromos?.length ?? 0) > 0 || (approvedAds?.length ?? 0) > 0,
      );
    };

    fetchNotifications();
  }, [user]);

  const links: { name: string; href: string; icon: LucideIcon }[] = [
    { name: "Dashboard", href: "/affiliate/dashboard", icon: Home },
    { name: "Marketplace", href: "/affiliate/marketplace", icon: Package },
    {
      name: "Manage Campaigns",
      href: "/affiliate/dashboard/manage-campaigns",
      icon: Package,
    },
    { name: "My Shop", href: "/affiliate/dashboard/my-shop", icon: Store },
    { name: "Inbox", href: "/affiliate/inbox", icon: Mail },
    { name: "Settings", href: "/affiliate/settings", icon: Settings },
    { name: "Support", href: "/affiliate/support", icon: LifeBuoy },
    { name: "Wallet", href: "/affiliate/wallet", icon: Package },
  ];

  const isActive = (href: string) => {
    if (pathname === href) return true;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <div className="hidden h-full md:block">
      <div className="relative h-full w-64 p-6 text-[var(--sidebar-foreground)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--sidebar)] via-[var(--card)] to-[var(--sidebar)]" />
        <div className="pointer-events-none absolute -left-6 top-10 h-48 w-48 rounded-full bg-[var(--primary)]/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 border-r border-[var(--sidebar-border)] shadow-[0_30px_90px_rgba(0,0,0,0.2)]" />

        <div className="relative">
          <ul className="mt-2 space-y-1">
            {links.map((link) => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <li key={link.href} className="relative">
                  {link.name === "Inbox" && (
                    <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-[var(--sidebar-border)] to-transparent" />
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
                    {active && (
                      <span className="ml-auto rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/20 px-2 py-0.5 text-[10px] text-[var(--primary)]">
                        Active
                      </span>
                    )}
                  </Link>

                  {link.name === "Inbox" && hasNotification && (
                    <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[var(--primary)] ring-2 ring-[var(--card)] shadow-[0_0_12px_2px_color-mix(in_oklab,var(--primary)_45%,transparent)]" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
