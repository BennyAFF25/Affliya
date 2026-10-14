"use client";
import { useEffect } from "react";
import { supabase } from "../utils/supabase/pages-client";
import { useSessionContext } from "@supabase/auth-helpers-react";

export default function ChatbaseIdentity() {
  const { session, isLoading } = useSessionContext();
  useEffect(() => {
    if (isLoading || !session?.user?.id) return;
    const controller = new AbortController();
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (controller.signal.aborted || !data.session?.user.id || data.session.user.id !== session.user.id ||
          !data.session.access_token || (data.session.expires_at || 0) * 1000 <= Date.now()) return null;
      return fetch("/api/chatbase/identify", { method: "POST", signal: controller.signal });
    })()
      .then(async response => {
        if (!response?.ok || controller.signal.aborted) return;
        const { token } = await response.json();
        const chatbase = (window as unknown as { chatbase?: (command: string, data: unknown) => void }).chatbase;
        if (token && !controller.signal.aborted) chatbase?.("identify", { token });
      }).catch(() => {});
    return () => controller.abort();
  }, [isLoading, session?.user?.id]);
  return null;
}
