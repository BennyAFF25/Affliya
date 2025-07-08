'use client';

import AffiliateSidebar from './AffiliateSidebar';
import Topbar from '@/components/Topbar';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <Topbar />
      <div className="flex flex-1">
        <div className="min-h-screen w-64 bg-[#1F1F1F] text-white">
          <AffiliateSidebar />
        </div>
        <main className="flex-1 p-10">
          <SessionContextProvider supabaseClient={supabaseClient}>{children}</SessionContextProvider>
        </main>
      </div>
    </div>
  );
}