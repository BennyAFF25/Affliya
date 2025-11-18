'use client';

import AffiliateSidebar from './AffiliateSidebar';
import Topbar from '@/components/Topbar';
import { useSession } from '@supabase/auth-helpers-react';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
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

  return (
    <div className="flex flex-col min-h-screen text-white bg-[#0e0e0e]">
      {/* Fixed Topbar at the top */}
      <div className="fixed top-0 left-0 right-0 z-30">
        {/* Pass unread count to Topbar (keeps working even if Topbar ignores it) */}
        <Topbar {...({ unreadCount } as any)} />
      </div>

      {/* Sidebar + content row, pushed down under Topbar */}
      <div className="flex flex-1 pt-[64px] min-h-0">
        {/* Sidebar column with fixed sidebar inside */}
        <div className="w-64">
          <div className="fixed left-0 top-[64px] bottom-0 w-64 bg-[#1F1F1F] text-white">
            {/* Pass unread count to sidebar as well (non‑breaking) */}
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
