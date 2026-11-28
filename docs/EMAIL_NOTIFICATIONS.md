# Email notifications

Nettmark sends transactional emails through Resend.

## Inbox notification email

`app/api/inbox-messages/route.ts` sends an email copy after the `inbox_messages` row has been inserted. The email sender is intentionally server-side only; do not expose a generic public email API for arbitrary recipients. Inbox/message creation treats email as best-effort and should succeed even when email delivery is skipped or fails.

Required environment variables:

- `RESEND_API_KEY` — Resend API key.
- `RESEND_FROM_EMAIL` — verified sender email/domain in Resend.

Optional environment variables:

- `RESEND_FROM_NAME` — sender display name, defaults to `Nettmark`.
- `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SITE_URL` — public app origin for relative inbox links. Falls back to `VERCEL_URL`, then `https://www.nettmark.com`.

If `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing, the route returns `{ ok: true, skipped: true }` and logs a masked recipient so inbox writes are not blocked.


## Canonical email UI

All Nettmark transactional email UI must render through `utils/email/renderNettmarkEmail.ts`.

The renderer owns the shared visual language:
- dark `#0F0F0F` page background
- `#151718` Nettmark card surfaces
- `#00C2CB` primary accent
- shared logo/header, badges, detail rows, notices, CTAs and footer
- pill-shaped primary and secondary actions
- table-based layout for email-client compatibility

Email routes/templates should provide content and state only. Do not add standalone full HTML documents to individual routes.

The legacy `lib/email/templates.ts` API remains for compatibility, but its templates now delegate to the canonical renderer. Old launch-era messaging such as "first 150 users free for life" has been removed.

## Growth billing emails

Spec and copy: `/workspace/nettmark/legal/refund-policy-2026-11-27/04-billing-emails-spec.md` (E1–E8). All go from `RESEND_FROM_EMAIL` with Reply-To contact@nettmark.com and the footer "Nettmark Pty Ltd · ABN 51 690 432 298 · Manage or cancel: {portal}".

- **Ledger emails** (E1 trial started, E4 trial converted / receipt, E6 cancelled for non-payment, E7 cancellation confirmations, E8 refund): `app/api/business-subscription/webhook/route.ts` enqueues rows in `business_billing_notifications` through `utils/billingNotificationsServer.ts` (never sends inline; failures are logged and the webhook still returns 200). `app/api/business-subscription/billing-notifications/route.ts` (cron every 5 minutes) re-checks the Stripe object, renders with `renderNettmarkEmail` and sends with idempotency key `billing/{kind}/{stripe_object_id}`; max 3 attempts. Flag `BILLING_NOTIFICATIONS_ENABLED`; per-kind allowlist `BILLING_NOTIFICATION_KINDS`. Outside production only the QA mailbox and `NON_PRODUCTION_EMAIL_ALLOWLIST` receive mail; in production internal/test addresses (`excludedTrialEmail`) are skipped.
- **Trial reminders** (`trial-reminders` cron): E3 (2 days before trial end, all cohorts) behind `TRIAL_BILLING_REMINDERS_V2_ENABLED`; optional E2 (7 days) behind `NETTMARK_DAY7_TRIAL_REMINDER`. Onboarding nudges on days 1, 3 and 10 are unchanged.
- **Failed payments** (E5): existing `payment-recovery` cron, copy updated, still behind `BILLING_RECOVERY_EMAILS_ENABLED`.
- **Avoiding duplicates with Stripe's own customer emails:** while Stripe's successful-payment and refund receipts are on, leave `payment_receipt`, `trial_converted` and `refund` out of `BILLING_NOTIFICATION_KINDS`. While Stripe's failed-payment emails are on, keep `BILLING_RECOVERY_EMAILS_ENABLED` off. While Stripe's 7-day trial reminder is on, keep `NETTMARK_DAY7_TRIAL_REMINDER` off.
