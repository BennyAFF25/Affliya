"use client";
import React, { useEffect, useState } from "react";
import { signOutSession } from "../../../utils/supabase/signOut";
import { supabase } from "../../../utils/supabase/pages-client";

/** Same sign-out as /logout, but returns Growth Partners to their own sign-in page. */
export default function GrowthPartnerLogoutPage() {
  const [error, setError] = useState(false);
  useEffect(() => {
    void signOutSession(supabase).then(({ error }) => {
      if (error) setError(true);
      else window.location.replace("/growth-partners/login");
    }).catch(() => setError(true));
  }, []);
  return <main role={error ? "alert" : "status"}>
    {error ? "Could not sign out. Please retry." : "Signing out…"}
    {error && <button onClick={() => window.location.reload()} className="ml-4 underline">Retry</button>}
  </main>;
}
