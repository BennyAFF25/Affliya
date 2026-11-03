export type OnboardingSuccessStep = { message: string; buttonLabel: string; href: string };

/** Post-publish next step: subscribed/trialing brands already chose a plan. */
export function onboardingSuccessStep(hasPlan: boolean): OnboardingSuccessStep {
  return hasPlan
    ? {
        message: "Your offer is saved. Next, connect Meta from My Business so affiliates can send paid proposals.",
        buttonLabel: "Go to My Business",
        href: "/business/my-business",
      }
    : {
        message: "Your offer is saved. Continue to choose how affiliates can promote your business.",
        buttonLabel: "Choose your plan",
        href: POST_PUBLISH_CHOOSE_PLAN_HREF,
      };
}

/** Post-publish plan CTA. `source=offer_published` keeps choose-plan on the plan cards instead of auto-continuing. */
export const POST_PUBLISH_CHOOSE_PLAN_HREF = "/business/choose-plan?plan=growth&source=offer_published";

/** True when choose-plan should render plans rather than auto-continue a brand that already chose Free. */
export function shouldShowPlanChoiceAfterPublish(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("source") === "offer_published" || params.has("subscription");
}

/** A brand that already has an offer must not see the first-offer wizard intro again (e.g. after a reload). */
export function wizardResumeDecision(offerCount: number | null): "wizard" | "published" {
  return typeof offerCount === "number" && offerCount > 0 ? "published" : "wizard";
}

export function hasBusinessPlan(entitlement: { stripeSubscriptionId?: string | null; billingStatus?: string | null } | null | undefined): boolean {
  return Boolean(entitlement?.stripeSubscriptionId ||
    ["subscription_active", "subscription_trialing"].includes(entitlement?.billingStatus || ""));
}
