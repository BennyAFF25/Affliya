# Segment E

Status: files implementation complete; files only. No SQL execution, push, Stripe or Meta calls.

Problem: settlement uses separate watermark, subsidy, deduction and liability writes; launch trusts saved account currency; commissions execute AUD regardless of offer currency. Affiliate role lookup can start during auth hydration.

Product intent: explicit founder request; dependable funding and clear currency outcomes align with VISION, PRODUCT_PRINCIPLES, PRODUCT and BUSINESS_RULES. Preserve AUD-only launch default, existing commercial model and approval controls.

Affected systems: settlements, wallet holds, launch/resume, readiness and funding UI, conversion/payout, affiliate role gate.

Approach: additive service-only locked settlement RPC and exact undo; mandatory hold consumption within transaction, preserve best-effort shadow ledger triggers; fresh Meta currency verification; server-authoritative currency flag; AUD estimates; block non-AUD commissions; defer role lookup until auth settles and retry transient failures.

Risks: database scripts are prepared from migrations, not live schema verification. Existing docs/MONEY_FLOW.md describes pre-Segment-D settlement and AUD payout behavior; current code has FX settlement fields. Production application and database rollout remain unverified. No production actions authorized.

Validation: mocked scripts, TypeScript and diff checks; SQL dry run supplied but not executed.


## Final implementation

- New service-role-only overload locks the runtime row and affiliate wallet account, validates the previous total and AUD/original amount split, consumes subsidy, writes the deduction, enforces idempotent hold consumption, writes the liability and advances the watermark in one transaction. Any canonical failure propagates; existing shadow-ledger exception guards are unchanged. Removed the replaced multi-query path and unused FX payload helper.
- Compatible pending-availability function update converts foreign spend before subtracting AUD holds. Missing/unsupported/stale cached FX exposes zero new capacity. It uses the existing default 72-hour cache ceiling; the TypeScript FX provider continues enforcing FX_MAX_STALENESS_HOURS before a foreign hold is requested. Legacy unrecorded AUD fallback is preserved. No data backfill/deletion; undo drops only the new overload and restores the exact previous function.
- Business launch, upload and RESUME obtain live account currency using the stored token, fail closed on network/API/mismatch/persistence errors, and persist matching currency before launch resources or hold creation. Upload funding readiness now follows currency verification so stale saved currency does not prematurely reject a valid account.
- PAID_LAUNCH_CURRENCIES is authoritative on the server, defaults AUD, accepts only AUD/USD/GBP/CAD. Client warnings fetch the same enabled list. With prepared SQL/application installed, AUD,USD enables USD launch/resume with live USD Meta verification, buffered AUD holds and AUD settlement/reimbursement. It does not enable USD wallets/top-ups or non-AUD commissions. Existing spend still settles when launch currencies are disabled.
- Funding readiness compares AUD capacity against the buffered AUD hold, while retaining the proposal's original required amount. Wizard, proposal and hold list show secondary AUD amounts; unavailable estimates are hidden. Active hold display uses remaining amounts. Holds endpoint authenticates with getUser and scopes accounts to the signed-in email.
- Commission choice: BLOCK. One-off/upfront and recurring-cycle liabilities preserve offer currency and use blocked_currency outside AUD. run-payout skips foreign/unknown currencies before any Stripe operation, including legacy AUD-labelled rows whose offers are foreign. Completed payout behavior is preserved. Recurring instance status remains within its existing active/paused/cancelled/completed constraint; its payout rows carry the currency block.
- Wallet role race: role verification previously started on user-ID changes without waiting for auth hydration or reacting to token readiness; empty results were cached for 60 seconds. Gate now waits for auth readiness, reacts to token changes, retries a transient failure once, bounds verification, and avoids caching empty roles. Existing retry and server/RLS authority remain.

## Validation evidence

Passed:
- `npx tsc -p . --noEmit` (also rerun with `--incremental false` to avoid changing tracked build metadata).
- `node --import tsx scripts/segE.test.ts`: flag default/allowlist, mocked Meta success/failure/mismatch/persistence, USD buffered funding, SQL permissions/undo contracts.
- `node --import tsx scripts/segE-commission-block.test.ts`: mocked payout execution for USD/GBP/CAD/unknown currencies, recurring and legacy mislabelled rows; Stripe access throws if attempted.
- `node --import tsx scripts/segD-fx-settlement.test.ts`: AUD/foreign atomic RPC parameters, partial funding, stale/mismatched FX, concurrent no-op, RPC failure without fallback, and settlement independent of launch switch.
- `node --import tsx scripts/account-role-cache.test.ts`: deduplication/user scope/rejected and empty role eviction/retry.
- Existing Segment A atomic-hold and Segment C FX scripts.
- Scoped ESLint on new files and settlement/currency/role code; final diff whitespace check.

Broader scoped ESLint still reports pre-existing explicit-any/unescaped-entity/unused-import errors in wallet, conversion, payout and funding-readiness files. New-file lint errors were corrected. The tsx CLI cannot open its IPC socket under this sandbox; tests used the equivalent `node --import tsx` runner successfully.

Not run: SQL, production schema checks, browser, build, real external API checks. SQL dry run is supplied, not database-proven. Installed versions verified: Next 15.5.7, React 19.2.1, Supabase JS 2.56.0; declarations alone were not used to infer behavior.

## Dry run and rollout prerequisites

After authorized installation of Segments A-D/E in a database, run:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/segE_atomic_settlement_dryrun.sql
```

Use a privileged database session. The script creates an isolated affiliate identity, credited top-up, proposal clone, paused runtime clone and hold, borrowing a valid AUD offer/business as a schema-compatible template. It asserts deduction/liability/hold/watermark success, repeat no-op, forced settlement-insert rollback, AUD capacity parity and foreign pending conversion. All fixture DML, the test trigger and the temporary FX-cache change roll back. Requires an existing valid AUD runtime/proposal whose business has launch entitlement (or the gate disabled). If none exists it fails explicitly. Full production DDL is not available locally; verify clone compatibility on a production-schema copy first. The temporary test trigger takes a table lock; lock wait is bounded at 3 seconds and statements at 30 seconds. No Stripe/Meta requests occur.

No SQL, remote configuration, deployment, commit or push performed. Remaining follow-up: authorized database/schema validation and browser smoke checks before production rollout. Plan retained at the explicitly requested active path.

## File inventory
- `app/affiliate/dashboard/manage-campaigns/PendingProposalRow.tsx`
- `app/affiliate/dashboard/promote/components/AdCampaignWizard.tsx`
- `app/affiliate/dashboard/promote/components/PaidCurrencyWarning.tsx`
- `app/affiliate/layout.tsx`
- `app/affiliate/wallet/page.tsx`
- `app/api/affiliate/pending-paid-proposals/route.ts`
- `app/api/affiliate/wallet-holds/route.ts`
- `app/api/business/ad-ideas/launch/route.ts`
- `app/api/business/ad-ideas/review-readiness/route.ts`
- `app/api/currency/route.ts`
- `app/api/meta/callback/upload-video/route.ts`
- `app/api/meta/control-ad/route.ts`
- `app/api/process-conversion/route.ts`
- `app/api/run-payout/route.ts`
- `components/CurrencyEstimate.tsx`
- `plans/active/segE.md`
- `scripts/account-role-cache.test.ts`
- `scripts/segD-fx-settlement.test.ts`
- `scripts/segE-commission-block.test.ts`
- `scripts/segE.test.ts`
- `supabase/migrations/20261016230000_segE_atomic_settlement.sql`
- `supabase/tests/segE_atomic_settlement_dryrun.sql`
- `supabase/undo/20261016230000_segE_atomic_settlement.undo.sql`
- `utils/adSpend/settlementFx.ts`
- `utils/adSpend/settlements.ts`
- `utils/affiliate/accountRole.ts`
- `utils/currency/paidCurrencyGuard.ts`
- `utils/currency/verifyMetaAccountCurrency.ts`
- `utils/paidCampaignLaunchReadiness.ts`
