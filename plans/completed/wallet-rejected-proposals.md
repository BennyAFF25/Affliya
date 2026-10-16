# Wallet billing feedback and rejected proposals

Status: completed (implementation and offline validation; existing environment/check limitations below).
Problem: loading billing renders disconnected guidance; rejected proposals use offer titles and lack decision dates.
Product intent: explicit founder request; aligns with clarity and dependable campaign state in PRODUCT_PRINCIPLES, PRODUCT and BUSINESS_RULES. No commercial, approval-authority or money changes.
User impact / success: truthful loading/error/disconnected feedback; proposal identity and real rejection dates; affiliate-only Rejected filter while preserving Archived access.
Existing implementation: wallet/page.tsx billing read and top-up gate; portalData.ts submissions; business/ad-ideas/update-status ownership-checked mutation; ManageCampaignsWorkspace archive content. Local main is older than HEAD 4ec6615; no remote inspection permitted. No applicable active plan.
Approach: isolate billing notice; extend existing submission projection with rollout-safe optional timestamp read; retain exact original reject payload on missing-column retry; transaction migration and undo without backfill; reuse archive content for affiliate Rejected tab.
Trade-offs: rejected proposals remain in Archived (existing history) and gain a focused filter; optional timestamp read must fall back before migration deployment.
Risks: schema is founder-supplied and local evidence only; no DB/external access. Undo drops any future rejection timestamps. Auth/owner filters and all money handlers stay unchanged.
Validation: offline rendered UI and mocked route/query regression tests; baseline and final tsc with incremental disabled; offline build; final diff checks. No deploy/commit/migration execution.

## Validation results
- PASS: wallet-billing-notice, rejected-proposals (including both missing-column codes, original payload fallback, no retry on other errors, fallback failure, pending unchanged, ownership, legacy reads, SQL contract), affiliate-campaign-labels (name/date/fallback and both tabs), affiliate-wallet-ui (financial-handler signatures), affiliate-campaigns-shared-workspace.
- PASS: ESLint for the new component and new billing test; React review performed; git diff --check.
- Typecheck: tsc --noEmit --incremental false reports 68 baseline diagnostics; final output identical to pre-edit output. No new errors; tsconfig.tsbuildinfo untouched.
- Build: Next 15.5.7 compiles successfully; page-data collection fails at /api/affiliate/live-campaigns. Its module imports utils/supabase/server-client.ts requiring SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, both absent. Build ran with networking blocked and telemetry disabled. Full build is not verified.
- Existing broader tests affiliate-portal-qa and business-manage-campaigns-ui fail (mock missing abortSignal; stale aria-label sort assertion). Both reproduced using HEAD source with an offline read override, without changing working source.
- No database/external connections, migration execution, deployment, commits, money changes, remote configuration changes, ad-insights edits or tsbuildinfo edits. SQL prepared only; production schema remains unverified. No documentation conflicts identified in this scope.

## Delivery
New billing notice + wallet integration; submission fields and rollout-safe read; rejection API timestamp and exact original update fallback; affiliate Rejected filter reuses existing Archived content and keeps historical access. Forward migration adds one nullable timestamp with comment and no backfill; transactional undo drops it (and any future values). Test changes and this plan document evidence. Remaining follow-up: apply migration only under explicit authorization; full build requires an appropriate separately authorized environment. No other risks identified.
