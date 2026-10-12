# Inbox conversations MVP — October 2026

**Status:** Implemented on main; authenticated two-account browser QA pending. **Scope:** business ↔ affiliate seeded test accounts, with reusable offer-based permission model.

## Problem and product alignment
The current shared `DbBackedInbox` displays notifications/invitations, not user replies. The previously authored `inbox_messages` migration is **not present** on the live database, and the Inbox currently shows read-only notifications; `app/api/inbox-messages` creates one-way updates. Existing users need direct collaboration within Nettmark (VISION: distribution network; PRODUCT_PRINCIPLES: keep workflows simple and on-platform). We must not create an unrestricted public DM directory or expose private emails, Meta credentials, billing or attribution.

## Existing evidence
- Business/affiliate inbox routes both render `app/components/inbox/DbBackedInbox.tsx`.
- `affiliate_requests` stores offer-linked approved business/affiliate relationships, verified for `contact@nettmark.com` and `jamesmarkets@gmail.com` against offer `525149d9-8cc6-435b-9653-9d2d3199b75f`.
- `profiles` holds verified auth UUIDs and public affiliate username.
- `inbox_messages` is still an un-applied GitHub migration; do not make the new chat depend on it or break existing notification views.

## Implementation
1. Create a single additive `inbox_chat_messages` table with offer, business and affiliate UUIDs, sender UUID, text and read timestamp. RLS: signed-in participants may select; only server-authorised API may insert/mark read. Add unique client message ID for idempotence. Configure realtime publication if available.
2. Add one authenticated API `/api/inbox/chat` for list/send/read, verifying user role and approved offer participation on every write. No client-supplied sender identity accepted. Display public usernames / business name, never partner emails.
3. Add a compact, responsive shared `InboxMessenger` inside the existing Inbox, with Conversations/Updates switcher; keep the legacy alert and launch-invite UI reachable.
4. Realtime subscriptions for new messages plus focus refresh fallback. No unsolicited test messages or fake traffic; both seeded accounts can send manually.

## Safety
Additive table only; no modifications to wallets, offers, old inbox rows, ads or payouts. No broad authenticated INSERT permission; server uses restricted participant resolution and rate/size limits. New SQL and policies verified read-only after migration; no seeding or impersonated chat messages.

## Acceptance
Business can select @jamesmarkets under Nettmark Partner Programme, send a text, affiliate sees it and replies. Messages survive reload, both roles see messages but not counterpart email. Unknown users, unapproved pairings and sender impersonation are rejected; unread states work. Existing Updates remain usable. Preserve desktop and mobile Nettmark design conventions.

## Validation
Production schema and RLS read-back, deployment status, regression tests (including role and unrelated-pair rejection). Authenticated real browser exchange still needs to be run by the test accounts.

## Implementation and validation results (12 October 2026)
- Added `supabase/migrations/20261012134500_inbox_chat_messages.sql` and applied equivalent additive DDL on connected production Supabase as migration `inbox_chat_messages_offer_scoped`.
- Verified table exists, RLS enabled, participant-only SELECT policy in place, authenticated role has SELECT **only**, service role owns writes, and Realtime publication includes the table. Zero message rows seeded or sent.
- Added `app/api/inbox/chat/route.ts` with authenticated GET/POST/PATCH, role verification, approved offer relationship, server-derived sender identity, UUID idempotency and one-minute rate limit.
- Added `app/components/inbox/InboxMessenger.tsx`, integrated into shared `DbBackedInbox.tsx` with Conversations and Updates tabs. Responsive chat UI, realtime INSERT subscription and refresh fallback.
- Existing platform updates and notification source retained; gracefully handle missing legacy one-way `inbox_messages` table in production.
- Added source regression checks in `scripts/inbox-conversations-mvp.test.ts` and NPM script.
- Verified seeded `contact@nettmark.com` ↔ `@jamesmarkets` relationship is **approved** on offer `525149d9-8cc6-435b-9653-9d2d3199b75f`; partner names remain public identifiers.
- Vercel build checked on integration commit; separately running the test script and a logged-in send/receive verification is still pending. No automated messages or user mutations were made.
- No changes to Meta, wallet, billing, attribution, payouts, or campaign state.
