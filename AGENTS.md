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

## Context loading before substantial work

Before substantial investigation, planning, or implementation, read the relevant documents under the repository's `docs/` directory. Load every applicable row when work spans multiple systems.

For any substantial request involving simplification, optimisation, product behaviour, UX, onboarding, billing, marketplace changes, AI features, or workflow changes, agents must read both [VISION.md](docs/VISION.md) and [PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md) before investigation, planning, or implementation.

| Work type | Required context |
|---|---|
| Simplification, optimisation, product behaviour, UX, onboarding, billing, marketplace changes, AI features, or workflow changes | [VISION.md](docs/VISION.md) and [PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md) |
| Product behaviour | [VISION.md](docs/VISION.md), [PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md), [PRODUCT.md](docs/PRODUCT.md), and [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) |
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
5. If the requested change conflicts with established product intent or introduces meaningful trade-offs, stop before implementing the conflicting change. Explain the conflict, the likely user/product impact, and a better alternative supported by evidence. For founder-level decisions listed below, resolve the intended outcome with the founder before proceeding; for other decisions, resolve it with the user. Do not guess intent or substitute a different feature without agreement.
6. Prefer preserving the intended product outcome over literal implementation of a narrow prompt. Explicit founder decisions can revise prior documented intent; record the agreed change rather than treating historical documentation as immutable.
7. Act as a product and engineering partner: assess outcomes and consequences as well as implementation details.

### Founder approval boundaries

Pause before implementation and obtain explicit founder approval for changes involving:

- major UX changes
- strategy or positioning
- the business model
- pricing or the commercial model
- approval authority
- attribution rules
- who carries financial risk
- major downstream-flow changes or meaningful downstream technical effects
- significant changes to user control

Explain the intended outcome, product impact, trade-offs, and downstream effects, and resolve these founder-level decisions with the founder before proceeding. Explicit founder instructions approving the specific change satisfy this requirement; do not request the same approval again.

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
