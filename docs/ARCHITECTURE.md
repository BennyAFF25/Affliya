# Nettmark architecture

> Repository evidence as of 2026-10-02. Static inspection only: live database schema, deployed configuration, external account state, and production behavior were not verified. Paths below are relative to the repository root. Historical LR reports may describe older behavior.

## Repository map

| Area | Evidence and responsibility |
|---|---|
| Framework | `package.json` declares Next.js `^15.2.6`, React `19.2.1`, TypeScript, Supabase and Stripe SDKs. These are manifest declarations, not proof of installed runtime versions. `app/` contains App Router pages, layouts, and route handlers. |
| UI | `app/components/`, `components/`, `context/`; Tailwind/PostCSS configuration and `app/globals.css`. |
| Shared business logic | `utils/approvals/`, `utils/offers/`, `utils/tracking/`, `utils/wallet/`, `utils/adSpend/`, plus entitlement, subscription, subsidy, and launch-fund utilities. Inspect these before duplicating logic in a page or route. |
| Persistence | Supabase browser/session clients and service-role server clients under `utils/supabase/`; SQL migrations and selected rollbacks under `supabase/`. |
| External services | Meta Graph requests under `app/api/meta/`; Stripe/Connect under `app/api/stripe/` and payout routes; subscription handlers under `business-subscription/` and `stripe-app/`; email helpers in `lib/email/` and `utils/email/`. |
| Scheduled work | `vercel.json` schedules `/api/meta/sync-active-ads` and `/api/ad-spend/process-transfer-batches` every five minutes. Both handlers check `CRON_SECRET`. |
| Validation | `package.json` contains focused TypeScript test scripts, typecheck, lint, build, and verify commands. `.github/workflows/marketing-dashboard.yml` runs a focused marketing test/typecheck. |

## Main execution boundaries

1. Authenticated dashboards and onboarding pages read/write Supabase directly for some operations; others call Next.js route handlers.
2. Session-aware routes use Supabase `auth.getUser()` and explicit ownership checks. Service-role clients bypass ordinary caller RLS boundaries; authorization must be verified at each route.
3. Tracking endpoints ingest storefront/browser events, resolve commercial identity, persist events, and hand conversions to a separate processor.
4. Commission creation records liabilities; payout execution performs external money movement. Ad-spend ledger application and Stripe reimbursement are also separate stages.
5. Database triggers can fill stable identities, enforce paid subscription activation, initialize business records, or reserve subsidies. A route-only trace is incomplete without the relevant migrations.

## Important caveats

`middleware.ts` only redirects the business dashboard based on a plan-choice cookie. It is not a global authentication or role gate. Review layouts, handlers, and RLS rather than assuming middleware protects all endpoints.

No checked-in Supabase Edge Function implementations were found, and no `functions.invoke`/`functions/v1` calls were found in `app/`, `utils/`, or `scripts/`. Historical operator docs mention Edge Function logs; deployed functions and any off-repository schedulers remain unknown.

`types/supabase.ts` is a sample `users` interface, not generated commercial schema. The checked-in SQL snapshot is dated February 2026. See [DATABASE.md](DATABASE.md).

`next.config.js` skips type and lint failures during builds. Run separate checks; inspect whether declared commands work with the installed tool versions before relying on them. Some manifest commands can reference absent files.

## Before changing a flow

Trace UI → handler → shared utility → tables/triggers → external API/webhook → displayed result. Preserve existing implementations and verify retries, partial failure, authorization, and amount units for high-risk changes. Do not push, deploy, apply migrations, or change remote configuration without instruction.
