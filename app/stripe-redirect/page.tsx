'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function StripeRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const role = searchParams.get('role');

    if (role) {
      router.push(`/create-account?role=${role}`);
    } else {
      router.push('/create-account');
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg">Finishing setup…</p>
    </div>
  );
}

export default function StripeRedirect() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-white">Loading…</div>}>
      <StripeRedirectInner />
    </Suspense>
  );
}