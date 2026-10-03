# Affiliate onboarding: make the next action obvious

Status: completed.

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
Validated code/test head: d31320eb94f76bbc1b2a991950fea693859a412a.
- Affiliate checks passed: https://github.com/BennyAFF25/Affliya/actions/runs/37106058329 (job 111154694533).
- Existing affiliate/approval/AI regressions passed; strict scoped typecheck and lint passed.
- Existing integration comparison: baseline 9 diagnostics, current 9, new 0. This is not a clean full-repository typecheck claim.
- Actual Chromium passed at 390x650, 320x568 and 1280x800 with 26 offers: selecting last card, focus, viewport-visible fixed CTA, final content unobscured, back and retained search, paid intent and reload, failed start, failed completion/retry, pending requests, server-authoritative approval and requested editor handoff.
- Existing policy reader, failed-acceptance retry and standalone return checks passed in both workflows. Separate workflow: https://github.com/BennyAFF25/Affliya/actions/runs/37106058338.
- Vercel preview build passed. Screenshot artifact affiliate-next-step-mobile.png.
- Browser fixtures mock authentication/data and stop at the editor route request; live database writes and full production Promote editor are not exercised. Policy acceptance behavior and wording were preserved.
- Early browser runs found test selector and router-timing/handoff isolation issues; fixed in the test harness. Application code was unchanged during those corrections.

Files: app/onboarding/for-partners/page.tsx (focused selection, CTA, back/focus/query continuity); scripts/affiliate-onboarding.browser.cjs (interaction regression); scripts/legal-navigation.browser.cjs (selected-screen assertions); .github/workflows/affiliate-onboarding.yml (browser checks and artifacts); this completed plan.
No database/schema/migrations/package dependencies or remote configuration changes.
Remaining follow-up: founder production usability test and activation measurement; replacement of the terms modal remains a separate proposal. No implementation blockers remain.
