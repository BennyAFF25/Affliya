# Internal marketing business funnel

## Status
Completed locally on 2026-10-06. User approved implementation and explicitly requested Nettmark dark branding on 2026-10-06. No commit, push, deployment, remote configuration change, or migration is authorised.

## Problem and product intent
The internal marketing dashboard mixes page-view events, signup-cohort milestones and subscription snapshots. The founder wants to follow `/lp/business-demo` visitors through business onboarding, publishing an offer, reaching plan choice and starting a trial. Put these outcomes first, with clear section order and the canonical dark/cyan visual language. This aligns with VISION.md, PRODUCT_PRINCIPLES.md, PRODUCT.md and BUSINESS_RULES.md: value through publishing an offer precedes downstream setup. Preserve onboarding, pricing, billing authority, commercial attribution and payment behaviour.

## Existing implementation and evidence
- `app/internal/marketing/page.client.tsx`, `marketing.module.css`, `dashboard-data.ts`: light/blue dashboard with independent acquisition and activation sections.
- `app/api/marketing-events/route.ts`: allowlisted authenticated reporting, capped reads and explicit source failures; anonymous event ingestion.
- `utils/marketing/logEvent.ts`, `attribution.ts`, `app/components/marketing/MarketingPageTracker.tsx`: best-effort repeated events with source metadata; no stable visitor linkage.
- `app/onboarding/for-business/page.tsx`: direct offer insert, onboarding completion API, then dashboard route. No onboarding analytics calls. Middleware controls post-offer plan gate.
- `app/business/choose-plan/page.tsx`: no handler-level plan events; root-mounted `components/analytics/BusinessProductAnalytics.tsx` records generic plan views/clicks by label. Consolidate these into page handlers to avoid duplicate events and capture successful Free choices. Free success clears gate cookies. Growth endpoint creates checkout; webhook records trial history.
- `app/api/product-events/route.ts`: authenticated actor identity; existing `product_events.meta` supports linkage without schema additions.
- Read-only production schema checks on 2026-10-06 verified relevant fields/types and that existing business funnel event types are permitted. Checked-in August product-event constraints omit business events, unlike the live constraint. Record this drift; do not apply migrations.
- Canonical design inspected in `docs/UI_DESIGN_SYSTEM.md`, `app/business/my-business/page.tsx`, `MobileBusinessOverview.tsx`, `mobile-business.css`, and theme styles. User explicitly approves replacing this internal page's existing light design with dark/cyan.

## Intended behaviour and success criteria
Deduplicate landing visitors by random browser identity; bridge to authenticated business events and verified signup records. Report ordered stages and branches: landing → signup → onboarding → verified onboarding offer → plan screen → Free confirmed or Growth click → server-recorded checkout → trial history. Repeats count once. Do not label clicks as completed trials or generic offers as onboarding offers. Historical/unlinked views remain visible and never become invented unique visitors. Returning accounts and ambiguous shared-browser identities must not inflate new-account conversions.

The selected UTC period selects observed landing visits; follow-up outcomes are evaluated through report generation. Browser identity is an approximation, not a guarantee of distinct humans. Source/campaign filters apply to the whole linked funnel. Show stage timestamps and unresolved tracking gaps, keep broad website/marketplace analytics secondary, preserve accessible errors/empty states/mobile behaviour.

## Approach and affected systems
1. Reuse existing JSON metadata for random browser ID on marketing and authenticated product events. Add missing best-effort onboarding and plan milestone calls using permitted event types; preserve success/failure/redirect paths.
2. Add pure funnel aggregation with chronological linkage, verified offer IDs/ownership, confirmed Free outcomes and entitlement trial timestamps. Reuse existing read-only reporting queries and allowlist; fetch complete pages up to the existing explicit cap rather than relying on the database's default response limit.
3. Add primary funnel, coherent source filters, progress gaps and individual journeys. Apply canonical dark surfaces, cyan accent, rounded panels and responsive stage rows. Put other metrics below.
4. Regression tests, scoped/full type checks as feasible, lint/build and rendered desktop/mobile checks. Update dashboard documentation and this plan.

## Trade-offs and risks
Browser tracking cannot identify cross-device users or blocked/storage-disabled browsers exactly. Historical events cannot be backfilled safely. Sequential measurements can undercount when an intermediate event fails; distinguish missing measurements from abandonment. A browser link is analytics evidence, never authorization or commercial attribution. Use verified saved offers and webhook-maintained trial history for outcomes. Multiple accounts on one browser are attributed to its first eligible new business only; one business links to one browser journey. No new external ad conversion calls; existing onboarding Reddit conversion stays intact. Read-only live schema is verified, but production rendering/instrumentation after deployment remains unverified.

## Validation approach
Planned: regression coverage for repeated visits, source isolation, ordering, missing milestones, pre-existing accounts, offer ownership, failed Free selection, trial timestamps, partial history and empty data; reporting tests, focused TypeScript checks, full typecheck baseline, scoped lint/build, desktop/mobile browser checks where authentication allows.


## Delivered files
- `app/internal/marketing/BusinessFunnel.tsx`: primary headline metrics, ordered funnel, plan branches, source/campaign filters, gaps, source table and business/timestamp drilldowns.
- `app/internal/marketing/page.client.tsx`, `marketing.module.css`, `dashboard-data.ts`: dark/cyan layout, primary report integration and secondary analytics hierarchy.
- `app/api/marketing-events/route.ts`: linked funnel response, capped paginated reads, stable identity tie-break ordering; existing allowlist/authentication retained.
- `utils/marketing/landingFunnel.ts`, `visitor.ts`, `reportRows.ts`, `logEvent.ts`: chronology/ownership checks, browser identity, paginated reads, fresh landing source and browser referrer metadata.
- `utils/productEvents.ts`: browser linkage and a bounded best-effort request; suppress duplicate external onboarding conversion because its existing completion endpoint already records it.
- `app/create-account/page.tsx`, `app/onboarding/for-business/page.tsx`, `app/business/choose-plan/page.tsx`: signup linkage, onboarding step/publication events and handler-level successful plan-choice tracking. Offer identity is generated before the existing insert so no additional browser SELECT/RLS requirement is introduced. The plan profile query now narrows the selected ID type and email.
- `components/analytics/BusinessProductAnalytics.tsx`: retire duplicate global label-based plan events; retain dashboard events.
- `scripts/marketing-funnel.test.ts`: regression coverage for browser/storage behavior, deduplication, deferred signup linkage, source isolation/freshness, order, offer ownership, retries, confirmed Free/trials, legacy coverage and pagination failures/caps.
- `tsconfig.marketing.json`, `.github/workflows/marketing-dashboard.yml`: include the new reporting tests and changed tracking surfaces in focused checks. The existing signup page's unrelated Supabase type errors remain outside the focused check.
- `docs/internal-marketing-dashboard.md`, this completed plan: approved design, exact measurement definitions, schema-history discrepancy and validation evidence.

## Validation results
- Existing marketing reporting regression suite: passed.
- Business funnel regression suite, including final browser identity/storage-denial checks: passed.
- Expanded focused marketing TypeScript check: passed.
- Scoped lint for dashboard/reporting/visitor/product analytics/plan page/new tests: passed with CLI overrides for modern JSX and styled-jsx. The repository's default lint configuration still incorrectly requires React imports on modern JSX; unchanged legacy signup `any` uses and onboarding control-character regex also fail the unmodified lint rules. No repo-wide lint configuration changed.
- Final production build: passed, compiled and generated 126 pages. Build still skips types/lint by repository configuration. An existing build-time Stripe account lookup logged a connection failure; the build completed. No Stripe/configuration changes made.
- Full source TypeScript comparison against HEAD in a separate temporary baseline: 73 baseline errors, 69 current source errors; no new source errors. Four pre-existing plan-page typing errors were removed by the narrow query typing. Generated Next types additionally expose existing issues in the unchanged recurring-commission PATCH route and shop page.
- Browser checks on actual client components with synthetic data and production global CSS: passed at 1440×1000, 390×844 and 768×1024. Verified dark computed styles, no viewport overflow or console errors, source filtering, stage drilldown, email search, coverage, empty/legacy/error states. Preview harness and synthetic screenshots live only in `/private/tmp/nettmark-marketing-preview/`, not the app or committed source.
- Built app access checks: anonymous internal marketing page and reporting GET return 404; unauthenticated product-event POST returns 401.
- Read-only production schema queries confirmed relevant columns and event constraints. No production customer records copied and no database writes/migrations performed.
- Diff whitespace and file scope checks: passed.

## Remaining limits and follow-up
No implementation work remains. No database migration, pricing/payment change, remote configuration change, commit, push or deployment performed. CI and focused TypeScript configuration changed locally as listed above. Fresh visitor linkage begins when these changes are deployed; historical unique-person journeys cannot be reconstructed. Cross-device identity, blocked tracking, lost intermediate events and the explicit 5,000-row report cap remain measurement limits. Production onboarding/checkout with an authenticated account was not exercised; browser checks use clearly synthetic data and do not trigger real signups or payments. Live-versus-checked-in product-event constraint drift and unrelated full-repository type/lint errors remain separate follow-up work.

## Main integration — 6 October 2026

Integrated with the newer trial-first onboarding on main. The primary landing journey uses `landingFunnel`; the existing immutable signup cohort `businessFunnel` and its observation controls remain available. Current onboarding view events, persisted server offer events, confirmed server Free choices, checkout eligibility, and entitlement trial history drive the journey. Existing onboarding retries, checkout verification, live pricing, and signup instrumentation are preserved. Landing-period reads are independent of signup cohort filters. No database, migration, remote configuration, or commercial flow changes were introduced by this integration.

Integration validation: marketing reporting, landing funnel, business onboarding allocation, and business funnel route regression suites passed. Focused marketing TypeScript check and production build passed. Desktop, tablet, mobile, filters, drilldowns, coverage states, and anonymous access browser checks passed using synthetic data. Scoped lint reports only two pre-existing unused API variables (`publishedByEvent`, `growthActivatedByEvent`); the changed components and helpers pass. Authenticated production checkout was not exercised. Merge/push to main explicitly authorised by the user.
