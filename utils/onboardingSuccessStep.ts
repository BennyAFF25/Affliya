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
        href: "/business/choose-plan",
      };
}
