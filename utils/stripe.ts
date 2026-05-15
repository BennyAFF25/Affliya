import Stripe from "stripe";

export const STRIPE_API_VERSION: Stripe.LatestApiVersion =
  "2025-08-27.basil";

type StripeMetadataValue = string | number | boolean | null | undefined;

export function createStripeClient(secret = process.env.STRIPE_SECRET_KEY) {
  if (!secret) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secret, {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function buildStripeMetadata(
  values: Record<string, StripeMetadataValue>,
) {
  const metadata: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;

    const normalized = String(value).trim();
    if (!normalized) continue;

    metadata[key] = normalized;
  }

  return metadata;
}

export function buildNettmarkStripeMetadata(
  action:
    | "wallet_topup"
    | "wallet_refund"
    | "wallet_payout"
    | "ad_spend_settlement",
  values: Record<string, StripeMetadataValue>,
) {
  return buildStripeMetadata({
    nettmark_platform: "nettmark",
    nettmark_action: action,
    ...values,
  });
}

export type StripePlatformBalanceSnapshot = {
  currency: string;
  available: number;
  pending: number;
  rawAvailable: Record<string, number>;
  rawPending: Record<string, number>;
};

export async function getPlatformBalanceSnapshot(
  client = createStripeClient(),
  currency = "aud",
): Promise<StripePlatformBalanceSnapshot> {
  const balance = await client.balance.retrieve();
  const normalizedCurrency = currency.toLowerCase();

  const rawAvailable = Object.fromEntries(
    (balance.available || []).map((entry) => [
      entry.currency.toLowerCase(),
      Number((entry.amount / 100).toFixed(2)),
    ]),
  );

  const rawPending = Object.fromEntries(
    (balance.pending || []).map((entry) => [
      entry.currency.toLowerCase(),
      Number((entry.amount / 100).toFixed(2)),
    ]),
  );

  return {
    currency: normalizedCurrency,
    available: rawAvailable[normalizedCurrency] || 0,
    pending: rawPending[normalizedCurrency] || 0,
    rawAvailable,
    rawPending,
  };
}
