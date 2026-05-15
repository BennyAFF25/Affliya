# LR-002 — Hard Server-Side Refund/Withdraw Lock Report

Status: DONE
Date: 2026-05-11
Branch: hardening/launch-readiness

---

## Goal

Prevent affiliates from refunding/withdrawing wallet funds when either of these is true:

1. any Meta ad is still active/live
2. any unpaid Meta ad spend remains unsettled

This patch hardens the backend first, then makes the wallet UI match that truth.

---

## What changed

### New shared helper
Created:
- `utils/wallet/refundLock.ts`

This helper now provides shared refund-lock evaluation based on `live_ads` state.

### Canonical LR-002 lock rules
Refunds are now blocked when:
- at least one `live_ads` row is `active` or `live` (including `billing_state` active/live signals)
- or any `live_ads` row has unpaid spend where `spend > spend_transferred`

### Reason codes
The backend now returns explicit lock codes:
- `ACTIVE_META_AD_LOCK`
- `UNPAID_AD_SPEND_LOCK`

---

## Files changed

### New
- `utils/wallet/refundLock.ts`
- `docs/LR-002_REFUND_LOCK_REPORT.md`

### Updated
- `app/api/stripe/refund/route.ts`
- `app/affiliate/wallet/page.tsx`
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`

---

## Behavioral changes

### Refund API
`app/api/stripe/refund/route.ts` now:
- checks refund lock state before touching top-ups or Stripe refunds
- rejects locked refund attempts server-side with HTTP `409`
- returns structured reason + message so the UI can explain why

Example locked response shape:
- `error: ACTIVE_META_AD_LOCK` or `UNPAID_AD_SPEND_LOCK`
- `message: ...`
- `lock: { ...state }`

### Wallet page
`app/affiliate/wallet/page.tsx` now:
- loads affiliate `live_ads` and derives refund lock state in UI
- disables refund submission, withdraw-all, top-up selection, and amount input when locked
- shows a visible refund-lock notice
- splits display into:
  - available balance
  - total top-ups
  - ad spend deductions
  - locked for refunds
  - available to refund

### Scope preserved
This patch does **not** change:
- wallet top-up mechanics
- Meta upload flow
- campaign creation flow
- spend settlement flow
- webhook wallet crediting path

---

## Verification run

### Passed
1. Refund lock helper smoke test via `tsx`

Command run:

```bash
npx tsx -e "import { calculateRefundLockState } from './utils/wallet/refundLock.ts'; const cases = [calculateRefundLockState([{status:'active',spend:10,spend_transferred:10}]), calculateRefundLockState([{status:'paused',spend:12.5,spend_transferred:7.25}]), calculateRefundLockState([{status:'paused',spend:3,spend_transferred:3}])]; console.log(JSON.stringify(cases, null, 2));"
```

Observed result:
- active ad case returned `ACTIVE_META_AD_LOCK`
- paused + unpaid case returned `UNPAID_AD_SPEND_LOCK`
- paused + settled case returned unlocked state

2. Targeted eslint on new helper + refund route

Command run:

```bash
./node_modules/.bin/eslint utils/wallet/refundLock.ts app/api/stripe/refund/route.ts
```

Observed result:
- no file-specific eslint errors from these LR-002 backend/helper files
- only the repo’s existing React-version warning from current eslint config

3. Diff sanity check

Command run:

```bash
git diff --check -- utils/wallet/refundLock.ts app/api/stripe/refund/route.ts app/affiliate/wallet/page.tsx docs/LAUNCH_READINESS_PATCH_PLAN.md
```

Observed result:
- no diff-format / whitespace errors

### Existing repo noise still present
The wallet page remains inside a repo with older lint/config noise unrelated to LR-002, including React lint/config expectations and pre-existing unused variables in that file.

---

## Rollback notes

If LR-002 needs to be reverted, back out these files together:
- `utils/wallet/refundLock.ts`
- `app/api/stripe/refund/route.ts`
- `app/affiliate/wallet/page.tsx`

Do not revert unrelated LR-001 wallet balance centralization while rolling back LR-002 unless you intentionally want to remove both patches.

---

## Ready for next patch?

Yes.

Recommended next patch after approval:
- `LR-003` — automated ad-spend settlement job
