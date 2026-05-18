# LR-015 — Money flow audit visibility report

## Goal
Make production money decisions debuggable by leaving durable, structured breadcrumbs that support/admin tooling can inspect later.

## What changed
### 1) Added a durable audit table
Added migration:
- `supabase/migrations/20260512123000_money_flow_audit_log.sql`
- rollback: `supabase/rollbacks/20260512123000_money_flow_audit_log.rollback.sql`

New table:
- `public.money_flow_audit_log`

Stored fields include:
- `event_type`
- `severity`
- `source_route`
- `entity_type` / `entity_id`
- email snapshots + stable IDs when available
- `offer_id`, `campaign_id`, `live_ad_id`, `payout_id`, top-up/refund identifiers
- `reason_code`
- `message`
- `metadata` (jsonb)
- `created_at`

Indexed for common inspection paths:
- recent activity
- event type
- payout id
- live ad id
- affiliate email
- business email

### 2) Added a shared audit writer
Created:
- `utils/moneyFlowAudit.ts`

This provides a small shared helper for structured inserts into `money_flow_audit_log` plus a tolerant wrapper so audit failures do not break protected flows.

### 3) Wired breadcrumbs into critical money decisions
#### Conversion quarantine decisions
- `utils/tracking/quarantine.ts`

Every quarantine decision now writes a durable audit breadcrumb alongside the quarantine queue row.

#### Payout creation
- `app/api/process-conversion/route.ts`

Successful conversion-driven payout creation now records:
- event/payout lineage
- commission context
- idempotent vs created/fallback behavior

Unhandled payout-creation failures also emit an audit row.

#### Payout execution
- `app/api/run-payout/route.ts`

Added breadcrumbs for:
- completed payout rows missing Stripe refs
- affiliate transfer-readiness blocks
- payout execution failures
- repairable bookkeeping gaps after Stripe money movement
- successful payout execution with Stripe ids + idempotency keys

#### Ad-spend settlement
- `app/api/ad-spend/settle/route.ts`

Added breadcrumbs for:
- transfer-readiness blocks
- settlement failures
- legacy fallback failures
- successful settlements
- successful settlements where Stripe transfer failed after ledger success

#### Meta ad auto-pause
- `app/api/meta/ad-insights/route.ts`

Added breadcrumbs for:
- failed Meta auto-pause attempts
- successful auto-pause actions, including whether local DB status also updated cleanly

#### Refund blocks / refunds
- `app/api/stripe/refund/route.ts`

Added breadcrumbs for:
- refund lock blocks
- no refundable top-up found
- refundable-balance violations
- per-top-up remaining-balance violations
- successful refunds
- refund failures

## Acceptance criteria coverage
1. **Each critical money event leaves enough breadcrumbs to debug without guessing**
   - Covered by durable rows containing source route, entity linkage, reason code, and structured metadata.

2. **Support/admin tools can inspect these decisions later**
   - Covered by a queryable DB table with indexes for the common operational lookup keys.

## Verification
### Migration
Applied successfully to linked Supabase test project:
- `supabase db query --linked -f supabase/migrations/20260512123000_money_flow_audit_log.sql`
- Result: `EXIT:0`

### Route-driven audit verification
Verified real audit rows landed in `public.money_flow_audit_log` from live route execution:

#### Refund block breadcrumb
Triggered:
- `POST http://localhost:3000/api/stripe/refund`
- payload email: `lr015-refund-block-verify@nettmark.local`

Observed audit row:
- `event_type = wallet_refund_blocked`
- `reason_code = NO_REFUNDABLE_TOPUP`
- `source_route = app/api/stripe/refund/route.ts`

#### Conversion quarantine breadcrumb
Triggered:
- `POST http://localhost:3000/api/track-event`
- invalid billable campaign identity for `lr015-quarantine-verify@nettmark.local`

Observed audit row:
- `event_type = conversion_quarantine_decision`
- `reason_code = INVALID_BILLABLE_CAMPAIGN_IDENTITY`
- `source_route = app/api/track-event/route.ts`

#### Payout execution breadcrumb
Executed a real Stripe test-mode payout:
- payout id: `2cfc4f59-1edf-4253-8593-fdec3c6b3b7f`
- payment intent: `pi_3TW5DBADLjZ5ptV00fIrysSD`
- charge: `ch_3TW5DBADLjZ5ptV00NuuwOyU`
- transfer: `tr_1TW5DCADLjZ5ptV0O5qUFsWn`

Observed audit row:
- `event_type = wallet_payout_executed`
- `reason_code = PAYOUT_COMPLETED`
- `source_route = app/api/run-payout/route.ts`

### Static verification
- `git diff --check` on LR-015 touched files ✅
- Targeted eslint still reports pre-existing `no-explicit-any` noise in older route code (`app/api/process-conversion/route.ts`, `app/api/meta/ad-insights/route.ts`), but the new audit helper/migration wiring did not introduce new syntax/whitespace issues.

## Notes
- Audit writes are intentionally non-fatal: core money protection logic should still run even if breadcrumb insertion fails.
- The audit log is launch-safe and additive; it does not replace existing business tables or change money calculations.
- This patch sets up the inspection surface LR-015 asked for without requiring a risky pre-launch admin UI build.
