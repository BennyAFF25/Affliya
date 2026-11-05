import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { businessContinuationDestination, safeBusinessReturnTo } from "../utils/safeBusinessReturnTo";
import { shouldShowPlanChoiceAfterPublish } from "../utils/onboardingSuccessStep";
import { connectMetaGrowthGateRedirect } from "../utils/meta/connectMetaGate";

const target = "/business/my-business/connect-meta?meta_error=no_page&onboard=1";
const page = readFileSync("app/business/choose-plan/page.tsx", "utf8");
// Exercise the page's resolver, including precedence and hostile input, without rendering React.
const resolver = page.match(/const continuationReturnTo = \(\) => \{([\s\S]*?)\n {2}\};/)![1];
const resolve = (search: string): string | null => new Function("window", "safeBusinessReturnTo", resolver)(
  { location: { search } }, safeBusinessReturnTo,
);
assert.equal(resolve(new URLSearchParams({ returnTo: target, next: "/business/settings" }).toString()), target);
assert.equal(resolve(new URLSearchParams({ next: target }).toString()), target);
for (const hostile of ["https://evil.com/business/x", "//evil.com/business/x", "javascript:alert(1)", "/\\evil.com", "/business/../../evil", "/business/x\ny", "/business/\\evil.com", "/business/x\u0000"]) {
  for (const key of ["returnTo", "next"]) {
    assert.equal(resolve(new URLSearchParams({ [key]: hostile }).toString()), null, hostile);
  }
}
assert.equal(resolve("returnTo=https%3A%2F%2Fevil.com&next=%2Fbusiness%2Fsettings"), null);
assert.equal(resolve(""), null);
const gated = new URL(connectMetaGrowthGateRedirect("?meta_error=no_page&onboard=1"), "https://x.invalid");
assert.equal(resolve(gated.search), target);
assert.equal(shouldShowPlanChoiceAfterPublish(gated.search), true);
assert.equal(shouldShowPlanChoiceAfterPublish("?reason=meta_requires_growth"), true);
assert.equal(shouldShowPlanChoiceAfterPublish(new URLSearchParams({ returnTo: target }).toString()), true);
assert.equal(shouldShowPlanChoiceAfterPublish("?returnTo=https://evil.com"), false);
assert.equal(shouldShowPlanChoiceAfterPublish(""), false);
assert.equal(shouldShowPlanChoiceAfterPublish("?source=offer_published"), true);
assert.equal(shouldShowPlanChoiceAfterPublish("?subscription=checkout_returned"), true);
assert.equal(businessContinuationDestination("/business/my-business?subscription=active", target), target);
const checkout = businessContinuationDestination("/business/choose-plan", target);
assert.equal(resolve(checkout.split("?")[1]), target);
assert.equal(businessContinuationDestination("/onboarding/for-business", target), `/onboarding/for-business?next=${encodeURIComponent(target)}`);
assert.match(page, /query\.get\("returnTo"\) \?\? query\.get\("next"\)/);
assert.match(page, /planFirst && result\.planSelectionComplete &&\s*!shouldShowPlanChoiceAfterPublish\(window\.location\.search\)/);
assert.match(page, /destination, continuationReturnTo\(\)/);
assert.match(page, /returnTo: businessContinuationDestination\("\/business\/choose-plan", continuationReturnTo\(\)\)/);
assert.match(page, /result.billingStatus === "subscription_trialing" \|\| result.billingStatus === "subscription_active"\) \{\s*continueTo\(/);
assert.match(page, /result.status === "already_subscribed" \|\| result.status === "grandfathered"\) \{ continueTo\(/);
console.log("choose-plan-returnto: ok");
