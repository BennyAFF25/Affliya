"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/../utils/supabase/pages-client";
import Image from "next/image";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeInternalReturnTo, roleReturnTo } from "@/../utils/affiliate/onboarding";

type Profile = { role?: string | null };
// The checked-in Database type only contains an example users table.
const profileClient = supabase as unknown as SupabaseClient;

export default function AuthRedirect() {
  const router = useRouter();
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const returnTo = safeInternalReturnTo(
      new URLSearchParams(window.location.search).get("returnTo") || new URLSearchParams(window.location.search).get("post"),
    );

    const handleRedirect = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const loginPath = roleReturnTo(returnTo, "affiliate")
          ? `/login/affiliate?next=${encodeURIComponent(returnTo!)}`
          : returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
        return startFade(() => router.replace(loginPath));
      }

      let { data: profile, error } = await profileClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<Profile>();

      // Email-confirmed affiliates can arrive before a client profile insert.
      // Existing persisted roles remain authoritative; never overwrite them from metadata.
      if (!error && !profile && user.user_metadata?.role === "affiliate" && user.email) {
        const recovered = await profileClient.from("profiles")
          .insert({ id: user.id, email: user.email, role: "affiliate" })
          .select("role").single<Profile>();
        if (recovered.error?.code === "23505") {
          const existing = await profileClient.from("profiles").select("role").eq("id", user.id).maybeSingle<Profile>();
          profile = existing.data; error = existing.error;
        } else { profile = recovered.data; error = recovered.error; }
      }

      if (error) {
        console.error("[PROFILE ERROR]", error);
        const loginPath = roleReturnTo(returnTo, "affiliate")
          ? `/login/affiliate?next=${encodeURIComponent(returnTo!)}`
          : returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
        return startFade(() => router.replace(loginPath));
      }

      if (profile?.role === "affiliate") {
        const destination = roleReturnTo(returnTo, profile.role) || "/affiliate/dashboard";
        startFade(() => router.replace(destination));
      } else if (profile?.role === "business") {
        const destination = roleReturnTo(returnTo, profile.role) || "/business/dashboard";
        startFade(() => router.replace(destination));
      } else {
        const loginPath = roleReturnTo(returnTo, "affiliate")
          ? `/login/affiliate?next=${encodeURIComponent(returnTo!)}`
          : returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
        startFade(() => router.replace(loginPath));
      }
    };

    handleRedirect();
  }, [router]);

  const startFade = (callback: () => void) => {
    setFade(true);
    setTimeout(callback, 1000);
  };

  return (
    <div
      className={`
        min-h-screen flex items-center justify-center
        bg-gradient-to-b from-black via-[#02060a] to-black
        transition-opacity duration-500
        ${fade ? "opacity-0" : "opacity-100"}
      `}
    >
      <div className="relative flex flex-col items-center gap-4">
        {/* Glow behind logo */}
        <div className="absolute h-40 w-40 rounded-full bg-[#00C2CB]/20 blur-3xl opacity-70 animate-pulse" />

        {/* Nettmark Logo */}
        <div className="relative h-24 w-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#00C2CB]/20" />
          <div className="absolute inset-2 rounded-full border-[3px] border-transparent border-t-[#00C2CB] border-l-[#7ff5fb]/60 animate-[spin_4s_linear_infinite]" />
          <div className="absolute inset-4 rounded-full border border-[#00C2CB]/15 bg-[#00C2CB]/5 blur-sm" />
          <Image
            src="/Nettmark-icon.png"
            alt="Nettmark Logo"
            width={96}
            height={96}
            className="relative z-10 drop-shadow-[0_0_28px_rgba(0,194,203,0.7)]"
            priority
          />
        </div>
      </div>
    </div>
  );
}
