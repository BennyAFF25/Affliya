export const OFFER_CURRENCIES = ["AUD", "USD", "GBP", "CAD"] as const;

export type OfferCurrency = (typeof OFFER_CURRENCIES)[number];
export const OFFER_CURRENCY_MESSAGE = "Offers can be priced in AUD, USD, GBP or CAD only.";

export function isOfferCurrency(value: unknown): value is OfferCurrency {
  return typeof value === "string" && (OFFER_CURRENCIES as readonly string[]).includes(value);
}

export function isOfferCurrencyCheckViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; constraint?: string; message?: string; details?: string };
  return candidate.code === "23514" && (
    candidate.constraint === "offers_currency_supported" ||
    /\boffers_currency_supported\b/.test(`${candidate.message || ""} ${candidate.details || ""}`)
  );
}
