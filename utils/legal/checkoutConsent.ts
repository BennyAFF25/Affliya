import { PUBLIC_TERMS_URL } from "./version";

/** Off by default: Stripe errors on consent_collection until Ben sets the ToS URL in Stripe → Settings → Public details. */
export function checkoutTosConsentEnabled(value: string | undefined = process.env.CHECKOUT_TOS_CONSENT_ENABLED) {
  return value === "true";
}

type Price = { formatted: string; interval: string; intervalCount: number };

function period(price: Price) {
  return price.intervalCount === 1 ? price.interval : `${price.intervalCount} ${price.interval}s`;
}

/** Stripe Checkout consent_collection + custom_text (03 §4). Each message stays under Stripe's 1,200 character limit. */
export function checkoutTermsConsentParams(params: { trialEligible: boolean; trialDays: number; price: Price }) {
  const perPeriod = `${params.price.formatted}/${period(params.price)}`;
  return {
    consent_collection: { terms_of_service: "required" as const },
    custom_text: {
      terms_of_service_acceptance: {
        message: `I agree to the [Terms of Service](${PUBLIC_TERMS_URL}), including that payments are non-refundable for change of mind, unused time or forgetting to cancel, except where required by the Australian Consumer Law.`,
      },
      submit: {
        message: params.trialEligible
          ? `Free for ${params.trialDays} days, then ${perPeriod} charged automatically until you cancel. Cancel anytime before your trial ends and you won't be charged.`
          : `${perPeriod} charged today and every ${period(params.price)} until you cancel. Cancel anytime; access continues to the end of the paid ${period(params.price)}.`,
      },
    },
  };
}
