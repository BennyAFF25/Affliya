"use client";
import React, { useEffect, useState } from 'react';
export function CurrencyEstimate({ currency, amount }: { currency?: string | null; amount: number }) {
  const [estimate, setEstimate] = useState<number | null>(null);
  useEffect(() => {
    setEstimate(null);
    if (!currency || currency === 'AUD' || !Number.isFinite(amount) || amount <= 0) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/currency?currency=${encodeURIComponent(currency)}&amount=${amount}`, { signal: controller.signal })
        .then(response => response.json()).then(body => { if (!controller.signal.aborted) setEstimate(body.holdAudEstimate); }).catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [currency, amount]);
  return estimate == null ? null : <span className="block text-xs text-[var(--muted-foreground)]">≈ A${estimate.toFixed(2)}</span>;
}
