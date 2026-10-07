# Affiliate assistant webhook events

**Status:** completed (repository implementation); production activation still requires the migration and environment configuration below.

## Problem
Grok Bot's "Nettmark brand events" routine needs reliable business-side events from Nettmark. The supplied spec requires asynchronous POST delivery, a stable event id for retries, 10s delivery timeout, exponential retry/backoff, current brand/offer context, and no feedback loop from the affiliate assistant's own actions except business-side outcomes/messages.

## Product intent
This supports Nettmark's documented direction toward proactive assistance and automation without adding business-facing setup or removing business approval authority. It aligns with `docs/VISION.md` and `docs/PRODUCT_PRINCIPLES.md`: the assistant receives context and prepares work, while businesses retain campaign/content approval and financial/brand control.

## User impact
No new UI. Existing business and affiliate flows continue normally. Eligible events are queued durably and delivered out-of-band to the configured Grok Bot routine.

## Implemented behaviour
- Added RLS-protected `affiliate_webhook_outbox` with stable event ids, leases, attempts, next-attempt scheduling, delivery/failure state and service-only claim functions.
- Added database triggers for business signup/profile changes, offer create/update, Meta connect/disconnect, Growth plan changes, proposal view/outcome and paid campaign launch/business pause.
- Added route-level queueing for brand-to-affiliate inbox messages and verified attributed sales.
- Added seven-day inactivity enqueueing from Supabase Auth `last_sign_in_at`.
- Added current brand/offer enrichment at delivery time.
- Added Grok webhook POST delivery using `Authorization: Bearer <AFFILIATE_WEBHOOK_KEY>`, a 10-second timeout, stable `event_id`, and retry delays of 1m, 5m, 30m, 2h and 12h before failure.
- Added `AFFILIATE_ASSISTANT_EMAIL` scoping so proposal/message/campaign/sale events for other affiliates are skipped.
- Added a one-minute CRON worker and a manual webhook test sender.
- No Meta access tokens, Stripe secrets or Nettmark credentials are included in webhook payloads.

## Event coverage
Implemented: `brand.signed_up`, `brand.profile_updated`, `offer.created`, `offer.updated`, `meta.connected`, `meta.disconnected`, `plan.upgraded`, `plan.downgraded`, `proposal.viewed`, `proposal.approved`, `proposal.rejected`, `proposal.changes_requested`, `message.received`, `campaign.launched`, `campaign.paused`, `sale.attributed`, `brand.inactive`.

Paid campaign events are sourced from `live_ads`, where business-side approval/termination is observable. Organic campaign pause/launch events are not emitted because the current schema does not reliably identify the actor and the webhook spec says not to echo the assistant's own actions.

## Files
- `supabase/migrations/20261007080000_affiliate_assistant_webhook_outbox.sql`
- `utils/affiliateAssistantWebhook.ts`
- `app/api/affiliate-assistant/webhook-delivery/route.ts`
- `app/api/inbox-messages/route.ts`
- `app/api/process-conversion/route.ts`
- `scripts/affiliate-assistant-webhook.test.ts`
- `scripts/send-affiliate-webhook-test.ts`
- `package.json`
- `vercel.json`

## Validation
- Verified the relevant live public Supabase table/column shapes before writing the migration.
- Reviewed Supabase's current trigger, RLS and secured-function guidance; security-definer functions use a pinned empty search path and exposed RPCs are restricted to `service_role`.
- Fixed the migration's `jsonb_object_keys` aliasing during diff review before production application.
- Vercel successfully built/deployed the initial application-code commit; the final migration-only correction was still deploying at the last repository status check.
- Added `yarn test:affiliate-assistant-webhook` for retry/scoping/SQL guard assertions and `yarn affiliate-webhook:send-test [event|all]` for receiver testing.
- A local full test run was not available in this tool environment. The Next/Vercel build does not substitute for the repository's separate typecheck/lint checks.

## Production activation
Repository work deliberately does not apply the production database migration or write production secrets/configuration. Activation requires:
1. Apply `20261007080000_affiliate_assistant_webhook_outbox.sql` to the Nettmark Supabase project.
2. Configure Vercel production env:
   - `AFFILIATE_WEBHOOK_URL`
   - `AFFILIATE_WEBHOOK_KEY`
   - `AFFILIATE_ASSISTANT_EMAIL`
3. Send a real or scripted `brand.signed_up` test and confirm Grok Bot returns HTTP 200 / starts the routine.

## Remaining known limits
- Current business data does not reliably store contact first name, general brand timezone or structured product lists; webhook payloads use null/empty values rather than inventing them.
- `offers` has no verified status column in the live schema, so an existing offer snapshot is represented as active.
- `inbox_messages` is referenced by app code but was absent from the verified live public schema; message webhook queueing occurs only after that existing route successfully inserts a message.
