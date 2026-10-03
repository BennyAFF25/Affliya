# Affiliate onboarding: make the next action obvious

Status: in progress.

## Problem and intended outcome
The founder reports selecting an offer leaves the next action hidden below the entire marketplace list. Current app/onboarding/for-partners/page.tsx confirms the selection panel is appended after all filtered offers. Selection should immediately reveal what happens next without searching or scrolling.

## Product alignment and authorization
The founder's specific direction is to make offer selection and the next step intuitive. This continues the authorized onboarding V1 production repair (user authorized main merges for testing). docs/VISION.md, docs/PRODUCT_PRINCIPLES.md sections 3, 9 and 15 support early value, justified friction and one relevant next action. Use docs/UI_DESIGN_SYSTEM.md and the canonical MobileBusinessOverview.tsx/mobile-business.css/page.tsx: dark cards, cyan pill CTA, focused panel with back action.
Participation authority, financial risk, offer availability, organic creative approval and paid-launch safeguards remain governed by existing endpoints (docs/BUSINESS_RULES.md). No automatic participation upon selection, publishing or funding.
The earlier suggestion to replace the terms modal is a separate proposal; this change preserves consent behavior.

## Existing systems and documentation discrepancy
Reuse offer DTO, affiliateOnboardingPath, isApproved, /api/onboarding/affiliate-offers, /api/affiliate/offers/[offerId]/start, /api/profile/onboarding-complete and existing Promote destination.
docs/PRODUCT.md describes the retired first-party programme onboarding; current page uses marketplace V1. Current code is authoritative for this repair.
No schema, API, migration, auth or remote configuration changes needed.

## Intended behavior and success criteria
- Browse offers with an explicit Choose brand affordance.
- Selection replaces the grid with one focused brand screen; heading receives focus and viewport returns to top.
- Organic remains default; explicit paid entry intent is retained.
- Clear Create my promotion or Request access action fixed within the viewport with safe-area padding and enough body space.
- Back allows another selection and retains search; URL intent survives refresh/navigation.
- Pending requests show a waiting state with Choose another brand; no duplicate request.
- Existing acceptance and completion failures remain retryable. No participation writes from selecting or changing mode.

## Approach
Update the current page only. Extend browser coverage with large lists, small screens, keyboard focus, query intent, back navigation, pending approvals and failed-start retry. Adapt existing policy browser assertions for the focused selected screen. Reuse existing scoped typecheck, lint and regression workflow; add a mobile browser job.

## Trade-offs and risks
Focused selection requires an explicit back action to compare offers but removes competing choices around the next step. It does not promise activation gains without measurement. Live Supabase behavior and original device are unverified; browser fixtures validate UI and API contracts, not production database state. Footer and content must not overlap on small viewports. Existing Promote remains the editor rather than duplicating it.

## Validation
Planned: existing affiliate regression tests, scoped strict types and lint, existing policy browser regression, actual Chromium at mobile/small-mobile/desktop sizes; Vercel build. Record results before completion.
