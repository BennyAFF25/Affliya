# Offer supported currencies

Status: completed.

Problem / product intent: Explicit founder instruction restricts offer pricing to AUD, USD, GBP and CAD without country restrictions. This supersedes historical display eligibility, preserves commercial calculations and paid-launch flag behavior, and aligns with predictable offer setup.

Existing implementation / affected systems: Three direct Supabase UI writers (create/edit/onboarding); Meta-assets API updates existing offers; firstPartyOffer reads offers and writes participation only. Tracking setup updates site_host only. Existing docs describe broader currency display support and historical AUD-only payout behavior; this change does not alter settlement.

Approach / success criteria: Shared exact-code validation and options, legacy unsupported selection shown and blocked, named check-violation mapping, server validation on Meta update, transactional CHECK and exact constraint-drop undo. No data rewriting, SQL apply, deployment, commit or push.

Risks / trade-offs: Full CHECK validation will fail if any existing non-NULL currency is unsupported; verify and resolve those rows separately before application. Live schema/data are unknown. Local main and origin/main match HEAD; fetch cannot run because .git is read-only. Existing country controls remain unchanged.

Validation: `node --import tsx scripts/offer-currencies.test.ts`, `scripts/segE.test.ts` and `scripts/currency-seg1b.test.ts` passed. Requested `npx tsc -p . --noEmit` passed after fixing the helper return type; generated tracked build info restored. Final TypeScript validation uses build info under /tmp. `git diff --check` passed. Initial tsx CLI attempts were blocked by sandbox IPC permissions; Node tsx import runner succeeded. No browser/build/lint run for this bounded selector/validation change; no live database checks or SQL execution.

Files: shared currency helper, paid-launch filter reuse, create/edit/onboarding UI and CAD preview, tracking save check-error mapping, Meta-assets API guard, migration and exact undo, script regression test, this plan. No configuration or country/region changes. No files deleted; no commit or push. Remaining risk: migration application depends on verifying existing rows and production schema separately.
