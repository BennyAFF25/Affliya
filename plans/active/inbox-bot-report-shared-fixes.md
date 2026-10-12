# Inbox bot report — shared affiliate/business fixes (12 October 2026)

**Status:** Implementing on main.

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
