import { createClient } from '@supabase/supabase-js';

// Explicit operator command only. SELECTs only; never load or print credentials.
async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service environment');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let count = 0;
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await client.from('wallet_ledger_reconciliation')
      .select('affiliate_email,currency,canonical_minor,ledger_minor,drift_minor,has_drift,canonical_floor_applied,floor_explanation')
      .eq('has_drift', true).order('affiliate_email').order('currency')
      .range(offset, offset + size - 1);
    if (error || !data) throw new Error('Reconciliation SELECT failed');
    for (const row of data) console.log(JSON.stringify(row));
    count += data.length;
    if (data.length < size) break;
  }
  console.log(`Wallet ledger drift rows: ${count}`);
  if (count > 0) process.exitCode = 1;
}
main().catch(() => {
  // Do not print raw client errors, URLs, headers or environment values.
  console.error('Wallet ledger drift check failed; verify service environment and view access.');
  process.exitCode = 1;
});
