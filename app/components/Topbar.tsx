'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import { LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';


type ProfileAvatarRow = {
  avatar_url: string | null;
};

const getPageTitle = (pathname: string | null): string => {
  if (!pathname) return 'Dashboard';

  // Break into segments, e.g. "/affiliate/marketplace/123" -> ["affiliate","marketplace","123"]
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';

  // Remove obviously dynamic/ID-like last segment (e.g. UUIDs) from the route key
  const staticSegments = [...segments];
  const last = staticSegments[staticSegments.length - 1];
  if (last && last.length > 12 && last.includes('-')) {
    staticSegments.pop();
  }

  const routeKey = staticSegments.join('/'); // e.g. "affiliate/marketplace"

  // Map known routes to nice titles
  const titleMap: Record<string, string> = {
    'affiliate/dashboard': 'Dashboard',
    'affiliate/marketplace': 'Marketplace',
    'affiliate/wallet': 'Wallet',
    'affiliate/settings': 'Settings',
    'affiliate/support': 'Support',
    'affiliate/inbox': 'Inbox',
    'affiliate/dashboard/promote': 'Promote Offer',
    'affiliate/dashboard/manage-campaigns': 'Manage Campaigns',

    'business/dashboard': 'Dashboard',
    'business/marketplace': 'Marketplace',
    'business/my-business': 'My Business',
    'business/settings': 'Settings',
    'business/support': 'Support',
    'business/inbox': 'Inbox',
  };

  if (titleMap[routeKey]) {
    return titleMap[routeKey];
  }

  // Fallback: use the last static segment, prettified
  const lastStatic = staticSegments[staticSegments.length - 1] || 'Dashboard';
  const pretty = lastStatic
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return pretty;
};

export default function Topbar() {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const userInitials = user?.email?.charAt(0).toUpperCase() || 'F';

  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    const loadAvatar = async () => {
      if (!user?.email) {
        setAvatarUrl(null);
        return;
      }

      try {
        const { data: affiliateProfileRaw } = await supabase
          .from('affiliate_profiles')
          .select('avatar_url')
          .eq('email', user.email)
          .maybeSingle<ProfileAvatarRow>();

        if (affiliateProfileRaw?.avatar_url) {
          setAvatarUrl(affiliateProfileRaw.avatar_url);
          return;
        }

        const { data: businessProfileRaw } = await supabase
          .from('business_profiles')
          .select('avatar_url')
          .eq('business_email', user.email)
          .maybeSingle<ProfileAvatarRow>();

        if (businessProfileRaw?.avatar_url) {
          setAvatarUrl(businessProfileRaw.avatar_url);
          return;
        }
      } catch (err) {
        console.error('[Topbar] Failed to load avatar', err);
      }
    };

    void loadAvatar();
  }, [user?.email]);

  return (
    <header
      className="
        w-full 
        bg-[#1F1F1F]
        h-[64px]
        flex items-center
        justify-between
        px-4 sm:px-6
        border-b border-black/20
      "
    >
      {/* LEFT SIDE */}
      <div className="flex items-center gap-6">
        {/* Slightly Smaller Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/nettmark-logo.png"
            alt="Nettmark Logo"
            width={150}     // smaller now
            height={40}
            priority
            className="object-contain"
          />
        </Link>

        {/* Page Title */}
        <span className="text-[#D0D0D0] text-xs tracking-[0.15em] uppercase">
          {pageTitle}
        </span>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Avatar – hidden on mobile */}
        {user && (
          <div
            className="
              hidden sm:flex
              w-10 h-10
              rounded-full overflow-hidden
              border border-white/10
              bg-black/30
              items-center justify-center
            "
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#00C2CB] font-semibold text-sm">
                {userInitials}
              </span>
            )}
          </div>
        )}

        {/* Sign Out – shrinks on mobile */}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/');
          }}
          className="
            flex items-center justify-center
            bg-[#00C2CB] hover:bg-[#00b0b8] 
            text-white 
            px-2 py-1.5
            rounded-md
            text-xs
            sm:px-3 sm:py-2 sm:rounded-lg sm:text-sm
            whitespace-nowrap
            transition
          "
        >
          <LogOut size={18} className="sm:size-[16px]" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}