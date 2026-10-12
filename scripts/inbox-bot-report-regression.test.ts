import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");
const affiliate = source("app/affiliate/inbox/page.tsx");
const business = source("app/business/inbox/page.tsx");
const inbox = source("app/components/inbox/DbBackedInbox.tsx");
const messenger = source("app/components/inbox/InboxMessenger.tsx");
const api = source("app/api/inbox/chat/route.ts");
const unread = source("app/components/inbox/useChatUnreadCount.ts");
const aSidebar = source("app/affiliate/AffiliateSidebar.tsx");
const bSidebar = source("app/business/BusinessSidebar.tsx");
const aLayout = source("app/affiliate/layout.tsx");
const bLayout = source("app/business/layout.tsx");

assert.match(affiliate, /<DbBackedInbox/);
assert.match(affiliate, /audience="affiliate"/);
assert.match(business, /<DbBackedInbox/);
assert.match(business, /audience="business"/);
assert.match(inbox, /<InboxMessenger audience=\{audience\} \/>/);
assert.match(inbox, /from\("inbox_messages"\)/);
assert.match(inbox, /from\("notifications"\)/);
assert.match(inbox, /if \(messageResult.error\)/);
assert.match(inbox, /setLoadError\(missingLegacyTable/);
assert.doesNotMatch(inbox, /messageResult\.error && !legacyTableNotInstalled/);
assert.match(inbox, /role="alert"/);
assert.match(inbox, /Try again/);
assert.match(inbox, /!loadError && \(/);
assert.match(inbox, /Inbox unavailable/);

// Dot and mobile badge must reflect actual unread chat messages, not
// affiliate approvals, pending proposals, or unrelated notification toasts.
assert.match(api, /new URL\(request\.url\)\.searchParams\.get\("unread"\) === "1"/);
assert.match(api, /const allowed = new Set|const approvedKeys = new Set/);
assert.match(api, /\.neq\("sender_user_id", ctx\.identity\.id\)\.is\("read_at", null\)/);
assert.match(api, /contacts\.map\(\(c\) => c\.key\)/);
assert.match(api, /unreadCount/);
assert.match(api, /"Cache-Control": "private, no-store"/);
assert.match(api, /"affiliate_requests"/);
assert.match(api, /const allowedStates = \["approved", "active", "accepted"\]/);
assert.match(unread, /\/api\/inbox\/chat\?unread=1/);
assert.match(unread, /nettmark-inbox-read/);
assert.match(unread, /30000/);
assert.match(messenger, /method: "PATCH"/);
assert.match(messenger, /window\.dispatchEvent\(new Event\("nettmark-inbox-read"\)\)/);
assert.match(messenger, /!mobileThread && !window\.matchMedia/);
for (const nav of [aSidebar, bSidebar]) {
  assert.match(nav, /chatUnreadCount > 0/);
  assert.doesNotMatch(nav, /hasNotification &&|showNotification &&/);
}
assert.match(aLayout, /badge: chatUnreadCount/);
assert.match(bLayout, /badge: chatUnreadCount/);
assert.match(aLayout, /useInboxNotifier/, "existing notification toast retained");
assert.doesNotMatch(aLayout, /badge: unreadCount/);

// Business contact names from imported profiles may be literal emails.
// Never pass those private emails to either role's contact list.
assert.match(api, /businessNames = new Map/);
assert.match(api, /business_name/);
assert.match(api, /"Business"/);
assert.match(api, /name && !\/\\S\+@\\S\+\\\.\\S\+\/.test\(name\)/);
assert.match(api, /formatPublicUsername\(partner\.username\)/);

// Shared chat input and links work for both roles.
assert.match(messenger, /maxLength=\{3000\}/);
assert.match(messenger, /draft\.length/);
assert.match(messenger, /Character limit reached/);
assert.match(messenger, /disabled=\{sending \|\| !draft\.trim\(\)\}/);
assert.match(api, /text\.length > 3000/);
assert.match(messenger, /function renderMessageBody/);
assert.match(messenger, /url\.protocol !== "https:" && url\.protocol !== "http:"/);
assert.match(messenger, /rel="noopener noreferrer"/);
assert.match(messenger, /renderMessageBody\(message\.body\)/);
assert.doesNotMatch(messenger, /dangerouslySetInnerHTML/);
assert.match(messenger, /aria-label="Back to conversations"/);
assert.match(messenger, /setMobileThread\(false\)/);
assert.match(messenger, /setActiveKey\(contact\.key\)/);

console.log("affiliate/business inbox bot report regression checks passed");
