'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';

type Profile = { role?: string | null };

export default function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Profile>();

      if (error) {
        console.error('[PROFILE ERROR]', error);
        router.push('/login');
        return;
      }

      if (profile?.role === 'affiliate') {
        router.push('/affiliate/dashboard');
      } else if (profile?.role === 'business') {
        router.push('/business/dashboard');
      } else {
        router.push('/login');
      }
    };

    handleRedirect();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg">Redirecting...</p>
    </div>
  );
}