"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/../utils/supabase/pages-client";
import AcceptTermsModal from "../AcceptTermsModal";
import { termsAcceptanceCurrent, termsV2Enabled } from "../../../utils/legal/version";

const profileClient = supabase as unknown as SupabaseClient;

/**
 * Workspace-wide re-acceptance check for Terms v2. Mounted in the business and
 * affiliate layouts so an existing user sees the updated-terms modal on any
 * workspace page (dashboard included), not only on My Business or the
 * marketplace. Renders nothing while NEXT_PUBLIC_TERMS_V2_ENABLED is off, so
 * legacy behaviour is unchanged. Pages that already mount their own modal pass
 * `skip` to avoid showing two dialogs.
 */
export default function TermsVersionGate({ userId, skip = false }: { userId?: string | null; skip?: boolean }) {
  const enabled = termsV2Enabled();
  const [show, setShow] = useState(false);
  const [previouslyAccepted, setPreviouslyAccepted] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!enabled || !userId || skip || accepted) { setShow(false); return; }
    let active = true;
    (async () => {
      const { data, error } = await profileClient.from("profiles")
        .select("terms_accepted, terms_version").eq("id", userId).maybeSingle();
      if (!active || error || !data) return;
      const profile = data as { terms_accepted?: boolean | null; terms_version?: string | null };
      if (!termsAcceptanceCurrent(profile, true)) {
        setPreviouslyAccepted(profile.terms_accepted === true);
        setShow(true);
      }
    })();
    return () => { active = false; };
  }, [enabled, userId, skip, accepted]);

  if (!enabled || !userId || skip || !show) return null;
  return <AcceptTermsModal userId={userId} updatedTerms={previouslyAccepted} onAccepted={() => { setAccepted(true); setShow(false); }} />;
}
