// app/redirect/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

export default function RedirectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleRedirect() {
      try {
        // First check Supabase session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.replace('/login');
          return;
        }

        // Look up profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('active_role, onboarding_completed')
          .eq('id', session.user.id)
          .single();

        if (error || !profile) {
          console.warn('[redirect] no profile found, sending home');
          router.replace('/');
          return;
        }

        const { active_role, onboarding_completed } = profile;

        if (!onboarding_completed) {
          if (active_role === 'affiliate') {
            router.replace('/onboarding/for-partners');
          } else {
            router.replace('/onboarding/for-business');
          }
          return;
        }

        // Otherwise send to dashboard
        if (active_role === 'affiliate') {
          router.replace('/affiliate/dashboard');
        } else if (active_role === 'business') {
          router.replace('/business/dashboard');
        } else {
          // Fallback to home
          router.replace('/');
        }
      } catch (e) {
        console.error('[redirect] error', e);
        router.replace('/');
      } finally {
        setLoading(false);
      }
    }

    handleRedirect();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Redirecting...
      </div>
    );
  }

  return null;
}