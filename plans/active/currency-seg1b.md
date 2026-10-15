# Currency Segment 1b regressions

Status: in progress; retained at requested active path. No commits, external calls, database changes or deployment.

Problem: strict launch currency enforcement leaked into advisory badges and introduced repeated offer/connection reads. Wizard warning must follow the offer response and exclude organic-only offers.

Product alignment: docs/VISION.md, PRODUCT_PRINCIPLES.md, PRODUCT.md and BUSINESS_RULES.md support progressive setup and independent organic participation. Preserve AUD containment at every launch/money boundary. Segment 1's blanket missing-account badge rule is superseded by explicit founder instructions here; unknown campaign currency still blocks.

Approach: add a separate advisory evaluator and request-local batch offer/connection loader. Inject advisory results only in pending/review endpoints; keep default funding and money callers strict. Resolve exact selected pair, or unique fallback Page/account, using newest matching connection. Reuse existing offer lookup in pending endpoint. Publish offer warning state immediately and render outside downstream wizard work; use repository organic-only definition (no selected Page/account) and organic mode to suppress paid warning.

Evidence: utils/currency/paidCurrencyGuard.ts, utils/offerReadiness.ts, utils/paidCampaignLaunchReadiness.ts, pending-paid-proposals and review-readiness routes, promote page/wizard; create-offer explicitly describes missing Page/account as organic-only. No persisted allow-paid/campaign-type offer column verified; do not invent schema. Existing strict launch, upload, launchFund and settlements remain unchanged.

Validation: mocked advisory matrix, constant currency query counts, wizard early rendering/suppression, existing strict safety regressions; typecheck, lint, build with network disabled. Compare pre-existing diagnostics against HEAD. No production behavior or timing can be measured under no-external-call constraint.

## Completion evidence

Status: completed locally; retained in `plans/active/` at the explicit requested path. No files deleted.

- Added advisory evaluator and batch context loader in `utils/currency/paidCurrencyGuard.ts`. Proposal currency wins; NULL falls back to offer. Missing account/currency allows ordinary readiness, known non-AUD selected connection blocks, unknown/non-AUD campaign currency blocks. Exact pair and newest row selection preserved. Strict guard implementation unchanged.
- Pending endpoint reuses its offer batch and adds one connection batch; review endpoint uses two currency context reads. No currency guard reads inside proposal loops. Existing unrelated readiness/funding queries remain unchanged. Funding accepts advisory context only at those two endpoints; launch/upload/reserve/redemption/settlement/reimbursement callers retain strict checks.
- Warning moved from wizard to `PaidCurrencyWarning` above downstream panels; currency and paid eligibility update immediately from offer fetch, before participation reads. Organic mode and organic-only offers suppress this paid warning. No invented offer permission columns.
- Added `test:currency-seg1b`, covering named proposal rendered badges, fallback/override/unknown values, missing/foreign account rules, newest exact pair, unrelated account isolation, query counts for 1/30 distinct offers, and warning rendering/suppression. Extended pending route batching test from 14 to 140 proposals, asserting one offer and one connection query and advisory context injection.

Validation (all Node commands use `/tmp/currency-no-network.cjs`, rejecting fetch, HTTP/HTTPS and TCP; local Unix IPC allowed):
- PASS: test:currency-seg1b, test:currency-seg1, test:pending-proposals-batching, test:meta-campaign-configuration, test:test-user-findings-round-6, test:launch-fund.
- Typecheck executed with build info redirected to `/tmp/currency-seg1b.tsbuildinfo`: existing errors, 63 source diagnostics exactly matching clean HEAD (file/code/message comparison ignoring shifted line numbers); no new source errors. Generated Next route errors also pre-exist; build regenerates its route types.
- Lint executed: existing 2,995 errors and 3 warnings, exactly matching clean HEAD by file/rule/message; no added diagnostics.
- Build PASS with NEXT_TELEMETRY_DISABLED=1 and placeholder SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY and STRIPE_APP_SECRET. Earlier attempts compiled but page collection needed the additional placeholder variables. Existing config skips build type/lint; separately checked above.
- PASS git diff --check. No edits to tsconfig.tsbuildinfo, /api/meta/ad-insights, migrations, database/configuration files, strict launch or money paths. package.json change only wires the mocked test. No external calls, database operations, Meta/Stripe writes, commits, pushes or deployments.
- Initial working tree clean. HEAD 75745a8; local main 79cd0a3. Remote not fetched because external calls prohibited. Compared against clean HEAD extracted locally under /tmp.

Human review / limitations:
- Verify actual post-change latency and existing ordinary readiness labels in a separately authorized environment. No production or real-user session accessed.
- Verify Accepted Payments' saved Page/account selection. Repository offer creation defines organic-only by missing selected Page/account; if organic-only, warning suppression intentionally wins. Otherwise GBP warning appears as soon as offer response resolves, regardless of wallet/reach/participation loads.
- Historical connection identity limitation from Segment 1 remains: current offer selection cannot prove original account identity. No financial/attribution changes attempted.
