# LR-013 — Stable ID rollout report

## Goal
Reduce commercial lineage fragility by keeping email snapshots for compatibility/UI while adding stable business/affiliate identifiers to money-critical tables.

## What changed
### 1) Added stable identity columns to money-critical tables
Migration added launch-safe stable identity refs to:
- `wallet_payouts`
- `wallet_deductions`
- `wallet_topups`
- `wallet_refunds`
- `live_ads`
- `live_campaigns`
- `campaign_tracking_events`

Columns added:
- `business_id uuid` where business ownership exists
- `affiliate_user_id uuid` where affiliate ownership exists

Note: `campaign_tracking_events` already had a legacy `affiliate_id text` field that currently stores email snapshots. To avoid a risky destructive type rewrite during launch hardening, LR-013 adds `affiliate_user_id uuid` alongside it.

### 2) Added automatic identity resolution triggers
Created `public.resolve_commercial_identity_links()` plus triggers on the target tables.

Behavior:
- on insert/update, if `business_id` is null and `business_email` exists, resolve from `business_profiles`
- on insert/update, if `affiliate_user_id` is null and `affiliate_email` exists, resolve from `affiliate_profiles`
- for `campaign_tracking_events`, resolve:
  - `affiliate_user_id` from legacy `affiliate_id` email
  - `business_id` from runtime campaign first (`live_ads` / `live_campaigns`), then `offer_id` as fallback

This makes existing write paths safer without requiring every route to be rewritten immediately.

### 3) Backfilled existing rows
The migration backfills historical rows in the target tables so old records pick up stable IDs wherever their email snapshots can be resolved.

### 4) Began migrating critical reads off email joins
Updated money-critical runtime reads to prefer stable IDs when present:
- `app/api/run-payout/route.ts`
- `app/api/ad-spend/settle/route.ts`

These still fall back to email snapshots for compatibility when needed.

## Acceptance criteria coverage
1. **New records include stable IDs in addition to emails**
   - Verified with real inserts in the linked Supabase test project across top-ups, payouts, deductions, campaigns, and tracking events.

2. **Money-critical lookups can migrate off email joins over time**
   - Begun in payout and settlement execution paths by preferring stable IDs when present.
   - Remaining email-based readers can migrate incrementally without breaking compatibility.

## Verification evidence
### Migration / schema
- Applied migration to linked Supabase test project:
  - `supabase/migrations/20260512105500_stable_commercial_identity_links.sql`
- Rollback included:
  - `supabase/rollbacks/20260512105500_stable_commercial_identity_links.rollback.sql`

### Insert/backfill verification
Verified new inserts automatically populated stable IDs:
- `wallet_topups.affiliate_user_id`
- `wallet_payouts.business_id`
- `wallet_payouts.affiliate_user_id`
- `wallet_deductions.business_id`
- `wallet_deductions.affiliate_user_id`
- `live_campaigns.business_id`
- `live_campaigns.affiliate_user_id`
- `campaign_tracking_events.business_id`
- `campaign_tracking_events.affiliate_user_id`

A subtle resolver edge case was caught and fixed during verification:
- `campaign_tracking_events.business_id` now prefers runtime `campaign_id` ownership before `offer_id` fallback

### Route verification
Executed a real Stripe test-mode payout against a payout row that had the new stable IDs populated.
Verified `/api/run-payout` still completed successfully:
- payout id: `0eda6d50-9e69-458c-99c6-cb96b7867432`
- payment intent: `pi_3TW4wgADLjZ5ptV01zD256B1`
- transfer: `tr_1TW4whADLjZ5ptV0AuRNAkHE`

### Static verification
- `npx eslint app/api/run-payout/route.ts app/api/ad-spend/settle/route.ts` ✅
- `git diff --check` on LR-013 touched files ✅

## Notes
- Email snapshots remain intentionally preserved for compatibility, UI display, and rollback safety.
- `campaign_tracking_events.affiliate_id` remains the legacy text snapshot field for now; `affiliate_user_id` is the new stable reference added by LR-013.
- This patch is intentionally launch-safe: schema-first, backward-compatible, and able to absorb older email-based writers while newer reads migrate toward stable IDs.
