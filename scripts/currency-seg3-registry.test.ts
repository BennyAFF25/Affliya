import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CURRENCY_CAPABILITIES, CURRENCY_REGISTRY, isCurrencyEnabled } from "../utils/currency/registry";

const filename = "20261015130000_currency_seg3_registry";
const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");
const normalize = (sql: string) => sql.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").trim();
const migration = normalize(read(`supabase/migrations/${filename}.sql`));
const undo = normalize(read(`supabase/undo/${filename}.undo.sql`));
const codes = ["AUD", "USD", "GBP", "CAD", "EUR", "NZD", "TRY", "JPY"];
const capabilities = ["offer_display_enabled", "topup_enabled", "wallet_enabled", "meta_launch_enabled", "commission_enabled", "payout_enabled", "refund_enabled"];
assert.deepEqual([...CURRENCY_CAPABILITIES], capabilities);
assert.match(migration, /^BEGIN; .* COMMIT;$/);
assert.equal(undo, "BEGIN; DROP TABLE IF EXISTS public.currency_registry; COMMIT;");
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.currency_registry \(/);
assert.ok(migration.includes("code text PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$')"));
assert.match(migration, /name text NOT NULL/);
assert.match(migration, /minor_unit_exponent smallint NOT NULL CHECK \(minor_unit_exponent BETWEEN 0 AND 4\)/);
for (const cap of capabilities) assert.ok(migration.includes(`${cap} bool NOT NULL DEFAULT false`));
for (const column of ["created_at", "updated_at"]) assert.ok(migration.includes(`${column} timestamptz NOT NULL DEFAULT now()`));
assert.match(migration, /symbol text, /);
assert.match(migration, /notes text, /);
// Parse the explicit seed column list and every tuple, rather than counting quoted codes in comments.
const insert = migration.match(/INSERT INTO public\.currency_registry \(([^)]+)\) VALUES (.*?) ON CONFLICT \(code\) DO NOTHING;/);
assert.ok(insert);
const columns = insert[1].split(",").map((value) => value.trim());
assert.deepEqual(columns, ["code", "name", "minor_unit_exponent", "symbol", ...capabilities, "notes"]);
const tuples = [...insert[2].matchAll(/\(([^)]+)\)/g)];
assert.equal(tuples.length, codes.length);
assert.equal(insert[2].replace(/\([^)]+\)/g, "").replace(/[\s,]/g, ""), "");
const seed = tuples.map((tuple) => {
  const tokens = tuple[1].match(/'(?:[^']|'')*'|true|false|\d+|NULL/g)!;
  assert.equal(tokens.length, columns.length);
  assert.equal(tuple[1].replace(/'(?:[^']|'')*'|true|false|\d+|NULL/g, "").replace(/[\s,]/g, ""), "");
  const values = tokens.map((token) => token.startsWith("'") ? token.slice(1, -1).replace(/''/g, "'") : token === "true" ? true : token === "false" ? false : token === "NULL" ? null : Number(token));
  return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
});
assert.deepEqual(seed.map((row) => row.code), codes);
assert.deepEqual(Object.keys(CURRENCY_REGISTRY), codes);
for (const row of seed) {
  assert.deepEqual(CURRENCY_REGISTRY[row.code as keyof typeof CURRENCY_REGISTRY], row, `SQL/TS parity: ${row.code}`);
  assert.equal(row.minor_unit_exponent, row.code === "JPY" ? 0 : 2);
  for (const capability of CURRENCY_CAPABILITIES) {
    const enabled = capability === "offer_display_enabled" || row.code === "AUD";
    assert.equal(row[capability], enabled, `${row.code}.${capability}`);
    assert.equal(isCurrencyEnabled(String(row.code), capability), enabled);
  }
}
for (const code of ["", "aud", " AUD", "AUD ", "CHF", "__proto__", "constructor", "toString"]) {
  for (const capability of CURRENCY_CAPABILITIES) assert.equal(isCurrencyEnabled(code, capability), false);
}
assert.match(migration, /ALTER TABLE public\.currency_registry ENABLE ROW LEVEL SECURITY;/);
const policies = [...migration.matchAll(/CREATE POLICY ([^;]+);/g)];
assert.equal(policies.length, 1);
assert.equal(policies[0][1], "currency_registry_select ON public.currency_registry FOR SELECT TO anon, authenticated USING (true)");
assert.match(migration, /DROP POLICY IF EXISTS currency_registry_select ON public\.currency_registry;/);
assert.equal([...migration.matchAll(/INSERT INTO /g)].length, 1);
// Ignore explanatory strings when checking for forbidden executable operations.
const executable = migration.replace(/'(?:[^']|'')*'/g, "''");
assert.doesNotMatch(executable, /\b(?:REFERENCES|FOREIGN KEY|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|FUNCTION|TRIGGER|CASCADE)\b/);
assert.equal([...executable.matchAll(/ALTER TABLE /g)].length, 1);
assert.equal([...executable.matchAll(/CREATE TABLE /g)].length, 1);
for (const column of columns.concat(["created_at", "updated_at"])) {
  assert.ok(migration.includes(`COMMENT ON COLUMN public.currency_registry.${column} IS '`), column);
}
assert.match(migration, /COMMENT ON TABLE public\.currency_registry IS 'Preparatory currency capabilities: unknown codes and disabled flags fail closed\./);
console.log("Currency Segment 3: exact eight-code seed, SQL/TS parity, AUD-only money capabilities, JPY exponent, fail-closed helper, select-only RLS and transactional undo verified.");
