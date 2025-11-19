'use client';

import { useState } from 'react';
import Link from 'next/link';
import AffiliateSidebar from './AffiliateSidebar';
import Topbar from '@/components/Topbar';
import { useSession } from '@supabase/auth-helpers-react';
import { useRouter, usePathname } from 'next/navigation';
import { Toast } from '@/components/Toast';
import { useInboxNotifier } from '../../utils/hooks/useInboxNotifier';

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return <AffiliateLayoutShell>{children}</AffiliateLayoutShell>;
}

function AffiliateLayoutShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const userEmail = session?.user?.email || '';
  const router = useRouter();
  const { toast, setToast, unreadCount } = useInboxNotifier(userEmail);
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="flex flex-col min-h-screen text-white bg-[#0e0e0e]">
      {/* Fixed Topbar at the top */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-[#1F1F1F]">
        <div className="flex items-center justify-between px-2">
          <Topbar {...({ unreadCount } as any)} />
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col items-center justify-center w-9 h-9 bg-[#1F1F1F] border border-white/10 rounded-md"
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            <span className="block w-5 h-[2px] bg-white mb-[3px] rounded" />
            <span className="block w-5 h-[2px] bg-white mb-[3px] rounded" />
            <span className="block w-5 h-[2px] bg-white rounded" />
          </button>
        </div>

        {/* Mobile pill slider */}
        {mobileNavOpen && (
          <div className="md:hidden bg-[#111111] border-t border-black/40 py-3 px-4 flex overflow-x-auto gap-3">
            <Link
              href="/affiliate/dashboard"
              onClick={closeMobileNav}
              className="px-4 py-2 rounded-full bg-[#00C2CB] text-black text-sm whitespace-nowrap"
            >
              Dashboard
            </Link>
            <Link
              href="/affiliate/marketplace"
              onClick={closeMobileNav}
              className="px-4 py-2 rounded-full bg-[#222222] text-gray-100 text-sm whitespace-nowrap"
            >
              Marketplace
            </Link>
            <Link
              href="/affiliate/dashboard/manage-campaigns"
              onClick={closeMobileNav}
              className="px-4 py-2 rounded-full bg-[#222222] text-gray-100 text-sm whitespace-nowrap"
            >
              Campaigns
            </Link>
            <Link
              href="/affiliate/inbox"
              onClick={closeMobileNav}
              className="px-4 py-2 rounded-full bg-[#222222] text-gray-100 text-sm whitespace-nowrap"
            >
              Inbox
            </Link>
            <Link
              href="/affiliate/settings"
              onClick={closeMobileNav}
              className="px-4 py-2 rounded-full bg-[#222222] text-gray-100 text-sm whitespace-nowrap"
            >
              Settings
            </Link>
            <Link
              href="/affiliate/support"
              onClick={closeMobileNav}
              className="px-4 py-2 rounded-full bg-[#222222] text-gray-100 text-sm whitespace-nowrap"
            >
              Support
            </Link>
            <Link
              href="/affiliate/wallet"
              onClick={closeMobileNav}
              className="px-4 py-2 rounded-full bg-[#222222] text-gray-100 text-sm whitespace-nowrap"
            >
              Wallet
            </Link>
          </div>
        )}
      </div>

      {/* Sidebar + content row, pushed down under Topbar */}
      <div className="flex flex-1 pt-[64px] min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-64">
          <div className="hidden md:block fixed left-0 top-[64px] bottom-0 w-64 bg-[#1F1F1F] text-white">
            <AffiliateSidebar {...({ unreadCount } as any)} />
          </div>
        </div>

        {/* Scrollable main content area */}
        <main className="flex-1 bg-[#0e0e0e] text-white overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Inbox Toast */}
      <Toast
        open={!!toast}
        title={toast?.title || ''}
        body={toast?.body}
        actionLabel="Check inbox"
        onAction={() => router.push('/affiliate/inbox')}
        onClose={() => setToast(null)}
      />
    </div>
  );
}