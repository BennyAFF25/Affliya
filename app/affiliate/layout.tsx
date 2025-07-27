'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AffiliateSidebar from './AffiliateSidebar';
import Topbar from '@/components/Topbar';
import { SessionContextProvider, useSession } from '@supabase/auth-helpers-react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      <AuthenticatedAffiliateLayout>{children}</AuthenticatedAffiliateLayout>
    </SessionContextProvider>
  );
}

function AuthenticatedAffiliateLayout({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === null) {
      router.push('/login');
    }
  }, [session, router]);

  if (session === undefined) {
    return <div className="w-full flex justify-center items-center py-12 text-white">Loading...</div>;
  }

  if (session === null) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen text-white">
      <Topbar />
      <div className="flex flex-1">
        <div className="min-h-screen w-64 bg-[#1F1F1F] text-white">
          <AffiliateSidebar />
        </div>
        <main className="flex-1 bg-white text-black">{children}</main>
      </div>
    </div>
  );
}