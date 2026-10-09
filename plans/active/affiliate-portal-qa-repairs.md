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
In progress. Latest founder approval permits resuming GitHub writes. Everbond destination and mixed-currency ledger are documented limitations.
