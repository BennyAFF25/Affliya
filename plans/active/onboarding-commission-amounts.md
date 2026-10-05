# Onboarding commission amounts

Status: in progress.

## Problem and product intent
The founder requested dollar commission amounts alongside percentages in affiliate onboarding. The current local commissionLabel in app/onboarding/for-partners/page.tsx hides commission_value whenever commission exists. Clear, truthful economics support early activation (docs/VISION.md and docs/PRODUCT_PRINCIPLES.md) while preserving existing business terms and money flow.

## Existing implementation and boundaries
Reuse utils/affiliate/onboarding.ts and app/api/onboarding/affiliate-offers/route.ts. The authenticated route already selects complete offers and returns an allowlisted DTO. Expose existing price and recurring terms only. app/business/my-business/create-offer/page.tsx derives commission_value from price and percentage; app/onboarding/for-business/page.tsx rounds it to whole units. app/business/my-business/edit-offer/[offerId]/page.tsx can leave that value independent of price. One-time estimates should therefore prefer current price times percentage. app/api/process-conversion/route.ts uses eligible sale value for one-time payouts; recurring payouts use recurring_monthly_commission_value, falling back to commission_value, and recurring_term_months/payout_cycles (default one month), upfront or spread. The existing recurring migration confirms those fields. Live data/schema are unverified; no query-column additions, schema changes, or financial writes are needed.

## Intended behavior and user impact
Both offer cards and selected-brand panels show currency-labelled amounts and retain percentages. One-time amounts are estimates, with their listed-sale basis and eligible-value qualification. Recurring amounts reflect configured monthly values and known term/payment mode; do not imply indefinite monthly income. Missing or malformed monetary context retains percentage/offer terms rather than fabricating amounts. Preserve selection, access, navigation, auth, payouts, and currencies.

## Approach, success criteria, and trade-offs
Add optional DTO fields and a shared display helper; reuse existing card typography and surfaces. Cover stored-value rounding/staleness, currency/missing-data fallbacks, and recurring term/payout semantics. Extend existing browser coverage at 320px, 390px, and desktop to verify both views and retained navigation. No new dependency, migration, approval, attribution, pricing, or configuration change. docs/PRODUCT.md describes older first-party onboarding; current marketplace flow is authoritative for this change.

## Validation and risks
Run existing GitHub Actions regression tests, scoped strict typecheck, integration type diagnostic comparison, lint, and browser checks; inspect Vercel build and production status. Repository cannot be executed locally in this tool environment. Unknown production offer completeness falls back safely; estimates are not guaranteed earnings. Record results before completion. No founder decision needed for this explicitly requested display-only improvement.
