"use client";
import { useEffect } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";

export default function ChatbaseIdentity() {
  const { session, isLoading } = useSessionContext();
  useEffect(() => {
    if (isLoading || !session?.user?.id) return;
    const controller = new AbortController();
    void fetch("/api/chatbase/identify", { method: "POST", signal: controller.signal })
      .then(async response => {
        if (!response.ok || controller.signal.aborted) return;
        const { token } = await response.json();
        const chatbase = (window as unknown as { chatbase?: (command: string, data: unknown) => void }).chatbase;
        if (token && !controller.signal.aborted) chatbase?.("identify", { token });
      }).catch(() => {});
    return () => controller.abort();
  }, [isLoading, session?.user?.id]);
  return null;
}
