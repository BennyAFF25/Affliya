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

  const links = [
    { name: 'Dashboard', href: '/business/dashboard', icon: <Home size={16} /> },
    { name: 'My Business', href: '/business/my-business', icon: <Briefcase size={16} /> },
    { name: 'Marketplace', href: '/business/marketplace', icon: <Package size={16} /> },
    { name: 'Manage Campaigns', href: '/business/manage-campaigns', icon: <Package size={16} /> },
    { name: 'Inbox', href: '/business/inbox', icon: <Mail size={16} /> },
    { name: 'Settings', href: '/business/settings', icon: <Settings size={16} /> },
    { name: 'Support', href: '/business/support', icon: <LifeBuoy size={16} /> },
  ];

  return (
    <div className="h-full w-64 bg-[#1F1F1F] p-6 text-white">
      <ul className="space-y-2 divide-y divide-white/10 mt-2">
        {links.map((link) => (
          <li key={link.href} className="relative">
            <Link
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition-all ${
                pathname === link.href
                  ? 'bg-[#00C2CB] text-white'
                  : 'hover:bg-[#e0fafa] hover:text-[#00C2CB] text-white'
              }`}
            >
              {link.icon}
              <span>{link.name}</span>
            </Link>
            {link.name === 'Inbox' && showNotification && (
              <span className="absolute top-3 right-4 w-2.5 h-2.5 bg-[#00C2CB] rounded-full animate-pulse" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}