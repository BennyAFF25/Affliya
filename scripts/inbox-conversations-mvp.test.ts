import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/inbox/chat/route.ts", "utf8");
const inbox = readFileSync("app/components/inbox/DbBackedInbox.tsx", "utf8");
const messenger = readFileSync("app/components/inbox/InboxMessenger.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20261012134500_inbox_chat_messages.sql", "utf8");

// Security: only signed-in business and affiliate roles with approved offer
// relationships can create, view or mark their messages read.
assert.match(route, /session\.auth\.getUser\(\)/);
assert.match(route, /"profiles"\)\.select\("id,email,role"\)/);
assert.match(route, /const allowedStates = \["approved", "active", "accepted"\]/);
assert.match(route, /"affiliate_requests"/);
assert.match(route, /String\(offer\.business_email\)\.toLowerCase\(\) !== businessEmail/);
assert.match(route, /contacts\.find\(\(c\) => c\.offerId === offerId && c\.affiliateUserId === affiliateUserId\)/);
assert.match(route, /ctx\.identity\.id/);
assert.doesNotMatch(route, /sender_email: body\./, "sender identity must be server-derived");
assert.match(route, /text\.length > 3000/);
assert.match(route, /count \|\| 0\) >= 15/, "limit burst message spam");
assert.match(route, /client_message_id: clientMessageId/);
assert.match(route, /onConflict: "sender_user_id,client_message_id"/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /inbox_chat_participants_select/);
assert.match(migration, /business_user_id = \(SELECT auth\.uid\(\)\) OR affiliate_user_id = \(SELECT auth\.uid\(\)\)/);
assert.match(migration, /REVOKE ALL ON public\.inbox_chat_messages FROM anon, authenticated/);
assert.match(migration, /GRANT SELECT ON public\.inbox_chat_messages TO authenticated/);
assert.doesNotMatch(migration, /GRANT INSERT.*authenticated/);
assert.match(migration, /supabase_realtime/);

// Shared UI, same conversation records on both sides, and old notifications
// still available in a distinct Updates tab.
assert.match(inbox, /<InboxMessenger audience=\{audience\} \/>/);
assert.match(inbox, /Conversations/);
assert.match(inbox, /Updates/);
assert.match(inbox, /from\("notifications"\)/);
assert.match(messenger, /\/api\/inbox\/chat/);
assert.match(messenger, /postgres_changes/);
assert.match(messenger, /event: "INSERT"/);
assert.match(messenger, /aria-label="Send message"/);
assert.match(messenger, /mobileThread/);
assert.match(messenger, /visible/);
assert.doesNotMatch(messenger, /@gmail\.com|@nettmark\.com/, "do not hardcode private email addresses in UI");
console.log("inbox conversations regression checks passed");
