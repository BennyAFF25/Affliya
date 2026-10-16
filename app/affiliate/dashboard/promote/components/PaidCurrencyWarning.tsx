import React, { useEffect, useState } from "react";

/** Paid mode is explicit; missing brand Meta setup is not an offer permission. */
export function PaidCurrencyWarning({ currency, mode }: { currency: string; mode: "ad" | "organic" }) {
  const [enabled, setEnabled] = useState<string[]>(['AUD']);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/currency', { signal: controller.signal }).then(response => response.json())
      .then(body => { if (Array.isArray(body.paidLaunchCurrencies)) setEnabled(body.paidLaunchCurrencies); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const normalized = currency.trim().toUpperCase();
  if (mode !== "ad" || !normalized || enabled.includes(normalized)) return null;
  return <p role="alert" className="mx-auto mb-4 max-w-6xl text-sm text-amber-300">Paid launch is currently unavailable for {normalized}. You can still submit a proposal.</p>;
}
