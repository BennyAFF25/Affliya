"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

export default function RedirectPage() {
  const router = useRouter();
  const supabase = createPagesBrowserClient();

  useEffect(() => {
    const handleRedirect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email;
      if (!email) {
        console.error("❌ No email found in session");
        return router.push("/login");
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("active_role, roles")
        .eq("email", email)
        .single();

      if (error) {
        console.error("❌ Failed to fetch profile:", error.message);
        return router.push("/login");
      }

      const localUserType = localStorage.getItem("userType");
      const currentRole = data.active_role;

      // Optional: auto-update `active_role` based on login intent
      if (localUserType && localUserType !== currentRole) {
        await supabase
          .from("profiles")
          .update({ active_role: localUserType })
          .eq("email", email);
        console.log(`[⚡ Updated Role] ${currentRole} ➡ ${localUserType}`);
      }

      const roleToUse = localUserType || currentRole;

      if (roleToUse === "affiliate") {
        router.push("/affiliate/dashboard");
      } else {
        router.push("/business/dashboard");
      }
    };

    handleRedirect();
  }, [router, supabase]);

  return <div className="p-10 text-xl">Redirecting...</div>;
}