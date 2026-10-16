import type { SupabaseClient } from '@supabase/supabase-js';

export type LedgerDriftClient = Pick<SupabaseClient, 'from'>;
export type LedgerDriftRow = {
  affiliate_email: string | null;
  currency: string | null;
  canonical_minor: number | string;
  ledger_minor: number | string;
  drift_minor: number | string;
  has_drift: boolean;
  canonical_floor_applied: boolean;
  floor_explanation: string | null;
};

// Read-only traversal shared by the operator CLI and scheduled diagnostic.
export async function scanWalletLedgerDrift(
  client: LedgerDriftClient,
  onRow: (row: LedgerDriftRow) => void,
) {
  let count = 0;
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await client.from('wallet_ledger_reconciliation')
      .select('affiliate_email,currency,canonical_minor,ledger_minor,drift_minor,has_drift,canonical_floor_applied,floor_explanation')
      .eq('has_drift', true).order('affiliate_email').order('currency')
      .range(offset, offset + size - 1);
    if (error || !data) throw new Error('Reconciliation SELECT failed');
    for (const row of data) onRow(row as LedgerDriftRow);
    count += data.length;
    if (data.length < size) return count;
  }
}
