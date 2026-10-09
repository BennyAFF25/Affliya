# Affiliate portal QA repairs

## Intent and evidence
Repair the seven QA findings in priority order with one final commit per item. Keep distribution accessible, business approval authoritative and wallet/commissions separate (docs/VISION.md, PRODUCT_PRINCIPLES.md, PRODUCT.md, BUSINESS_RULES.md). Read AGENTS.md and applicable architecture/database/money/Meta/UI context and canonical Business Overview. Current main 8c589fa134ba941815415df861027f9266ccc50e is unchanged by the interrupted work.
Production read-only schema verifies both absent tables and Meta/proposal columns. Existing subsidy migration enables automatic A$10 grants from legacy subscription fields; compatibility repair must create empty storage without grants, triggers or backfill. Existing webhook brand-name/trimmed URL/shared auth provider fixes are already on main.
HouseDesk currently has a correct website; Everbond has incomplete saved data with no column length limit or save truncation found. Correct URL still needed. Wallet charges preferred currency but stores no currency/FX in ledger; leave billing unchanged and flag this before any future financial changes.

## Approach and acceptance
1. Inbox storage with participant reads, recipient-only limited status updates, authenticated relationship-bound sends; empty subsidy storage; failures show retry/error rather than empty/zero.
2. Shared paid/organic submission and approved-offer/active-status definitions, independent of optional funding and chart date filters.
3. Real Meta columns; bounded, cancellable brand-content requests; genuine empty state vs error.
4. Owner-scoped read-only proposal details. No business-viewed/status mutations; explicit missing fields.
5. Render authoritative offer before optional readiness; discard stale responses, current destination only, no duplicated description/empty type. Preserve complete URL paths/query strings.
6. Real contact, single accordion icon, accurate zero-refund copy and shared display currency formatting. No conversion or charging changes.
7. Same-account session verification/refresh before submission; preserve mounted drafts/files, re-login in another tab, no automatic replay. Preserve upstream webhook fixes.

## Validation and delivery
Use GitHub Actions disposable PostgreSQL RLS/replay checks, focused unit/browser tests, baseline integration typecheck, focused lint, and Vercel build. No local terminal is available. Validate on a temporary branch, deliver seven commits without rewriting history. Prepare targeted migration SQL/operator instructions; do not apply production migrations. Main/deploy explicitly authorized in session; no new environment variables expected.
## Status
Completed implementation and targeted validation on 9 October 2026. Main/deployment authorized by the founder; production migrations are prepared for operator application, not executed.

## Validation evidence
Validation commit eee84b7126d43596652c031ce729046da99d1ae9:
- GitHub Actions Affiliate portal QA repairs run 37881943948 passed: disposable PostgreSQL migration replay and Inbox RLS, shared-count pagination/errors, proposal ownership/amount units, complete URLs, display currencies and same-account session refresh/failure.
- Actual browser checks passed for Inbox error/retry, pending/viewed proposals despite failed funding enrichment, saved read-only proposal details, early current-offer rendering, one description, empty/error/timeout brand content and expired-session draft/file preservation without writes.
- Existing Promote return navigation, direct entry/authentication, mobile/desktop, onboarding/AI, webhook, private identity and business-offer integrity checks passed.
- Focused lint and strict feature type checks passed. Baseline integration diagnostics: 34 before, 32 after, 0 new. Existing repository diagnostics remain; do not describe the repository as entirely type-clean.
- Vercel preview build passed. Production browser QA remains required after rollout.

## Remaining limits and rollout
Apply only the two targeted SQL files documented in docs/AFFILIATE_QA_DATABASE_REPAIR.md; do not bulk-run the legacy automatic A$10 grant migration. Inbox will show a visible error until storage is installed. The compatibility table starts empty and grants no credits.
HouseDesk's current production website is correct; the UI now rejects stale offer responses. Everbond's stored destination is incomplete; its real full URL is still needed and no production offer data was rewritten.
Shared display formatting does not convert amounts. Full AUD-only wallet standardisation is intentionally not implemented: preferred-currency checkout and a ledger without stored currency/FX need a separate financial audit/decision. No charges, refunds, budgets, ad campaigns or Meta configuration changed.
Use docs/AFFILIATE_QA_GROK_RETEST.md for a read-only production retest. Follow-up issues should distinguish missing migrations, existing incomplete data and unknown legacy currencies from regressions.
