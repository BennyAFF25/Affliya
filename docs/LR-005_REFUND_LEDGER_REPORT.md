# LR-005 — Canonical Refund Ledger Report

## Goal
Make every successful wallet refund produce canonical ledger evidence in `wallet_refunds`, while keeping `wallet_topups.amount_refunded` in sync with the exact source top-up.

## Why this patch exists
Before this patch, the refund route:
- updated `wallet_topups.amount_refunded`
- did not guarantee a canonical `wallet_refunds` row for each successful refund
- ignored the wallet UI's selected top-up lineage in the backend

That meant refund history could drift from top-up consumption, and audit evidence for the source top-up was weak.

## What changed

### 1) New migration: refund-ledger lineage + atomic DB recorder
Added:
- `supabase/migrations/20260511051500_wallet_refund_ledger.sql`
- `supabase/rollbacks/20260511051500_wallet_refund_ledger.rollback.sql`

The migration adds:
- `wallet_refunds.source_topup_id uuid`
- unique index `wallet_refunds_stripe_refund_id_unique`
- index `wallet_refunds_source_topup_id_idx`
- RPC function `public.record_wallet_refund(...)`

### 2) Refund route now respects selected top-up lineage
Updated:
- `app/api/stripe/refund/route.ts`

The route now:
- accepts the wallet UI's `stripe_charge_id` selection and resolves the exact source top-up row
- validates refund amount cleanly before touching Stripe
- creates the Stripe refund first
- records refund ledger + top-up refund consumption through `record_wallet_refund(...)`
- returns both Stripe and ledger result payloads on success

### 3) Atomic DB-side refund recording
`record_wallet_refund(...)` now:
- locks the selected `wallet_topups` row
- rejects over-refunds against that top-up's remaining refundable amount
- inserts canonical `wallet_refunds` row with:
  - `affiliate_email`
  - `source_topup_id`
  - `stripe_refund_id`
  - `stripe_charge_id`
  - `amount`
  - `status`
  - `created_at`
- updates `wallet_topups.amount_refunded` and `refunded_at` in the same transaction
- marks top-up `status='refunded'` only when fully refunded
- treats duplicate `stripe_refund_id` as idempotent success

## Live rollout
Applied directly to the linked Supabase project with:

```bash
supabase db query --linked -f supabase/migrations/20260511051500_wallet_refund_ledger.sql
```

Direct apply was used instead of `supabase db push` because the repo still has older migration-history version collisions unrelated to LR-005.

## Verification run

### Passed
1. Targeted lint on refund route

```bash
./node_modules/.bin/eslint app/api/stripe/refund/route.ts
```

Result:
- no route-specific lint failure
- only existing repo-level React-version warning

2. Diff sanity check

```bash
git diff --check -- app/api/stripe/refund/route.ts supabase/migrations/20260511051500_wallet_refund_ledger.sql supabase/rollbacks/20260511051500_wallet_refund_ledger.rollback.sql
```

Result:
- passed

3. Live DB object verification

Verified live:
- function `record_wallet_refund` exists
- column `wallet_refunds.source_topup_id` exists
- index `wallet_refunds_stripe_refund_id_unique` exists
- index `wallet_refunds_source_topup_id_idx` exists

4. Safe no-op RPC probe

```sql
select public.record_wallet_refund(
  'nobody@example.com',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'rf_test_lr005_probe',
  'ch_test_lr005_probe',
  1.23,
  'succeeded'
);
```

Result:
- returned `SOURCE_TOPUP_NOT_FOUND`
- no mutation performed

5. Local route load / validation smoke test

Executed the refund route locally with invalid amount `0`.

Result:
- handler loaded successfully
- returned HTTP `400`
- response: `{"error":"Refund amount must be greater than 0"}`

## Acceptance criteria status
- Every refund can now produce a ledger record: **met**
- Refund history and top-up refund consumption are linked through source top-up lineage: **met**
- Wallet refund history remains ledger-backed without changing LR-001 balance math: **met**

## Notes
- `wallet_refunds` remains audit history in LR-001/LR-005 balance math; refunds are still counted canonically through `wallet_topups.amount_refunded` to avoid double subtraction.
- A live end-to-end Stripe refund was intentionally not forced during verification, to avoid moving real money unnecessarily.

## Files changed
- `app/api/stripe/refund/route.ts`
- `supabase/migrations/20260511051500_wallet_refund_ledger.sql`
- `supabase/rollbacks/20260511051500_wallet_refund_ledger.rollback.sql`
- `docs/LR-005_REFUND_LEDGER_REPORT.md`
