import { getLaunchWalletAvailable } from './launchHolds';

// Presentation/launch estimate only. Settlement owns the actual wallet ledger.
export function calculateSpendableBalance(ledgerBalance: number, pendingSpend: number) {
  return Math.max(0, Math.round((ledgerBalance - pendingSpend) * 100) / 100);
}
export async function getSpendableWalletBalance(client: { from: (table: string) => unknown }, email: string) {
  return getLaunchWalletAvailable(client, email);
}
// Both automatic funding pauses and manual pauses use PAUSED in legacy rows.
// Show funding recovery guidance without claiming an unrecorded pause reason.
export function isFundingPaused(ad: { status?: string | null; billing_state?: string | null }) {
  return String(ad.status || '').toLowerCase() === 'paused' && ['paused', 'paused_low_wallet'].includes(String(ad.billing_state || '').toLowerCase());
}
