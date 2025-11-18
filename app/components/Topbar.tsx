'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import { LogOut } from 'lucide-react';
import { useTheme } from '@/../context/ThemeContext';
import { useRouter } from 'next/navigation';

export default function Topbar() {
  const user = useUser();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const router = useRouter();

  const userInitials = user?.email?.charAt(0).toUpperCase() || 'F';

  useEffect(() => {
    const loadAvatar = async () => {
      if (!user?.email) {
        setAvatarUrl(null);
        return;
      }

      try {
        // Try affiliate profile first
        const { data: affiliateProfile, error: affError } = await (supabase as any)
          .from('affiliate_profiles')
          .select('avatar_url')
          .eq('email', user.email as string)
          .maybeSingle();

        if (affError && affError.code && affError.code !== 'PGRST116') {
          console.warn('[Topbar] affiliate_profiles avatar error', affError);
        }

        if (affiliateProfile?.avatar_url) {
          setAvatarUrl(affiliateProfile.avatar_url as string);
          return;
        }

        // Fallback to business profile
        const { data: businessProfile, error: bizError } = await (supabase as any)
          .from('business_profiles')
          .select('avatar_url')
          .eq('business_email', user.email as string)
          .maybeSingle();

        if (bizError && bizError.code && bizError.code !== 'PGRST116') {
          console.warn('[Topbar] business_profiles avatar error', bizError);
        }

        if (businessProfile?.avatar_url) {
          setAvatarUrl(businessProfile.avatar_url as string);
        }
      } catch (err) {
        console.error('[Topbar] Failed to load avatar', err);
      }
    };

    void loadAvatar();
  }, [user?.email]);

  return (
    <header className="w-full bg-[#1F1F1F] px-6 pt-3 pb-1 border-0 flex justify-between items-center" style={{ height: '64px' }}>
      <Link href="/" className="flex items-center">
        <Image
          src="/nettmark-logo.png"
          alt="Nettmark Logo"
          width={140}
          height={35}
          priority
          className="object-contain ml-4 translate-y-[-3px]"
        />
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm text-[#00C2CB] font-medium hover:underline translate-y-[-3px]">
          Home
        </Link>


        {user && (
          <>
            {avatarUrl ? (
              <div className="w-9 h-9 rounded-full border border-white/15 overflow-hidden bg-black/40 translate-y-[-3px]">
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="h-9 w-9 object-cover"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#1F1F1F]/20 flex items-center justify-center text-[#00C2CB] font-semibold text-sm shadow-inner translate-y-[-3px]">
                {userInitials}
              </div>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
              className="flex items-center gap-2 bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-lg text-sm transition translate-y-[-3px]"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
