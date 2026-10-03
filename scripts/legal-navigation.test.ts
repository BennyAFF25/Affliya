import * as assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { policyReturnDestination } from "../utils/legal/navigation";
import LegalPolicyContent, { type LegalPolicy } from "../app/components/legal/LegalPolicyContent";

const origin = "https://www.nettmark.com";
const setup = "/onboarding/for-partners?offerId=11111111-1111-4111-8111-111111111111&mode=ad";
assert.equal(policyReturnDestination(setup, "", origin), setup);
assert.equal(policyReturnDestination(null, origin + setup, origin), setup);
assert.equal(policyReturnDestination("/affiliate/marketplace", origin + setup, origin), "/affiliate/marketplace");
assert.equal(policyReturnDestination(null, "https://foreign.test" + setup, origin), "/");
assert.equal(policyReturnDestination(null, "", origin), "/");
for (const invalid of ["https://foreign.test", "//foreign.test", "/\\foreign.test", "/%2f%2fforeign.test", "/affiliate/../legal/privacy/cookies", "/legal/privacy/cookies", "/legal/privacy"]) {
  assert.equal(policyReturnDestination(invalid, "", origin), "/", invalid);
}
assert.equal(policyReturnDestination("https://foreign.test", origin + setup, origin), setup);
assert.equal(policyReturnDestination(null, origin + "/legal/privacy/terms-of-service", origin), "/");

const content = readFileSync("app/components/legal/LegalPolicyContent.tsx", "utf8");
const base = "b463313bb3b7cd8365cb6eb855e2bc09d5986346";
for (const [policy, path, title] of [
  ["terms", "app/legal/privacy/terms-of-service/page.tsx", "Terms of Service"],
  ["privacy", "app/legal/privacy/page.tsx", "Privacy Policy"],
  ["cookies", "app/legal/privacy/cookies/page.tsx", "Cookie Policy"],
] as const) {
  const original = execFileSync("git", ["show", base + ":" + path], { encoding: "utf8" });
  const legalStart = original.indexOf('        <div className="space-y-6');
  const legalEnd = original.lastIndexOf("\n      </div>");
  assert.ok(content.includes(original.slice(legalStart, legalEnd)), "Preserve policy wording: " + path);
  const standalone = renderToStaticMarkup(React.createElement(LegalPolicyContent, { policy: policy as LegalPolicy }));
  assert.ok(standalone.includes(title));
  assert.ok(standalone.includes("<h1"));
  const reader = renderToStaticMarkup(React.createElement(LegalPolicyContent, { policy: policy as LegalPolicy, showTitle: false }));
  assert.ok(!reader.includes("<h1"), "Dialog supplies the accessible policy title");
  assert.ok(reader.includes("Last updated:"));
}
console.log("Policy navigation destinations and unchanged legal text checks passed");
