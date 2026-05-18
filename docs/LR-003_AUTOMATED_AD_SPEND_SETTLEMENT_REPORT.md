# LR-003 — Automated Ad-Spend Settlement Job Report

Status: DONE
Date: 2026-05-11
Branch: hardening/launch-readiness

---

## Goal

Make active Meta ad spend settle automatically into the correct affiliate wallet without waiting for a manual pause/stop action.

---

## What changed

### Primary automation point
Updated:
- `app/api/meta/sync-active-ads/route.ts`

The active-ad cron path now does more than just sync spend and pause low-wallet ads.

### New LR-003 cycle
For each active/live Meta ad, `sync-active-ads` now:
1. syncs latest spend/clicks via `/api/meta/ad-insights`
2. computes unpaid spend for the ad
3. loads canonical wallet availability
4. if unpaid spend exists **and** the wallet can cover it, calls `/api/ad-spend/settle`
5. if the wallet cannot cover unpaid spend, preserves the existing low-wallet auto-pause behavior
6. returns machine-readable per-ad settlement results

### Settlement reporting added
The cron response now includes:
- per-ad `settlement` result objects
- `wouldSettle` in dry runs
- top-level `settled` count
- top-level `settlementFailed` count
- existing `autoPaused` count remains intact

---

## Files changed

### Updated
- `app/api/meta/sync-active-ads/route.ts`
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`
- `docs/LR-003_AUTOMATED_AD_SPEND_SETTLEMENT_REPORT.md`

### Reused unchanged core paths
- `app/api/meta/ad-insights/route.ts`
- `app/api/ad-spend/settle/route.ts`

Those routes already had the core building blocks, so LR-003 kept scope tight by orchestrating them instead of rewriting them.

---

## Behavioral changes

### Before LR-003
- spend sync happened
- low-wallet auto-pause could happen
- actual wallet deduction still depended on separate/manual settlement flow

### After LR-003
- active-ad cron sync now attempts immediate wallet settlement after successful spend sync whenever unpaid spend exists and the wallet can cover it
- deductions are written through the existing settlement route
- low-wallet ads still pause when the wallet cannot cover unpaid spend
- ops now get a clearer audit response from the cron job

---

## Example response shape additions

Per ad:
- `settlement.attempted`
- `settlement.success`
- `settlement.status`
- `settlement.chargedAmount`
- `settlement.transferredAfter`
- `settlement.unpaidAfter`
- `settlement.message`
- `settlement.error`

Top level:
- `settled`
- `settlementFailed`

---

## Verification run

### Passed
1. Diff sanity check

Command run:

```bash
git diff --check -- app/api/meta/sync-active-ads/route.ts app/api/ad-spend/settle/route.ts app/api/meta/ad-insights/route.ts
```

Observed result:
- no diff-format / whitespace errors

2. Targeted eslint on the LR-003 orchestration file

Command run:

```bash
./node_modules/.bin/eslint app/api/meta/sync-active-ads/route.ts --rule '@typescript-eslint/no-explicit-any: off'
```

Observed result:
- no route-specific lint errors after removing one useless-assignment issue
- only the repo’s existing React-version warning from current eslint config

---

## Known LR-003 limits

This patch improves automation, but it does **not** yet make settlement atomic at the database layer.

Current limitation remains in `app/api/ad-spend/settle/route.ts`:
- `live_ads.spend_transferred` is still updated before wallet deduction insert is fully guaranteed
- rollback is still best-effort

That is the exact LR-004 follow-up.

Also, LR-003 still relies on `spend_transferred` as the operational checkpoint. It improves automation and reporting, but it does not yet add a unique settlement ledger constraint/index by spend checkpoint.

---

## Rollback notes

If LR-003 needs to be reverted, back out:
- `app/api/meta/sync-active-ads/route.ts`

This returns the system to the prior state where spend sync and low-wallet auto-pause exist, but automatic settlement orchestration does not.

---

## Ready for next patch?

Yes.

Recommended next patch after approval:
- `LR-004` — atomic ad-spend settlement + ledger idempotency hardening
