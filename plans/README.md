# Implementation plans

Substantial feature work should have a short implementation plan before application changes begin. Read the relevant context documents mapped in [AGENTS.md](../AGENTS.md) and inspect the existing implementation first. Routine small edits do not require a separate plan.

- `active/`: proposed, in-progress, or blocked plans. Check for a relevant plan before creating another one.
- `completed/`: finished plans with the final implementation and validation results recorded.

Use a descriptive Markdown filename, such as `offer-readiness.md`. Extend an existing plan when it covers the same work. Keep plans concise and grounded in source paths; update them when scope, approach, risks, or evidence changes. Move a plan to `completed/` only when the work and required validation are finished, recording any remaining risks or follow-up work.

## Plan contents

Each plan should contain:

- **Problem:** the concrete issue or feature request and supporting evidence.
- **Product intent:** the intended product outcome, its documented or explicitly instructed basis, and alignment with Nettmark's commercial model, business rules, architecture, and downstream workflows. Mark undocumented intent as unknown.
- **User impact:** who is affected and how the experience or behaviour will change.
- **Intended behaviour:** the requested outcome and acceptance criteria.
- **Success criteria:** observable outcomes that demonstrate the problem is solved and the intended product outcome is preserved.
- **Existing implementation:** relevant UI, routes, utilities, data, migrations, and external integrations; cite source paths.
- **Affected systems:** the systems and boundaries touched by the change.
- **Implementation approach:** a short sequence of changes, preferring existing systems over duplicate implementations.
- **Trade-offs:** meaningful alternatives, benefits, costs, and product conflicts; record the agreed resolution before implementing a conflicting change.
- **Risks:** high-risk flows, compatibility, partial failures, and unknowns needing verification.
- **Validation:** planned checks, followed by actual results and any checks that could not run.
- **Status:** proposed, in progress, blocked, or completed; include remaining work and blockers as applicable.

If documentation conflicts with current code, record both source references and the discrepancy. Mark unverified behavior as unknown or needing verification; do not guess the intended resolution. Separate requested behavior from observed behavior. Do not invent founder vision, branding, roadmap, customer strategy, or product philosophy.

A completed plan does not authorize a commit, push, deployment, migration, or remote configuration change. Follow the user's instructions and the delivery rules in `AGENTS.md`.

## Known historical documentation conflict

`docs/NETTMARK_COMMERCIAL_LINKAGE_AND_PAYMENT_INTEGRITY.md` describes duplicate conversion-to-payout paths and hostname-based conversion fallbacks. Current `app/api/track.gif/route.ts` proxies to `track-event`; `app/api/track-event/route.ts` rejects unresolved billable runtime identities and hands conversions to `process-conversion`. Treat the older report as historical context, and verify each affected path before using its conclusions. The historical document has not been rewritten.
