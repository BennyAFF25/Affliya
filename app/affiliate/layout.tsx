'use client';
import Link from 'next/link';
import AffiliateSidebar from './AffiliateSidebar';
import Topbar from '@/components/Topbar';
import { useSession } from '@supabase/auth-helpers-react';
import { useRouter, usePathname } from 'next/navigation';
import { Toast } from '@/components/Toast';
import { useInboxNotifier } from '../../utils/hooks/useInboxNotifier';
import { useEffect, useState } from 'react';
import { supabase } from '@/../utils/supabase/pages-client';

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

  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    supabase
      .from('profiles')
      .select('revenue_subscription_status, revenue_current_period_end')
      .eq('id', session.user.id)
      .single()
      .then(({ data }: { data: {
        revenue_subscription_status: string | null;
        revenue_current_period_end: string | null;
      } | null }) => {
        if (data?.revenue_current_period_end) {
          const end = new Date(data.revenue_current_period_end);
          setTrialEndsAt(end);

          const now = Date.now();
          const diffDays = Math.max(
            0,
            Math.ceil((end.getTime() - now) / (1000 * 60 * 60 * 24))
          );
          setDaysRemaining(diffDays);
        } else {
          setDaysRemaining(null);
        }

        setSubscriptionStatus(data?.revenue_subscription_status || null);
      });
  }, [session?.user?.id]);

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
      </div>

      {subscriptionStatus === 'trialing' && daysRemaining !== null && (
        <div className="bg-yellow-500 text-black text-sm px-4 py-2 text-center">
          Free trial — {daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining.
          <span className="ml-2 opacity-80">
            Billing starts automatically after your trial ends.
          </span>
        </div>
      )}

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