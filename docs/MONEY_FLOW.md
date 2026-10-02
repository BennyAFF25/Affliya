# Nettmark money flows

> Repository evidence as of 2026-10-02. Static inspection only: live database schema, deployed configuration, external account state, and production behavior were not verified. Paths below are relative to the repository root. Historical LR reports may describe older behavior.

## Keep these ledgers separate

| Flow | Payer → recipient | Main records |
|---|---|---|
| Spend wallet top-up | Affiliate → platform Stripe account | `wallet_topups`, cached `wallets`, `platform_fee_ledger` |
| Ad-spend reimbursement | Platform → business Connect account | `wallet_deductions`, `business_activation_subsidies`, `ad_spend_settlements`, `live_ads.spend_transferred` |
| Sales commission | Business saved card → platform → affiliate Connect account | `campaign_tracking_events`, `wallet_payouts`, recurring instances, fee ledger |
| Nettmark Business subscription | Business → configured subscription Stripe account | `business_entitlements`, subscription Stripe events; creator referral ledger when applicable |
| Revenue subscription | Separate `stripe-app` handlers | Revenue subscription fields on `profiles`/`pre_signup_revenue`; do not confuse with commission billing |

## Spend funding and refunds

`app/affiliate/wallet/page.tsx` → `/api/stripe/create-topup-session`: validates signed-in user/email and requires an affiliate Connect account marked onboarding-complete, creates Checkout metadata for principal and fees. `utils/feeAccounting.ts` defaults to a 220 bps Nettmark fee; top-up estimated Stripe passthrough defaults to 175 bps plus 0.30, configurable by environment. These are code defaults, not verified Stripe pricing. Stripe amounts use integer minor units; ledger values here are decimal major units.

`/api/stripe/webhook` verifies the signature, handles paid Checkout, resolves actual Stripe fee details, and credits principal using `credit_wallet_topup`, with a compatibility fallback. Stripe-ID deduplication protects retries. `/api/stripe/reconcile-topup` is an additional recovery entrypoint; inspect it before changing credit logic.

`utils/wallet/balance.ts` derives availability from countable credited top-ups minus embedded `amount_refunded` and `wallet_deductions`. It prefers positive `credited_amount`, otherwise `amount_net`; refund ledger amounts are audit-only so they are not subtracted twice. `wallets` is a cache, not the canonical balance. Refund UI calls `/api/stripe/refund`, checks locked campaigns and canonical/top-up limits, issues a Stripe refund, then records it via `record_wallet_refund` or fallback bookkeeping. Verify authorization and partial-failure recovery before changing it.

## Ad spend

Meta charges the connected ad account externally; Nettmark's code reimburses the business via Connect. `sync-active-ads` reads insights and updates local spend/clicks, runs funding guardrails, and invokes settlement. `/api/ad-spend/settle` delegates to `settleAdSpendLedger` in `utils/adSpend/settlements.ts`.

Settlement calculates unpaid spend from `spend - spend_transferred`, checks wallet plus reserved activation subsidy, claims the watermark with compare-and-set, consumes subsidy, inserts wallet deductions and an `ad_spend_settlements` row. Stripe transfer is queued separately. `process-transfer-batches` groups queued amounts by business, checks platform available balance/account readiness, and creates idempotent batch transfers; pending funds and retry/error state are persisted.

**Needs verification:** launch readiness includes uncommitted launch-fund allocations, but this settlement helper visibly counts wallet and activation subsidy. Its multi-query claim/bookkeeping sequence is not the older atomic RPC. Concurrency and crashes between writes need reconciliation evidence.

## Conversion commissions and payouts

`track-event` inserts an event and hands `event_id` to `process-conversion`. That processor resolves runtime campaign/offer, checks participation and paid creative approval, evaluates eligible amount, and computes one-off principal as eligible gross × commission / 100. It records pending payouts and processing markers. A recurring offer instead uses configured monthly commission and term; upfront pays the term total, spread schedules monthly cycles. First availability is event time plus 14 days. Recurring cancellation controls are in `/api/business/recurring-commissions/[id]`.

`app/business/payouts/page.tsx` → `/api/run-payout`: checks maturity/terminal state and recurring state, resolves business/affiliate profiles (stable IDs preferred, emails fallback), saved business card and affiliate Connect readiness, then confirms an off-session PaymentIntent for principal plus Nettmark fee and transfers principal in AUD. Principal must be at least 0.50 AUD. Separate payout-derived idempotency keys protect charge and transfer. It records Stripe IDs, errors, completion, fee ledger, and recurring progress. A bank payout is not created here; the code creates a Connect transfer. External bank payout schedules are unknown.

Commission readiness deliberately uses `business_profiles.stripe_customer_id`, not subscription customer IDs (`utils/businessPaymentReadiness.ts`). Subscription webhook processing has its own Stripe-event history and creator invoice commission path.

## Risks to resolve before money changes

Some service-role routes (`run-payout`, `process-conversion`, `ad-spend/settle`, `stripe/refund`) show no explicit session/owner verification in their handlers. Middleware is not a general guard. Deployment protection is unknown. Generic events lack durable external-order deduplication; ingestion success does not prove payout creation succeeded. Offers allow currency selection, while commission payout execution hardcodes AUD. No commission-payout cron is declared in `vercel.json`; automated settlement outside the checked-in business UI is unknown.
