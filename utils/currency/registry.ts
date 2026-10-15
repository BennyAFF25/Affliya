/** Preparatory seed mirror only. No runtime paths consume this registry yet. */
export const CURRENCY_CAPABILITIES = [
  "offer_display_enabled",
  "topup_enabled",
  "wallet_enabled",
  "meta_launch_enabled",
  "commission_enabled",
  "payout_enabled",
  "refund_enabled",
] as const;

export type CurrencyCapability = (typeof CURRENCY_CAPABILITIES)[number];
export type CurrencyRegistryEntry = Readonly<{
  code: string;
  name: string;
  minor_unit_exponent: 0 | 1 | 2 | 3 | 4;
  symbol: string | null;
  notes: string | null;
}> & Readonly<Record<CurrencyCapability, boolean>>;

export const CURRENCY_REGISTRY = {
  AUD: {
    code: "AUD", name: "Australian Dollar", minor_unit_exponent: 2, symbol: "A$",
    offer_display_enabled: true,
    topup_enabled: true,
    wallet_enabled: true,
    meta_launch_enabled: true,
    commission_enabled: true,
    payout_enabled: true,
    refund_enabled: true,
    notes: "AUD-only containment; all capabilities enabled.",
  },
  USD: {
    code: "USD", name: "US Dollar", minor_unit_exponent: 2, symbol: "US$",
    offer_display_enabled: true,
    topup_enabled: false,
    wallet_enabled: false,
    meta_launch_enabled: false,
    commission_enabled: false,
    payout_enabled: false,
    refund_enabled: false,
    notes: "Display only; money capabilities fail closed.",
  },
  GBP: {
    code: "GBP", name: "Pound Sterling", minor_unit_exponent: 2, symbol: "£",
    offer_display_enabled: true,
    topup_enabled: false,
    wallet_enabled: false,
    meta_launch_enabled: false,
    commission_enabled: false,
    payout_enabled: false,
    refund_enabled: false,
    notes: "Display only; money capabilities fail closed.",
  },
  CAD: {
    code: "CAD", name: "Canadian Dollar", minor_unit_exponent: 2, symbol: "CA$",
    offer_display_enabled: true,
    topup_enabled: false,
    wallet_enabled: false,
    meta_launch_enabled: false,
    commission_enabled: false,
    payout_enabled: false,
    refund_enabled: false,
    notes: "Display only; money capabilities fail closed.",
  },
  EUR: {
    code: "EUR", name: "Euro", minor_unit_exponent: 2, symbol: "€",
    offer_display_enabled: true,
    topup_enabled: false,
    wallet_enabled: false,
    meta_launch_enabled: false,
    commission_enabled: false,
    payout_enabled: false,
    refund_enabled: false,
    notes: "Display only; money capabilities fail closed.",
  },
  NZD: {
    code: "NZD", name: "New Zealand Dollar", minor_unit_exponent: 2, symbol: "NZ$",
    offer_display_enabled: true,
    topup_enabled: false,
    wallet_enabled: false,
    meta_launch_enabled: false,
    commission_enabled: false,
    payout_enabled: false,
    refund_enabled: false,
    notes: "Display only; money capabilities fail closed.",
  },
  TRY: {
    code: "TRY", name: "Turkish Lira", minor_unit_exponent: 2, symbol: "₺",
    offer_display_enabled: true,
    topup_enabled: false,
    wallet_enabled: false,
    meta_launch_enabled: false,
    commission_enabled: false,
    payout_enabled: false,
    refund_enabled: false,
    notes: "Display only; money capabilities fail closed.",
  },
  JPY: {
    code: "JPY", name: "Japanese Yen", minor_unit_exponent: 0, symbol: "¥",
    offer_display_enabled: true,
    topup_enabled: false,
    wallet_enabled: false,
    meta_launch_enabled: false,
    commission_enabled: false,
    payout_enabled: false,
    refund_enabled: false,
    notes: "Display only; money capabilities fail closed.",
  },
} as const satisfies Readonly<Record<string, CurrencyRegistryEntry>>;

export type CurrencyCode = keyof typeof CURRENCY_REGISTRY;

/** Exact codes only: no normalization or fallback to AUD. */
export function isCurrencyEnabled(code: string, capability: CurrencyCapability): boolean {
  if (!Object.prototype.hasOwnProperty.call(CURRENCY_REGISTRY, code)) return false;
  return CURRENCY_REGISTRY[code as CurrencyCode][capability] === true;
}
