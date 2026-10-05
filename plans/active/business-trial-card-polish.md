# Business trial card polish

## Status
In progress.

## Problem and product intent
Founder supplied an explicit visual reference for a cleaner trial continuation card and requested "$0 Today" instead of "AUD $0 Today". Align with docs/VISION.md, docs/PRODUCT_PRINCIPLES.md and docs/UI_DESIGN_SYSTEM.md: outcome-first mobile onboarding, premium dark surfaces, cyan actions, one obvious trial continuation and accessible Free choice. Founder approval for this specific visual treatment is explicit. No commercial or approval rules change.

## Existing implementation and scope
components/business/BusinessTrialFirstContinuation.tsx renders the trial-first screen at app/business/choose-plan/page.tsx. Keep callbacks, checkout eligibility/disabled states, errors/retry, funnel data attribute, private-offer context and verified price/trial duration. Inspect canonical app/business/my-business/{page.tsx,MobileBusinessOverview.tsx,mobile-business.css} and app/globals.css. Preserve actual Meta billing/reimbursement explanation in an accessible disclosure, not an unsupported claim of zero financial risk. Existing paid launch readiness remains unchanged.

## Approach
Restyle only the trial card: stronger heading, compact icon benefit rows, subtle cyan nested surface, prominent "$0 Today", dynamic recurring price and clear automatic billing/card/cancellation/tax terms, pill primary/secondary actions. Use current cyan and dark palette/system font and 24px/19px card shapes. No header, legacy pricing screen, affiliate, Stripe, CAPI, database, migration or environment changes.

## Validation
Use existing business-trial-first CI: strict focused typecheck, lint, billing/route regressions and actual 320px/390px/desktop browser checks with screenshot. Extend the existing browser assertions only for the intended visible copy, preserved disclosure and readable buttons. No new test architecture. Review diff and deploy after checks.

## Success criteria and risks
Reference layout/copy achieved at mobile and desktop without horizontal scrolling; clear prices/trial/Free action and preserved checkout behaviour. Real subscription prices remain runtime data, not the screenshot's illustrative $49. Ensure current theme selectors do not override icon/button foregrounds. No pricing or billing changes.

## Rollback
Revert the isolated component styling/copy commit. No database/configuration rollback required.
