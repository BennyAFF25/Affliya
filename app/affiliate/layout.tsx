'use client';

import AffiliateSidebar from './AffiliateSidebar';
import Topbar from '@/components/Topbar';

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return <AffiliateLayoutShell>{children}</AffiliateLayoutShell>;
}

function AffiliateLayoutShell({ children }: { children: React.ReactNode }) {
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