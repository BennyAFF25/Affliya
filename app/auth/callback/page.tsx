'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function StripeReturnRedirectInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    // 1) Determine role from query param (accountType), normalize to business|affiliate
    const rawRole = (sp.get('accountType') || '').toLowerCase();
    const role = rawRole === 'affiliate' || rawRole === 'partner' ? 'affiliate' : 'business';
    const nextParam = sp.get('next');

    // 2) Always send to /auth-redirect with role and post param
    const post = nextParam || `/create-account?role=${role}`;
    const target = `/auth-redirect?role=${role}&post=${encodeURIComponent(post)}`;
    router.replace(target);
  }, [router, sp]);

  // Simple loading UI while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="max-w-md w-full text-center">
        <div
          className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-[#00C2CB] border-t-transparent animate-spin"
          aria-hidden
        />
        <h1 className="text-xl font-semibold">Redirecting you to account creation…</h1>
        <p className="mt-3 text-white/70 text-sm">If this takes more than a second, you can close this tab.</p>
      </div>
    </div>
  );
}

export default function StripeReturnRedirect() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StripeReturnRedirectInner />
    </Suspense>
  );
}