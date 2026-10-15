import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tables = [
  "wallet_topups", "wallet_refunds", "wallet_deductions", "wallet_payouts", "wallets",
  "ad_spend_settlements", "live_ads", "conversions", "recurring_commission_instances",
  "business_activation_subsidies",
];
const filename = "20261015120000_currency_seg2_money_record_currency";
const migrationPath = resolve(__dirname, `../supabase/migrations/${filename}.sql`);
const undoPath = resolve(__dirname, `../supabase/undo/${filename}.undo.sql`);
assert.ok(!undoPath.startsWith(resolve(__dirname, "../supabase/migrations") + "/"), "Undo is outside forward migrations");

// Strip SQL comments, retain quoted values for CHECK verification, and normalize whitespace.
function normalize(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").trim();
}
function pattern(literal: string): RegExp {
  return new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
}
function exactlyOnce(sql: string, literal: string): void {
  assert.equal([...sql.matchAll(pattern(literal))].length, 1, literal);
}
const migration = normalize(readFileSync(migrationPath, "utf8"));
const undo = normalize(readFileSync(undoPath, "utf8"));
for (const sql of [migration, undo]) {
  assert.match(sql, /^BEGIN; .* COMMIT;$/);
  assert.doesNotMatch(sql, /\b(?:DEFAULT|UPDATE|INSERT|DELETE|MERGE|TRUNCATE|CREATE|GRANT|REVOKE|POLICY|CASCADE)\b/i,
    "Only schema metadata operations; no defaults, backfill, indexes, functions or access changes");
}
assert.doesNotMatch(migration, /\b(?:DROP|SET\s+NOT\s+NULL)\b/i);
const additions = [...migration.matchAll(/ALTER TABLE public\.(\w+) ADD COLUMN ([^;]+);/g)];
assert.equal(additions.length, tables.length);
assert.deepEqual(additions.map((match) => match[1]).sort(), [...tables].sort());
const undoStatements = [...undo.matchAll(/ALTER TABLE public\.(\w+) ([^;]+);/g)];
assert.equal(undoStatements.length, tables.length);
assert.deepEqual(undoStatements.map((match) => match[1]).sort(), [...tables].sort());
assert.equal([...migration.matchAll(/ADD CONSTRAINT /g)].length, tables.length * 2);
assert.equal([...migration.matchAll(/COMMENT ON COLUMN /g)].length, tables.length * 2);
assert.equal([...migration.matchAll(/DO \$currency_constraints\$/g)].length, tables.length);

for (const table of tables) {
  const columns = additions.find((match) => match[1] === table)![2];
  assert.equal(columns, "IF NOT EXISTS currency text NULL, ADD COLUMN IF NOT EXISTS currency_source text NULL");
  const checks = [
    ["currency_format_chk", "currency IS NULL OR currency ~ '^[A-Z]{3}$'"],
    ["currency_source_chk", "currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved')"],
  ];
  for (const [suffix, expression] of checks) {
    const name = `${table}_${suffix}`;
    exactlyOnce(migration, `IF NOT EXISTS ( SELECT 1 FROM pg_constraint WHERE conrelid = 'public.${table}'::regclass AND conname = '${name}' ) THEN ALTER TABLE public.${table} ADD CONSTRAINT ${name} CHECK (${expression}); END IF;`);
  }
  for (const column of ["currency", "currency_source"]) {
    const comment = migration.match(new RegExp(`COMMENT ON COLUMN public\\.${table}\\.${column} IS '([^']+)';`))?.[1];
    assert.ok(comment, `${table}.${column} comment`);
    assert.match(comment, /ISO 4217 code of the amount columns on this row/);
    assert.match(comment, /NULL = not yet recorded; set by future segments\./);
  }
  assert.equal(undoStatements.find((match) => match[1] === table)![2],
    `DROP CONSTRAINT IF EXISTS ${table}_currency_format_chk, DROP CONSTRAINT IF EXISTS ${table}_currency_source_chk, DROP COLUMN IF EXISTS currency, DROP COLUMN IF EXISTS currency_source`);
}
// All forward ALTERs must be column additions or the two explicitly checked constraints.
assert.equal([...migration.matchAll(/ALTER TABLE /g)].length, tables.length * 3);
console.log("Currency Segment 2: all 10 tables, 20 nullable columns, 20 guarded constraints, comments and complete undo verified; no defaults or data writes.");
