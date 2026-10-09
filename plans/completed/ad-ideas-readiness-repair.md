# Ad Ideas readiness repair

**Status:** completed

## Problem
Production Ad Ideas showed `Setup required` for a funded, approved affiliate campaign and prompted the business to connect billing even after setup. Live inspection found two causes:
- `utils/paidCampaignLaunchReadiness.ts` queries `business_activation_subsidies`, but production did not have the compatibility table, causing campaign readiness to collapse to `READINESS_CHECK_FAILED`.
- `app/business/my-business/page.tsx` could treat a browser `localStorage` card flag as authoritative while Ad Ideas/launch checked Stripe server-side.

## Product intent
Keep setup contextual and accurate. Users should see launch blockers only when they are real. This aligns with `docs/VISION.md`, `docs/PRODUCT_PRINCIPLES.md`, and `docs/BUSINESS_RULES.md`: hide infrastructure, minimise unnecessary friction, and keep payment/campaign state dependable.

## Intended behaviour
- Missing optional activation-subsidy storage must not crash campaign funding readiness.
- The compatibility table defaults to A$0 and does not enable the retired automatic A$10 programme.
- Business billing readiness must come from the same server-side Stripe-backed helper used by paid campaign launch.
- No wallet, commission, Meta launch, ad-spend settlement, pricing, or entitlement rules change.

## Existing implementation
- Campaign readiness: `app/api/business/ad-ideas/review-readiness/route.ts` → `utils/paidCampaignLaunchReadiness.ts`.
- Canonical business payment readiness: `utils/businessPaymentReadiness.ts`.
- Business dashboard billing UI: `app/business/my-business/page.tsx`.
- Compatibility storage migration: `supabase/migrations/20261009010100_activation_subsidy_storage_compatibility.sql`.

## Implementation
1. Apply the existing zero-subsidy compatibility migration to production.
2. Route `/api/stripe/check-customer-card` through `getBusinessPaymentReadiness`.
3. Remove the browser `nm_has_card_*` shortcut and re-check the server after SetupIntent completion.
4. Validate schema/RLS, focused billing tests, and the affected campaign readiness data.

## Validation
- Production compatibility table exists with RLS enabled and zero rows immediately after creation.
- Existing James campaign still has A$15 required funding and A$15 canonical wallet credit; affiliate participation is approved.
- Focused billing regression test asserts no browser card cache can mark billing ready and both UI/launch use the shared server helper.
- Supabase security advisors reviewed after the schema change.

## Remaining risk
The commission-billing Stripe customer is intentionally separate from the Growth subscription customer. If the commission customer genuinely has no saved card, Ad Ideas should continue to show billing required; this is expected rather than a readiness bug.
