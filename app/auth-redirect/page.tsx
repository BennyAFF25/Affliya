'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
import Image from 'next/image';

type Profile = { role?: string | null };

export default function AuthRedirect() {
  const router = useRouter();
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const handleRedirect = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return startFade(() => router.replace('/login'));
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Profile>();

      if (error) {
        console.error('[PROFILE ERROR]', error);
        return startFade(() => router.replace('/login'));
      }

      if (profile?.role === 'affiliate') {
        startFade(() => router.replace('/affiliate/dashboard'));
      } else if (profile?.role === 'business') {
        startFade(() => router.replace('/business/dashboard'));
      } else {
        startFade(() => router.replace('/login'));
      }
    };

    handleRedirect();
  }, [router]);

  const startFade = (callback: () => void) => {
    setFade(true);
    setTimeout(callback, 450);
  };

  return (
    <div
      className={`
        min-h-screen flex items-center justify-center
        bg-gradient-to-b from-black via-[#02060a] to-black
        transition-opacity duration-500
        ${fade ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <div className="relative flex flex-col items-center gap-4">

        {/* Glow behind logo */}
        <div className="absolute h-40 w-40 rounded-full bg-[#00C2CB]/20 blur-3xl opacity-70 animate-pulse" />

        {/* Nettmark Logo */}
        <div className="relative h-24 w-24 flex items-center justify-center">
          <Image
            src="/Nettmark-icon.png"
            alt="Nettmark Logo"
            width={96}
            height={96}
            className="drop-shadow-[0_0_20px_rgba(0,194,203,0.6)]"
            priority
          />
        </div>

        <p className="text-sm text-white/70">
          Setting up your Nettmark dashboard…
        </p>
      </div>
    </div>
  );
}