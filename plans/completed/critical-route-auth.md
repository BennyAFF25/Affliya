# Critical route authorization
Status: completed (local implementation; live verification excluded by request).
Problem: five privileged routes lack verified caller/owner authorization; stripe-app logs part of its secret.
Product intent: explicit founder request, aligned with VISION/PRODUCT_PRINCIPLES reliability and meaningful user control; preserve UX and commercial behavior. PRODUCT/BUSINESS_RULES, ARCHITECTURE/DATABASE/MONEY_FLOW/META_ADS and active Segment A/B/E plans reviewed. Older docs describe superseded refund/settlement code; retain current implementation.
User impact: legitimate owners retain existing actions; other callers get 401/403. Browser cookies already sent by same-origin fetch. Harness refund/payout now require incoming CRON_SECRET, then forward it to avoid an unauthenticated proxy bypass.
Existing implementation/callers: /tmp/critical.md. Stable identities from 20260512105500 migration and business profile trigger; existing cookie getUser pattern and ad-spend/settle secret check.
Approach: injectable authorization wrapper, shared existing cron check, narrow route integration; sanitize control actor/skipSettlement, verify Connect reuse belongs to profile; no business logic changes.
Success: denied callers never reach work; owner and trusted server pass mocked work. Existing guards/retry logic retained.
Trade-offs: wrapper reads JSON before work using clone, keeping existing handler implementation; no new admin bypass without a legitimate admin caller.
Risks: no live schema/config evidence allowed; prod secret and browser session behavior need operator verification. No DB/config/deploy actions.
Validation: mocked auth matrix + related tests and TypeScript; results recorded below.

## Completion
Implemented five authorization bindings, injectable core/server adapter, extracted existing settle cron helper, guarded harness forwarding, removed partial Stripe secret logging and added package runner. Browser callers retain cookie credentials. Five original work handler bodies verified byte-for-byte unchanged after stripping bindings. No migrations, production config changes, DB/network actions, deployment, commit or push.
Validation: new offline auth matrix passes; ad-spend-stripe-init, auth-rate-limit, segA-atomic-holds, segB-refund, segC-fx-rates, segE-commission-block, segE, segE2 and money-surface-security pass. TypeScript has only the expressly excluded pre-existing cron/fx-rates generated-types export error. Two older suites reproduce baseline failures: currency-seg5-record-currency references removed recordWalletRefund; segB transfer fixture omits campaignCurrency. No unrelated financial logic changes made to satisfy stale tests. git diff --check passes.
Remaining risks/follow-up: no deployed schema/cookie/secret/off-repository caller verification allowed. Existing CRON_SECRET required for harness refund/payout. Full caller map, requirements, files and test evidence in /tmp/critical.md. No new product-direction or commercial conflict identified.
