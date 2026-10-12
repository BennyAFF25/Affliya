# Business Dashboard — calm responsive redesign (12 October 2026)

**Status:** In progress

**Problem:** The current 1,403-line `app/business/dashboard/page.tsx` layers large onboarding sections, six stat tiles, two charts, expandable campaign/activity lists, and a payout transaction modal; the founder provided a sleek, simpler desktop mockup and requires credible pending affiliate-funded ad-spend visibility with strong mobile UX.

**Product intent and alignment:** Nettmark VISION and PRODUCT_PRINCIPLES prioritise simplicity, outcome-focused UX, and business control. Follow `docs/UI_DESIGN_SYSTEM.md`: neutral black/charcoal `#0f0f0f`, `#151718`, `#101415`, restrained cyan `#00C2CB`, rounded 20–24px panels, clear 11–24px typography, accessibility. Preserve existing app-wide header/sidebar in `app/business/layout.tsx`; redesign page content only.

**Existing architecture:** `app/api/business/dashboard/summary/route.ts` already authenticates business users and returns accurate campaigns/counts. Current page also directly queries payouts, affiliate requests, onboarding checks and conversion events. Ad spend is represented by `live_ads.spend` and `spend_transferred` (ledger watermark, not Stripe transfer), while actual Stripe transfer state lives in `ad_spend_settlements.status=transfer_succeeded`.

**Implementation:** Enrich the existing summary endpoint (no new route) with business-scoped `spend`, unaccounted spend (`spend-spend_transferred`), queued/ledger-applied settlements and confirmed Stripe transfer totals, plus recent daily affiliate growth counts and resolved public campaign titles/affiliate handles. Keep this read-only and restricted to the authenticated business; never expose private affiliate wallet balances. Replace the oversized page implementation rather than stacking UI; keep links to original campaign controls, inbox, offer creation, and review. UI: one concise header; four-card reconciliation panel; three simple KPI tiles; most recent live campaign; needs-attention links; compact affiliate growth bars; responsive vertical layout on phones.

**Scope / trade-off:** The illustration's fourth 'affiliate wallet remaining' metric would disclose affiliate finances and is not necessary for business reconciliation. Replace it with 'Transferred to business' or 'Wallet accounted' depending on settled data, and distinguish reported Meta spend, unsettled amounts, ledger-applied funds and confirmed transfers. No transfers or wallet writes. Obsolete transaction modal and second sales chart are removed from dashboard; the dedicated payout/campaign screens remain accessible.

**Validation:** Check endpoint ownership and settlement status mapping, source-level regression checks, production deploy/build, and inspect the new code for duplicate data paths. Full browser verification requires authenticated QA. No migrations, billing logic changes, or Meta control changes.
