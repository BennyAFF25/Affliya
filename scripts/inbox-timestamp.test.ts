import assert from 'node:assert/strict';
import { formatInboxTimestamp, parseInboxTimestamp } from '../utils/inboxTimestamp';
for (const tz of ['UTC','Australia/Adelaide','America/New_York']) {
 process.env.TZ=tz;
 assert.equal(parseInboxTimestamp('2026-10-26 01:37:00').toISOString(),'2026-10-26T01:37:00.000Z');
 assert.equal(parseInboxTimestamp('2026-10-26T01:37:00.123').toISOString(),'2026-10-26T01:37:00.123Z');
 assert.equal(parseInboxTimestamp('2026-10-26T12:07:00+10:30').toISOString(),'2026-10-26T01:37:00.000Z');
 assert.equal(parseInboxTimestamp('2026-10-26T01:37:00Z').toISOString(),'2026-10-26T01:37:00.000Z');
}
assert.match(formatInboxTimestamp('2026-10-26 01:37:00',{ timeZone:'Australia/Adelaide',hour:'numeric',minute:'2-digit' }),/12:07/);
assert.equal(formatInboxTimestamp('invalid'),'Unknown date');
assert.equal(formatInboxTimestamp(null),'Unknown date');
console.log('Inbox timestamp tests passed');
