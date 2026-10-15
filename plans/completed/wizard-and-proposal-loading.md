# Wizard and proposal loading
Status: in progress.
Problem: paid setup card appears late; proposal display waits for campaign/title reads.
Product intent: preserve paid promotion and business review rules while making loading stable and bounded, aligned with VISION, PRODUCT_PRINCIPLES, PRODUCT and BUSINESS_RULES. No commercial, authorization, currency or funding change.
Approach: reserve exact card geometry using hidden existing content with a skeleton until offer setup resolves; publish submissions independently, enrich titles later with one shared query; bound auth/submission loading with an eight-second deadline and retain retry/generation guards.
Systems: promotion page, affiliate campaign page, shared workspace, local tests. Pending API inspected only; its readiness/funding/currency behavior stays intact.
Trade-off: titles initially use existing fallback rather than delaying proposals. Actual production latency is unknown; no external or database connections permitted. Local main/history inspected without fetching.
Validation: mocked loading regression, existing related suites, before/after nonincremental typecheck, offline build. No commits/deployment/configuration/migrations.

## Findings and final changes
- promote/[offerId]/page.tsx:1537: unresolved saved setup previously omitted the entire card. Skeleton now overlays invisible full card content in normal flow for identical responsive geometry, retaining space on unknown/error and collapsing only on resolved ready setup. Existing AI draft pattern preserved.
- manage-campaigns/page.tsx:109–124: shared title callback previously awaited both campaign results before submissions returned. Submissions now publish at line 113 without titles; one shared title query enriches later, with its own deadline/fallback.
- ManageCampaignsWorkspace.tsx:348: proposal count previously gated on campaign loading; now depends only on proposal state.
- manage-campaigns/page.tsx:94,133: one batched badge request, already independent, with eight-second HTTP timeout. API pending-paid-proposals/route.ts:17–70 authenticates, reads proposals, then starts entitlement/funding/wallet tasks in parallel and awaits currency readiness. This can delay badges but no longer list/count. No API or readiness semantics changed.
- utils/affiliate/portalData.ts:7–14,27–35: stored paid/organic submission reads are concurrent, paginated sequentially per source with eight-second per-page abort; title read previously unbounded. Overall submission promise and session resolution now each have an eight-second deadline (proposalTimeout.ts:1). Error/retry replaces indefinite loading, while generation guards reject stale publication.
- manage-campaigns/page.tsx:226: post-submit retry now waits for proposals rather than campaigns, avoiding a redundant refresh while proposals remain unresolved. No per-row HTTP requests; unchanged constant three initial fetches.

## Validation results
- Passed paid-promotion-setup-layout test: actual card JSX renders skeleton from unresolved first paint, identical hidden content geometry, positive reveal, definitive negative collapse.
- Passed pending-proposals-batching: stalled campaigns/badges/titles do not block own submissions/count; stalled submissions show alert and retry succeeds; one enrichment request, three initial HTTP requests and one shared title query at 1/11/14/140 cards. Existing mocked API funding/currency/auth failure cases passed.
- Passed trybe-draft-layout, affiliate-campaigns-shared-workspace, currency-seg1b and currency-seg1c.
- business-manage-campaigns-ui fails existing assertion for aria-label="Sort campaigns". Verified label also absent from unchanged HEAD workspace; unrelated UI left intact.
- Nonincremental typecheck before/after: same 68 existing diagnostics, identical after normalizing source positions; no new errors. tsconfig.tsbuildinfo untouched.
- Offline next build compiled successfully; page-data collection failed for /api/affiliate/live-campaigns in this environment. No full build success claimed. Network connections blocked by local preload during build.
- git diff --check passed. React quality checklist reviewed (async independence, functional updates, generation guards, accessible hidden content/status, reduced motion).

Status: completed locally. No DB/external connections, migrations, configuration changes, commits, push or deployment. Protected ad-insights, money and currency guard logic unchanged. Remaining limitations: production latency and rendered pixel layout not browser-verified; existing typecheck/test failures and offline page-collection blocker remain.
