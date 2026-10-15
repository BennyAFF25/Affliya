# Currency Segment 3: dormant currency registry

Status: completed (prepared files only; not applied). Retained at the explicitly requested active path.

## Problem, intent and user impact
Prepare the registry foundation specified by /workspace/currency-plan.md Appendix C1/C6 without changing application behaviour. Explicit founder scope preserves AUD-only money containment and recognises eight display currencies; later integration, foreign keys and backfills are excluded. No runtime consumer is added.

## Evidence and alignment
Read AGENTS.md, docs/DATABASE.md, plans/README.md, Segment 2 plan, migration and undo, currency plan C1/C6, utils/currency.ts, package.json and tsconfig.json. Segment 2 adds nullable denomination/provenance only, with no registry membership enforcement. This additive registry aligns with the staged contract; it does not claim currency-safe accounting is implemented. No conflicts identified. Live schema remains unverified. Clean starting worktree; HEAD 57c0e4e, local main 79cd0a3. No fetch under the no-external-connections instruction.

## Approach and success criteria
1. Add transactional registry DDL, eight idempotent seed rows, comments and select-only RLS; prepare separate transactional undo.
2. Add typed seed constants and a pure fail-closed capability helper; leave existing formatters and runtime paths untouched.
3. Document the dormant schema and wire a static contract test into package.json.
4. Run test, compare typecheck diagnostics against baseline with incremental disabled, and review scope and whitespace.

## Risks and boundaries
No existing financial flow, ownership check, amount unit or provider call changes. No foreign keys, backfill, triggers or timestamp automation. Capability flags are preparatory metadata, not active enforcement. No DB/external connections, deploy, commit or push. Do not touch tsconfig.tsbuildinfo or /api/meta/ad-insights. Undo drops registry contents if later executed; neither SQL file is applied here. Existing schema drift and production grants cannot be verified offline.

## Validation
- `npm run test:currency-seg3-registry`: PASS. Exact eight codes, all seeded fields mirrored in TypeScript, AUD-only money flags, display flags, JPY exponent, unknown/prototype codes rejected, schema constraints/defaults/comments, select-only RLS, no existing-table changes and transactional undo.
- `npm run test:currency-seg2-schema`: PASS; prior segment contract preserved.
- `node_modules/.bin/tsc --noEmit --incremental false`: exit 2 before and after with 68 pre-existing errors and byte-identical diagnostics (`diff -u` passes). No new errors. Logs: /tmp/currency-seg3-typecheck-{before,after}.log. Installed TypeScript 5.9.2 and tsx 4.21.0.
- `git diff --check`: PASS; reviewed all seven changed/added files. No files deleted. Prohibited paths unchanged; source search confirms only the test imports the registry.
- SQL not executed and live policies/grants not verified, as required by the no-connection boundary. No DB/external connections, deployments, commits or pushes. Only package configuration change is the local test script; no remote configuration changes.

No unresolved requirement identified. Applying SQL and integrating future consumers require separate work; undo would discard future registry metadata.
