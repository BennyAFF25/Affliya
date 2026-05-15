# LR-009 — Billable Event Quarantine Report

## Goal
Preserve invalid billable events for investigation instead of guessing attribution or allowing them to drift toward payout/charge creation.

## Grounding used
Implemented against:
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`
- `docs/NETTMARK_COMMERCIAL_LINKAGE_AND_PAYMENT_INTEGRITY.md`

This patch follows directly from LR-008: once billable campaign identity became strict, invalid events needed a durable review queue rather than a silent drop or heuristic rescue.

## What changed

### 1) Added quarantine ledger table
Added migration:
- `supabase/migrations/20260511070000_billable_event_quarantine.sql`
- rollback: `supabase/rollbacks/20260511070000_billable_event_quarantine.rollback.sql`

New table:
- `public.billable_event_quarantine`

Stored fields include:
- `event_id`
- `source_route`
- `reason_code`
- `message`
- `event_type`
- `raw_campaign_id`
- `resolved_campaign_id`
- `offer_id`
- `affiliate_id`
- `raw_payload`
- `event_snapshot`
- `status`
- `created_at`

### 2) Added shared quarantine helper
Added:
- `utils/tracking/quarantine.ts`

This centralizes quarantine inserts so the billable ingress and processor paths preserve evidence in one consistent shape.

### 3) Quarantine invalid billable identity at ingress
Updated:
- `app/api/track-event/route.ts`
- `app/api/track.gif/route.ts`

For billable conversion events that fail exact runtime resolution:
- no payout/charge path is created
- a quarantine row is written with route + reason + raw identity context
- `track-event` still returns `400 INVALID_BILLABLE_CAMPAIGN_IDENTITY`
- `track.gif` still returns its GIF response, but the billable event is quarantined rather than guessed

### 4) Quarantine processor-side resolution failures
Updated:
- `app/api/process-conversion/route.ts`

If a stored conversion event later fails exact runtime campaign or offer resolution:
- no payout is created
- the event is written to quarantine for review
- the route returns its normal error response (`campaign_not_found` / `offer_not_resolved`)

## Verification

### Passed
1. Diff integrity
- `git diff --check` passed for LR-009 files

2. Live table creation
Applied the quarantine table/indexes directly through linked SQL.

3. Ingress quarantine: `track-event`
Probe with:
- `event_type = conversion`
- `campaign_id = offers.id` (invalid for billable runtime identity)

Result:
- HTTP `400`
- quarantine row written with:
  - `source_route = app/api/track-event/route.ts`
  - `reason_code = INVALID_BILLABLE_CAMPAIGN_IDENTITY`
  - `status = pending_review`

4. Ingress quarantine: `track.gif`
Probe with same invalid billable identity.

Result:
- GIF returned normally
- quarantine row written with:
  - `source_route = app/api/track.gif/route.ts`
  - `reason_code = INVALID_BILLABLE_CAMPAIGN_IDENTITY`

5. Processor quarantine: `process-conversion`
Inserted synthetic conversion event with:
- `campaign_id = 11111111-1111-1111-1111-111111111111`

Then ran `process-conversion` for that event.

Result:
- HTTP `400 campaign_not_found`
- no payout created
- quarantine row written with:
  - `source_route = app/api/process-conversion/route.ts`
  - `reason_code = UNRESOLVED_RUNTIME_CAMPAIGN`
  - matching `event_id`

6. No payout leakage for the processor probe
Confirmed:
- `wallet_payouts` count for the synthetic LR-009 processor probe event stayed `0`

### Known repo noise
Targeted eslint still reports pre-existing `any` typing issues in these legacy routes. No LR-009-specific syntax or diff-integrity issue was found.

## Acceptance criteria status
- No payout or charge is generated from heuristic attribution alone: **met**
- Invalid billable events are preserved for investigation instead of silently guessed: **met**

## Files changed
- `supabase/migrations/20260511070000_billable_event_quarantine.sql`
- `supabase/rollbacks/20260511070000_billable_event_quarantine.rollback.sql`
- `utils/tracking/quarantine.ts`
- `app/api/track-event/route.ts`
- `app/api/track.gif/route.ts`
- `app/api/process-conversion/route.ts`
- `docs/LR-009_BILLABLE_EVENT_QUARANTINE_REPORT.md`
