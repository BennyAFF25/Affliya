import React from "react";
import { PAID_CURRENCY_BLOCK_MESSAGE } from "../../../../../utils/currency/paidCurrencyMessage";

/** Uses offer-fetch state only; wallet, reach and participation loads never delay this. */
export function PaidCurrencyWarning({ currency, allowsPaid, mode }: { currency: string; allowsPaid: boolean; mode: "ad" | "organic" }) {
  const normalized = currency.trim().toUpperCase();
  if (mode !== "ad" || !allowsPaid || !normalized || normalized === "AUD") return null;
  return <p role="alert" className="mx-auto mb-4 max-w-6xl text-sm text-amber-300">{PAID_CURRENCY_BLOCK_MESSAGE}</p>;
}
