# Nettmark transactional notifications

New customer notifications are **off by default**. Do not turn on flags or apply this migration to the production database without a separate release approval.

## Scopes

- subscription = **Nettmark** Stripe account, \`/api/business-subscription/webhook\`.
- platform = **Platform Transactions** Stripe account, wallet, ad spend, payouts.
- product = internal Nettmark partner messaging and campaign events.

Never use subscription Stripe credentials in Platform Transactions routes, or vice versa. Notification send and delivery logic must never change financial state.

## Release steps

1. Review and merge the PR after CI and test-event checks.
2. Apply \`supabase/migrations/20261023120000_transactional_notification_outbox.sql\`; verify RLS and service-role-only RPC.
3. In a *test deployment only*, set \`NETTMARK_NOTIFICATION_ENQUEUE_ENABLED=true\`, \`NETTMARK_NOTIFICATION_SEND_ENABLED=true\`. Provide test Resend sending configuration and \`CRON_SECRET\`. Test all notification kinds without real charges or transfers.
4. Configure and test Resend Svix delivery webhook \`/api/notifications/resend-webhook\` with \`RESEND_WEBHOOK_SECRET\`.
5. Audit any Stripe built-in failed-payment email notifications. Avoid duplicate billing reminders; preserve Stripe Smart Retries, entitlements, subscription cancellation behaviour and prices unchanged.
6. Before production activation, inspect backlogged outbox rows. Set neither flag in production until specifically approved. Backfill of old failures requires separate approval.
7. Verify \`/api/notifications/dispatch\` is protected by Vercel Cron's Bearer \`CRON_SECRET\`; inspect delivery and failure logs.
8. Roll back immediately by setting \`NETTMARK_NOTIFICATION_SEND_ENABLED=false\`, then stop producers with \`NETTMARK_NOTIFICATION_ENQUEUE_ENABLED=false\`. No money movement is impacted.

## Design

Enqueue after *confirmed* application outcomes and only through the service role. Dedicated outbox has unique event key + recipient, atomic row claiming with stale-lease recovery, bounded retry and disabled delivery by default. Render with \`renderNettmarkEmail\`. All customer CTAs point to Nettmark-owned authenticated routes, not customer-supplied external URLs. Financial notifications must describe the confirmed financial stage (wallet credit, Stripe transfer), not assumed bank arrival.

## Testing

Use mocked Stripe events and an isolated database or Supabase test project. Test duplicate events, Resend errors, later payment recovery, cancelled invoices, multiple recipients and retry exhaustion; never simulate these cases with live financial mutations.


## Preview safety and CI verification (2026-10-23)

The PR branch has branch-specific Preview-only placeholder values for \`SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`, \`STRIPE_SECRET_KEY\`, \`STRIPE_APP_SECRET\`, and \`RESEND_API_KEY\`. Both notification flags explicitly equal \`false\`. These tokens are deliberately invalid, cannot communicate with real services, and must **not** be copied to production or main-branch Preview config.

The notification-specific workflow runs isolated rendering/flag tests, targeted ESLint, touched-module TypeScript diagnostics and a production-style Next.js build with the same inert variables. The full build may not exercise external systems; real integration and webhook tests remain a release gate.

Existing Business trial-first workflow may fail for unrelated baseline lint diagnostics; review that workflow independently rather than editing unrelated onboarding modules in this change.
