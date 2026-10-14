# Campaign spend formatting and readiness performance

Status: in progress.

Problem: Manage Campaigns uses ambiguous AUD symbols; 14 proposal badges reportedly take six seconds. Inspection shows one UI request to pending-paid-proposals and Promise.all on the server already; completed-value entitlement caching races and wallet reads repeat per proposal.

Product intent/user impact: clearer AUD amounts and faster advisory badges, aligned with VISION, PRODUCT_PRINCIPLES, PRODUCT and BUSINESS_RULES. Preserve all funding, ownership, launch and loading behaviour; no commercial changes. Read ARCHITECTURE, DATABASE, MONEY_FLOW and related round-4 plan. No documentation conflict found in affected behaviour. Live latency and schema remain unverified.

Approach: extract Wallet's existing AUD presentation into utils/currency.ts; use it in Wallet and shared campaign workspace. Cache in-flight entitlement and funding promises per request, share one canonical wallet snapshot across cards, run funding alongside entitlement. Identical offer/budget funding checks share results; differing budgets retain individual calculations. Reuse existing owned pending-proposal query and response, with no new endpoint/auth changes.

Success criteria: A$12.47 tiles, one enrichment request for all cards, concurrent unique lookups, 14-card deduplication regression, unchanged Checking status… and failure states.

Trade-offs/risks: request-local snapshot slightly reduces timing variation across cards; never persists or reserves funding. Unique offers still need their own funding reads. All direct launch checks continue independently revalidating. No database/schema/config/migration changes, Meta/Stripe calls, deployment or commits. Local main is older than working branch; no upstream network access under hard rules.

Validation: compare baseline/final typecheck (--incremental false) and lint; mocked batching/auth/error and existing tests; build with dummy credentials and external network blocked. Do not modify tsconfig.tsbuildinfo. Production latency requires human measurement.

## Final implementation and validation
Status: completed locally; production latency remains a human review item.

Changed files:
- `utils/currency.ts`, `app/affiliate/wallet/page.tsx`, `components/business/ManageCampaignsWorkspace.tsx`: extract existing Wallet AUD formatting and reuse for campaign metrics/header. Non-AUD formatting preserved.
- `app/api/affiliate/pending-paid-proposals/route.ts`: request-local in-flight caches, one shared canonical wallet snapshot, entitlement and funding started concurrently. Auth and affiliate-owned pending query unchanged; response/state/timing/Meta cleanup precedence unchanged.
- `utils/paidCampaignLaunchReadiness.ts`: optional server-provided wallet snapshot for advisory batches. Other callers continue loading/revalidating normally. No funding amount or ledger policy change.
- `scripts/pending-proposals-batching.test.ts`, `scripts/affiliate-wallet-ui.test.ts`, `scripts/test-user-findings-round-4-ui.test.ts`, `package.json`: 14-card auth/filter/dedup/concurrency/isolation/failure regression, shared AUD assertions and rendered spend tiles; existing loading render test retained. New package test command.
- This plan moved to completed. No files deleted.

Results:
- All 34 package test commands executed with fetch/http/https/TCP blocked (local IPC permitted for tsx). Final: 26 PASS, 8 FAIL. All eight failures reproduced in a clean HEAD archive using the same installed dependencies: missing `sa-rental-validation.test.ts`; stale assertions in business-subscription-gate, connect-meta-asset-mapping, ad-ideas-review-ui, tracking-metrics, business-manage-campaigns-ui, inbox-conversations, signup-provisioning. No newly failing suites. Wallet test's implementation-specific assertion updated for the shared formatter and passes; immutable financial handler signatures remain intact. Final round-4 suite re-run after strengthening both tile assertions: PASS.
- New batching suite PASS: 14 proposals => one entitlement lookup, one wallet snapshot, three distinct offer/budget funding checks; distinct budgets retain correct amounts; second request re-evaluates; failed funding/entitlements preserve fallback states; no admin reads when unauthenticated. UI retains one enrichment fetch and loading state.
- Typecheck `npm run typecheck -- --incremental false`: 70 existing diagnostics, identical normalized diagnostic multiset to baseline, zero added/removed. Ran final after build to avoid transient generated-type removal during build.
- Lint `npm run lint`: existing 2,995 errors and three warnings, identical normalized diagnostic multiset to baseline, zero added/removed. Targeted shared formatter/new batching/Wallet tests lint PASS (existing React settings warning).
- Build `npm run build`: PASS with telemetry disabled, dummy Supabase/Stripe initialization values and outbound network blocked. Initial attempts identified missing server Supabase URL and Stripe-app secret; no real credential/API access. Existing build skips type/lint, so separate diagnostics above apply.
- `git diff --check`: PASS. `tsconfig.tsbuildinfo` and `app/api/meta/ad-insights/route.ts` unchanged. No commits, pushes, deployments, migrations, external API execution, spending or Meta/Stripe writes. No DB/schema or runtime configuration changes.

Human follow-up: actual six-second production latency is unverified; after a separately authorised release measure endpoint duration for existing 14 proposals. Check explicit A$ tiles against Wallet, one readiness request per page load, Checking status… under throttling, resolved/failure states and unchanged filters/mobile wrapping. Do not launch/resume/top-up/sync during these read-only checks. Existing type/lint/test debt listed above remains outside this change; no other new risk identified.
