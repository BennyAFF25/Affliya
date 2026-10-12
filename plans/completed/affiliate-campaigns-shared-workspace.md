# Affiliate campaign management parity with business UI — 12 October 2026

**Status:** First draft implemented on main; authenticated visual QA pending.

## Goal and product alignment
Founder wants the affiliate Manage Campaigns page to match the existing business Manage Campaigns desktop/mobile UI while keeping affiliate-specific metrics, actions and pending proposals. Follow docs/VISION.md, docs/PRODUCT_PRINCIPLES.md, docs/PRODUCT.md, docs/BUSINESS_RULES.md and docs/UI_DESIGN_SYSTEM.md; existing business workspace is the visual baseline. Same dark neutral surfaces (#0F0F0F, #151718, #101415), cyan #00C2CB and Meta blue mark. Less to learn when switching roles.

## Verified current behaviour
- Business page uses components/business/ManageCampaignsWorkspace.tsx with responsive grid, filters, Meta icons, Search/Sort, shop placements, View / Stop Meta / Pause Organic and manual Sync.
- Affiliate page app/affiliate/dashboard/manage-campaigns/page.tsx is a separate 764-line implementation with oversized cards; loads affiliate-owned live_ads via loadAffiliatePaidCampaigns, organic via /api/affiliate/live-campaigns, pending paid/organic proposals via loadAffiliateSubmissions and /api/affiliate/pending-paid-proposals; view detail links and manual Sync spend. Read-only auto-refreshes stored paid metrics every 30s while tab is visible.
- Existing affiliate controls do **not** expose business Stop Meta or Pause Organic on list; do not grant them by copying business controls. Preserve submitted-proposal success and funding-state messages.
- Affiliate paid query presently provides only stored spend/watermark, not Meta clicks or conversion totals. Do not invent numbers.

## Implementation
1. Extend the existing business workspace with a typed `audience` prop, affiliate metrics (pending proposals, unsettled spend), optional proposal section and display-name fields. Reuse its actual responsive campaign rows, filters, search, sorting and Meta icon.
2. Preserve business defaults and existing business controls. Affiliate primary navigation points to existing affiliate detail route, dashboard and marketplace; on affiliate rows only Sync spend and View campaign; no business Stop/Pause buttons. Affiliate pending proposals remain accessible with funding guidance.
3. Replace affiliate's old cards with one call to the shared workspace. Retain existing load/filter/auto-refresh and send logic but remove old presentation components and redundant status transforms. Map affiliate campaign data into the shared campaign type using only real fields; use offer/proposal labels without exposing emails.
4. Add meaningful source regression checks for both roles, mobile parity, permission/action differences, pending proposal review and read-only spend refresh.

## Validation and scope
Review actual main source and documents, inspect exact resulting diff, run available tests and Vercel production build; report any manual authenticated browser QA outstanding. No production migrations, Meta budget/stop changes, wallet movement, billing or external ad calls beyond existing manual Sync action. Do not change app-wide sidebars/topbars or business metrics.

## Completed implementation and verification (12 October 2026)
- Extended the existing `components/business/ManageCampaignsWorkspace.tsx` with discriminated business/affiliate role props; preserves business shop placements, Stop Meta, Pause Organic and original routes. Affiliate list gets the same desktop table, mobile cards, metrics, filters/search/sort and Meta icons, but only shows permitted View and manual Sync controls.
- Replaced affiliate page's duplicate active/archived card layouts (764 → 439 lines) with the shared workspace. Pending paid/organic proposal funding guidance, success confirmation, retry behaviour, and 30-second read-only Meta spend refresh are retained. Affiliate-specific KPI cards include pending proposals and the wallet-unsettled spend estimate; unavailable proposal counts do not show false zero.
- Expanded `loadAffiliatePaidCampaigns` query to read existing `ad_idea_id`, `caption`, recorded Meta clicks/conversions and tracking links. Existing affiliate submission data enriches paid campaign headlines/previews; no fabricated metrics.
- Refined the pending proposal rows to the same charcoal/cyan visual language and removed the stale `shortDate` helper reference.
- Added `scripts/affiliate-campaigns-shared-workspace.test.ts`, registered `test:affiliate-campaign-workspace` and updated legacy business source regression for the pre-existing shared MetaMark icon. Source-level verification checked identical layout, route integrity, action permission differences, review state retention and read-only polling; checks passed. Dedicated tsx test script and authenticated desktop/mobile browser QA not independently executed; Vercel production build READY for last application-code commit `7a735cc231ba6a372c0cb1913131e81ea09c611c` (intermediate incomplete refactor builds failed, fixed before completion).
- No production database changes/migrations, Stripe, wallet, payout, budget, campaign state, sidebar or topbar changes.
