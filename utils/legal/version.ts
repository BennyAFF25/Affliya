/**
 * Fixed legal version used on the Terms page, in acceptance records and in
 * Stripe metadata. Bump TERMS_VERSION (and the published date) whenever the
 * Terms change materially; AcceptTermsModal then asks every user to accept again.
 *
 * The v2 Terms (clause 7: Subscriptions, Free Trials, Cancellation and Refunds)
 * are a DRAFT pending Australian legal review. Everything that depends on them
 * stays behind NEXT_PUBLIC_TERMS_V2_ENABLED, which is off by default.
 */
export const TERMS_VERSION = "terms-2026-12-v2";
/** Publish date shown as "Last updated". Set to the real publish date before turning the flag on in production. */
export const TERMS_PUBLISHED_AT = "2026-12-01";
export const TERMS_PUBLISHED_LABEL = "1 December 2026";
export const TERMS_URL_PATH = "/legal/privacy/terms-of-service";
export const PUBLIC_TERMS_URL = "https://www.nettmark.com/legal/privacy/terms-of-service";

/**
 * Literal process.env access so Next.js inlines the value in client bundles.
 * Pass a value explicitly in tests.
 */
export function termsV2Enabled(value: string | undefined = process.env.NEXT_PUBLIC_TERMS_V2_ENABLED) {
  return value === "true";
}

/** True when a profile has accepted the Terms that are currently in force. */
export function termsAcceptanceCurrent(
  profile: { terms_accepted?: boolean | null; terms_version?: string | null } | null | undefined,
  v2 = termsV2Enabled(),
) {
  if (profile?.terms_accepted !== true) return false;
  return v2 ? profile.terms_version === TERMS_VERSION : true;
}

/** Profile columns to select for the terms check. terms_version exists only after the legal_acceptances migration. */
export function termsProfileColumns(v2 = termsV2Enabled()) {
  return v2 ? "terms_accepted, terms_version" : "terms_accepted";
}
