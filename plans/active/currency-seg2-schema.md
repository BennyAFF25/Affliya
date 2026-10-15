# Currency Segment 2: additive money-record schema

Status: completed (prepared files only; not applied). Retained at this active path as explicitly requested.

## Problem and product intent
Money records lack durable denomination/provenance. The founder requests only nullable schema preparation under /workspace/currency-plan.md Appendix C1, C5 and C6, with no application behaviour change. This preserves commercial behaviour and prepares evidence-based later currency recording without inventing historical AUD values. Registry, minor-unit conversion, enforcement and backfills remain future work.

## Evidence and boundaries
Read AGENTS.md, docs/DATABASE.md, docs/MONEY_FLOW.md, plans/README.md and the currency plan C1/C5/C6; inspected existing Segment 1 plan, refund migration and rollback, package scripts and tsconfig. Founder-supplied verified production facts establish the ten tables have neither column and no functions insert positional VALUES into them. No database or external API access is permitted or performed. Local main is 79cd0a3; HEAD is fbd7f61; no remote fetch. No existing working changes.

Existing ledgers and money routes remain untouched. Local migrations are incremental rather than authoritative complete DDL (docs/DATABASE.md); supplied production facts are the scope evidence. No conflicting requirement identified.

## Intended behaviour and success criteria
Each of the ten specified public tables gets nullable text currency and currency_source, without defaults. Currency accepts NULL or three uppercase ASCII letters; source accepts NULL, verified, inferred or unresolved. Constraints are named per table and guarded by pg_constraint including relation identity. Comments explain denomination, missing values and future writers. Existing data is not rewritten. No user-visible change.

## Approach and affected systems
1. Prepare transactional, idempotent forward SQL in supabase/migrations.
2. Prepare transactional undo in supabase/undo, outside the migrations tree, matching the repository practice of separate rollback directories. This avoids relying on CLI recursive-discovery behaviour; no CLI or external documentation call is required.
3. Document columns and add a local static SQL contract test wired into package.json.
4. Run static test, compare typecheck against pre-change baseline with incremental disabled, and inspect final diff/prohibited paths.

## Risks and trade-offs
Format validation is not ISO registry membership or money-movement enforcement. NULL intentionally remains valid pending future segments; no blanket AUD backfill or permissive default. Existing consumers continue to omit these columns. Constraints scan existing rows when applied; no production application is authorised. Undo removes the new metadata, so any future populated values would be lost; prepare only, do not execute. No functions, RLS, indexes, amount units, authentication, runtime code or remote configuration change.

## Validation
- `npm run test:currency-seg2-schema`: PASS. Covers the exact ten tables, 20 nullable columns without defaults, 20 relation-scoped idempotency guards and CHECK expressions, column comments, transactional boundaries, forbidden data writes and complete undo. Initial direct tsx CLI attempt failed on sandbox IPC (`listen EPERM`); package wiring uses `node --import tsx` and passes.
- `node_modules/.bin/tsc --noEmit --incremental false`: exit 2 before and after, with 68 existing errors and byte-identical diagnostics (`diff -u` passed). No new errors, including in the new test. Baselines are /tmp/currency-seg2-typecheck-{before,after}.log. Incremental disabled to avoid touching tsconfig.tsbuildinfo.
- `git diff --check`: PASS. Reviewed migration/undo, documentation, test and package diff; only the six requested files changed/added, none deleted. tsconfig.tsbuildinfo and /api/meta/ad-insights unchanged.
- No SQL execution or database-backed integration tests, consistent with the explicit restriction. No commits, pushes, deployments, database operations or external API calls. Package configuration changes only add the test script; no remote configuration changes.

Remaining follow-up: separately authorised application of prepared SQL and evidence-based currency population belong to later work. No unresolved requirement for this segment. Undo would discard future populated metadata; neither script has been applied.
