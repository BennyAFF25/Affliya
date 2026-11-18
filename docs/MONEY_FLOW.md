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

## Shopify subscription provider (staging preparation)

App Store-first businesses without Stripe billing history use Shopify for Free/Growth selection; existing Stripe brands are unchanged. Provider selection lives on business_entitlements. Stripe subscription checkout/portal, reminder jobs and entitlement sync exclude Shopify businesses. Shopify confirmation/webhook reconciliation writes the same entitlement statuses used by campaign gates. Default Growth parity is A$49 per 30 days and one 14-day trial; explicit currency/amount env overrides require release review.

This does **not** migrate commission or usage/platform fees. feeAccounting defaults Nettmark's transaction fee to 220 bps; run-payout still charges principal plus fee through Stripe and transfers principal through Connect. Wallet topups also include fees/passthrough. A capped Shopify usage line item plus deduplicated appUsageRecordCreate could collect platform fees, but principal funding, cap failures, ledger reconciliation, refunds and prevention of duplicate Stripe fee collection require a separate design/decision. See plans/active/shopify-billing.md. No money movement or usage-record code changed; recurring billing is not a claim that all App Store fee requirements are resolved.

## Business payout fee decision — Ben, 16 Nov 2026

For `business_entitlements.billing_provider = 'shopify'`, the brand-side Nettmark payout fee is waived by default: fee 0, gross charge equals commission principal. Server-only `SHOPIFY_BILLED_PLATFORM_FEE_ENABLED` defaults false; only the exact string `true` restores the usual fee. Stripe-billed businesses retain 220 bps / `NETTMARK_TRANSACTION_FEE_BPS`. Affiliate wallet top-up fees remain unchanged; commission principal still travels through Stripe Connect.

`run-payout` resolves provider server-side (stable business ID, email fallback); lookup errors stop before any charge. Missing entitlement means Stripe. Charge amounts are frozen with a conditional wallet_payouts update before PaymentIntent creation. Existing PaymentIntent amounts override current fee policy on retries; fee/gross bookkeeping and transfer metadata use that same amount. Every recurring cycle uses this route. The authenticated dashboard summary supplies fee bps for UI estimates; recorded zero values win. Unknown estimates are shown as unavailable.

Zero fees skip `platform_fee_ledger` entries; wallet_payouts keeps zero fee, principal-only gross and actual Stripe processor costs. No waiver ledger row is written, so no waiver metadata is required on that ledger. Positive fee entries retain existing upsert behavior. Harness payouts proxy run-payout and display stored amounts; marketing reporting sums actual ledger amounts. No separate commission receipt/email fee calculation was found.

Shopify usage billing (merchant-approved usage line item with `cappedAmount` and `appUsageRecordCreate`) is deferred; the fee calculation is retained behind the flag for later. Public pricing copy in `app/pricing/page.tsx` and `BusinessDemoLandingPage` still says 2.2% on business payouts: unchanged, follow-up for Ben. No production configuration or database changes were executed.
