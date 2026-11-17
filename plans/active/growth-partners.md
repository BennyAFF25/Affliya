# Growth Partner Programme

Status: in progress; offline implementation, senior review and staging SQL/e2e validation required.

## Outcome and alignment
Founder-requested referral-only programme: selective application, approval, passwordless access, immediate referral URL, privacy-preserving dashboard and manual admin-approved subscription commissions. Extends creator attribution rather than marketplace affiliate money flows. Aligns with VISION network growth, PRODUCT_PRINCIPLES minimal setup and explicit financial control. Founder explicitly revises the creator attribution default and commission calculation. Business-funded advertising wording follows this instruction; VISION also describes affiliate-funded advertising, so no existing marketplace behaviour changes.

## Verified current behaviour
`utils/creatorReferrals.ts`, migration `20260728110000_creator_referral_attribution.sql`: shared first-touch cookie, email intents, permanent unique business attribution and service-role ledger. Existing calculation uses gross invoice amount, counts by subscription including reversed rows, lacks active check; replace these. Existing webhook audits Stripe event IDs before processing, so reporting failures require reconciliation rather than billing replay. Stripe version `2025-08-27.basil`; support older/newer invoice shapes defensively. Existing signup trigger ignores auth users with no metadata role. Auth-helpers route cookies match server-component cookies. Internal allowlist comes from marketing helper. Email renderer actual palette differs from UI doc; reuse renderer unchanged. Local main inspected; no fetch permitted. No relevant existing programme plan found.

## Approach / boundaries
1. Add additive migration and explicit undo preserving existing creator rows; extend shared tables, add applications, audit and manual payouts. RLS service-role only. SQL locks enforce payout ownership/currency/status and hold; no money movement.
2. Growth role is creator_partners.program + user_id; profiles role remains business/affiliate. Approval links existing auth identities or creates role-less identities. Auth magic-link confirm uses auth-helpers. Explicit marketplace opt-in creates affiliate profile only when absent.
3. Reuse cookie/intents/attributions with 60-day first-touch, captured_at, new-business checks, self-referral rejection and immutable attribution. /r redirects preserve marketing parameters. Isolated checkout fallback and metadata insertion.
4. Replace commission basis with collected monthly subscription revenue excluding tax, discounts, credits and other fees, capped by collection. AUD without reported tax removes 1/11 by default. Three successful unreversed periods per business, suspended partners excluded, 14-day approval hold. Unique invoice and audit keys; refunds reduce unpaid amounts or create negative clawbacks after payment. Transactional SQL needed wherever concurrent financial mutations require serialization.
5. Hidden noindex application/login/dashboard and allowlisted internal admin. Canonical renderer, guarded nonproduction recipients, best-effort Lead reporting with shared event ID, no secrets/tokens logged.

## Decisions — Ben to confirm
60-day window; eligible billing reasons limited to subscription_create/subscription_cycle; AUD advertised price GST-inclusive fallback; fully reversed periods release a slot; suspended partners receive no new commissions; no rejection email in v1. Implement as instructed pending confirmation.

## Edge cases / risks
Retry approval after auth user creation; existing affiliate/business identity preserved. Reapplication after rejection; pending duplicate no duplicate Lead. First touch cannot overwrite permanent attribution. Free/failed/nonmonthly/proration/manual invoices excluded. Paid refunds net next payout; no automatic transfer. Cross-currency payouts rejected. SQL and live identity/schema behaviour require reviewer validation. Shopify PR #39/#41 overlap: webhook and checkout insertions isolated; no billing_provider/fee changes. Shopify-billed businesses have no Stripe invoice and earn no growth commission in v1.

## Rollout / recovery
Review forward SQL and undo; apply forward migration to staging before deploying application code, run staging e2e incl auth cookies and concurrent payout/refund/approval cases, then explicit production migration/deploy authorisation. Never run undo after payouts without reconciliation: undo removes programme metadata and converts approved back to payable. Retain/export audit/ledger before rollback. Environment: CREATOR_REFERRAL_ATTRIBUTION_WINDOW_DAYS, GROWTH_PARTNER_ASSUME_AUD_GST_INCLUSIVE, GROWTH_PARTNER_COMMISSION_HOLD_DAYS, GROWTH_PARTNER_IP_HASH_SALT, NON_PRODUCTION_EMAIL_ALLOWLIST, ADMIN_NOTIFY_EMAIL; reuse Supabase, Resend, Meta, rate-limit and canonical URL config. Production Meta CAPI only with VERCEL_ENV=production and configured token. Nonproduction emails default to QA mailbox (+aliases).

## Validation evidence
Pending: in-memory programme tests; existing creator, funnel, signup, route auth, money, email, auth limiter, subscription tests; nonincremental tsc; changed-file eslint; scope/diff review. No network, DB, deployments, commits or pushes authorised. Do not touch tsconfig.tsbuildinfo or protected pages.
