# Affiliate Wallet UI-only simplification — 12 October 2026

**Status:** In progress.

## Intent and alignment
Founder requests UI-only redesign of `app/affiliate/wallet/page.tsx` around what an affiliate needs to know: spendable principal, funding exposed to current campaigns, money movement. Follow `docs/VISION.md`, `docs/PRODUCT_PRINCIPLES.md`, `docs/PRODUCT.md`, `docs/BUSINESS_RULES.md`, `docs/MONEY_FLOW.md`, `docs/UI_DESIGN_SYSTEM.md` and canonical mobile Business Overview. Keep dark neutral surfaces (#0f0f0f, #151718, #101415), brand cyan #00C2CB, mobile-first.

## Existing verified paths / protected boundaries
- `refreshWalletState`: reads wallet_refunds, wallet_deductions, live_ads, wallet_topups, wallet_payouts with existing queries. Refund eligibility `calculateRefundLockState` comes from live_ads status and unpaid spend. Canonical `calculateWalletBalance` computes available/refundable from succeeded credits less embedded amount_refunded and wallet deductions; wallet_refunds audit rows must not be double-subtracted.
- `handleTopUp` invokes existing `/api/stripe/create-topup-session`. `handleWithdrawAll` sets input only; `handleRequestRefund` invokes existing `/api/stripe/refund`. Pending session `/api/stripe/reconcile-topup` effect and billing status `/api/stripe/affiliates/check-account` must remain unchanged.
- Existing wallet activity displays payouts alongside ad funds. `wallet_payouts` belongs to commission earnings, so hide payout rows in wallet's display (do not touch query or state, to honour UI-only scope).
- Existing `live_ads` read selects only id,status,billing_state,spend,spend_transferred and gives **no reliable per-campaign budget allocation, daily budget, title or last Meta sync time**. Cannot truthfully show funded/remaining per campaign, lifetime estimate or sync timestamps. Do not create new queries or pretend wallet principal is reserved per campaign. Show existing campaign IDs with status, stored Meta spend and unsettled difference, with link to detailed campaigns.
- Cannot call `walletSnapshot.refundableBalance` a second pot of money; refunds are temporarily locked during active ads/unsettled spend. Show one prominent spendable balance, small refund availability and unsettled spend context, with a disabled Withdraw CTA when refunds are blocked.

## UI-only implementation
1. Preserve all existing database queries (identical select clauses), Stripe endpoints, session reconciliation effects, money computation helpers and action handler implementations. Derive campaign summaries from the *existing* live_ads query result only.
2. Replace current large gradient hero, duplicate metric tiles, two-column dense forms and duplicate ledger table with calm overview card, campaign exposure list, one filtered expandable wallet-activity timeline and collapsed explanatory section.
3. Add Funds/Withdraw buttons reveal existing, unchanged forms; retain billing-readiness explanation, all refund-lock/available eligibility, top-up actual fee confirmation and exact preview fees.
4. Use display-only `A$` currency formatting when AUD; for other currencies, keep honest ISO currency. Do not show fabricated running balances, fees or refund restrictions.
5. Add source regression tests to lock query/Stripe/action bodies and visual role-specific outcomes. No DB write, migration, configuration, Stripe logic or money ledger changes.

## Validation plan
Inspect final diff, run source-level tests, verify deployed Vercel build; record unavailable authenticated end-to-end and type checks explicitly. Never exercise financial buttons during validation.
