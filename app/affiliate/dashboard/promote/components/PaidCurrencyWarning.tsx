import React from "react";
import { PAID_CURRENCY_BLOCK_MESSAGE } from "../../../../../utils/currency/paidCurrencyMessage";

/** Paid mode is explicit; missing brand Meta setup is not an offer permission. */
export function PaidCurrencyWarning({ currency, mode }: { currency: string; mode: "ad" | "organic" }) {
  const normalized = currency.trim().toUpperCase();
  if (mode !== "ad" || !normalized || normalized === "AUD") return null;
  return <p role="alert" className="mx-auto mb-4 max-w-6xl text-sm text-amber-300">{PAID_CURRENCY_BLOCK_MESSAGE} You can submit a proposal, but it cannot launch until multi-currency support is available.</p>;
}
