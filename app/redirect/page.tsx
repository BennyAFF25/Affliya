// app/redirect/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('loginRole'); // 'affiliate' or 'business'

    if (role === 'affiliate') {
      router.push('/affiliate/dashboard');
    } else if (role === 'business') {
      router.push('/business/dashboard');
    } else {
      router.push('/'); // fallback
    }
  }, [router]);

  return null;
}