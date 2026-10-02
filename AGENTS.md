# AGENTS.md — Nettmark

## Project and verified stack

This repository is Nettmark. The package manifest retains the name `falconx`; do not infer product architecture from that name.

- Next.js App Router with React and TypeScript; pages, layouts, and API route handlers live under `app/`.
- Shared UI and utilities live in `components/`, `app/components/`, `utils/`, `lib/`, and `context/`.
- Tailwind CSS and PostCSS support styling.
- Supabase client integrations are in `utils/supabase/`; SQL migrations and rollback scripts are in `supabase/`.
- Stripe server and browser SDKs support existing payment integrations. Meta API integrations have routes under `app/api/meta/` and helpers under `utils/meta/`.
- Yarn has a checked-in lockfile. Validation scripts are defined in `package.json`, with TypeScript tests under `scripts/`.
- Vercel configuration is in `vercel.json`; GitHub Actions workflows are under `.github/workflows/`.

Verify relevant files and installed versions before making decisions. A dependency declaration alone does not establish how a feature works.

## Inspect before changing

Read the existing implementation, callers, related utilities, tests, configuration, and relevant documentation before editing. Check Git status and preserve unrelated work.

Prefer extending existing systems over creating duplicate implementations. Search for existing routes, helpers, components, and business rules before adding new ones. Keep changes focused on the requested outcome.

Use current code as evidence of behavior. Treat historical reports and schema snapshots as context that may be outdated; explicitly identify anything that cannot be verified.

## Database and high-risk flows

Never guess database schema. Verify table and column names, types, constraints, relationships, functions, triggers, and row-level security policies from migrations and authoritative schema evidence. When current database state matters, obtain authorized read-only evidence or ask for the missing information before making a dependent change.

Treat payments, Stripe, wallets, commissions, attribution, Meta APIs, authentication, and database migrations as high-risk.

Before changing a high-risk flow, trace it end to end: the initiating UI or external event, API route, authentication and authorization, shared business logic, database reads and writes, external API calls, webhooks or background processing, and the final user-visible result, as applicable. Inspect retries, idempotency, failure handling, and existing tests. Document the verified behavior and the intended change; resolve material uncertainties before editing.

For money flows, verify amount units, ownership, ledger effects, commission calculations, and reconciliation behavior. For attribution, verify identity propagation and conversion linkage. For authentication and Meta integrations, verify permissions, token handling, and access boundaries. For migrations, verify existing data compatibility, rollout order, and rollback or recovery strategy.

Do not expose secrets or weaken authorization to make a flow work. Do not apply database migrations or change remote configuration without explicit instruction.

## Validation

After changes, run testing and validation appropriate to the affected behavior. Inspect `package.json` and existing tests to choose relevant commands; do not assume every declared command is functional or every referenced test file exists.

For application changes, use relevant tests, type checking, linting, and build checks as appropriate. Add or update meaningful regression coverage when behavior changes warrant it. High-risk changes must validate relevant failure, retry, authorization, and consistency cases.

For documentation-only or repository housekeeping changes, validate the diff, references, and file scope. Report checks that failed or could not run and why. The Next.js configuration skips type and lint failures during builds, so a successful build alone does not establish those checks passed.

## Delivery and completion

Do not push or deploy unless explicitly instructed. Do not commit unless instructed. Keep credentials and private data out of logs and commits.

Finish each task with a completion summary listing:

- Files changed or deleted and the purpose of the changes.
- Database, migration, and configuration changes, or explicitly state none.
- Tests and validation performed, including results and any checks not run.
- Remaining risks, unresolved questions, and follow-up work, or explicitly state none identified.
