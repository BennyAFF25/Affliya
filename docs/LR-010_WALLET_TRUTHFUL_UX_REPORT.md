# LR-010 — Wallet Truthful UX Report

## Goal
Make the affiliate wallet page reflect backend truth around spendability, refund locks, live Meta ad state, and wallet ledger activity.

## Grounding used
Implemented against:
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`
- existing LR-001 / LR-002 / LR-003 / LR-004 / LR-005 / LR-006 / LR-007 / LR-008 / LR-009 wallet and money-flow changes already present in repo

This patch closes the user-facing gap left by earlier launch-readiness hardening: backend rules for refund locks, settlement, and payouts already existed, but the wallet page still told an incomplete story.

## What changed

### 1) Wallet snapshot now surfaces the real operator-facing truth
Updated:
- `app/affiliate/wallet/page.tsx`

The wallet page now shows:
- available balance
- refundable now
- locked-by-active-ads / unsettled-spend amount
- active Meta ad count
- unsettled ad spend total
- pending payout receipts

This aligns the page with the canonical wallet balance and refund-lock rules instead of presenting a generic balance/refund view.

### 2) Refund lock messaging is explicit instead of vague
The wallet page now uses the shared refund-lock state to explain why refunds are blocked.

Clear user-visible reasons are shown for:
- active Meta ads still running
- unsettled ad spend still outstanding
- no current lock when refunds are available

That reduces support/debug churn because the page itself explains the block instead of forcing the user to guess.

### 3) Refund actions now stay tied to genuinely refundable top-ups
The refund selector is derived from countable wallet top-ups whose remaining refundable amount is still greater than zero.

That keeps the UI aligned with the backend refund model and avoids presenting stale or exhausted sources as refundable.

### 4) Wallet timeline now tells a fuller ledger story
The wallet timeline / detailed ledger now includes:
- top-ups
- refunds
- ad spend settlements / wallet deductions
- payout receipts / scheduled payouts from `wallet_payouts`

It also adds contextual notes where useful, such as:
- Stripe fee context on top-ups
- settlement before/after references on ad-spend deductions
- payout availability timing on payout rows

## Verification

### Passed
1. Targeted eslint
- `npx eslint app/affiliate/wallet/page.tsx`
- passed after restoring explicit `React` import required by repo lint settings

2. Relevant TypeScript surface
- full `tsc --noEmit` still has existing repo-wide failures unrelated to LR-010
- no TypeScript errors were reported for:
  - `app/affiliate/wallet/page.tsx`
  - `utils/wallet/balance.ts`
  - `utils/wallet/refundLock.ts`

3. Diff review
- wallet-page diff confirms LR-010 acceptance scope is covered in a single user-facing surface

### Blocked / limited verification
1. Live authenticated browser smoke test
- not completed in-tool here
- browser navigation to the local app was blocked by policy, and there was no attached logged-in user browser session available for reuse

So runtime verification is grounded by code inspection + lint/type checks, but not by a logged-in UI walkthrough in this session.

## Acceptance criteria status
- Wallet UI matches backend truth: **met by implementation and static verification**
- User can immediately see why funds are not withdrawable: **met**
- Support/debug burden is reduced because the UI explains lock state: **met**

## Known repo noise
Repo-wide TypeScript still reports pre-existing unrelated failures in other pages/routes and older helper typing surfaces. Those did not point at the LR-010 wallet page itself.

## Files changed
- `app/affiliate/wallet/page.tsx`
- `docs/LR-010_WALLET_TRUTHFUL_UX_REPORT.md`
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`
