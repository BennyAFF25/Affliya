# Terms policy navigation fix

Status: in progress. Base: b463313bb3b7cd8365cb6eb855e2bc09d5986346. Founder requested a fix during production testing; existing main-release authorization continues for this repair.

## Verified problem
AcceptTermsModal opens terms/privacy/cookies in a new tab. Those three standalone pages have no navigation. Accept & Continue only updates the authenticated profile's existing terms_accepted fields and calls onAccepted; no code redirect to cookies was found. The exact reported tap/browser behavior remains unverified.

## Product alignment and fix
Follow simplicity/value before setup in docs/VISION.md and PRODUCT_PRINCIPLES.md; preserve consent, legal wording, profile persistence and business review. Reuse the existing policy text in an in-dialog reader with an explicit Back to terms control and constrained scrolling. Reading must not navigate, save acceptance or discard checked state/selected offer/mode. Provide a safe internal return link on standalone policies, honoring an explicit returnTo or same-origin referrer; reject external/recursive destinations and offer a home fallback.

## Scope and validation
No schema, migration, dependency, configuration, legal wording or commercial changes. Localized dark/cyan UI follows the previously inspected canonical Business Overview. Read AGENTS.md, relevant product documents, shared modal/callers, policies, root/provider/theme/affiliate layouts and existing validation configuration. No local terminal/browser is available; GitHub Actions will run browser interactions with mocked data, strict feature types and lint. Browser validation covers all three readers, checkbox/offer/mode continuity, no consent write on reading, failed acceptance/retry, same-origin standalone return and external redirect rejection. Temporary browser tooling is installed only on the runner.

## Delivery
Small fix branch/PR, merge after checks under existing production-test authorization, verify production build, and record remaining limitations. Real auth/production Supabase writes are not part of mocked browser tests.
