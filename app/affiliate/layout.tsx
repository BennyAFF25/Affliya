'use client';

import AffiliateSidebar from './AffiliateSidebar';
import Topbar from '@/components/Topbar';
import { useSession } from '@supabase/auth-helpers-react';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { Toast } from '@/components/Toast';
import { useInboxNotifier } from '../../utils/hooks/useInboxNotifier';
import { useState } from 'react';

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

  return (
    <div className="flex flex-col min-h-screen text-white bg-[#0e0e0e]">
      {/* Fixed Topbar at the top */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-[#1F1F1F]">
        <div className="flex items-center justify-between px-2">
          <Topbar {...({ unreadCount } as any)} />
          <button
            className="md:hidden flex flex-col items-center justify-center w-7 h-7 bg-[#1A1A1A] rounded-md border border-white/15"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle navigation"
          >
            <span className="block w-4 h-[2px] bg-white mb-0.5" />
            <span className="block w-4 h-[2px] bg-white mb-0.5" />
            <span className="block w-4 h-[2px] bg-white" />
          </button>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-[#111111] border-b border-white/5 py-2 px-3 flex overflow-x-auto gap-2">
            <a
              href="/affiliate/dashboard"
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border ${
                pathname === '/affiliate/dashboard'
                  ? 'bg-[#222222] text-white border-white/20'
                  : 'bg-[#111111] text-gray-200 border-white/10 hover:bg-[#222222]'
              }`}
            >
              Dashboard
            </a>
            <a
              href="/affiliate/marketplace"
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border ${
                pathname === '/affiliate/marketplace'
                  ? 'bg-[#222222] text-white border-white/20'
                  : 'bg-[#111111] text-gray-200 border-white/10 hover:bg-[#222222]'
              }`}
            >
              Marketplace
            </a>
            <a
              href="/affiliate/dashboard/manage-campaigns"
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border ${
                pathname === '/affiliate/dashboard/manage-campaigns'
                  ? 'bg-[#222222] text-white border-white/20'
                  : 'bg-[#111111] text-gray-200 border-white/10 hover:bg-[#222222]'
              }`}
            >
              Campaigns
            </a>
            <a
              href="/affiliate/inbox"
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border ${
                pathname === '/affiliate/inbox'
                  ? 'bg-[#222222] text-white border-white/20'
                  : 'bg-[#111111] text-gray-200 border-white/10 hover:bg-[#222222]'
              }`}
            >
              Inbox
            </a>
            <a
              href="/affiliate/settings"
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border ${
                pathname === '/affiliate/settings'
                  ? 'bg-[#222222] text-white border-white/20'
                  : 'bg-[#111111] text-gray-200 border-white/10 hover:bg-[#222222]'
              }`}
            >
              Settings
            </a>
            <a
              href="/affiliate/support"
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border ${
                pathname === '/affiliate/support'
                  ? 'bg-[#222222] text-white border-white/20'
                  : 'bg-[#111111] text-gray-200 border-white/10 hover:bg-[#222222]'
              }`}
            >
              Support
            </a>
            <a
              href="/affiliate/wallet"
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border ${
                pathname === '/affiliate/wallet'
                  ? 'bg-[#222222] text-white border-white/20'
                  : 'bg-[#111111] text-gray-200 border-white/10 hover:bg-[#222222]'
              }`}
            >
              Wallet
            </a>
          </div>
        )}
      </div>

      {/* Sidebar + content row, pushed down under Topbar */}
      <div className="flex flex-1 pt-[64px] min-h-0">
        {/* Sidebar column with fixed sidebar inside */}
        <div className="hidden md:block w-64">
          <div className="hidden md:block fixed left-0 top-[64px] bottom-0 w-64 bg-[#1F1F1F] text-white">
            {/* Pass unread count to sidebar as well (non-breaking) */}
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