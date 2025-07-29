'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@supabase/auth-helpers-react';
import BusinessSidebar from './BusinessSidebar';
import Topbar from '@/components/Topbar';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    const currentPath = window.location.pathname;
    const isBusinessRoute = currentPath.startsWith('/business');
    const isPublic = ['/', '/redirect'].includes(currentPath);

    if (session === undefined) return;

    if (!session && isBusinessRoute && !isPublic) {
      router.push('/redirect');
    }
  }, [session, router]);

  if (session === undefined) {
    return <div className="w-full flex justify-center items-center py-12 text-black">Redirecting...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <Topbar />
      <div className="flex flex-1">
        <div className="min-h-screen w-64 bg-[#1F1F1F] text-white">
          <BusinessSidebar />
        </div>
        <main className="flex-1 bg-white text-black">{children}</main>
      </div>
    </div>
  );
}
