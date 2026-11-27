"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { X } from "lucide-react";
import LegalPolicyContent, { POLICY_TITLES, type LegalPolicy } from "./LegalPolicyContent";

/** Read a policy without leaving the current form (keeps typed details and checkbox state). */
export default function PolicyReaderDialog({ policy, onClose }: { policy: LegalPolicy | null; onClose: () => void }) {
  return (
    <Dialog open={policy !== null} onClose={onClose} className="relative z-[120]">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#151718] text-gray-200 shadow-2xl">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-5">
            <DialogTitle className="text-lg font-semibold text-white">{policy ? POLICY_TITLES[policy] : ""}</DialogTitle>
            <button type="button" onClick={onClose} aria-label="Close" className="grid min-h-11 min-w-11 place-items-center rounded-full text-white/70 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB]">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-6">
            {policy && <LegalPolicyContent policy={policy} showTitle={false} />}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
