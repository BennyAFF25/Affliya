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
