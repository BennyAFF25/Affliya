# Terms policy navigation fix

Status: completed. Base: b463313bb3b7cd8365cb6eb855e2bc09d5986346. Founder requested a fix during production testing; existing main-release authorization continues for this repair.

## Verified problem
AcceptTermsModal opens terms/privacy/cookies in a new tab. Those three standalone pages have no navigation. Accept & Continue only updates the authenticated profile's existing terms_accepted fields and calls onAccepted; no code redirect to cookies was found. The exact reported tap/browser behavior remains unverified.

## Product alignment and fix
Follow simplicity/value before setup in docs/VISION.md and PRODUCT_PRINCIPLES.md; preserve consent, legal wording, profile persistence and business review. Reuse the existing policy text in an in-dialog reader with an explicit Back to terms control and constrained scrolling. Reading must not navigate, save acceptance or discard checked state/selected offer/mode. Provide a safe internal return link on standalone policies, honoring an explicit returnTo or same-origin referrer; reject external/recursive destinations and offer a home fallback.

## Scope and validation
No schema, migration, dependency, configuration, legal wording or commercial changes. Localized dark/cyan UI follows the previously inspected canonical Business Overview. Read AGENTS.md, relevant product documents, shared modal/callers, policies, root/provider/theme/affiliate layouts and existing validation configuration. No local terminal/browser is available; GitHub Actions will run browser interactions with mocked data, strict feature types and lint. Browser validation covers all three readers, checkbox/offer/mode continuity, no consent write on reading, failed acceptance/retry, same-origin standalone return and external redirect rejection. Temporary browser tooling is installed only on the runner.

## Validation and changed files
Validated code: 56f2db573bf61284a14f019fe277f97094d66d33. GitHub Actions https://github.com/BennyAFF25/Affliya/actions/runs/37102752917 passed destination/wording checks, strict TypeScript, lint and mobile Chromium browser interactions. Vercel preview build passed. Browser fixture checks all three in-place readers, a visible return control at 390x650, preserved checkbox/offer/paid mode, no acceptance writes from reading, failed save/retry, unchanged URL after accepting, explicit standalone return and external redirect rejection. The initial browser assertion treated Headless UI's zero-height root wrapper as the visible surface; fixed the test to wait for actual visible headings and removal after acceptance. No app change was needed for that assertion.
Files: AcceptTermsModal.tsx supplies the reader and retryable explicit acceptance; components/legal/LegalPolicyContent.tsx shares unchanged document content; components/legal/LegalPolicyNavigation.tsx and utils/legal/navigation.ts supply safe return links; the three existing policy pages reuse these components. scripts/legal-navigation.test.ts, scripts/legal-navigation.browser.cjs, tsconfig.legal-navigation.json and .github/workflows/legal-navigation.yml validate this repair. This plan moved from active to completed.

## Delivery
PR: https://github.com/BennyAFF25/Affliya/pull/11. Merge to main under existing founder release authorization, then verify production build. No migration, application dependency, legal wording, remote configuration or approval-authority changes. Actual production Supabase persistence and the founder's original device/tap sequence were not reproduced; browser tests mock identity/data and verify the user interaction and persistence request shape.
