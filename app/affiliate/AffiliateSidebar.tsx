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
    <div className="relative h-full w-64 p-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1014] via-[#0f151a] to-[#0b0f12]" />
      <div className="pointer-events-none absolute -left-6 top-10 h-48 w-48 rounded-full blur-3xl bg-[#00C2CB]/20" />
      <div className="pointer-events-none absolute inset-0 border-r border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.65)]" />
      <div className="relative">
        <div className="text-[#00C2CB] font-bold text-lg mb-6 text-center tracking-wide" />

        <ul className="mt-2 space-y-1">
          {links.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <li key={link.href} className="relative">
                {link.name === "Inbox" && (
                  <div className="my-2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                )}

                <Link
                  href={link.href}
                  className={[
                    "group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors border backdrop-blur-sm",
                    active
                      ? "bg-[#0b2f31]/80 text-white border-[#00C2CB]/30 shadow-[0_15px_40px_rgba(0,0,0,0.35)]"
                      : "text-gray-200 border-transparent hover:bg-[#0b2a2b]/80 hover:text-white hover:border-[#1f3a3b]/80",
                  ].join(" ")}
                >
                  <Icon
                    size={18}
                    className={
                      active
                        ? "text-[#00C2CB]"
                        : "text-gray-400 group-hover:text-[#7ff5fb]"
                    }
                  />
                  <span className={active ? "tracking-wide" : ""}>
                    {link.name}
                  </span>
                  {active && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#00C2CB]/15 text-[#7ff5fb] border border-[#00C2CB]/30">
                      Active
                    </span>
                  )}
                </Link>

                {link.name === "Inbox" && hasNotification && (
                  <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-[#00C2CB] ring-2 ring-[#0f0f0f] shadow-[0_0_12px_2px_rgba(0,194,203,0.45)]" />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
