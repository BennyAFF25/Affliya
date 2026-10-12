# Affiliate Wallet UI-only simplification — 12 October 2026

**Status:** Implemented, source verified and deployed; authenticated visual QA remains.

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

## Completion (12 October 2026)
- Replaced the wallet's gradient hero, six duplicate stat tiles, separate always-open payment panels, payout mix, duplicated ledger table and bulky status blocks with:
  - One charcoal balance card with only the spendable principal as the large value, smaller unsettled Meta spend and refundable-now figures, and Add Funds/Withdraw controls.
  - Conditional (not duplicated) existing top-up and original-payment-method refund forms. Eligibility/warnings come from original `calculateWalletBalance` and `calculateRefundLockState`.
  - Current Meta-ad rows derived solely from the already fetched live_ads result; show recorded Meta spend, unsettled amount, status and detail link. Never infer a funded bucket, daily budget or days remaining.
  - Single filterable and expandable wallet-only topup/spend/refund timeline; payout rows are hidden on this surface, but the original read remains untouched. Transaction notes and Stripe fees are exposed on expansion; no unverified historical running balances.
  - Collapsed 3-point explanation. In AUD, user-facing amount renderer uses A$; other currencies retain truthful currency code.
- `app/affiliate/wallet/page.tsx` reduced from 1,014 to 887 lines. No Stripe route/API file, Supabase policies, tables, triggers, migrations, or application payment handlers changed.
- **Immutable logic verification:** Compared against baseline `730c6e723b30b03c3a8e1bc1415aa55b8f2d9745`. Original wallet query block, billing status effect, pending-checkout reconciliation effect, fee preview helper, `handleTopUp`, `handleWithdrawAll`, and `handleRequestRefund` are all exactly unchanged. New `setLiveAdRows` is read-only state populated from the already-existing query.
- Added `scripts/affiliate-wallet-ui.test.ts` with baseline signatures and UI regression assertions; registered `test:affiliate-wallet-ui` in package.json. Direct source-level invariant checks passed. Dedicated `tsx` regression script and authenticated visual/manual payment-flow test were not independently run here; no payment action was triggered by validation.
- Vercel deployment `dpl_2KRtca9LTJujiAC7DTg7LgG3LAGh` of application + test commit `e0a46207a43e2c4c295e322ce89fed7eacd8d903` was **READY** with www.nettmark.com alias. Later documentation-only commits do not change application code.
- Remaining follow-up (outside strict UI-only scope): true campaign names, per-campaign allocation/daily budget, exhaustion forecast, exact last Meta sync timestamp, and authoritative historical running balances require new reliable read-model fields/metadata. Do not invent them.
