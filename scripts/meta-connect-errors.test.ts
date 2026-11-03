import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMetaConnectErrorMessage, ADS_MANAGER_URL } from "../utils/meta/connectErrors";

const callback = readFileSync("app/api/meta/callback/route.ts", "utf8");
const reasons = [...callback.matchAll(/meta_error:\s*'([a-z_]+)'/g)].map((m) => m[1]);
for (const r of ["authorization_cancelled", "authorization_failed"]) reasons.push(r);
assert.ok(reasons.length >= 10, "found callback reasons");
for (const r of reasons) {
  const m = getMetaConnectErrorMessage(r);
  assert.ok(m && m.title && m.body, `message for ${r}`);
}
assert.equal(getMetaConnectErrorMessage(null), null);
assert.equal(getMetaConnectErrorMessage("no_ad_account")!.link!.href, ADS_MANAGER_URL);
assert.match(getMetaConnectErrorMessage("no_page")!.body, /ticked/);
assert.match(getMetaConnectErrorMessage("nettmark_session")!.body, /same browser/);
assert.match(getMetaConnectErrorMessage("nettmark_session")!.body, /in-app browser/);
for (const r of ["token_exchange", "ad_accounts_fetch", "pages_fetch"]) {
  assert.match(getMetaConnectErrorMessage(r)!.body, /allow every permission/);
}
for (const r of ["connection_save", "unexpected", "something_new"]) {
  const m = getMetaConnectErrorMessage(r)!;
  assert.match(m.body, /try again/);
  assert.equal(m.showSupport, true);
}
const page = readFileSync("app/business/my-business/connect-meta/page.tsx", "utf8");
assert.match(page, /searchParams\?\.get\("meta_error"\)/);
assert.match(page, /data-testid="meta-connect-error"/);
console.log("meta-connect-errors: ok");
