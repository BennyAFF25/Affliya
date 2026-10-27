# Nettmark fixes 4

Status: implemented and reviewed; offline investigation complete with live verification limitations below. Local-only work; no network, DB writes, commit or push.

Problem/outcome: preserve a validated business login destination through required onboarding; restore mobile payout setup visibility; remove harmless blocked/malformed client reads; document payout-seed safety and campaign identity.

Product alignment: follows VISION/PRODUCT_PRINCIPLES reliability and justified friction. Preserve plan choice, launch/billing permissions, commercial behavior and existing mobile visual language. PRODUCT.md describes an older offer-first order; current plan-step-status and choose-plan implement plan-first. Preserve current gates.

Implementation: share the existing business return-path validator; extend the existing authenticated plan-status response with onboarding state; retain required plan choice and carry next through existing continuation pages. Fix mobile layout only. Reuse authenticated dashboard summary for settlement totals and select only granted Meta currency columns. Inspect remaining requests without guessing deployed schema.

Systems/risks: auth routing only (no permission changes); existing server reads remain session/role/owner scoped. Money execution, RLS, SQL and cron behavior are read-only analysis. Live error responses/schema and remote main cannot be checked under no-network constraint; local main is 434474d, clean starting tree.

Validation: offline routing regression, relevant existing tests, requested tsc and changed-file eslint, diff review. Results pending. Findings in /tmp/fixes4.md.

## Implementation and validation evidence
- Shared safe return-path helper, own-profile onboarding status, login/onboarding/plan continuation; existing plan gates and no-next login routing preserved.
- Mobile overview exposes the existing payouts setup card with layout/CSS changes only.
- Payout settlement totals reuse existing authenticated dashboard summary; Meta currency read uses only granted column.
- Findings/complete query inventory, cron/trigger and run-payout analysis, inert visible QA values, affiliate runtime ID contract: /tmp/fixes4.md.
- New offline business-login-next regression passed. Existing onboarding-success-step, business-offer-onboarding-nudge/drafts, business-onboarding-funnel, business-billing-profile, critical-route-auth, money-surface-security passed.
- Existing business-manage-campaigns-ui test fails stale Sort campaigns aria-label assertion in untouched workspace component.
- Requested tsc reports only allowed pre-existing .next cron/fx-rates createFxRatesHandler error. Final changed-file ESLint has 46 pre-existing errors; baseline 47. No new lint errors. Diff check passed.
- No DB/migration/configuration changes, no network, commit/push or deployment. Browser packages unavailable; no runtime 390px screenshot. Reported onboarding/My Business 403s and manage-campaigns 400 require failed request/error details or deployed schema to identify conclusively. No speculative RLS or schema bypass.
