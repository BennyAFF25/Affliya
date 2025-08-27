'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
import BusinessSidebar from './BusinessSidebar';
import Topbar from '@/components/Topbar';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
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
