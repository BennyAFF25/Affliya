'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import {
  Home,
  Package,
  Mail,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';

export default function AffiliateSidebar() {
  const pathname = usePathname();
  const [hasNotification, setHasNotification] = useState(false);

  const { session, isLoading } = useSessionContext();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/');
    }
  }, [isLoading, session, router]);

  const user = session?.user;

  useEffect(() => {
    const fetchNotifications = async () => {
      const email = user?.email;
      if (!email) return;

      const [{ data: approvedPromos }, { data: approvedAds }] = await Promise.all([
        supabase
          .from('affiliate_requests')
          .select('id')
          .eq('affiliate_email', email)
          .eq('status', 'approved'),
        supabase
          .from('ad_ideas')
          .select('id')
          .eq('affiliate_email', email)
          .eq('status', 'approved'),
      ]);

      const hasPromo = (approvedPromos ?? []).length > 0;
      const hasAd = (approvedAds ?? []).length > 0;

      setHasNotification(hasPromo || hasAd);
    };

    fetchNotifications();
  }, [user]);

  const links: { name: string; href: string; icon: LucideIcon }[] = [
    { name: 'Dashboard', href: '/affiliate/dashboard', icon: Home },
    { name: 'Marketplace', href: '/affiliate/marketplace', icon: Package },
    { name: 'Manage Campaigns', href: '/affiliate/dashboard/manage-campaigns', icon: Package },
    { name: 'Inbox', href: '/affiliate/inbox', icon: Mail },
    { name: 'Settings', href: '/affiliate/settings', icon: Settings },
    { name: 'Support', href: '/affiliate/support', icon: LifeBuoy },
    { name: 'Wallet', href: '/affiliate/wallet', icon: Package },
  ];

  return (
    <div className="h-full w-64 bg-gradient-to-b from-[#121212] to-[#1a1a1a] p-6 text-white">
      {/* Optional: FalconX label or subtle spacer */}
      <div className="text-[#00C2CB] font-bold text-lg mb-6 text-center tracking-wide">
      
      </div>

      <ul className="mt-2 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <li key={link.href} className="relative">
              {/* Section divider before Inbox */}
              {link.name === 'Inbox' && (
                <div className="my-2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              )}

              <Link
                href={link.href}
                className={[
                  'group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors border',
                  active
                    ? 'bg-[#00C2CB]/15 text-white border-[#00C2CB]/30 ring-1 ring-[#00C2CB]/20'
                    : 'text-gray-200 border-transparent hover:bg-[#0b2a2b] hover:text-white hover:border-[#1f3a3b]'
                ].join(' ')}
              >
                <Icon
                  size={18}
                  className={active ? 'text-[#00C2CB]' : 'text-gray-400 group-hover:text-[#7ff5fb]'}
                />
                <span className={active ? 'tracking-wide' : ''}>{link.name}</span>
                {/* Active pill on the right for clarity */}
                {active && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#00C2CB]/20 text-[#7ff5fb] border border-[#00C2CB]/30">
                    Active
                  </span>
                )}
              </Link>

              {link.name === 'Inbox' && hasNotification && (
                <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-[#00C2CB] ring-2 ring-[#0f0f0f] shadow-[0_0_12px_2px_rgba(0,194,203,0.45)]" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}