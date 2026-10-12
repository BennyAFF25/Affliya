"use client";

import { useCallback, useEffect, useState } from "react";

// Inbox navigational indicators track chat unread status only. Approvals,
// notifications and campaign requests have their own separate surfaces.
export function useChatUnreadCount(userId?: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const refresh = useCallback(async () => {
    if (!userId) { setUnreadCount(0); return; }
    try {
      const response = await fetch("/api/inbox/chat?unread=1", {
        cache: "no-store", credentials: "same-origin",
      });
      if (!response.ok) return;
      const result = await response.json();
      if (result?.success && typeof result.unreadCount === "number") {
        setUnreadCount(result.unreadCount);
      }
    } catch {
      // An outage must not fabricate unread state.
    }
  }, [userId]);

  useEffect(() => {
    setUnreadCount(0);
    if (!userId) return;
    void refresh();
    const onRead = () => { void refresh(); };
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("nettmark-inbox-read", onRead);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(onVisible, 30000);
    return () => {
      window.removeEventListener("nettmark-inbox-read", onRead);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [userId, refresh]);

  return unreadCount;
}
