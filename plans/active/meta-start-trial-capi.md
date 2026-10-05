# Meta StartTrial server delivery

## Status
In progress. Production secret configured by founder. No database migration or deployment authorised in this implementation step; prepare and validate a reviewable branch before requesting the required rollout approval.

## Problem and product intent
The founder wants history of genuine business Growth trials on Meta's existing Dataset, without changing CompleteRegistration acquisition campaigns. This supports measurable distribution and dependable commercial infrastructure (docs/VISION.md, docs/PRODUCT_PRINCIPLES.md). No pricing, subscription creation, entitlements, UX, merchant attribution, or revenue behaviour changes.

## Existing implementation
Browser Pixel: utils/marketing/metaPixel.ts, app/create-account/page.tsx. Pixel 465823834246251; no StartTrial/CAPI sender. Server: app/api/business-subscription/webhook/route.ts on Vercel. Checkout sets a 14-day configured Growth trial and requires a payment method. Stripe signature verification and entitlement synchronisation already exist. Existing webhook replay handling skips failed/processing rows and catches handler failures with HTTP 200; preserve billing behaviour and recover reporting independently. No existing durable Meta delivery record.

## Intended behaviour and success criteria
One first genuine Growth trial per business. Signed live-mode Stripe subscription creation with configured Growth price, trialing state, valid configured trial dates, Nettmark metadata and successfully confirmed database subscription. Use stable hashed business event ID, original Stripe trial start, server-only standard StartTrial; no Purchase/value. Suppress test-mode, nonproduction runtime, known internal identities and reserved test email domains. Capture only available checkout cookies/IP/user agent; hash email and stable external ID. Token remains server-only META_CAPI_ACCESS_TOKEN in Vercel Production.

## Approach and affected systems
Add one private delivery table and atomic lease RPC migration (prepare, do not apply), narrow server helper/worker, authenticated existing checkout matching snapshot, safe reporting calls after successful sync and on recorded webhook replay. Reconcile recent signed subscription-created events against confirmed entitlement independently of billing. Use existing CRON_SECRET and Vercel scheduling. Bounded retries, stable payload/event ID, no raw Meta error bodies or tokens in logs. CI includes payload, eligibility, failures, retry/concurrency SQL, route regression and type checks. No browser StartTrial.

## Trade-offs and risks
A small private delivery table is required for durable retries and uniqueness; existing analytics tables do not enforce conversion uniqueness. Meta delivery is at least once; Meta event ID deduplicates ambiguous acknowledgements within a bounded retry window. No billing replay changes. Unknown accounts cannot be recognised as internal without an explicit identity policy; reuse existing internal dashboard allowlist and suppress reserved test domains. Production credentials/domain/Dataset permission require external verification. Test Events validation is not proof of later optimisation eligibility.

## Validation
Pending CI and isolated PostgreSQL migration tests. No genuine Stripe checkout or Meta conversion sent during implementation. Preserve prior business regression suite. Production rollout must apply additive migration before deploying code; token alone does not enable events.

## Rollback
Redeploy previous application revision and stop delivery cron. Retain delivery ledger for deduplication/audit; avoid dropping it after sending events. No subscriptions or charges created by this feature.
