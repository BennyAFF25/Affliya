import { useEffect, useState } from 'react';
import { supabase } from '@/../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';

export function useUserSettings() {
  const session = useSession();
  const email = session?.user?.email;
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!email) return;
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[❌ Settings Fetch Error]', error.message);
      }

      setSettings(data);
      setIsLoading(false);
    };

    fetchSettings();
  }, [email]);

  return { settings, isLoading };
}