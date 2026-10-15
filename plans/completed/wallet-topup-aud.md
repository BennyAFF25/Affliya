# AUD wallet top-up containment

Status: completed.

Problem: Checkout accepts client currency and leaves Adaptive Pricing unset; credit paths trust metadata principal but fall back to unverified settlement gross.
Product intent: user explicitly requests AUD-only containment and a A$10 minimum, aligned with currency registry and wallet principal/fee separation in BUSINESS_RULES/MONEY_FLOW. Fee percentages remain unchanged.
User impact/success: AUD Checkout only, clear minimum, anomalous payments held for manual review without credit.
Existing implementation: wallet/page.tsx → create-topup-session → webhook or reconcile-topup → credit_wallet_topup RPC / wallet_topups fallback → fee ledger/cache. RPC/session idempotency preserved. LR-001/012 describe webhook-only mutation, but current reconcile route also credits; preserve that recovery path.
Approach: shared validation of metadata principal/gross, session currency/total and settlement currency/amount; log rejected payments, acknowledge webhook; mock full route I/O in tests.
Affected systems: Checkout creation, two credit paths, wallet input. No database/schema/configuration changes or live calls.
Risks: historical sessions missing valid metadata will require manual review; deployed Stripe account settings and historical transactions are unknown. Existing fallback idempotency is not redesigned.
Validation: mocked routes, existing wallet/currency/Stripe tests, typecheck without incremental writes, build with network blocked. No commits/deploy.


Validation results:
- New test:wallet-topup-aud passes with mocked Stripe/Supabase: forced AUD, Adaptive Pricing disabled, client currency ignored, 9.99 rejected/10 accepted, both RPC/fallback principal credit paths, duplicate RPC outcome, session/settlement currency and gross mismatches, missing/invalid metadata, audit-write failure with HTTP 200/no credit.
- Existing affiliate-wallet-ui (only intentional top-up handler hash updated), currency-seg5-record-currency, ad-spend-stripe-init and money-surface-security tests pass.
- Typecheck --noEmit --incremental false: 68 existing diagnostics in both HEAD extracted under /tmp and working tree using the same generated Next types; zero new diagnostics after repository-root normalization. No tsbuildinfo writes.
- Build passes with dummy Supabase/Stripe/Stripe App keys and network-denying preload (Unix IPC allowed). Initial attempts exposed missing environment settings; no real calls. Existing webhook import-time account lookup was blocked and logged during build.
- Targeted route/helper/test lint passes. Wallet page retains five pre-existing react/no-unescaped-entities errors; no new lint issues. git diff --check passes.
- No DB/schema/migration or runtime configuration changes. package.json changes only test wiring. No files deleted, commits, deployment, remote fetch or external API/database calls. Protected paths unchanged.

Findings: installed Stripe 18.5.0 supports SessionCreateParams.adaptive_pricing.enabled; shared API is 2025-08-27.basil. SDK comments say omitted Adaptive Pricing inherits dashboard settings. Historical create route used one quantity-1 inline price_data line item with selected/default AUD currency and fee-inclusive gross minor units, no explicit payment methods or Adaptive Pricing. Session/PI metadata carry principal/gross/fees. Thus localized USD presentment is consistent with inherited Adaptive Pricing, but dashboard state and actual historical credits cannot be verified offline. Both webhook and reconcile formerly credited numeric topup_amount or, if missing/zero/invalid, balanceTx.amount/100; neither used presentment_details or amount_total as principal. No currency/matching checks existed. RPC and fallback store credited principal in amount_net/credited_amount; settlement amount/fees populate gross/fee fields. New checks hold invalid sessions for manual review, logging and best-effort audit without credit. Historical sessions missing valid AUD quote metadata require review; no historical data repaired. LR-001/012 webhook-only statements are historical: current reconcile also credits.
