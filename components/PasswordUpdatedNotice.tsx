'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

/** Shared by the reset destinations, without adding Suspense to each page. */
export default function PasswordUpdatedNotice() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!['/login', '/login/affiliate', '/login/business', '/affiliate/dashboard', '/business/my-business'].includes(pathname || '')) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('passwordUpdated') !== '1' && url.searchParams.get('reset') !== '1') return;
    toast.success('Password updated', { id: 'password-updated' });
    url.searchParams.delete('passwordUpdated');
    url.searchParams.delete('reset');
    router.replace(url.pathname + url.search + url.hash, { scroll: false });
  }, [pathname, router]);
  return null;
}
