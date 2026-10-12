# Inbox bot report — shared affiliate/business fixes (12 October 2026)

**Status:** Implemented on main; production READY, authenticated visual QA pending.

## Evidence / scope
The founder provided a hands-on bot report: Conversations work for affiliate, but Updates silently swallows a 404 missing public.inbox_messages, nav unread dot never clears after PATCH, textarea has no length feedback, one contact displayed a saved business email instead of a name. Bot did not verify message links, unread reconciliation, or back navigation. Founder additionally requires business inbox review.

Both routes render shared DbBackedInbox + InboxMessenger. Current business_profiles record for test business contains a literal email as business_name, so render a neutral `Business` fallback (do not mutate user data or invent brand names). Production schema has `inbox_chat_messages` but **not** `inbox_messages`. The static inbox_messages migration exists in GitHub but its application is outside this UI/API scope and needs separate production-change approval.

Sidebar root bug: AffiliateSidebar shows approvals as its inbox dot, BusinessSidebar shows pending affiliate proposals as inbox dot, affiliate mobile nav uses notification-only count. None represents chat unread count; sidebar alerts must be decoupled from unrelated approval states.

## Product alignment
VISION (simple participation), PRODUCT_PRINCIPLES (outcomes, clarity), UI_DESIGN_SYSTEM (neutral #151718 cards and cyan #00C2CB). Same behavior across roles, server-authorised partner access preserved. Keep approved offer relationship, server-derived sender ID, existing 3000-char and 15/min limits.

## Implementation
- Shared Updates: never suppress missing legacy-table error; show explanatory warning and Retry while retaining notifications as a partial view, with error-specific empty state and no falsely authoritative counts.
- Extend existing GET /api/inbox/chat with read-only `?unread=1` summary, only counting unread messages for authorised approved partners, no new permissions or writes. Ensure viewerId provided when zero contacts.
- A reusable `useChatUnreadCount` hook for both nav sidebars/mobile menus, reloads on visibility/focus and on successful read event. Replace unrelated approval-based dots; preserve existing notification toasts separately.
- Messenger: explicit unread badge, mark-read refresh event, suppress PATCH for hidden mobile thread until opened; remaining character counter and limit notice, safe rendering of http(s) links only (no raw HTML).
- Sanitise business contact display names that look like emails; fallback 'Business' if no verified human-readable name, preserving actual stored data.
- Add source regression assertions and check Vercel build. Do not send bot replies or mutate production chat records during testing.

## Validation
Read-only Supabase schema verification, source checks for role scoping, business/affiliate parity and old working behavior. Authenticated two-account browser test remains outstanding unless accessible from a suitable test harness.

## Final implementation / verification
- Shared `DbBackedInbox` no longer catches the missing legacy `inbox_messages` table as success. It retains available `notifications` but presents an amber alert explaining partial results and a Retry action; the All/Unread count chips are hidden while the query is incomplete. **No production schema migration applied.**
- `GET /api/inbox/chat?unread=1` returns a read-only unread count, respecting authenticated user identity, approved business-affiliate offer contacts, received messages only and server-side sender checks. When no contacts, returns 0 (and default GET now includes viewerId for completeness).
- One `useChatUnreadCount` hook drives both desktop sidebars and mobile inbox badges; it updates on read completion, focus/visibility and 30s fallback. Sidebar dots no longer reflect unrelated approval/pending ad data. Existing notifications toast continues separately for affiliates.
- Messenger dispatches a custom read-completed event after PATCH 200; mobile auto-selection no longer marks an unopened thread read. Shows remaining input count and a 3000/3000 limit warning. Only HTTPS/HTTP links become safe clickable anchors (escaped React content, noreferrer/noopener). Current mobile back button and selected conversation preserved.
- Verified an affected business-profile test record contains a literal email in `business_name`; the chat contacts API now uses `Business` when a name looks like an email, without rewriting customer data. Both inbox routes share this API/component.
- Read-only production schema checks confirmed `inbox_chat_messages` exists and `inbox_messages` does not. Read-only aggregate check of the seeded business and affiliate found **zero unread chat messages** for each at validation time; previous approval-based nav dots were misleading.
- Source-level test suite `scripts/inbox-bot-report-regression.test.ts` and `test:inbox-bot-report` added. Source invariants checked role-scoped unread, Updates partial-error state, both navigations, contact privacy, 3000 chars, safe links and unchanged POST/PATCH authorisation/rate limits; checks passed. Existing `scripts/inbox-conversations-mvp.test.ts` source requirements remain intact. Production Vercel deployment `dpl_Dz1F7pm5vwmTRoUosTzw5kj7Yw3S` for `7207e65320e67536b89a9b7220c42aac3b3328da` READY.
- **Not independently tested:** authenticated live browser send/reply cycle and responsive UI, standalone `tsx` test runner. No bot reply, production message edit, insert, migration, wallet, Stripe or Meta control action performed.

## Follow-ups requiring separate authorisation or product decision
- The legacy Updates message store remains absent. Restoring these one-way updates requires separately evaluating the existing legacy migration, its RLS, send API and product necessity. This was deliberately not applied to production during a chat UI repair.
- The test business should set a legitimate brand name in its account/profile if it wants that name displayed instead of the generic fallback.
