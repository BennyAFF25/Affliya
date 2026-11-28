"use client";

import { useState } from "react";
import { growthTermsCopy, type GrowthTermsInput } from "../../../utils/legal/trialTerms";
import PolicyReaderDialog from "./PolicyReaderDialog";

/**
 * Trial / paid-start summary plus the required, unticked consent checkbox
 * (Terms v2). Rendered directly above the start button; the parent keeps the
 * button disabled until `checked` is true.
 */
export default function GrowthTermsConsent({ terms, checked, onChange, disabled, tone = "dark" }: {
  terms: GrowthTermsInput; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; tone?: "dark" | "card";
}) {
  const [reading, setReading] = useState(false);
  const copy = growthTermsCopy(terms);
  const termsLink = (label: string) => (
    <button type="button" onClick={() => setReading(true)} className="font-semibold text-[#63e8ee] underline underline-offset-2 hover:text-white">{label}</button>
  );
  return (
    <div className={`mt-6 rounded-2xl border border-white/15 ${tone === "card" ? "bg-black/20" : "bg-[#0f1213]"} p-4 text-left`} data-testid="growth-terms-consent">
      <p className="text-sm font-semibold text-white">{copy.heading}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-200">
        {copy.bullets.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}
        <li className="pl-4">{termsLink("Full terms")}</li>
      </ul>
      <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-white/10 pt-4 text-sm leading-6 text-white">
        <input type="checkbox" required checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[#00C2CB]" data-testid="growth-terms-checkbox" />
        <span>{copy.checkbox.replace("the Terms of Service, including the refund policy.", "")}{termsLink("the Terms of Service")}, including the refund policy.</span>
      </label>
      <PolicyReaderDialog policy={reading ? "terms" : null} onClose={() => setReading(false)} />
    </div>
  );
}
