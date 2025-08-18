'use client';

import AffiliateSidebar from './AffiliateSidebar';
import Topbar from '@/components/Topbar';
import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
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

  return (
    <div className="flex flex-col min-h-screen text-white">
      {/* Pass unread count to Topbar (keeps working even if Topbar ignores it) */}
      <Topbar {...({ unreadCount } as any)} />
      <div className="flex flex-1">
        <div className="min-h-screen w-64 bg-[#1F1F1F] text-white">
          {/* Pass unread count to sidebar as well (non‑breaking) */}
          <AffiliateSidebar {...({ unreadCount } as any)} />
        </div>
        <main className="flex-1 bg-white text-black">{children}</main>
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