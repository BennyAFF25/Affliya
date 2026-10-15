import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateWalletBalance } from '../utils/wallet/balance';

const name = '20261016090000_currency_seg10_shadow_ledger';
const raw = readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const clean = (s: string) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const sql = clean(raw);
const undo = clean(readFileSync(`supabase/undo/${name}.undo.sql`, 'utf8'));
assert.match(sql, /^BEGIN; .* COMMIT;$/);
assert.match(sql, /IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conrelid = 'public.wallet_accounts'::regclass AND conname = 'wallet_accounts_id_currency_key'\) THEN ALTER TABLE public.wallet_accounts ADD CONSTRAINT wallet_accounts_id_currency_key UNIQUE \(id, currency\);/);
assert.equal((sql.match(/CREATE TABLE /g) ?? []).length, 2);
assert.equal((sql.match(/FOREIGN KEY \(account_id, currency\) REFERENCES public.wallet_accounts\(id, currency\)/g) ?? []).length, 2);
assert.equal((sql.match(/currency text NOT NULL REFERENCES public.currency_registry\(code\)/g) ?? []).length, 2);
assert.match(sql, /amount_minor bigint NOT NULL CHECK \(amount_minor <> 0\)/);
assert.match(sql, /amount_minor bigint NOT NULL CHECK \(amount_minor > 0\)/);
assert.match(sql, /UNIQUE \(source_table, source_id, entry_type\)/);
assert.match(sql, /entry_type text NOT NULL CHECK \(entry_type IN \('topup_credit', 'refund_debit', 'deduction_debit', 'hold', 'hold_release', 'adjustment'\)\)/);
assert.match(sql, /status text NOT NULL CHECK \(status IN \('active', 'consumed', 'released'\)\)/);
for (const table of ['wallet_ledger_entries', 'wallet_holds']) {
  assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`));
}
assert.match(sql, /REVOKE ALL ON public.wallet_ledger_entries, public.wallet_holds FROM PUBLIC, anon, authenticated;/);
assert.match(sql, /GRANT ALL ON public.wallet_ledger_entries, public.wallet_holds TO service_role;/);
assert.doesNotMatch(sql, /CREATE (?:OR REPLACE )?(?:POLICY|TRIGGER|FUNCTION)|DISABLE ROW LEVEL SECURITY|\b(?:UPDATE|DELETE|TRUNCATE|DROP)\b/i);
const alterations = [...sql.matchAll(/ALTER TABLE public\.(\w+) ([^;]+);/g)].map(m => `${m[1]} ${m[2]}`);
assert.deepEqual(alterations, [
  'wallet_accounts ADD CONSTRAINT wallet_accounts_id_currency_key UNIQUE (id, currency)',
  'wallet_ledger_entries ENABLE ROW LEVEL SECURITY', 'wallet_holds ENABLE ROW LEVEL SECURITY',
]);
assert.ok([...sql.matchAll(/INSERT INTO public\.(\w+)/g)].every(m => m[1] === 'wallet_ledger_entries'));
assert.match(sql, /CREATE VIEW public.wallet_ledger_balances WITH \(security_invoker = true\)/);
assert.match(sql, /REVOKE ALL ON public.wallet_ledger_balances FROM PUBLIC, anon, authenticated;/);
assert.match(sql, /GRANT SELECT ON public.wallet_ledger_balances TO service_role;/);
assert.equal((sql.match(/\bGRANT\b/g) ?? []).length, 2);
assert.match(sql, /FROM public.wallet_holds WHERE status = 'active' GROUP BY account_id/);
assert.equal((sql.match(/a.owner_email = [td]\.affiliate_email AND a.currency = [td]\.currency/g) ?? []).length, 2);
assert.match(sql, /COALESCE\(lower\(t.status\), ''\) IN \('', 'succeeded', 'refunded'\)/);
assert.match(sql, /CASE WHEN credited > 0 THEN credited ELSE net END AS principal/);
assert.match(sql, /greatest\(0, principal - refunded\) AS net_available/);
assert.match(sql, /\('refund_debit', refund\)/);
assert.match(sql, /\('adjustment', net_available - credit - refund\)/);
assert.match(sql, /GROUP BY a.id, a.currency HAVING sum\(e.amount_minor\) < 0/);
assert.doesNotMatch(sql, /'wallet_refunds',/);
assert.match(sql, /null_currency_count <> 0 OR missing_account_count <> 0 THEN RAISE EXCEPTION/);
assert.match(sql, /minor_unit_exponent <> 2/);
assert.match(sql, /FULL JOIN canonical c ON c.affiliate_email = l.owner_email/);
assert.match(sql, /COALESCE\(l.available, 0\) <> COALESCE\(c.available, 0\)/);
assert.match(sql, /ledger_total <> canonical_total THEN RAISE EXCEPTION/);
assert.equal((sql.match(/FROM public.affiliate_wallet_balances_by_currency/g) ?? []).length, 2);
assert.match(sql, /LOCK TABLE public.wallet_topups, public.wallet_deductions, public.wallet_refunds, public.wallet_accounts IN SHARE MODE;/);
for (const column of ['credited_amount', 'amount_net', 'amount_refunded', 'd.amount']) {
  assert.ok(sql.includes(`floor(${column}::double precision * 100 + 0.5)::numeric`));
  assert.ok(sql.includes(`${column}::text IN ('NaN', 'Infinity', '-Infinity')`));
}
assert.equal(undo, 'BEGIN; DROP VIEW IF EXISTS public.wallet_ledger_balances; DROP TABLE IF EXISTS public.wallet_holds; DROP TABLE IF EXISTS public.wallet_ledger_entries; ALTER TABLE public.wallet_accounts DROP CONSTRAINT IF EXISTS wallet_accounts_id_currency_key; COMMIT;');
assert.match(raw, /Static backfill snapshot as of migration; no dual-write yet/);

// Offline model of the SQL decomposition compared to the existing calculator.
// Fixtures cover audit-only refunds, clamps, status filtering and credited preference.
type Topup = { credited_amount?: number | null; amount_net?: number; amount_refunded?: number; status?: string | null };
const minor = (n: number | null | undefined) => Number.isFinite(Number(n ?? 0)) ? Math.round(Number(n ?? 0) * 100) : 0;
function shadow(topups: Topup[], deductions: { amount: number }[]) {
  const entries: number[] = [];
  for (const t of topups) {
    if (!['', 'succeeded', 'refunded'].includes((t.status || '').toLowerCase())) continue;
    const credited = minor(t.credited_amount);
    const principal = credited > 0 ? credited : minor(t.amount_net);
    const refunded = minor(t.amount_refunded);
    const credit = Math.max(0, principal);
    const refund = -Math.min(credit, Math.max(0, refunded));
    const adjustment = Math.max(0, principal - refunded) - credit - refund;
    entries.push(credit, refund, adjustment);
  }
  entries.push(...deductions.map(d => -minor(d.amount)));
  const sum = entries.reduce((a, b) => a + b, 0);
  if (sum < 0) entries.push(-sum);
  return entries.reduce((a, b) => a + b, 0);
}
const fixtures: { topups: Topup[]; deductions: { amount: number }[]; refunds?: { amount: number }[] }[] = [
  { topups: [{ credited_amount: 47.95, amount_net: 47.95, amount_refunded: 47.95, status: 'refunded' }], deductions: [], refunds: [{ amount: 47.95 }] },
  { topups: [{ credited_amount: 15, amount_net: 14, status: '' }], deductions: [] },
  { topups: [{ credited_amount: 0, amount_net: 100, amount_refunded: 150 }], deductions: [] },
  { topups: [{ credited_amount: -5, amount_net: 20, status: 'SUCCEEDED' }, { amount_net: 50, status: 'pending' }], deductions: [{ amount: 30 }] },
  { topups: [{ amount_net: -10, amount_refunded: -20 }, { amount_net: 10, amount_refunded: -5 }], deductions: [{ amount: -2 }] },
  { topups: [{ credited_amount: NaN, amount_net: 10.125, amount_refunded: Infinity }], deductions: [{ amount: 0.125 }] },
  { topups: [], deductions: [] },
];
for (const fixture of fixtures) {
  assert.equal(shadow(fixture.topups, fixture.deductions), Math.round(calculateWalletBalance(fixture).availableBalance * 100));
}
console.log('Currency Segment 10 shadow ledger static and offline parity tests passed');
