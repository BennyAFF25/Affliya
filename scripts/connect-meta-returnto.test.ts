import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { connectMetaGrowthGateRedirect } from "../utils/meta/connectMetaGate";

const returnToOf = (url: string) => new URL(url, "https://x.invalid").searchParams.get("returnTo");
const reasonOf = (url: string) => new URL(url, "https://x.invalid").searchParams.get("reason");

assert.equal(
  connectMetaGrowthGateRedirect(null),
  "/business/choose-plan?returnTo=%2Fbusiness%2Fmy-business%2Fconnect-meta&reason=meta_requires_growth",
);
assert.equal(returnToOf(connectMetaGrowthGateRedirect("")), "/business/my-business/connect-meta");
const r = connectMetaGrowthGateRedirect("?meta_error=no_page&onboard=1");
assert.equal(returnToOf(r), "/business/my-business/connect-meta?meta_error=no_page&onboard=1");
assert.equal(reasonOf(r), "meta_requires_growth");
assert.equal(returnToOf(connectMetaGrowthGateRedirect("meta_error=unexpected")), "/business/my-business/connect-meta?meta_error=unexpected");
// Hostile input stays on the connect-meta path.
assert.equal(returnToOf(connectMetaGrowthGateRedirect("?x=" + "a".repeat(600))), "/business/my-business/connect-meta");
assert.ok(returnToOf(connectMetaGrowthGateRedirect("?a=1#//evil.com"))!.startsWith("/business/my-business/connect-meta"));

const layout = readFileSync("app/business/my-business/connect-meta/layout.tsx", "utf8");
assert.match(layout, /connectMetaGrowthGateRedirect\(/);
assert.doesNotMatch(layout, /returnTo=%2Fbusiness%2Fmy-business%2Fconnect-meta&reason/);
const mw = readFileSync("middleware.ts", "utf8");
assert.match(mw, /\/business\/my-business\/connect-meta/);
assert.match(mw, /nettmark_business_plan_choice_v2/);
console.log("connect-meta-returnto: ok");
