import { createClient } from '@supabase/supabase-js';
import { scanWalletLedgerDrift } from '../utils/wallet/ledgerDrift';

// Explicit operator command only. SELECTs only; never load or print credentials.
async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service environment');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const count = await scanWalletLedgerDrift(client, row => console.log(JSON.stringify(row)));
  console.log(`Wallet ledger drift rows: ${count}`);
  if (count > 0) process.exitCode = 1;
}
main().catch(() => {
  // Do not print raw client errors, URLs, headers or environment values.
  console.error('Wallet ledger drift check failed; verify service environment and view access.');
  process.exitCode = 1;
});
