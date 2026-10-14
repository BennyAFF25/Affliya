import { getWalletBalanceSnapshot } from './balance';
import { getRefundLockState } from './refundLock';

// Presentation/launch estimate only. Settlement owns the actual wallet ledger.
export function calculateSpendableBalance(ledgerBalance: number, pendingSpend: number) {
  return Math.max(0, Math.round((ledgerBalance - pendingSpend) * 100) / 100);
}
export async function getSpendableWalletBalance(client: { from: (table: string) => unknown }, email: string) {
  const [wallet, lock] = await Promise.all([getWalletBalanceSnapshot(client, email), getRefundLockState(client, email)]);
  return calculateSpendableBalance(wallet.availableBalance, lock.totalUnpaidSpend);
}
// Both automatic funding pauses and manual pauses use PAUSED in legacy rows.
// Show funding recovery guidance without claiming an unrecorded pause reason.
export function isFundingPaused(ad: { status?: string | null; billing_state?: string | null }) {
  return String(ad.status || '').toLowerCase() === 'paused' && String(ad.billing_state || '').toLowerCase() === 'paused';
}
