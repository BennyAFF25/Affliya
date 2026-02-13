'use client';

import { Suspense } from 'react';
import SetupTrackingContent from './SetupTrackingContent';

export default function SetupTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#0e0e0e] flex items-center justify-center text-gray-300">
          Loading…
        </div>
      }
    >
      <SetupTrackingContent />
    </Suspense>
  );
}