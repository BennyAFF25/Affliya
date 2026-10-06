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

## Operating model

These rules apply to Nettmark development unless explicit current founder instructions override them within the requested scope.

### Ship-first autonomy

A clear request to implement a normal product, UI, UX, engineering, or repository change authorises editing files, running proportionate checks, committing, and pushing to the current working branch or `main` where appropriate. Do not require separate commit or push instructions or intermediate approval for routine implementation steps. A review or proposal request alone does not authorise implementation.

Complete the requested work and report the result. Use the [approval boundaries](#approval-boundaries) only for unresolved requirements or new material risks outside the authorised scope. Never force-push or destructively rewrite Git history.

### Preserve existing product behaviour

Use the current repository as evidence of implemented behaviour. Do not reconstruct code from old chat history, stale branches, or memory. Explicit current founder instructions govern the requested change.

Before editing, inspect Git status and the latest `main`, preserve unrelated working changes, and base new work on current code. Integrate upstream changes safely without discarding authorised in-progress work. Read the existing implementation, callers, utilities, tests, configuration, and applicable documentation. Inspect recent Git history when the affected area has changed recently.

Assume unrelated behaviour is intentional. Prefer narrow, intentional diffs and preserve previous patches, controls, filters, routes, tracking, billing behaviour, and UX unless the request explicitly replaces them. A task is complete only when the new behaviour works and unrelated functionality remains intact.

### Replace, do not stack

Preserve product behaviour while removing implementation made redundant by the requested change. Search for existing abstractions before adding new ones; prefer extending them over competing implementations.

Remove superseded branches, handlers, helpers, imports, duplicate state, stale feature flags, redundant wrappers, and outdated comments where safe within the affected area. Do not run old and new implementations side by side without a documented migration, rollback, or compatibility reason. Keep the affected code at least as understandable as before.

## Approval boundaries

This is the authoritative approval-boundary section. Proceed autonomously for normal requested product, UI, UX, engineering, and repository implementation.

Pause before a proposed action introduces material risk involving:

- pricing or the commercial model;
- billing/payment behaviour, financial logic, money movement, or who carries financial risk;
- authentication or authorization;
- destructive database changes, or deletion or material transformation of production data;
- secrets or security;
- major infrastructure changes;
- major attribution changes;
- major user-control, permissions, or approval-authority changes;
- major product-direction, strategy, positioning, core visual-language, or UX changes;
- destructive or difficult-to-reverse actions, or material downstream consequences.

An explicit current founder instruction requesting such a change counts as product approval for the requested direction. Do not ask again for the same decision. Pause only if implementation reveals a new material risk, ambiguity, or consequence not reasonably covered by that instruction, or a missing requirement prevents a correct implementation. Explain the concrete issue, its impact, and the decision needed; continue independent authorised work where possible.

Deployment remains a distinct production action and requires explicit instruction. Applying production database migrations or changing remote production configuration also requires explicit instruction covering that action; approval of a product direction alone does not authorise those operations. Existing explicit authorisation remains valid and must not be requested again. Environment-enforced sandbox or tool permissions still apply.

## Context loading before substantial work

Before substantial investigation, planning, or implementation, read the relevant documents under the repository's `docs/` directory. Load every applicable row when work spans multiple systems.

For any substantial request involving simplification, optimisation, product behaviour, UX, onboarding, billing, marketplace changes, AI features, or workflow changes, agents must read both [VISION.md](docs/VISION.md) and [PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md) before investigation, planning, or implementation.

| Work type | Required context |
|---|---|
| Simplification, optimisation, product behaviour, UX, onboarding, billing, marketplace changes, AI features, or workflow changes | [VISION.md](docs/VISION.md) and [PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md) |
| Product behaviour | [VISION.md](docs/VISION.md), [PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md), [PRODUCT.md](docs/PRODUCT.md), and [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) |
| Substantial UI/UX work | [UI_DESIGN_SYSTEM.md](docs/UI_DESIGN_SYSTEM.md), plus the founder and product context required above |
| Architecture and system boundaries | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Database queries, schema, policies, or migrations | [DATABASE.md](docs/DATABASE.md) |
| Payments, Stripe, wallets, or commissions | [MONEY_FLOW.md](docs/MONEY_FLOW.md) |
| Tracking or attribution | [TRACKING.md](docs/TRACKING.md) |
| Meta advertising or account connection | [META_ADS.md](docs/META_ADS.md) |
| Historical product decisions | [DECISIONS.md](docs/DECISIONS.md) |

Follow the documents' source references into current code, utilities, routes, and migrations. Documentation is context, not proof of deployed behavior. If documentation conflicts with current code, note the conflicting statements and source paths in the plan or completion summary. Do not resolve conflicts by guessing intent; mark unresolved questions as needing verification.

For substantial feature work, follow [plans/README.md](plans/README.md): inspect any relevant active plan, then create or update a short implementation plan before editing application code. Keep its status and validation evidence current and move completed plans to `plans/completed/`.

Do not invent founder vision, branding, roadmap, customer strategy, or product philosophy. Use only verified repository evidence or explicit user instructions.

## Product alignment before implementation

This rule is mandatory for any substantial feature change, simplification, optimisation, refactor, workflow change, billing change, money-flow change, onboarding change, or user-facing behaviour change.

1. First determine the intended product outcome from explicit user instructions and verified repository evidence. Distinguish the requested outcome from a proposed implementation; mark undocumented intent as unknown rather than inventing founder vision.
2. Read the relevant product and business documentation, including `docs/PRODUCT.md` and `docs/BUSINESS_RULES.md`, plus the applicable context documents above. Check their claims against the existing implementation.
3. Evaluate whether the requested change aligns with Nettmark's documented product intent, user experience, commercial model, business rules, existing architecture, and downstream workflows. Record the assessment in the implementation plan.
4. Do not interpret words such as "simplify", "improve", "clean up", or "optimise" as permission to change behaviour blindly.
5. Flag material conflicts with established product intent and explain the likely impact and an evidence-backed alternative. Apply the [approval boundaries](#approval-boundaries) to new material risks or unresolved requirements; routine implementation trade-offs do not require approval. Do not guess intent or substitute a different feature without agreement.
6. Prefer preserving the intended product outcome over literal implementation of a narrow prompt. Explicit founder decisions can revise prior documented intent; record the agreed change rather than treating historical documentation as immutable.
7. Act as a product and engineering partner: assess outcomes and consequences as well as implementation details.

### Canonical visual reference

For substantial UI/UX work, read [UI_DESIGN_SYSTEM.md](docs/UI_DESIGN_SYSTEM.md) and inspect the canonical mobile Business Overview in `app/business/my-business/page.tsx`, `app/business/my-business/MobileBusinessOverview.tsx`, and `app/business/my-business/mobile-business.css`, including relevant supporting theme styles, before creating new UI patterns.

Prefer extending its existing visual language over creating new styles. Flag significant deviations and their product impact before implementation, applying the [approval boundaries](#approval-boundaries). Document existing inconsistencies rather than silently normalising them.

## Database and high-risk flows

Never guess database schema. Verify table and column names, types, constraints, relationships, functions, triggers, and row-level security policies from migrations and authoritative schema evidence. When current database state matters, obtain authorized read-only evidence or ask for the missing information before making a dependent change.

Treat payments, Stripe, wallets, commissions, attribution, Meta APIs, authentication, and database migrations as high-risk.

Before changing a high-risk flow, trace it end to end: the initiating UI or external event, API route, authentication and authorization, shared business logic, database reads and writes, external API calls, webhooks or background processing, and the final user-visible result, as applicable. Inspect retries, idempotency, failure handling, and existing tests. Document the verified behavior and the intended change; resolve material uncertainties before editing.

For money flows, verify amount units, ownership, ledger effects, commission calculations, and reconciliation behavior. For attribution, verify identity propagation and conversion linkage. For authentication and Meta integrations, verify permissions, token handling, and access boundaries. For migrations, verify existing data compatibility, rollout order, and rollback or recovery strategy.

Do not expose secrets or weaken authorization to make a flow work. Prepare and validate migrations and remote configuration changes within the requested scope; execute production actions only under the [approval boundaries](#approval-boundaries).

## Validation

After changes, run proportionate testing and validation appropriate to the affected behavior. Use dev servers, browser sessions, or extensive test environments only when they materially help validate or debug the requested change. Inspect `package.json` and existing tests to choose relevant commands; do not assume every declared command is functional or every referenced test file exists.

For application changes, use relevant tests, type checking, linting, and build checks as appropriate. Add or update meaningful regression coverage when behavior changes warrant it. High-risk changes must validate relevant failure, retry, authorization, and consistency cases.

For documentation-only or repository housekeeping changes, validate the diff, references, and file scope. Report checks that failed or could not run and why. The Next.js configuration skips type and lint failures during builds, so a successful build alone does not establish those checks passed.

## Delivery and completion

Before committing and pushing, review the final diff for accidental removals, regressions, dead code, duplicate logic, stale state, obsolete comments, and temporary code. Confirm unrelated functionality remains intact and fix unintended removals. Keep credentials and private data out of logs and commits. Follow ship-first autonomy and the approval boundaries for delivery.

Finish each task with a completion summary listing:

- Files changed or deleted and the purpose of the changes.
- Database, migration, and configuration changes, or explicitly state none.
- Tests and validation performed, including results and any checks not run.
- Remaining risks, unresolved questions, and follow-up work, or explicitly state none identified.
