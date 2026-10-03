"use client";

import { useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/../utils/supabase/pages-client";
import LegalPolicyContent, { POLICY_TITLES, type LegalPolicy } from "./legal/LegalPolicyContent";

interface AcceptTermsModalProps {
  userId: string;
  onAccepted?: () => void;
}

// The repository's Database type only describes an example users table.
const profileClient = supabase as unknown as SupabaseClient;

export default function AcceptTermsModal({ userId, onAccepted }: AcceptTermsModalProps) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<LegalPolicy | null>(null);
  const saving = useRef(false);

  async function handleAccept() {
    if (!checked || saving.current) return;
    saving.current = true;
    setLoading(true);
    setError(null);
    try {
      const { error: saveError } = await profileClient.from("profiles")
        .update({ terms_accepted: true, terms_accepted_at: new Date().toISOString() })
        .eq("id", userId);
      if (saveError) throw new Error("Acceptance failed");
      onAccepted?.();
    } catch {
      setError("Failed to save acceptance. Please try again.");
    } finally {
      saving.current = false;
      setLoading(false);
    }
  }

  return (
    <Dialog open={true} onClose={() => setPolicy(null)} className="relative z-50">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#151718] text-gray-200 shadow-2xl">
          <div className="shrink-0 border-b border-white/10 p-6">
            {policy && <button type="button" onClick={() => setPolicy(null)} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white hover:border-[#00C2CB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to terms
            </button>}
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">
              {policy ? POLICY_TITLES[policy] : "Accept terms to continue"}
            </DialogTitle>
          </div>

          {policy ? (
            <div className="min-h-0 overflow-y-auto overscroll-contain p-6">
              <LegalPolicyContent policy={policy} showTitle={false} />
            </div>
          ) : (
            <>
              <div className="min-h-0 overflow-y-auto p-6">
                <p className="text-sm leading-6 text-gray-300">Agree to Nettmark’s Terms of Service and Privacy Policy to continue. You can read each policy here without leaving your setup.</p>
                <div className="mt-4 space-y-2">
                  {(["terms", "privacy", "cookies"] as const).map(value => (
                    <button key={value} type="button" onClick={() => setPolicy(value)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-left text-sm text-[#00C2CB] hover:border-[#00C2CB]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB]">
                      {POLICY_TITLES[value]}<ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="shrink-0 border-t border-white/10 p-6">
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-gray-200">
                  <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} disabled={loading} className="mt-1 h-4 w-4 shrink-0 accent-[#00C2CB]" />
                  <span>I have read and agree to the Terms of Service and Privacy Policy</span>
                </label>
                {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
                <button type="button" onClick={handleAccept} disabled={!checked || loading} className="mt-4 min-h-11 w-full rounded-full bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#19d1d8] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB]">
                  {loading ? "Saving…" : "Accept & Continue"}
                </button>
              </div>
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
