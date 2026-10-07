'use client';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { ThemeProvider } from '@/../context/ThemeContext';
import { supabase } from '@/../utils/supabase/pages-client';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionContextProvider supabaseClient={supabase}>
        {children}
      </SessionContextProvider>
    </ThemeProvider>
  );
}