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

  return (
    <div
      className="relative h-full w-64 border-r px-5 py-6"
      style={{
        backgroundColor: "var(--sidebar)",
        color: "var(--sidebar-foreground)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      <ul className="space-y-1">
        {links.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <li key={link.href} className="relative">
              {link.name === "Inbox" && (
                <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
              )}

              <Link
                href={link.href}
                className="group flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all"
                style={{
                  backgroundColor: active
                    ? "var(--sidebar-accent)"
                    : "transparent",
                  borderColor: active ? "var(--sidebar-ring)" : "transparent",
                  color: active
                    ? "var(--sidebar-accent-foreground)"
                    : "var(--muted-foreground)",
                }}
              >
                <Icon
                  size={18}
                  className="transition-colors"
                  style={{
                    color: active
                      ? "var(--sidebar-primary)"
                      : "var(--muted-foreground)",
                  }}
                />
                <span className={active ? "tracking-wide" : ""}>
                  {link.name}
                </span>
                {active && (
                  <span
                    className="ml-auto rounded-full border px-2 py-0.5 text-[10px]"
                    style={{
                      borderColor: "var(--sidebar-ring)",
                      color: "var(--sidebar-primary)",
                    }}
                  >
                    Active
                  </span>
                )}
              </Link>

              {link.name === "Inbox" && hasNotification && (
                <span
                  className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: "var(--sidebar-primary)",
                    boxShadow: "0 0 12px 2px rgba(0,194,203,0.45)",
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
