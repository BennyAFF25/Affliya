import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { META_CONNECTION_PUBLIC_COLUMNS } from "../utils/meta/loadOwnMetaConnections";

// meta_connections is granted to service_role only (no authenticated/anon).
const callback = readFileSync("app/api/meta/callback/route.ts", "utf8");
const sessionAt = callback.indexOf("auth.getUser()");
const adminAt = callback.indexOf("const admin = createServerSupabaseClient()");
const upsertAt = callback.search(/admin\s*\.from\('meta_connections'\)\s*\.upsert/);
assert.ok(sessionAt > 0 && adminAt > sessionAt && upsertAt > adminAt, "callback upserts with admin client after session check");
assert.doesNotMatch(callback, /supabase\s*\.from\('meta_connections'\)/, "no user-scoped meta_connections access in callback");
assert.match(callback, /const business_email = user\?\.email\n/, "business_email from session user");

assert.doesNotMatch(META_CONNECTION_PUBLIC_COLUMNS, /token/i, "route never returns tokens");
for (const f of ["app/api/business/meta-connections/route.ts", "app/api/meta/connection-currency/route.ts"]) {
  const src = readFileSync(f, "utf8");
  assert.match(src, /auth\.getUser\(\)/, `${f} checks session`);
  assert.doesNotMatch(src, /access_token|select\("\*"\)/, `${f} never selects tokens`);
}
const currency = readFileSync("app/api/meta/connection-currency/route.ts", "utf8");
assert.match(currency, /affiliate_email/, "currency route checks ownership");

function walk(dir: string, out: string[] = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}
const offenders = [...walk("app"), ...walk("components")]
  .filter((f) => !f.startsWith(join("app", "api")))
  .filter((f) => /from\(\s*["'`]meta_connections["'`]\s*\)/.test(readFileSync(f, "utf8")));
assert.deepEqual(offenders, [], "no client page queries meta_connections directly");
console.log("meta-connections-service-role: ok");
