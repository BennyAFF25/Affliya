# Business campaign detail visual parity — 12 October 2026
**Status:** Implementing first UI draft on main.

**Problem:** Business campaign detail `app/business/manage-campaigns/[campaignId]/page.tsx` is an ~1,140-line older iPhone-preview/stats/status layout. Affiliate detail now uses one consistent ~370-line `CampaignDetailWorkspace` with neutral #151718 / #101415 surfaces, cyan #00C2CB, responsive summary/metrics/preview/tracking/stats.

**Founder intent:** Make business detail resemble affiliate detail while preserving business-specific variables and decisions. Align with VISION, PRODUCT_PRINCIPLES, PRODUCT, BUSINESS_RULES, UI_DESIGN_SYSTEM; canonical mobile Business Overview. No global navigation or pricing changes.

**Verified behaviour to preserve:** Business campaign access scoped by signed-in business email in `live_ads` or `live_campaigns`; campaign-scoped tracking stats, conversions and revenue; authenticated Meta Insights manual refresh; Meta actor='business' Pause/Resume and organic pause flow with existing confirmation warning (organic does not resume here); permanent business stop lock; Meta currency from business connection. Business affiliate email visible; tracking link readonly if present. No unexpected new actions, billing/Meta spend transfers or mutations.

**Approach:** Move the affiliate detail visual workspace to shared `components/campaigns/CampaignDetailWorkspace.tsx` (no duplicate UI), add a business mode with truthful business KPIs (Meta spend/clicks, Nettmark landing visits, carts, conversions, revenue), header/status/actions, read-only campaign detail, and reuse its creative card and chart shell. Keep both page loaders and action handlers in their respective role-owned page. Replace business legacy JSX with shared component and remove unused UI/icon/chart logic. Do not modify Meta endpoints or finance flows. Preserve affiliate UI byte-for-byte where possible through default 'affiliate' mode.

**Validation:** Review both role paths/source checks; Vercel build status, relevant source-level regression tests. Authenticated browser QA not available in connector environment unless a supported browser interface is exposed. No database migration/config changes.
