"use client";

import { affiliateLoginDestination } from "../../utils/affiliate/loginDestination";
import { businessLoginDestination } from "../../utils/businessLoginDestination";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/../utils/supabase/pages-client";
import Image from "next/image";
import { getAccountRole } from "../../utils/affiliate/accountRole";
import { safeInternalReturnTo, roleReturnTo } from "@/../utils/affiliate/onboarding";

export default function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const returnTo = safeInternalReturnTo(
      new URLSearchParams(window.location.search).get("returnTo") || new URLSearchParams(window.location.search).get("post"),
    );

    const handleRedirect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        const loginPath = roleReturnTo(returnTo, "affiliate")
          ? `/login/affiliate?next=${encodeURIComponent(returnTo!)}`
          : returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
        return router.replace(loginPath);
      }

      const role = await getAccountRole(user.id);

      if (role === "affiliate") {
        const destination = await affiliateLoginDestination(roleReturnTo(returnTo, role), user.email);
        router.replace(destination);
      } else if (role === "business") {
        const destination = await businessLoginDestination(roleReturnTo(returnTo, role));
        router.replace(destination);
      } else {
        const loginPath = roleReturnTo(returnTo, "affiliate")
          ? `/login/affiliate?next=${encodeURIComponent(returnTo!)}`
          : returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
        router.replace(loginPath);
      }
    };

    void handleRedirect().catch(() => router.replace("/login?error=account-check"));
  }, [router]);

  return (
    <div
      className={`
        min-h-screen flex items-center justify-center
        bg-gradient-to-b from-black via-[#02060a] to-black
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
