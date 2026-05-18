# LR-011 — Business payout execution hardening report

## Goal
Make payout execution safe to rerun, preserve Stripe linkage on completed payouts, and surface bookkeeping gaps instead of allowing silent ambiguity.

## What changed
- Added `supabase/migrations/20260512094500_business_payout_execution_hardening.sql`
- Added rollback: `supabase/rollbacks/20260512094500_business_payout_execution_hardening.rollback.sql`
- Hardened `app/api/run-payout/route.ts` so payout execution now:
  - uses stable Stripe idempotency keys derived from `wallet_payouts.id`
  - persists `stripe_payment_intent_id`, `stripe_charge_id`, and `stripe_transfer_id`
  - treats already-completed payouts as terminal success instead of re-paying
  - returns a repairable conflict when a payout is marked completed but Stripe refs are missing
  - records payout failure code/message when Stripe execution fails after route entry
- Updated business payout UI consumers to treat `completed` as the canonical successful state while remaining compatible with older `paid` records.

## Acceptance criteria coverage
1. **Re-running payout job cannot double-pay the affiliate**
   - Verified with a real Stripe test-mode payout executed twice against the same `wallet_payouts.id`.
   - First run created:
     - Payment intent: `pi_3TW4ItADLjZ5ptV00HYkCXBx`
     - Charge: `ch_3TW4ItADLjZ5ptV00uswia6B`
     - Transfer: `tr_1TW4IuADLjZ5ptV0t8ZZgQMZ`
   - Second run returned `alreadyCompleted: true` and reused the same Stripe refs.

2. **Every completed payout has linked Stripe references**
   - Verified that the successful test payout row persisted:
     - `status = completed`
     - `stripe_payment_intent_id`
     - `stripe_charge_id`
     - `stripe_transfer_id`
   - Verified Stripe-side objects existed and matched the stored refs.

3. **Bookkeeping failure after transfer is detectable and repairable**
   - Verified by inserting a synthetic `completed` payout row with missing Stripe refs and calling the route.
   - Route returned `409 completed_payout_missing_stripe_refs` with `repairable: true`.

## Test evidence run
### DB / migration
- Applied LR-011 migration to the linked Supabase test project.

### Route verification
- Synthetic pending payout id: `4c71103c-8fc8-44da-800b-170d4445f7e0`
  - First POST to `/api/run-payout` succeeded and persisted Stripe refs.
  - Second POST to `/api/run-payout` returned `alreadyCompleted: true`.
- Synthetic broken completed payout id: `d2b0367a-4fb2-4054-87c3-897ef6d48224`
  - POST to `/api/run-payout` returned HTTP 409 with `repairable: true`.

### Static checks
- `npx eslint app/api/run-payout/route.ts` ✅
- `git diff --check -- app/api/run-payout/route.ts app/business/payouts/page.tsx app/business/dashboard/page.tsx supabase/migrations/20260512094500_business_payout_execution_hardening.sql supabase/rollbacks/20260512094500_business_payout_execution_hardening.rollback.sql` ✅

## Notes
- Repo-wide lint/type noise still exists in unrelated business dashboard files; LR-011 did not introduce that baseline.
- The end-to-end payout verification was executed entirely against Stripe test mode and the linked Supabase test project.
