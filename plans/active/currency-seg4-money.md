# Currency Segment 4: pure Money primitives and campaign title reuse

Status: in progress. Kept at the explicitly requested active path.

## Problem and product intent
Implement currency-plan C1 exact integer arithmetic and C6 validated construction without integrating any runtime money path. This preserves the commercial model, 220 bps fee policy and current server guards. Also remove duplicate client campaign/submission offer-title queries without changing campaign behaviour. Aligned with VISION, PRODUCT_PRINCIPLES, PRODUCT, BUSINESS_RULES, ARCHITECTURE and MONEY_FLOW; no new product policy or documentation conflict identified.

## Evidence and approach
Registry is a dormant typed mirror with JPY exponent 0. Existing formatAUD prefixes A$. portalData.loadAffiliateSubmissions and Manage Campaigns each load offer titles independently; server pending-paid-proposals already reuses its own batched offers for guards and is excluded from this change. Add an optional title loader to the existing submissions helper so this page combines submission and campaign IDs into one title query. Preserve default behaviour for other callers.

Add frozen Money values, strict exact constructors, mismatch checks, signed half-up basis-point rounding (ties away from zero), deterministic integer allocation/splitting, formatting and validated JSON adapters. Registry membership permits representation, not movement capability. No default currencies, floats or currency conversion. General repository-wide C6 lint/service restrictions remain future integration work.

## Boundaries, risks and success criteria
No DB/external connections, deploy, commit, push, migrations or remote config. No edits to tsconfig.tsbuildinfo, ad-insights or server currency guards. Local main inspected (79cd0a3), HEAD 4bc91e4; no fetch permitted. Money must have no runtime consumers. Allocation must preserve signed totals; unsupported currency/precision and numeric amounts reject. Title query regression uses mocked local clients, no live schema assumptions or DB writes.

## Validation
Pending: money regression suite; campaign batching tests; existing currency tests; nonincremental typecheck compared with baseline; final diff review. TypeScript target es6 requires BigInt() constants rather than bigint literals.

## Implementation and validation results
- Added utils/currency/money.ts and scripts/currency-seg4-money.test.ts; package.json exposes test:currency-seg4-money using node --import tsx (the tsx CLI cannot open its IPC pipe in this sandbox).
- Campaign title reuse changes page.tsx and portalData.ts. Extended pending-proposals-batching.test.ts to use the real submissions loader and assert one client offers query with deduplicated IDs and preserved campaign/proposal titles at 1/11/14/140 offers. Adjusted the existing shared-workspace static assertion for the optional loader argument.
- Money, mocked pending-proposal batching (including existing failure/auth checks), currency Segment 3 registry, currency Segment 1c, and shared campaign workspace tests PASS. No network or DB used; expected mocked failure logs are captured in /tmp/nettmark-batching.txt.
- git diff --check PASS. Source search confirms only the new test imports Money. No files deleted; no DB/migration/remote configuration changes. Only package configuration change is the test command. Prohibited files and server guard semantics unchanged.
- General lint/build not run: focused local tests and nonincremental typecheck are proportionate; a build could invoke unrelated integrations. Registry capability enforcement and broader C6 lint rules remain outside this pure preparatory segment.
- Final nonincremental typecheck exits 2 with exactly 68 pre-existing errors; before/after diagnostics are byte-identical (diff PASS). Logs: /tmp/nettmark-typecheck-{before,after}.txt. No new errors.

Status: completed at the requested active path. No unresolved requirement or new runtime risk identified. Runtime integration and production verification remain separate future work.
