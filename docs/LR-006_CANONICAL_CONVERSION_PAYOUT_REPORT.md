# LR-006 — Canonical Conversion Payout Report

## Goal
Remove duplicate conversion payout creation paths so exactly one backend path is allowed to create `wallet_payouts`.

## Why this patch exists
Before this patch, conversion-related money side effects existed in multiple places:
- `app/api/track-event/route.ts`
- `app/api/process-conversion/route.ts`
- `app/api/track.gif/route.ts`

That created real duplicate-payout risk, inconsistent behavior between tracking paths, and race windows around `source_event_id`.

## What changed

### 1) `process-conversion` is now the canonical payout creator
Updated:
- `app/api/process-conversion/route.ts`

The route now:
- supports both campaign identity shapes already used in production:
  - `live_campaigns.id`
  - `live_ads.id`
- remains the single route that creates payout rows
- uses DB RPC `create_wallet_payouts_for_conversion(...)` when available
- records `processed_conversions` only after payout creation has completed, avoiding premature permanent locks on invalid events

### 2) `track-event` is now tracking-first and hands off conversion processing
Updated:
- `app/api/track-event/route.ts`

The route still:
- resolves campaign / offer context
- writes `campaign_tracking_events`

But it no longer inserts `wallet_payouts` directly.
Instead, when the inserted event is a conversion, it hands off to `/api/process-conversion`.

### 3) `track.gif` no longer creates payouts or business-side financial effects directly
Updated:
- `app/api/track.gif/route.ts`

The route still:
- writes tracking events
- returns the 1x1 GIF reliably

But it no longer:
- inserts `wallet_payouts` directly
- inserts conversion-linked `wallet_deductions` directly
- creates Stripe payment intents directly

For conversion events, it now hands off to `/api/process-conversion`.

### 4) New DB-side idempotency guard for payout rows
Added:
- `supabase/migrations/20260511054500_canonical_conversion_payouts.sql`
- `supabase/rollbacks/20260511054500_canonical_conversion_payouts.rollback.sql`

The migration adds:
- unique index `wallet_payouts_source_event_cycle_unique`
  - uniqueness on `(source_event_id, cycle_number)`
  - supports recurring payouts without allowing duplicate cycle rows
- RPC function `public.create_wallet_payouts_for_conversion(...)`

This moves payout row creation closer to a canonical idempotent boundary.

## Live rollout
Applied directly to the linked Supabase project with:

```bash
supabase db query --linked -f supabase/migrations/20260511054500_canonical_conversion_payouts.sql
```

Direct apply was used instead of `supabase db push` because older unrelated migration-history conflicts still exist in the repo.

## Verification run

### Passed
1. Duplicate-pair preflight

Checked for existing duplicate payout rows on `(source_event_id, cycle_number)` before applying the unique index.

Result:
- `duplicate_pairs = 0`

2. Diff sanity check

```bash
git diff --check -- app/api/process-conversion/route.ts app/api/track-event/route.ts app/api/track.gif/route.ts supabase/migrations/20260511054500_canonical_conversion_payouts.sql supabase/rollbacks/20260511054500_canonical_conversion_payouts.rollback.sql
```

Result:
- passed

3. Live DB object verification

Verified live:
- function `create_wallet_payouts_for_conversion` exists
- index `wallet_payouts_source_event_cycle_unique` exists

4. Safe no-op RPC probe

```sql
select public.create_wallet_payouts_for_conversion(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'nobody@example.com',
  'nobody@example.com',
  '00000000-0000-0000-0000-000000000000'::uuid,
  0,
  false,
  'upfront',
  'monthly',
  null,
  now()
);
```

Result:
- returned `INVALID_PAYOUT_AMOUNT`
- no mutation performed

5. Local handler smoke tests

`process-conversion` invalid event probe:
- request used a non-existent UUID
- returned HTTP `404`
- response: `{"error":"event_not_found"}`

`track-event` invalid payload probe:
- request omitted `event_type`
- returned HTTP `400`
- response: `{"error":"event_type required"}`

`track.gif` module load:
- imported successfully after refactor
- no syntax/runtime load failure

### Known repo noise
Targeted eslint still reports existing `any`-typing noise in these long-lived tracking files. No new syntax or diff integrity issue was found during this patch.

## Acceptance criteria status
- Exactly one route can create payout rows: **met**
- Conversion event processed twice should still lead to one payout set: **met** via canonical processor + `processed_conversions` + DB uniqueness on `(source_event_id, cycle_number)`
- Tracking/beacon routes no longer directly perform payout creation: **met**

## Notes
- A live end-to-end conversion smoke test was intentionally not forced, to avoid generating real payout liability or business charges.
- This patch does not yet solve broader attribution-hardening problems around ambiguous campaign identity or heuristic offer inference; those belong to the next integrity patches.

## Files changed
- `app/api/process-conversion/route.ts`
- `app/api/track-event/route.ts`
- `app/api/track.gif/route.ts`
- `supabase/migrations/20260511054500_canonical_conversion_payouts.sql`
- `supabase/rollbacks/20260511054500_canonical_conversion_payouts.rollback.sql`
- `docs/LR-006_CANONICAL_CONVERSION_PAYOUT_REPORT.md`
