# LR-001 — Canonical Wallet Balance Engine Report

Status: DONE
Date: 2026-04-30
Branch: hardening/launch-readiness

---

## Goal

Make wallet balance/refundable balance math consistent across the app before adding server-side lock rules in `LR-002`.

---

## What changed

### New canonical helper
Created:
- `utils/wallet/balance.ts`

This helper now defines the shared wallet snapshot shape and formulas used by wallet-related routes/UI.

### Canonical LR-001 formula
For now, wallet truth is:

- `totalTopupsCredited` = sum of countable top-up `amount_net`
- `totalTopupsNetAvailable` = sum of `max(0, amount_net - amount_refunded)` across countable top-ups
- `availableBalance` = `max(0, totalTopupsNetAvailable - totalDeductions)`
- `refundableBalance` = `availableBalance`
- `lockedBalance` = `0` for LR-001 (real locks come in `LR-002`)

### Countable top-ups rule
Top-ups with status:
- `succeeded`
- `refunded`

are included in canonical math.

This avoids incorrectly dropping partially refunded top-ups from balance calculations just because the row status changed to `refunded`.

### Important LR-001 decision
`wallet_refunds` is currently treated as audit history only and is **not** subtracted a second time in canonical balance math, because current refund flow already mutates `wallet_topups.amount_refunded`.

That avoids double-subtracting refunds.

---

## Files changed

### New
- `utils/wallet/balance.ts`
- `docs/LR-001_CANONICAL_WALLET_BALANCE_REPORT.md`

### Updated
- `utils/supabase/getRefundableBalance.ts`
- `app/api/ad-spend/settle/route.ts`
- `app/api/meta/ad-insights/route.ts`
- `app/api/meta/sync-active-ads/route.ts`
- `app/api/stripe/refund/route.ts`
- `app/affiliate/wallet/page.tsx`
- `app/affiliate/dashboard/promote/[offerId]/page.tsx`
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`

---

## Behavioral changes

### Wallet page
- Uses canonical balance math instead of ad hoc client-side math
- Stops relying on `wallets.balance` for decision-making
- Shows wallet deductions in ledger activity
- Keeps Stripe session confirmation UX-only; wallet crediting remains exclusive to `/api/stripe/webhook`

### Promote flow
- Wallet budget gating now uses canonical available balance
- Ad spend deductions are now included in the wallet sufficiency check

### Ad spend settlement / Meta guardrails
- `ad-spend/settle`
- `meta/ad-insights`
- `meta/sync-active-ads`

all now read from the same wallet snapshot logic instead of duplicate per-route formulas.

### Refund route
- Refund requests are now checked against canonical `refundableBalance`
- Existing per-top-up remaining-cap check is still preserved

---

## Verification run

### Passed
1. Helper smoke test via `tsx`

Command run:

```bash
npx tsx -e "import { calculateWalletBalance } from './utils/wallet/balance.ts'; const cases = [calculateWalletBalance({ topups:[{amount_net:100,amount_refunded:20,status:'succeeded'}], deductions:[{amount:30}], refunds:[{amount:20}] }), calculateWalletBalance({ topups:[{amount_net:100,amount_refunded:40,status:'refunded'},{amount_net:50,amount_refunded:0,status:'succeeded'}], deductions:[{amount:25}] })]; console.log(JSON.stringify(cases, null, 2));"
```

Observed result:
- Case 1 returned available/refundable balance `50`
- Case 2 confirmed partially refunded `status='refunded'` rows still contribute remaining balance correctly

2. Diff sanity check

Command run:

```bash
git diff --check -- utils/wallet/balance.ts utils/supabase/getRefundableBalance.ts app/api/ad-spend/settle/route.ts app/api/meta/ad-insights/route.ts app/api/meta/sync-active-ads/route.ts app/api/stripe/refund/route.ts app/affiliate/wallet/page.tsx 'app/affiliate/dashboard/promote/[offerId]/page.tsx'
```

Observed result:
- no diff-format / whitespace errors

### Blocked by pre-existing repo issues
1. Repo-wide typecheck

Command run:

```bash
yarn -s typecheck
```

Observed result:
- failed due existing unrelated repo errors, including:
  - Supabase `never` typing issues in `app/create-account/page.tsx`
  - inbox notifier typing issues in `utils/hooks/useInboxNotifier.ts`
  - existing Stripe API-version mismatch in `utils/stripe.ts`

2. Targeted eslint on touched files

Command run:

```bash
./node_modules/.bin/eslint utils/wallet/balance.ts utils/supabase/getRefundableBalance.ts app/api/ad-spend/settle/route.ts app/api/meta/ad-insights/route.ts app/api/meta/sync-active-ads/route.ts app/api/stripe/refund/route.ts app/affiliate/wallet/page.tsx 'app/affiliate/dashboard/promote/[offerId]/page.tsx'
```

Observed result:
- command is still dominated by existing repo-wide `no-explicit-any` violations across touched legacy files
- no LR-001-specific runtime failure was found from this step

---

## Rollback notes

If LR-001 needs to be reverted, back out these files together:
- `utils/wallet/balance.ts`
- `utils/supabase/getRefundableBalance.ts`
- `app/api/ad-spend/settle/route.ts`
- `app/api/meta/ad-insights/route.ts`
- `app/api/meta/sync-active-ads/route.ts`
- `app/api/stripe/refund/route.ts`
- `app/affiliate/wallet/page.tsx`
- `app/affiliate/dashboard/promote/[offerId]/page.tsx`

Do **not** revert the wallet-page Stripe-session UX comment/change that protects `/api/stripe/webhook` as the sole wallet-crediting path.

---

## Ready for next patch?

Yes — `LR-001` is complete enough to review.

Recommended next patch after approval:
- `LR-002` — hard server-side refund/withdraw lock during active Meta ads or unpaid spend
