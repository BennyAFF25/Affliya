'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import { LogOut } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

// Navigation links for each side of the app
const businessLinks = [
  { href: '/business/dashboard', label: 'Dashboard' },
  { href: '/business/my-business', label: 'My Business' },
  { href: '/business/marketplace', label: 'Marketplace' },
  { href: '/business/manage-campaigns', label: 'Manage Campaigns' },
  { href: '/business/inbox', label: 'Inbox' },
  { href: '/business/settings', label: 'Settings' },
  { href: '/business/support', label: 'Support' },
];

const affiliateLinks = [
  { href: '/affiliate/dashboard', label: 'Dashboard' },
  { href: '/affiliate/marketplace', label: 'Marketplace' },
  { href: '/affiliate/manage-campaigns', label: 'Manage Campaigns' },
  { href: '/affiliate/wallet', label: 'Wallet' },
  { href: '/affiliate/inbox', label: 'Inbox' },
  { href: '/affiliate/settings', label: 'Settings' },
  { href: '/affiliate/support', label: 'Support' },
];

export default function Topbar() {
  const user = useUser();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const userInitials = user?.email?.charAt(0).toUpperCase() || 'F';

  // Decide which set of links to show based on the current section
  let navLinks: { href: string; label: string }[] = [];
  if (pathname?.startsWith('/business')) {
    navLinks = businessLinks;
  } else if (pathname?.startsWith('/affiliate')) {
    navLinks = affiliateLinks;
  }

  const current = navLinks.find((link) => pathname?.startsWith(link.href));

  useEffect(() => {
    const loadAvatar = async () => {
      if (!user?.email) {
        setAvatarUrl(null);
        return;
      }

      try {
        // Try affiliate profile first
        const { data: affiliateProfile, error: affError } = await (supabase as any)
          .from('affiliate_profiles')
          .select('avatar_url')
          .eq('email', user.email as string)
          .maybeSingle();

        if (affError && affError.code && affError.code !== 'PGRST116') {
          console.warn('[Topbar] affiliate_profiles avatar error', affError);
        }

        if (affiliateProfile?.avatar_url) {
          setAvatarUrl(affiliateProfile.avatar_url as string);
          return;
        }

        // Fallback to business profile
        const { data: businessProfile, error: bizError } = await (supabase as any)
          .from('business_profiles')
          .select('avatar_url')
          .eq('business_email', user.email as string)
          .maybeSingle();

        if (bizError && bizError.code && bizError.code !== 'PGRST116') {
          console.warn('[Topbar] business_profiles avatar error', bizError);
        }

        if (businessProfile?.avatar_url) {
          setAvatarUrl(businessProfile.avatar_url as string);
        }
      } catch (err) {
        console.error('[Topbar] Failed to load avatar', err);
      }
    };

    void loadAvatar();
  }, [user?.email]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <>
      {/* FIXED TOP BAR */}
      <header className="w-full bg-[#1F1F1F] px-4 sm:px-6 flex justify-between items-center h-16 md:h-20">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center">
            <Image
              src="/nettmark-logo.png"
              alt="Nettmark Logo"
              width={140}
              height={35}
              priority
              className="object-contain ml-2 md:ml-4 translate-y-[-3px]"
            />
          </Link>

          {/* Desktop current section label */}
          {current && (
            <div className="hidden md:flex items-center ml-4 text-xs uppercase tracking-[0.18em] text-gray-400">
              <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
              <span>{current.label}</span>
            </div>
          )}
        </div>

        {/* Desktop right-side controls */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/" className="text-sm text-[#00C2CB] font-medium hover:underline translate-y-[-2px]">
            Home
          </Link>

          {user && (
            <>
              {avatarUrl ? (
                <div className="w-9 h-9 rounded-full border border-white/15 overflow-hidden bg-black/40 translate-y-[-2px]">
                  <img src={avatarUrl} alt="Profile" className="h-9 w-9 object-cover" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#1F1F1F]/20 flex items-center justify-center text-[#00C2CB] font-semibold text-sm shadow-inner translate-y-[-2px]">
                  {userInitials}
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-lg text-sm transition translate-y-[-2px]"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </>
          )}
        </div>

        {/* Mobile right-side controls */}
        <div className="flex md:hidden items-center gap-2">
          {current && (
            <span className="text-[0.7rem] uppercase tracking-[0.16em] text-gray-400 mr-1">
              {current.label}
            </span>
          )}

          {user && (
            <>
              {avatarUrl ? (
                <div className="w-8 h-8 rounded-full border border-white/15 overflow-hidden bg-black/40">
                  <img src={avatarUrl} alt="Profile" className="h-8 w-8 object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1F1F1F]/20 flex items-center justify-center text-[#00C2CB] font-semibold text-xs shadow-inner">
                  {userInitials}
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-3 py-1.5 rounded-lg text-xs transition"
              >
                <LogOut size={14} />
                Out
              </button>
            </>
          )}

          {/* Mobile hamburger / nav toggle */}
          {navLinks.length > 0 && (
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#101010] text-gray-300 hover:border-[#3a3a3a]"
              aria-label="Toggle navigation"
            >
              <div className="space-y-[3px]">
                <span
                  className={`block h-[2px] w-5 rounded-full bg-current transition-transform ${
                    mobileNavOpen ? 'translate-y-[5px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[2px] w-5 rounded-full bg-current transition-opacity ${
                    mobileNavOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`block h-[2px] w-5 rounded-full bg-current transition-transform ${
                    mobileNavOpen ? '-translate-y-[5px] -rotate-45' : ''
                  }`}
                />
              </div>
            </button>
          )}
        </div>
      </header>

      {/* Mobile nav pills shown under the top bar */}
      {mobileNavOpen && navLinks.length > 0 && (
        <nav className="md:hidden bg-[#0e0e0e] px-3 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {navLinks.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#00C2CB] text-black'
                      : 'bg-[#151515] text-gray-300 border border-[#252525] hover:bg-[#1f1f1f]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
