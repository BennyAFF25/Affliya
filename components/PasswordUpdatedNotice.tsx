'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { PASSWORD_UPDATED_FLAG, showPasswordUpdatedNoticeOn } from '../utils/auth/passwordResetDestination';

/** Global: shows once wherever a password reset finally lands (dashboards, choose-plan, onboarding, login). */
export default function PasswordUpdatedNotice() {
  const pathname = usePathname();
  useEffect(() => {
    if (!showPasswordUpdatedNoticeOn(pathname)) return;
    let flagged = false;
    try { flagged = window.sessionStorage.getItem(PASSWORD_UPDATED_FLAG) === '1'; } catch { /* storage blocked */ }
    const url = new URL(window.location.href);
    const queryFlag = url.searchParams.get('passwordUpdated') === '1';
    if (!flagged && !queryFlag) return;
    try { window.sessionStorage.removeItem(PASSWORD_UPDATED_FLAG); } catch { /* storage blocked */ }
    toast.success('Password updated', { id: 'password-updated' });
    if (queryFlag || url.searchParams.has('reset')) {
      url.searchParams.delete('passwordUpdated');
      url.searchParams.delete('reset');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, [pathname]);
  return null;
}
