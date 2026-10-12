# Affiliate campaign detail UI unification — 12 Oct 2026
**Status:** In progress

## Problem / evidence
The dynamic affiliate campaign detail page `app/affiliate/dashboard/manage-campaigns/[campaignId]/page.tsx` has 2,314 lines and **two incompatible full-page render paths**: the modern organic-specific branch (`if (isOrganic)`) and a legacy paid-Meta branch. Paid Meta is the founder's current active test, so it appears to have regressed. GitHub history confirms UI polishing in commit `9f5942c` and spend polling in `66b972e`; the organic redesign is still present but not shared with paid campaigns.

## Product intent / approval
Requested: repair the detail UI on `main`, recovering previous design when possible, otherwise redesign. Follows `docs/VISION.md` (low-friction promotion), `docs/PRODUCT_PRINCIPLES.md` (hide infrastructure, expose outcomes), and `docs/UI_DESIGN_SYSTEM.md` (neutral #0f0f0f/#151718/#101415, brand #00C2CB, 20-24px surfaces and mobile-first). Header/sidebar belong to affiliate layout, untouched. Business campaign-detail and other role actions unaffected.

## Existing behaviour to preserve
- Organic loads via authenticated `/api/affiliate/live-campaigns`; paid via existing `live_ads` and approved `ad_ideas` creative fallback; offer, currency and campaign-linked stats continue loading.
- Meta manual Sync spend and affiliate PAUSE/RESUME stay as-is, with business-stop lockout. Current automatic 30-second read-only spend polling must remain.
- Tracking links: prefer stored canonical link, with old fallback. Copy disabled on paused/stopped. Organic email/media preview, organic setup/promote controls and confirmation-gated organic delete retained.
- Campaign-scoped landing visits (unverified), carts, conversions, seven-day trend and estimated commission. Never confuse landing visits with Meta-reported clicks or label provisional commission as paid.
- Existing app role gates, wallet, Stripe and Meta API routes remain unchanged.

## Approach
Move one shared display into a compact, responsive presentational component, with all data loading and callbacks staying in the existing route. Remove both duplicate legacy render paths, unused icons/styles/handlers. Reuse shared MetaMark. Add focused source regression checks ensuring paid/organic parity, actions, labels and automatic refresh. Source path scope: affiliate detail only and new view component/tests; no database migrations or financial writes.

## Validation
Check source + parity assertions and Vercel deployment build on main; authenticated live UI testing requires user's test account. No live Meta control or money changes as part of verification.
