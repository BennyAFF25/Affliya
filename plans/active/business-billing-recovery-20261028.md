# Growth payment recovery — 28 Oct 2026

**Status:** Code ready for review; production migration, configuration and deployment not performed.

## Problem and intent
Live A$49 Growth subscription invoices are remaining unpaid after trial conversion. The existing hourly trial-reminder scheduler sends pre-billing emails, but the Stripe subscription webhook does not send billing failure reminders. Implement an opt-in, minimal recovery journey today without changing pricing, cards, invoice payment attempts, subscriptions, permissions or Stripe retry policies. Nettmark's product guidelines call for clear, simple, low-friction billing and retention.

## Existing verified paths
- `app/api/business-subscription/trial-reminders/route.ts`: established CRON_SECRET, Resend and canonical email renderer patterns.
- `app/api/business-subscription/webhook/route.ts`: synchronises subscription entitlement state; already subscribes to failed/paid invoice Stripe events. Do not embed email sends in the webhook.
- `app/api/business-subscription/create-portal-session/route.ts`: authenticated Stripe Customer Portal for business owners. Stripe portal supports payment method updates.
- `business_entitlements`: source of discovery; Stripe subscription/latest invoice is source of truth.

## Implementation
1. `utils/billingRecovery.ts`: deterministic immediate/48-hour/five-day stage selection; copy.
2. `app/api/business-subscription/payment-recovery/route.ts`: bearer-protected, feature-flagged hourly cron. Discover past-due/unpaid business subscriptions, retrieve live Stripe subscription and invoice, verify outstanding invoice, currency, ownership and email; reserve stage; recheck live invoice; send canonical Resend email linking to Stripe-hosted invoice; persist delivery result.
3. `supabase/migrations/20261028093000_business_billing_recovery_emails.sql`: unique invoice+stage send ledger with service-role-only access, retryable pending sends. Migration must precede enabling feature flag.
4. `vercel.json`: hourly cron offset from trial reminders. No changes to billing state.

## Intentional trade-offs and boundaries
- No separate immediate Stripe webhook emails: hourly discovery avoids coupling Resend delivery to payment-webhook state; first notification may take up to an hour.
- For the first release, only Stripe `past_due` or `unpaid` subscriptions with unpaid attempted AUD invoices in the past 30 days receive reminders. No chase of canceled businesses or grandfathered subscribers. If invoice is paid before send, skip.
- The recovery cron is OFF unless `BILLING_RECOVERY_EMAILS_ENABLED=true`.
- Invoice lifecycle is the source of truth; unsynchronised local status may delay discovery. Separate webhook replay/reconciliation review remains recommended.
- The scan caps at 400 accounts/hour and needs pagination for larger volumes.
- Resend idempotency keys mitigate duplicates; a sent-but-unrecorded message that is retried after >24h remains an edge case. The send ledger limits retries to three.
- Verify whether native Stripe failed-payment emails are enabled before activating application reminders to avoid duplicates.
- Do not change billing, Stripe account configuration, production database or deployment without separate explicit instructions.

## Validation
- Added pure milestone/copy regression test `scripts/business-billing-recovery.test.ts`.
- Pending in repository CI / runnable checkout: `node --import tsx scripts/business-billing-recovery.test.ts`, `yarn typecheck`, `yarn test:business-subscriptions`, `yarn test:email-ui`, sandbox Resend/Stripe end-to-end dry run. None claimed as passed in this plan.
- Gate live emails on successful production SQL migration, verified Stripe recovery email settings, QA and explicit deployment/enablement approval.

## Rollback
Remove/disable `BILLING_RECOVERY_EMAILS_ENABLED` (or set false) to stop sends immediately. Revert code/cron if necessary. The append-only recovery ledger can remain for audit; no data deletion is required.
