# Business Manage Campaigns desktop/mobile redesign

**Status:** In progress (12 October 2026)

**Problem / evidence:** Current `app/business/manage-campaigns/page.tsx` stacks oversized campaign cards with controls that overflow on desktop, wasting space. The founder supplied a visual mockup with a compact header, KPIs, tabs, search, and structured rows, plus an explicit request for polished mobile rendering.

**Product outcome:** A premium, clear and efficient business management surface consistent with `docs/VISION.md`, `docs/PRODUCT_PRINCIPLES.md` (simplicity, reliable reporting, user control), and the cyan-on-dark `docs/UI_DESIGN_SYSTEM.md`. Business users should be able to locate and control both paid and organic campaigns quickly.

**Existing implementation:** `app/business/manage-campaigns/page.tsx` reads `live_ads`, `live_campaigns`, `affiliate_shop_requests`, and `shop_hits`; business status controls use existing handlers and `/api/meta/control-ad` / `/api/meta/ad-insights`. Sidebar/topbar are provided by `app/business/layout.tsx` and are excluded from scope.

**Approach:** Preserve existing data queries, routes, organic pause, Meta stop, Meta sync, and shop placement data. Replace the large card UI with a content-only presentation component: dense responsive campaign table at desktop widths; stacked mobile campaign cards at small widths; search/sort/status/type filters and honest metrics sourced from the existing records. Show official-style Meta infinity branding, thumbnails when available, and clear no-data states.

**Trade-offs:** Organic clicks/conversions are not currently supplied by the list query: show em dashes rather than inventing counts. Paid clicks come from stored `live_ads.clicks` last Meta sync, not Nettmark landing-page visit telemetry. Avoid adding new backend queries or changing payment/tracking/approval flows. Historic rows remain untouched.

**Risks / scope:** UI only; no campaign launch or billing changes. Verify responsive sizing and action alignment in source; production browser verification may still be required.

**Success criteria:** Desktop row actions never spill from the list; mobile campaign cards fit narrow screens; type filters, search, sorting, and controls work for paid/organic/stopped rows; shop placements remain accessible; the business shell is unchanged.

**Validation:** Review Vercel build, re-open committed page; perform authenticated browser QA separately if no browser connected.
