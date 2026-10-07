# Affiliate assistant webhook events

**Status:** in progress

## Problem
Grok Bot's "Nettmark brand events" routine needs reliable business-side events from Nettmark. The supplied spec requires asynchronous POST delivery, a stable event id for retries, 10s delivery timeout, exponential retry/backoff, current brand/offer context, and no feedback loop from the affiliate assistant's own actions except proposal outcomes and brand messages.

## Product intent
This supports Nettmark's documented direction toward proactive assistance and automation without adding business-facing setup or removing business approval authority. It aligns with `docs/VISION.md` and `docs/PRODUCT_PRINCIPLES.md`: the assistant receives context and prepares work, while brands keep control over proposals/campaign approvals and financial/brand risk.

## User impact
No new UI. Existing business and affiliate flows continue normally. Eligible business events are queued in the background and delivered to the configured Grok Bot routine.

## Intended behaviour
- Queue durable webhook descriptors for brand signup/profile changes, offer create/update, Meta connect/disconnect, Growth plan changes, proposal view/outcome, assistant-targeted brand messages, assistant campaign launch/pause, attributed sales, and brand inactivity.
- Enrich queued events with current brand/offer snapshots at send time.
- POST JSON to `AFFILIATE_WEBHOOK_URL` using `Authorization: Bearer <AFFILIATE_WEBHOOK_KEY>`.
- Scope proposal/message/campaign/sale events to `AFFILIATE_ASSISTANT_EMAIL`; never echo the assistant's own outbound activity.
- Retry failed deliveries with stable `event_id` and bounded backoff.
- Never put Meta access tokens or Nettmark secrets in payloads.

## Existing implementation
- Business/profile/offer and Meta data are in Supabase; several flows write directly from client pages, so route-only instrumentation would miss events.
- Existing scheduled workers use `CRON_SECRET` and Vercel Cron.
- Existing Meta StartTrial reporting demonstrates a durable delivery queue + claim/lease pattern.

## Affected systems
Supabase migration/triggers, Next.js server utility, one cron route, Vercel cron config, inbox message route, tests/scripts.

## Implementation approach
1. Add RLS-protected `affiliate_webhook_outbox` with service-only claim RPC and trigger functions.
2. Add triggers for existing authoritative tables; use a route-level enqueue for inbox messages because that table is not present in the verified live public schema.
3. Build server-side payload enrichment/delivery with filtering, timeout, retry and safe auth header.
4. Add cron route and Vercel schedule.
5. Add focused tests and a manual test sender script.

## Trade-offs
Database triggers are preferred over sprinkling HTTP calls through product flows because direct browser Supabase writes exist. The external network call remains outside the transaction: triggers only enqueue locally.

## Risks
- Production migration and environment variables are separate production actions and are not applied by this repository patch.
- Current public schema has no reliable general brand timezone/contact-first-name fields; payloads preserve nulls rather than inventing values.
- `offers` currently has no status column; webhook offer status is derived as active while the row exists.
- `inbox_messages` is referenced by application code but absent from the verified live public schema; the migration adds its trigger conditionally if that table exists.

## Validation
Planned: static diff review, focused TypeScript test coverage, SQL assertions, and post-push repository checks.

