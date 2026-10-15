import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const name = '20261016100000_currency_seg11_ledger_dual_write';
const clean = (s: string) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const sql = clean(readFileSync(`supabase/migrations/${name}.sql`, 'utf8'));
const undo = clean(readFileSync(`supabase/undo/${name}.undo.sql`, 'utf8'));
assert.match(sql, /^BEGIN; .* COMMIT;$/);
assert.match(sql, /LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public/);
assert.match(sql, /REVOKE EXECUTE ON FUNCTION public.shadow_ledger_sync_source\(\) FROM PUBLIC, anon, authenticated;/);
assert.equal((sql.match(/CREATE TRIGGER /g) ?? []).length, 3);
for (const table of ['wallet_topups', 'wallet_refunds', 'wallet_deductions']) {
  assert.ok(sql.includes(`CREATE TRIGGER shadow_ledger_sync_${table} AFTER INSERT OR UPDATE OR DELETE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.shadow_ledger_sync_source();`));
  assert.ok(undo.includes(`DROP TRIGGER IF EXISTS shadow_ledger_sync_${table} ON public.${table};`));
}
assert.doesNotMatch(sql, /\bBEFORE\b|\bRAISE\b|\bDROP\b|resolve_.*identity|\bRETURN (?:NEW|OLD)\b|\bTRUNCATE\b/);
assert.ok((sql.match(/RETURN NULL;/g) ?? []).length >= 3);
assert.match(sql, /RETURN NULL; EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; v_state := SQLSTATE; v_reason := 'SHADOW_LEDGER_SYNC_FAILED'; BEGIN INSERT INTO public.money_flow_audit_log/);
assert.equal((sql.match(/EXCEPTION WHEN OTHERS THEN NULL; END;/g) ?? []).length, 2);
assert.match(sql, /'shadow_ledger_sync_failed', 'warning'/);
assert.match(sql, /'sqlerrm', v_error, 'sqlstate', v_state/);
for (const field of ['wallet_topup_id', 'wallet_refund_id', 'wallet_deduction_id']) assert.ok(sql.includes(field));
assert.match(sql, /ON CONFLICT \(source_table, source_id, entry_type\) DO UPDATE SET account_id = EXCLUDED.account_id, currency = EXCLUDED.currency/);
assert.match(sql, /IF TG_OP = 'DELETE' THEN DELETE FROM public.wallet_ledger_entries WHERE source_table = TG_TABLE_NAME AND source_id = v_row->>'id'; RETURN NULL;/);
assert.match(sql, /OLD.id::text IS DISTINCT FROM NEW.id::text/);
assert.match(sql, /DELETE FROM public.wallet_ledger_entries e .* AND NOT EXISTS .* d.amount <> 0/);
assert.match(sql, /owner_email = v_row->>'affiliate_email' AND currency = v_row->>'currency'/);
assert.match(sql, /r.code = v_row->>'currency' AND r.wallet_enabled = true ON CONFLICT \(owner_email, currency\) DO NOTHING/);
assert.match(sql, /minor_unit_exponent = 2/);
assert.match(sql, /SHADOW_LEDGER_CURRENCY_UNRECORDED/);
assert.match(sql, /COALESCE\(lower\(v_row->>'status'\), ''\) IN \('', 'succeeded', 'refunded'\)/);
assert.match(sql, /CASE WHEN v_credited > 0 THEN v_credited ELSE v_net END/);
assert.match(sql, /v_refund := -least\(greatest\(0, v_principal\), greatest\(0, v_refunded\)\)/);
assert.match(sql, /v_adjustment := greatest\(0, v_principal - v_refunded\) - v_credit - v_refund/);
for (const field of ['credited_amount', 'amount_net', 'amount_refunded', 'amount']) {
  assert.ok(sql.includes(`v_row->>'${field}' IN ('NaN', 'Infinity', '-Infinity')`));
  assert.ok(sql.includes(`floor((v_row->>'${field}')::double precision * 100 + 0.5)::numeric`));
}
assert.doesNotMatch(sql, /(?:IF|ELSIF) TG_TABLE_NAME = 'wallet_refunds'/);
assert.match(sql, /CREATE VIEW public.wallet_ledger_reconciliation WITH \(security_invoker = true\)/);
assert.match(sql, /FULL JOIN public.wallet_ledger_balances l ON l.owner_email = c.affiliate_email AND l.currency = c.currency_bucket/);
for (const field of ['canonical_minor', 'ledger_minor', 'drift_minor', 'has_drift', 'canonical_missing', 'ledger_missing', 'canonical_floor_applied', 'floor_explanation']) assert.ok(sql.includes(`AS ${field}`));
assert.match(sql, /REVOKE ALL ON public.wallet_ledger_reconciliation FROM PUBLIC, anon, authenticated; GRANT SELECT ON public.wallet_ledger_reconciliation TO service_role;/);
assert.match(undo, /DROP FUNCTION IF EXISTS public.shadow_ledger_sync_source\(\); DROP VIEW IF EXISTS public.wallet_ledger_reconciliation;/);
assert.doesNotMatch(undo, /DELETE|TRUNCATE|DROP TABLE|resolve_.*identity/);
// No writes to canonical sources or existing trigger definitions.
assert.deepEqual([...sql.matchAll(/(?:INSERT INTO|DELETE FROM|UPDATE) public\.(\w+)/g)].map(m => m[1]).filter(t => !['wallet_accounts', 'wallet_ledger_entries', 'money_flow_audit_log'].includes(t)), []);
const checker = readFileSync('scripts/check-wallet-ledger-drift.ts', 'utf8');
assert.match(checker, /\.eq\('has_drift', true\)/);
assert.match(checker, /\.range\(offset, offset \+ size - 1\)/);
assert.match(checker, /if \(count > 0\) process.exitCode = 1/);
assert.doesNotMatch(checker, /\.(insert|update|delete|upsert|rpc)\(/);
console.log('Currency Segment 11 static trigger, isolation, parity-shape, access and undo checks passed');
