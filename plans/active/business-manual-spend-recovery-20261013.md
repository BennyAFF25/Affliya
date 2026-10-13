# Business ad-spend recovery control

Status: implementation prepared for review; awaiting executable CI, migration staging and Meta/Stripe integration verification (no production database or deployment changes).

## Problem
A business stop reached Meta successfully but `/api/meta/control-ad` called the secured settlement endpoint without `CRON_SECRET`, resulting in HTTP 401. The cron only scans active/live ads; stopped ads can retain unpaid spend. A general-purpose business-facing settlement API would create abuse and duplicate-transfer risk.

## Product intent
Provide a quiet, recovery-only action on the **business paid campaign detail** when a stopped/paused campaign has previously recorded spend that remains unsettled. Affiliated funds remain affiliate-funded; no business-initiated ad-spend amount, arbitrary transfer recipient, or extra fee is created. Aligns with VISION, PRODUCT_PRINCIPLES, BUSINESS_RULES and MONEY_FLOW.

## Existing flow
`app/api/ad-spend/settle` uses the server-only `settleAdSpendLedger` helper and the `ad_spend_settlements` ledger with unique settlement keys and wallet deduction keys; Stripe transfers are queued and processed by `/api/ad-spend/process-transfer-batches`. Meta spend is synced by `/api/meta/ad-insights` and the five-minute cron for active campaigns only. Current `live_ads` RLS permits affiliate updates, including sensitive values: never trust client-modifiable spend fields without authoritative Meta verification.

## Implementation
- New service-only recovery table with **one immutable per-ad attempt/claim**, durable result/status, RLS, and no client grants. A failed or ambiguous attempt requires support rather than unlimited self-serve retries.
- Guard GET eligibility: session and business ownership, valid paid campaign, stopped/paused for two minutes, unpaid recorded balance, and no prior claim. No client-submitted currency or amount.
- Guard POST: same checks, same-origin; re-verify paused Meta ad, its ad account and campaign, **lifetime spend from Meta**, AUD currency, and matching approved idea; claim uniquely before applying money movement.
- Save verified spend with compare-and-set, then invoke existing idempotent settlement ledger exactly once. Record successes, partials and failures. Existing transfer cron handles queued Stripe transfers.
- Block authenticated/anonymous edits to `live_ads` financial/identity fields with a trigger without affecting service-role sync.
- Render the recovery action only in the business detail view when the endpoint indicates eligibility, with clear warnings, busy state, result and refresh. No affiliate UI or business pricing changes.
- Add static regression checks and review branch diff. No live settlement or migration execution during code authoring.

## Risks and boundaries
- Meta access token rotation or unavailable insights must fail closed. No free-text spend input.
- If a request crashes after a durable claim, lock remains: support must reconcile; it cannot automatically retry an ambiguous charge.
- Existing settlement helper is multi-statement and a partial failure can occur; unique keys, claim and audit mitigate but do **not** make all existing money operations fully atomic.
- The patch is separate from PR #22 (pause/settlement handoff fix). Integrate both before production testing.
- The production database migration must be applied before publishing the route, with deployment authorised separately.

## Validation
21 independent static safeguard checks passed against branch source. The tsx regression suite is committed but has not been executed locally; full TypeScript/build and controlled staged Meta/Stripe tests are pending. Paid launch has been verified as a service-role insert in app/api/meta/callback/upload-video/route.ts, enabling client INSERT revocation in the migration. No production writes or settlement.
