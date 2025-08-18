'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '@/../utils/supabase/pages-client';
import { LogOut } from 'lucide-react';
import { useTheme } from '@/../context/ThemeContext';
import { useRouter } from 'next/navigation';

export default function Topbar() {
  const user = useUser();
  const userInitials = user?.email?.charAt(0).toUpperCase() || 'F';
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  return (
    <header className="w-full bg-[#1F1F1F] px-6 py-2 border-b border-gray-800 flex justify-between items-center" style={{ height: '56px' }}>
      <Link href="/" className="flex items-center">
        <Image
          src="/nettmark-logo.png"
          alt="Nettmark Logo"
          width={140}
          height={35}
          priority
          className="object-contain ml-4"
        />
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm text-[#00C2CB] font-medium hover:underline">
          Home
        </Link>

        <button
          onClick={toggleTheme}
          className="px-4 py-2 rounded bg-[#00C2CB] text-white hover:bg-[#00b0b8] text-sm"
        >
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>

        {user && (
          <>
            <div className="w-9 h-9 rounded-full bg-[#1F1F1F]/20 flex items-center justify-center text-[#00C2CB] font-semibold text-sm shadow-inner">
              {userInitials}
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
              className="flex items-center gap-2 bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-lg text-sm transition"
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