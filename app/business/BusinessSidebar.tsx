'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import {
  Home,
  Briefcase,
  Package,
  Mail,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';

export default function BusinessSidebar() {
  const pathname = usePathname();
  const session = useSession();
  const user = session?.user;
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const checkBusinessNotifs = async () => {
      if (!user?.email) return;

      const [{ data: reqs }, { data: ads }] = await Promise.all([
        supabase.from('affiliate_requests').select('*').eq('status', 'pending'),
        supabase.from('ad_ideas').select('*').eq('status', 'pending'),
      ]);

      if ((reqs?.length ?? 0) > 0 || (ads?.length ?? 0) > 0) {
        setShowNotification(true);
      }
    };

    checkBusinessNotifs();
  }, [user]);

  const links: { name: string; href: string; icon: LucideIcon }[] = [
    { name: 'Dashboard', href: '/business/dashboard', icon: Home },
    { name: 'My Business', href: '/business/my-business', icon: Briefcase },
    { name: 'Marketplace', href: '/business/marketplace', icon: Package },
    { name: 'Manage Campaigns', href: '/business/manage-campaigns', icon: Package },
    { name: 'Inbox', href: '/business/inbox', icon: Mail },
    { name: 'Settings', href: '/business/settings', icon: Settings },
    { name: 'Support', href: '/business/support', icon: LifeBuoy },
  ];

  return (
    <>
      {/* Desktop sidebar wrapper now takes full height */}
      <div className="hidden md:block h-full">
        <div className="h-full w-64 bg-gradient-to-b from-[#121212] to-[#1a1a1a] border-r border-[#262626] p-6 text-white">
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
                        : 'text-gray-200 border-transparent hover:bg-[#0b2a2b] hover:text-white hover:border-[#1f3a3b]',
                    ].join(' ')}
                  >
                    <Icon
                      size={18}
                      className={
                        active
                          ? 'text-[#00C2CB]'
                          : 'text-gray-400 group-hover:text-[#7ff5fb]'
                      }
                    />
                    <span className={active ? 'tracking-wide' : ''}>
                      {link.name}
                    </span>
                    {/* Active pill on the right for clarity */}
                    {active && (
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#00C2CB]/20 text-[#7ff5fb] border border-[#00C2CB]/30">
                        Active
                      </span>
                    )}
                  </Link>

                  {link.name === 'Inbox' && showNotification && (
                    <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-[#00C2CB] ring-2 ring-[#0f0f0f] shadow-[0_0_12px_2px_rgba(0,194,203,0.45)]" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Mobile pill slider nav */}
      <div className="md:hidden bg-[#1F1F1F] border-b border-black/20 py-3 px-4 flex overflow-x-auto gap-3">
        <Link
          href="/business/dashboard"
          className="px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm whitespace-nowrap"
        >
          Dashboard
        </Link>
        <Link
          href="/business/my-business"
          className="px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm whitespace-nowrap"
        >
          My Business
        </Link>
        <Link
          href="/business/marketplace"
          className="px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm whitespace-nowrap"
        >
          Marketplace
        </Link>
        <Link
          href="/business/manage-campaigns"
          className="px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm whitespace-nowrap"
        >
          Campaigns
        </Link>
        <Link
          href="/business/inbox"
          className="px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm whitespace-nowrap"
        >
          Inbox
        </Link>
        <Link
          href="/business/settings"
          className="px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm whitespace-nowrap"
        >
          Settings
        </Link>
        <Link
          href="/business/support"
          className="px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm whitespace-nowrap"
        >
          Support
        </Link>
      </div>
    </>
  );
}