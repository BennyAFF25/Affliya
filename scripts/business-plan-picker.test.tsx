import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveBusinessPlanChoice } from "../utils/businessPlanChoice";
import BusinessTrialFirstContinuation from "../components/business/BusinessTrialFirstContinuation";

assert.equal(resolveBusinessPlanChoice(null), "growth");
assert.equal(resolveBusinessPlanChoice(undefined), "growth");
assert.equal(resolveBusinessPlanChoice(""), "growth");
assert.equal(resolveBusinessPlanChoice("growth"), "growth");
assert.equal(resolveBusinessPlanChoice("bogus"), "growth");
assert.equal(resolveBusinessPlanChoice("free"), "free");

const context = { business_onboarding_funnel: "treatment", treatment: true, offerId: null, participationMode: "open",
  trialEligible: true, trialDays: 14, price: null, billingError: null, checkoutEnabled: true };
const noop = () => {};
const render = (plan?: "free" | "growth") => renderToStaticMarkup(React.createElement(BusinessTrialFirstContinuation,
  { context, busy: null, error: null, onGrowth: noop, onFree: noop, onRetry: noop, ...(plan ? { selectedPlan: plan } : {}) }));

for (const html of [render(), render(resolveBusinessPlanChoice(null))]) {
  assert.ok(html.includes("Selected · Recommended"), "Growth preselected by default");
  assert.ok(!/>Selected</.test(html), "Free not selected by default");
  assert.ok(html.includes("Organic affiliates only, no paid ads"));
  assert.ok(html.includes("Start my affiliate-funded launch, 14 days free"));
}
const free = render(resolveBusinessPlanChoice("free"));
assert.ok(/>Selected</.test(free), "?plan=free selects Free");
assert.ok(!free.includes("Selected · Recommended"));
assert.ok(free.includes("Organic affiliates only, no paid ads"));
console.log("Business plan picker preselect/override passed");
