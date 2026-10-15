import { tryWriteMoneyFlowAudit } from "../moneyFlowAudit";
import type Stripe from 'stripe';

export const MIN_WALLET_TOPUP_AUD = 10;
export const WALLET_TOPUP_MINIMUM_MESSAGE = 'Minimum wallet top-up is A$10.00.';

function metadataCents(value: string | undefined): number | null {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Metadata is our original AUD quote; never derive principal from presentment or settlement. */
export function validateAudTopup(
  session: Pick<Stripe.Checkout.Session, 'currency' | 'amount_total' | 'metadata' | 'payment_status'>,
  balanceTx?: Pick<Stripe.BalanceTransaction, 'currency' | 'amount'>,
): string | null {
  const principal = metadataCents(session.metadata?.topup_amount);
  const gross = metadataCents(session.metadata?.gross_charge_amount);
  if (session.payment_status !== 'paid') return 'TOPUP_NOT_PAID';
  if (session.currency !== 'aud') return 'TOPUP_SESSION_NOT_AUD';
  if (session.metadata?.currency !== 'aud' || principal === null || principal <= 0 || gross === null || gross < principal) return 'TOPUP_INVALID_AUD_METADATA';
  if (session.amount_total !== gross) return 'TOPUP_GROSS_MISMATCH';
  if (balanceTx && balanceTx.currency !== 'aud') return 'TOPUP_SETTLEMENT_NOT_AUD';
  if (balanceTx && balanceTx.amount !== gross) return 'TOPUP_SETTLEMENT_GROSS_MISMATCH';
  return null;
}

export async function flagTopupReview(
  supabase: Parameters<typeof tryWriteMoneyFlowAudit>[0],
  sessionId: string, reason: string, sourceRoute: string,
) {
  console.error('[wallet-topup manual review required; no credit]', { sessionId, reason });
  await tryWriteMoneyFlowAudit(supabase, {
    eventType: 'wallet_topup_manual_review', severity: 'error', sourceRoute,
    entityType: 'stripe_checkout_session', entityId: sessionId, reasonCode: reason,
    message: 'Top-up held for manual review; wallet not credited.',
  });
}
