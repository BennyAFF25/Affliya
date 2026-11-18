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
  return <main className="mx-auto max-w-md"><div className="gp-card text-center" role={error ? "alert" : "status"}>
    {error ? "Could not sign out. Please retry." : <><span aria-hidden="true" className="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#00C2CB]" />Signing you out…</>}
    {error && <button onClick={() => window.location.reload()} className="ml-4 underline">Retry</button>}
  </div></main>;
}
