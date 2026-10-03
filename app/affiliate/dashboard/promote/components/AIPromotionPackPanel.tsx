"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { validatePromotionPack, type PromotionPack } from "@/../utils/affiliate/promotionPack";

type Props = {
  offerId: string;
  mode: "paid" | "organic";
  creativeId?: string | null;
  hasExistingCopy: boolean;
  onApply: (pack: PromotionPack) => void;
};

export function AIPromotionPackPanel({ offerId, mode, creativeId, hasExistingCopy, onApply }: Props) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pack, setPack] = useState<PromotionPack | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const generation = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/affiliate/offers/" + offerId + "/generate-promotion", { cache: "no-store", signal: controller.signal })
      .then(async response => { if (response.ok) { const data = await response.json(); if (!controller.signal.aborted) setAvailable(data.available === true); } })
      .catch(() => { /* Manual promotion remains available. */ });
    return () => { controller.abort(); generation.current?.abort(); };
  }, [offerId]);

  async function generate() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(""); setStatus(""); setConfirmReplace(false);
    const controller = new AbortController();
    generation.current = controller;
    try {
      const response = await fetch("/api/affiliate/offers/" + offerId + "/generate-promotion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...(creativeId ? { creativeId } : {}) }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate a draft.");
      const next = validatePromotionPack(data.pack);
      if (controller.signal.aborted) return;
      setPack(next); setSources(Array.isArray(data.sources) ? data.sources : []);
      setLimited(data.limitedContext === true); setExpanded(true);
      setStatus("Draft ready. Review it before using it.");
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not generate a draft. Your copy is unchanged.");
    } finally { if (!controller.signal.aborted) { setBusy(false); busyRef.current = false; } }
  }

  async function copyPack() {
    if (!pack) return;
    try {
      await navigator.clipboard.writeText([
        "Campaign angle: " + pack.campaignAngle, "Hooks:\n" + pack.hooks.map(hook => "- " + hook).join("\n"),
        "Primary ad copy: " + pack.primaryAdCopy, "Headline: " + pack.headline, "CTA: " + pack.cta,
        "Organic caption: " + pack.organicCaption, "Why it fits: " + pack.explanation,
      ].join("\n\n"));
      setStatus("Promotion pack copied.");
    } catch { setError("Copy failed. Select and copy the text below."); }
  }

  function apply() {
    if (!pack) return;
    if (hasExistingCopy && !confirmReplace) { setConfirmReplace(true); return; }
    onApply(pack); setConfirmReplace(false);
    setStatus("Draft added to your form. Check the facts and edit it before submitting for business review.");
  }

  if (!available) return null;
  return (
    <section className="mb-6 rounded-3xl border border-white/10 bg-[#151718] p-5 text-white lg:col-span-2 sm:p-6" aria-label="AI promotion draft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-[#00C2CB]" />Start with a draft</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">An angle, hooks and copy using this offer’s saved brand context. Review every claim before submitting.</p>
        </div>
        <button type="button" onClick={generate} disabled={busy} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#19d1d8] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Generating…" : pack ? "Generate again" : "Generate with AI"}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
      {status && <p role="status" className="mt-4 text-sm text-[#00C2CB]">{status}</p>}
      {pack && (
        <div className="mt-5">
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="text-sm text-white/70 underline underline-offset-4">{expanded ? "Hide" : "Review"} promotion pack</button>
          {expanded && <div className="mt-4 space-y-5 rounded-2xl border border-white/10 bg-black/15 p-5">
            <p className="text-xs text-white/45">Context: {sources.join(" · ")}{limited ? " · Limited detail: check the draft carefully." : ""}</p>
            <PackField label="Campaign angle" text={pack.campaignAngle} />
            <div><h3 className="text-xs font-medium uppercase tracking-wide text-[#00C2CB]">3 hooks</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/80">{pack.hooks.map((hook, index) => <li key={index}>{hook}</li>)}</ol></div>
            <PackField label="Primary ad copy" text={pack.primaryAdCopy} />
            <PackField label="Headline" text={pack.headline} />
            <PackField label="CTA" text={pack.cta.replaceAll("_", " ").toLowerCase()} />
            <PackField label="Organic caption" text={pack.organicCaption} />
            <PackField label="Why this angle fits" text={pack.explanation} />
          </div>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={apply} disabled={busy} className="min-h-11 rounded-full bg-[#00C2CB] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
              {confirmReplace ? "Replace current copy" : mode === "organic" ? "Use social caption" : "Use ad copy"}
            </button>
            <button type="button" onClick={copyPack} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white/70"><Copy className="h-4 w-4" />Copy pack</button>
            {confirmReplace && <button type="button" onClick={() => setConfirmReplace(false)} className="text-sm text-white/60">Keep current copy</button>}
          </div>
          {confirmReplace && <p className="mt-3 text-xs leading-5 text-white/55">{mode === "organic" ? "This replaces your caption and selects the social post form." : "This replaces your headline, primary ad text and CTA. Media and budget stay as chosen."}</p>}
          <p className="mt-3 text-xs leading-5 text-white/45">AI text is a draft and needs business review. Generation uses a limited daily allowance; failed attempts count too. Copy the pack if you want to keep it.</p>
        </div>
      )}
    </section>
  );
}

function PackField({ label, text }: { label: string; text: string }) {
  return <div><h3 className="text-xs font-medium uppercase tracking-wide text-[#00C2CB]">{label}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/80">{text}</p></div>;
}
