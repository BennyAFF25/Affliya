import assert from "node:assert/strict";
import { onboardingSuccessStep, shouldShowPlanChoiceAfterPublish, wizardResumeDecision, hasBusinessPlan } from "../utils/onboardingSuccessStep";
import { businessContinuationDestination } from "../utils/safeBusinessReturnTo";
import { readFileSync } from "node:fs";
const paid = onboardingSuccessStep(true);
assert.equal(paid.href, "/business/my-business");
assert.ok(!/choose how affiliates/i.test(paid.message));
assert.match(paid.message, /connect Meta/);
const free = onboardingSuccessStep(false);
assert.equal(free.href, "/business/choose-plan?plan=growth&source=offer_published");
assert.match(free.message, /choose how affiliates can promote/);
console.log("Onboarding success step copy passed");
assert.equal(paid.message, "Your offer is saved. Next, connect Meta from My Business so affiliates can send paid proposals.");
assert.equal(paid.buttonLabel, "Go to My Business");

// Routing: post-publish CTA stays on plan choice; normal visits still auto-continue.
assert.equal(shouldShowPlanChoiceAfterPublish("?plan=growth&source=offer_published"), true);
assert.equal(shouldShowPlanChoiceAfterPublish("?subscription=success"), true);
assert.equal(shouldShowPlanChoiceAfterPublish(""), false);
assert.equal(businessContinuationDestination(free.href, null), free.href);
assert.equal(businessContinuationDestination(free.href, "/business/my-business/offers"),
  "/business/choose-plan?plan=growth&source=offer_published&next=%2Fbusiness%2Fmy-business%2Foffers");
// Reload after publish: never the wizard intro again.
assert.equal(wizardResumeDecision(1), "published");
assert.equal(wizardResumeDecision(0), "wizard");
assert.equal(wizardResumeDecision(null), "wizard");
assert.equal(hasBusinessPlan({ billingStatus: "subscription_trialing" }), true);
assert.equal(hasBusinessPlan({ billingStatus: "free", stripeSubscriptionId: null }), false);
// Draft is cleared on publish success and on resume-after-publish.
const wizard = readFileSync("app/onboarding/for-business/page.tsx", "utf8");
assert.match(wizard, /draftCleared\.current = true;\s*try \{ if \(draftKey\) localStorage\.removeItem\(draftKey\);[^\n]*\n\s*setDraftNote\(null\);/);
assert.match(wizard, /wizardResumeDecision\(count\) !== "published"[\s\S]{0,200}localStorage\.removeItem\(draftKey\)/);
assert.match(readFileSync("app/business/choose-plan/page.tsx", "utf8"), /!shouldShowPlanChoiceAfterPublish\(window\.location\.search\)/);
console.log("Choose-plan routing and draft clear passed");
