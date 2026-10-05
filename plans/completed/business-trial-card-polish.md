# Business trial card polish

## Status
Completed UI implementation and validation. Release through PR #18.

## Problem and product intent
Founder supplied an explicit visual reference for a cleaner trial continuation card and requested "$0 Today" instead of "AUD $0 Today". Align with docs/VISION.md, docs/PRODUCT_PRINCIPLES.md and docs/UI_DESIGN_SYSTEM.md: outcome-first mobile onboarding, premium dark surfaces, cyan actions, one obvious trial continuation and accessible Free choice. Founder approval for this specific visual treatment is explicit. No commercial or approval rules change.

## Existing implementation and scope
components/business/BusinessTrialFirstContinuation.tsx renders the trial-first screen at app/business/choose-plan/page.tsx. Keep callbacks, checkout eligibility/disabled states, errors/retry, funnel data attribute, private-offer context and verified price/trial duration. Inspect canonical app/business/my-business/{page.tsx,MobileBusinessOverview.tsx,mobile-business.css} and app/globals.css. Preserve actual Meta billing/reimbursement explanation in an accessible disclosure, not an unsupported claim of zero financial risk. Existing paid launch readiness remains unchanged.

## Approach
Restyle only the trial card: stronger heading, compact icon benefit rows, subtle cyan nested surface, prominent "$0 Today", dynamic recurring price and clear automatic billing/card/cancellation/tax terms, pill primary/secondary actions. Use current cyan and dark palette/system font and 24px/19px card shapes. No header, legacy pricing screen, affiliate, Stripe, CAPI, database, migration or environment changes.

## Validation
Passed on 4cd3ada0b424cb555fe88f4bf24ee5e1a3ceb688 in Business trial-first workflow 37287057532: strict focused typecheck, lint, no new integration diagnostics, business billing/ownership/checkout/entitlement/marketing regressions and actual 320px/390px/1280px browser checks. Verified "$0 Today", benefit copy, visible billing/card/cancellation terms, expandable funding explanation, Free action, checkout failures and disabled pricing states; no horizontal scrolling. Mobile screenshot captured in CI. Vercel preview build passed. No genuine Stripe checkout performed; billing handlers and configuration were untouched. Final scope: component styling/copy, existing browser assertions and this plan. No database, migration or environment changes.

## Success criteria and risks
Reference layout/copy achieved at mobile and desktop without horizontal scrolling; clear prices/trial/Free action and preserved checkout behaviour. Real subscription prices remain runtime data, not the screenshot's illustrative $49. Ensure current theme selectors do not override icon/button foregrounds. No pricing or billing changes.

## Rollback
Revert the isolated component styling/copy commit. No database/configuration rollback required.
