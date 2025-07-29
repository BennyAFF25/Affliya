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
} from 'lucide-react';
import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';

export default function AffiliateSidebar() {
  const pathname = usePathname();
  const [hasNotification, setHasNotification] = useState(false);

  const session = useSession();
  const router = useRouter();

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && session === null) {
      router.push('/');
    }
  }, [isClient, session, router]);
  
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

  const links = [
    { name: 'Dashboard', href: '/affiliate/dashboard', icon: <Home size={16} /> },
    { name: 'Marketplace', href: '/affiliate/marketplace', icon: <Package size={16} /> },
    { name: 'Manage Campaigns', href: '/affiliate/dashboard/manage-campaigns', icon: <Package size={16} /> },
    { name: 'Inbox', href: '/affiliate/inbox', icon: <Mail size={16} /> },
    { name: 'Settings', href: '/affiliate/settings', icon: <Settings size={16} /> },
    { name: 'Support', href: '/affiliate/support', icon: <LifeBuoy size={16} /> },
    { name: 'Wallet', href: '/affiliate/wallet', icon: <Package size={16} /> },
  ];

  return (
    <div className="h-full w-64 bg-[#1F1F1F] p-6 text-white">
      {/* Optional: FalconX label or subtle spacer */}
      <div className="text-[#00C2CB] font-bold text-lg mb-6 text-center tracking-wide">
      
      </div>

      <ul className="divide-y divide-white/10">
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

            {link.name === 'Inbox' && hasNotification && (
              <span className="absolute top-3 right-4 w-2.5 h-2.5 bg-[#00C2CB] rounded-full animate-pulse" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}