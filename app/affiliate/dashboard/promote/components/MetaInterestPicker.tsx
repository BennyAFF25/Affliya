"use client";

import { useEffect, useState } from "react";
import type { MetaInterest } from "../../../../../utils/meta/campaignConfiguration";

type Props = {
  offerId: string;
  value: MetaInterest[];
  onChange: (next: MetaInterest[]) => void;
};

export function MetaInterestPicker({ offerId, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MetaInterest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2 || !offerId) {
      setResults([]);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/meta/interests?offerId=${encodeURIComponent(offerId)}&q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(json?.interests)) {
          throw new Error(json?.error || "Could not load Meta interests.");
        }
        setResults(json.interests);
      } catch (e) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(e instanceof Error ? e.message : "Could not search interests.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, offerId]);

  return (
    <div className="space-y-2">
      <label className="block text-base font-semibold text-[#00C2CB]" htmlFor="meta-interest-search">
        Interests <span className="text-xs font-normal text-gray-400">(optional)</span>
      </label>
      <p className="text-xs text-gray-400">Choose official Meta interests. Leave blank for broad targeting.</p>
      <div className="flex flex-wrap gap-2">
        {value.map((item) => (
          <button key={item.id} type="button"
            className="rounded-full border border-[#00C2CB]/50 bg-[#00C2CB]/10 px-3 py-1.5 text-sm text-white"
            onClick={() => onChange(value.filter((i) => i.id !== item.id))}
            title={`Remove ${item.name}`}>
            {item.name} ×
          </button>
        ))}
      </div>
      <input id="meta-interest-search" type="search" autoComplete="off" value={query}
        placeholder="Search Meta interests, e.g. entrepreneurship"
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded-xl border border-[#303536] bg-[#121718] p-3 text-sm text-white placeholder:text-gray-500" />
      {busy && <p role="status" className="text-xs text-gray-400">Searching Meta interests…</p>}
      {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
      {query.trim().length >= 2 && results.length > 0 && !error && (
        <div className="max-h-44 overflow-y-auto rounded-xl border border-[#303536] bg-[#121718] p-1">
          {results.filter((item) => !value.some((selected) => selected.id === item.id)).map((item) => (
            <button key={item.id} type="button"
              onClick={() => { onChange([...value, item]); setQuery(""); setResults([]); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-[#00C2CB]/10">
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
