'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/../utils/supabase/pages-client';

type NotificationRow = {
  id: string;
  created_at: string;
  user_email: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
};

export function useInboxNotifier(userEmail?: string) {
  const [toast, setToast] = useState<null | {title: string; body?: string; link?: string}>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // initial load
  useEffect(() => {
    if (!userEmail) return;
    (async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body, link_url, read_at, created_at')
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) return;

      const unread = (data || []).filter(n => !n.read_at);
      setUnreadCount(unread.length);

      // if any unread, show the most recent as a toast
      if (unread[0]) {
        setToast({ title: unread[0].title, body: unread[0].body || undefined, link: unread[0].link_url || undefined });
      }
    })();
  }, [userEmail]);

  // realtime: pop toast on new notification inserts
  useEffect(() => {
    if (!userEmail) return;
    // cleanup previous channel
    subRef.current?.unsubscribe();

    const channel = supabase
      .channel(`notif_${userEmail}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_email=eq.${userEmail}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setUnreadCount(c => c + 1);
          setToast({ title: row.title, body: row.body || undefined, link: row.link_url || undefined });
        }
      )
      .subscribe();
    subRef.current = channel;

    return () => { channel.unsubscribe(); };
  }, [userEmail]);

  return {
    toast,
    setToast,          // to dismiss
    unreadCount,
  };
}