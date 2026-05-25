"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useUser } from "@supabase/auth-helpers-react";
import { supabase } from "utils/supabase/pages-client";
import { LogOut, Moon, Sun } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/../context/ThemeContext";

type ProfileAvatarRow = {
  avatar_url: string | null;
};

const getPageTitle = (pathname: string | null): string => {
  if (!pathname) return "Dashboard";

  // Break into segments, e.g. "/affiliate/marketplace/123" -> ["affiliate","marketplace","123"]
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Dashboard";

  // Remove obviously dynamic/ID-like last segment (e.g. UUIDs) from the route key
  const staticSegments = [...segments];
  const last = staticSegments[staticSegments.length - 1];
  if (last && last.length > 12 && last.includes("-")) {
    staticSegments.pop();
  }

  const routeKey = staticSegments.join("/"); // e.g. "affiliate/marketplace"

  // Map known routes to nice titles
  const titleMap: Record<string, string> = {
    "affiliate/dashboard": "Dashboard",
    "affiliate/marketplace": "Marketplace",
    "affiliate/wallet": "Wallet",
    "affiliate/settings": "Settings",
    "affiliate/support": "Support",
    "affiliate/inbox": "Inbox",
    "affiliate/dashboard/promote": "Promote Offer",
    "affiliate/dashboard/manage-campaigns": "Manage Campaigns",

    "business/dashboard": "Dashboard",
    "business/marketplace": "Marketplace",
    "business/my-business": "My Business",
    "business/settings": "Settings",
    "business/support": "Support",
    "business/inbox": "Inbox",
  };

  if (titleMap[routeKey]) {
    return titleMap[routeKey];
  }

  // Fallback: use the last static segment, prettified
  const lastStatic = staticSegments[staticSegments.length - 1] || "Dashboard";
  const pretty = lastStatic
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return pretty;
};

export default function Topbar() {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolvedTheme = mounted ? theme : "dark";

  const userInitials = user?.email?.charAt(0).toUpperCase() || "F";

  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    const loadAvatar = async () => {
      if (!user?.email) {
        setAvatarUrl(null);
        return;
      }

      try {
        const { data: affiliateProfileRaw } = await supabase
          .from("affiliate_profiles")
          .select("avatar_url")
          .eq("email", user.email)
          .maybeSingle<ProfileAvatarRow>();

        if (affiliateProfileRaw?.avatar_url) {
          setAvatarUrl(affiliateProfileRaw.avatar_url);
          return;
        }

        const { data: businessProfileRaw } = await supabase
          .from("business_profiles")
          .select("avatar_url")
          .eq("business_email", user.email)
          .maybeSingle<ProfileAvatarRow>();

        if (businessProfileRaw?.avatar_url) {
          setAvatarUrl(businessProfileRaw.avatar_url);
          return;
        }
      } catch (err) {
        console.error("[Topbar] Failed to load avatar", err);
      }
    };

    void loadAvatar();
  }, [user?.email]);

  return (
    <div
      className="flex h-[64px] w-full items-center justify-between gap-3 px-3 sm:px-4 lg:px-6"
      style={{
        backgroundColor: "var(--sidebar)",
        color: "var(--sidebar-foreground)",
      }}
    >
      {/* LEFT SIDE */}
      <div className="flex min-w-0 items-center gap-3 sm:gap-4 lg:gap-6">
        {/* Slightly Smaller Logo */}
        <div className="flex shrink-0 items-center">
          <Image
            src="/nettmark-logo.png"
            alt="Nettmark Logo"
            width={120}
            height={32}
            priority
            className="h-8 w-auto object-contain sm:h-9 lg:h-10"
          />
        </div>

        {/* Page Title */}
        <span className="hidden text-[var(--muted-foreground)] text-xs tracking-[0.15em] uppercase md:inline">
          {pageTitle}
        </span>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-6">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--card)] text-[var(--foreground)] transition hover:bg-[var(--secondary)]"
        >
          {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Avatar – hidden on mobile */}
        {user && (
          <div
            className="
              hidden sm:flex
              w-10 h-10
              rounded-full overflow-hidden
              border border-[color:var(--border)]
              bg-[var(--secondary)]/60
              items-center justify-center
            "
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[var(--primary)] font-semibold text-sm">
                {userInitials}
              </span>
            )}
          </div>
        )}

        {/* Sign Out – only when authenticated */}
        {user && (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/");
            }}
            className="
              flex items-center justify-center
              bg-[var(--primary)] hover:brightness-110 
              text-[var(--primary-foreground)] 
              px-2 py-1.5
              rounded-md
              text-xs
              sm:px-3 sm:py-2 sm:rounded-lg sm:text-sm
              whitespace-nowrap
              transition
            "
          >
            <LogOut size={18} className="sm:size-[16px]" />
            <span className="hidden lg:inline">Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );
}
