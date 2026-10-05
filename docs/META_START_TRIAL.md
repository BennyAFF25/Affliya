# Nettmark StartTrial reporting

## Status and rollout
Prepared on codex/meta-start-trial-capi. Not live until the additive delivery migration is explicitly approved/applied and the application is deployed. META_CAPI_ACCESS_TOKEN is a sensitive server-only Vercel Production variable; never expose or commit its value. Existing public NEXT_PUBLIC_META_PIXEL_ID selects the same Dataset as the browser Pixel (fallback 465823834246251). Existing CompleteRegistration campaigns stay unchanged.

Apply supabase/migrations/20261005080000_meta_start_trial_delivery.sql before deploying. Verify the private table/RPC and existing CRON_SECRET. Never replay billing to repair a Meta delivery. No new subscriptions, trials or charges are created by reporting.

## Event definition
Standard server-only StartTrial: first live-mode business Growth trial, actual configured price, Stripe trialing snapshot with the configured 14-day dates, correct Nettmark/business/user metadata, verified business profile and a confirmed matching Nettmark entitlement subscription. Signature-verified subscription.created is primary. Verified checkout.completed with a retrieved actual trial subscription can recover the same event. Current trial-used flags, page visits, CTA clicks and checkout creation are not triggers.

The event time is Stripe trial_start, not processing time. Event ID is a stable opaque business hash. No value or Purchase is sent. Later cancellation does not invalidate a genuine original trial. Trial state changes do not generate new events.

## Delivery and matching
One private delivery row per business; atomic RPC leases prevent competing workers from sending concurrently. Retries keep the same ID/time/payload; delivery attempts are bounded to 24 hours after first attempt and recent events only. Record acknowledgement only after Meta reports one received event. Uncertain delivery acknowledgements may be retried with the same ID for Meta deduplication. Expired rows require investigation; do not silently invent a new event ID or reset event time.

Webhook reporting errors do not change billing responses or entitlements. The authenticated CRON_SECRET worker retries every five minutes and independently recovers recent subscription.created events from Stripe and confirmed Nettmark state. Recovery inspects up to 500 recent events and retrieves at most 20 missing snapshots per run; investigate backlog if that capacity is exceeded.

Email and the stable user ID are normalised and SHA-256 hashed. Existing cookies _fbp/_fbc, trusted Vercel client IP and original checkout user agent are supplied only when available. No derived/fabricated fbc, phone/name/address, or Stripe webhook IP/user agent. Matching snapshots are copied from the existing private checkout event into the private delivery record; consumed snapshot data is removed from checkout attribution, and delivery matching data is removed after acknowledgement or expiry. Abandoned checkout snapshots remain in the private checkout analytics table under its existing retention policy.

Production sends require VERCEL_ENV=production and a configured token. Stripe test-mode events, nonbusiness identities, known internal dashboard allowlist emails, reserved example/test domains and obvious test/dummy email prefixes are excluded. Extend the existing INTERNAL_MARKETING_DASHBOARD_EMAILS list if other internal live-mode test accounts must be excluded; the app cannot infer every test identity.

## Safe Meta Test Events verification (after deployment)
1. Open Events Manager, Dataset 465823834246251, Test Events. Copy the test-event code; it is not the CAPI access token.
2. Sign in using an account in Nettmark's existing internal dashboard allowlist. Use an owned internal business that is eligible for a new Growth trial. Complete the real Stripe checkout explicitly; current billing rules require a card. The test route never creates a subscription or grants eligibility.
3. In Stripe Dashboard's live-mode Events list, locate that subscription's customer.subscription.created event and copy its evt_ ID. The original event must show trialing with the configured Growth price and trial dates.
4. On www.nettmark.com while signed in as that internal user, run the following browser console request, replacing only the nonsecret test code and Stripe event ID:

```js
fetch("/api/internal/meta-start-trial/test", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    testEventCode: "TEST_CODE_FROM_EVENTS_MANAGER",
    stripeEventId: "evt_YOUR_CONFIRMED_INTERNAL_TRIAL_EVENT"
  })
}).then(async response => ({ status: response.status, body: await response.json() })).then(console.log);
```

5. Expect HTTP 200 and ok:true. In Meta Test Events verify StartTrial, Server connection, original trial time, test_ event ID and hashed matching fields. The internal test endpoint sends only with test_event_code, uses a distinct test_ ID, and creates no production delivery row.
6. Repeat the same request: the event ID stays identical. Confirm Meta deduplication rather than assuming repeated delivery equals a new conversion.
7. Open and abandon another checkout. No subscription-created trial event, production delivery row or automatically sent StartTrial should appear. A trial click/checkout session ID cannot be used as proof in the test endpoint.
8. Cancel the controlled real trial before its billing date if you do not intend to continue Growth. Known internal identities remain excluded from automatic production reporting.

The controlled internal test may use a genuine live-mode trial; initial trial payment is zero, but normal billing begins later unless cancelled. The test endpoint only verifies/delivers an existing confirmed trial and never sends Purchase.

## Production verification and future optimisation
After a genuine external business trial, check the private delivery row reaches sent, has one stable event ID and the original event timestamp. Replay the Stripe webhook safely through Stripe's delivery retry UI: no additional row or conversion should result. Never use a browser StartTrial separately without sharing the same event ID.

Events Manager should display Server StartTrial on the existing Dataset. No manual custom conversion is required for this standard event. History begins only after actual production delivery. Keep CompleteRegistration optimisation unchanged. Future StartTrial campaign eligibility/volume/matching quality must be checked in the live ad account; reporting alone is not proof of sufficient optimisation signal.

## Rollback and monitoring
Redeploy the previous application revision to stop the sender/worker. Keep the delivery ledger so sent events retain durable deduplication. Monitor pending/expired counts and safe error codes; never output payloads, customer data or access tokens. Existing webhook billing replay limitations remain; this feature repairs reporting independently without changing those financial paths.
