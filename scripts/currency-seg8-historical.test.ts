import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const name = '20261015160000_currency_seg8_historical_classification';
// Independent allowlist: never derive expected IDs from the migration or external backup.
const groups: [string, string | null, string, string[]][] = [
  ['wallet_topups', 'AUD', 'inferred', ['5e7e145c-9dbc-4d7a-a974-75aafb345ef7', '7fd1d936-5b6d-4684-978f-fe30b0f1d148', '2ad4bdde-acd5-44b4-9b3d-2f0585694757', 'de9cc65b-37d9-4135-a8c0-ad55ae602a96', '5599924b-e217-4296-80dd-fe796562857a']],
  ['wallet_refunds', 'AUD', 'inferred', ['32edeab7-d0b4-41cc-97a1-e3b2480e2055']],
  ['wallet_payouts', 'AUD', 'inferred', ['f8025e53-d432-482f-ad7e-08124c5b14a4']],
  ['wallet_payouts', null, 'unresolved', ['6004c3cd-62be-4d41-8eb6-2dd72b992b9d', '7c56e16d-efa5-41d6-9425-75b00497d796']],
  ['live_ads', 'AUD', 'inferred', ['3e0c466c-a2a3-4a3d-aa71-df0b90bbdc83', '271271fa-2563-4fc4-995e-7e276d0cc09e', 'e1b62502-2ed8-4302-821c-ce21af809844', '66f13993-a48b-47e6-a936-bd8b1ebeed1f']],
];
const literal = (v: string | null) => v === null ? 'NULL' : `'${v}'`;
function verify(sql: string, undo: boolean) {
  const clean = sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  assert.match(clean, /^BEGIN; DO \$classification\$ DECLARE .*COMMIT;$/);
  const updates = [...clean.matchAll(/UPDATE public\.(\w+) SET (.*?) WHERE (.*?);/g)];
  assert.equal(updates.length, groups.length);
  const expected = groups.map(([table, currency, source, ids]) => {
    const guard = undo
      ? `currency ${currency === null ? 'IS NULL' : `= ${literal(currency)}`} AND currency_source = ${literal(source)}`
      : 'currency IS NULL AND currency_source IS NULL';
    return `UPDATE public.${table} SET currency = ${undo ? 'NULL' : literal(currency)}, currency_source = ${undo ? 'NULL' : literal(source)} WHERE id IN (${ids.map(literal).join(', ')}) AND ${guard};`;
  });
  assert.deepEqual(updates.map(m => m[0]), expected, 'exact assignments, allowlist and predicates');
  assert.equal((clean.match(/\bUPDATE\b/g) ?? []).length, 9, '5 updates plus 4 row locks');
  assert.equal((clean.match(/GET DIAGNOSTICS v_updated = ROW_COUNT;/g) ?? []).length, 5);
  assert.equal((clean.match(/v_total := v_total \+ v_updated;/g) ?? []).length, 5);
  assert.equal((clean.match(/IF v_before IS DISTINCT FROM v_after THEN/g) ?? []).length, 4);
  assert.equal((clean.match(/to_jsonb\(t\) - 'currency' - 'currency_source'/g) ?? []).length, 8);
  assert.doesNotMatch(clean, /\b(?:DELETE|ALTER|DROP|CREATE|TRUNCATE|EXECUTE|CALL|MERGE)\b/i);
  if (!undo) {
    for (const [table, count] of [['wallet_topups', 5], ['wallet_refunds', 1], ['wallet_payouts', 3], ['live_ads', 4]] as const) {
      assert.ok(clean.includes(`IF v_total <> ${count} THEN RAISE EXCEPTION 'Segment 8 ${table}: expected ${count} updates, got %', v_total; END IF;`));
    }
    assert.equal((clean.match(/\bINSERT\b/g) ?? []).length, 1);
    assert.ok(clean.indexOf('INSERT INTO public.money_flow_audit_log') > clean.indexOf('$classification$;', 20));
    const audit = clean.match(/INSERT INTO public\.money_flow_audit_log \(event_type, source_route, reason_code, message, metadata\) VALUES \('currency_historical_classification', 'migration:[^']+', 'evidence_based_inference', '[^']+', '(.*?)'::jsonb\);/);
    assert.ok(audit);
    const metadata = JSON.parse(audit[1]);
    assert.equal(metadata.migration, name);
    assert.deepEqual(metadata.classifications, groups.map(([table, currency, currency_source, ids]) => ({ table, ids, currency, currency_source })));
  } else {
    assert.doesNotMatch(clean, /\bINSERT\b/);
  }
}
const migration = readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const undo = readFileSync(`supabase/undo/${name}.undo.sql`, 'utf8');
verify(migration, false);
verify(undo, true);
// Mutation checks demonstrate that unsafe edits are rejected by the static contract.
for (const bad of [
  migration.replace('SET currency =', 'SET amount ='),
  migration.replace('AND currency_source IS NULL', 'AND true'),
  migration.replaceAll(groups[0][3][0], '00000000-0000-0000-0000-000000000000'),
  migration.replace('v_total <> 5', 'v_total <> 4'),
  migration.replace('IF v_before IS DISTINCT FROM v_after THEN', 'IF false THEN'),
]) assert.throws(() => verify(bad, false));
assert.throws(() => verify(undo.replace("AND currency_source = 'inferred'", 'AND true'), true));
console.log('Currency Segment 8 historical classification static tests passed');
