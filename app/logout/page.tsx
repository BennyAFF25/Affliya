"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase/pages-client";

export default function LogoutPage() {
  const [error, setError] = useState(false);
  useEffect(() => {
    void supabase.auth.signOut().then(({ error }) => {
      if (error) setError(true);
      else window.location.replace("/login");
    }).catch(() => setError(true));
  }, []);
  return <main className="min-h-screen p-8" role={error ? "alert" : "status"}>
    {error ? "Could not sign out. Please retry." : "Signing out…"}
    {error && <button onClick={() => window.location.reload()} className="ml-4 underline">Retry</button>}
  </main>;
}
