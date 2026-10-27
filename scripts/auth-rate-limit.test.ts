/* eslint-disable @typescript-eslint/no-require-imports -- Install server-only mock before loading server handlers. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
// Next supplies the server-only boundary during bundling; mock it for this Node test.
const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
const original = loader._load;
loader._load = function(name: unknown, ...args: unknown[]) {
  if (name === 'server-only') return {};
  return original.call(this, name, ...args);
};
const { createAuthLimiter } = require('../utils/auth/rateLimit');
const { createPasswordResetHandler } = require('../utils/auth/passwordResetHandler');
const { createSignupHandler } = require('../utils/auth/signupHandler');
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.invalid';
process.env.RESEND_API_KEY = 'mock-resend-key';
const request = (email = 'person@example.com', ip = '1', extra: RequestInit = {}) => new Request('https://nettmark.test/api/auth/send-password-reset', {
  method: 'POST', headers: { origin: 'https://nettmark.test', 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email }), ...extra,
});
function fixture(failure = false, exists = true) {
  const counts = new Map<string, number>();
  let generated = 0, sent = 0;
  const limit = createAuthLimiter({ secret: () => 'test-secret', rpc: async (_: string, args: { p_bucket: string; p_limit: number; p_window_seconds: number }) => {
    if (failure) return { data: null, error: { code: 'unavailable' } };
    assert(!args.p_bucket.includes('person@'));
    const hits = (counts.get(args.p_bucket) || 0) + 1;
    counts.set(args.p_bucket, hits);
    return { data: hits <= args.p_limit, error: null };
  } });
  const handler = createPasswordResetHandler({ limit, log: () => {}, createAdmin: () => ({ auth: { admin: { generateLink: async () => {
    generated++;
    return exists ? { data: { properties: { hashed_token: 'test-token' } }, error: null } : { data: null, error: { code: 'user_not_found' } };
  } } } }), createResend: () => ({ emails: { send: async () => { sent++; return { error: null }; } } }) });
  return { handler, limit, counts: () => [generated, sent] };
}
async function main() {
  let f = fixture();
  const legit = await f.handler(request());
  assert.equal(legit.status, 200); assert.equal(legit.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await legit.json(), { ok: true }); assert.deepEqual(f.counts(), [1, 1]);
  f = fixture();
  for (let i = 0; i < 4; i++) await f.handler(request('person@example.com', String(i)));
  assert.deepEqual(f.counts(), [3, 3]);
  f = fixture();
  for (let i = 0; i < 6; i++) await f.handler(request(`person${i}@example.com`));
  assert.deepEqual(f.counts(), [5, 5]);
  f = fixture(true);
  assert.deepEqual(await (await f.handler(request())).json(), { ok: true }); assert.deepEqual(f.counts(), [0, 0]);
  const thrown = createAuthLimiter({ secret: () => 'test', rpc: async () => { throw new Error('offline'); } });
  assert.equal(await thrown(request(), 'reset', 'person@example.com'), false);
  f = fixture();
  for (const req of [request('bad'), request('x'.repeat(255)+'@example.com'), request(undefined, undefined, { body: '{' }), request(undefined, undefined, { body: JSON.stringify({ email: 123 }) }), request(undefined, undefined, { body: ' '.repeat(2049) }), request(undefined, undefined, { headers: { origin: 'https://evil.test', 'content-type': 'application/json' } }), request(undefined, undefined, { headers: { 'content-type': 'application/json' } }), request(undefined, undefined, { headers: { origin: 'https://nettmark.test', 'content-type': 'text/plain' } })]) {
    assert.equal((await f.handler(req)).status, 400);
  }
  assert.deepEqual(f.counts(), [0, 0]);
  const existing = await fixture(false, true).handler(request());
  const missing = await fixture(false, false).handler(request());
  assert.equal(existing.status, missing.status); assert.equal(await existing.text(), await missing.text());
  assert.equal(existing.headers.get('cache-control'), missing.headers.get('cache-control'));
  const unicodeOversize = request(undefined, undefined, { body: JSON.stringify({ email: 'person@example.com', padding: '😀'.repeat(600) }) });
  assert.equal((await f.handler(unicodeOversize)).status, 400);
  assert.equal((await f.handler(request(undefined, undefined, { headers: { origin: 'https://nettmark.test', 'content-type': 'application/json', 'content-length': '2049' } }))).status, 400);
  let signups = 0;
  const signup = createSignupHandler({ limit: async () => false, client: () => { signups++; throw new Error('must not call'); } });
  const signupResponse = await signup(request(undefined, undefined, { body: JSON.stringify({ email: 'person@example.com', password: 'password123', options: { data: { role: 'affiliate', username: 'person' } } }) }));
  assert.equal(signupResponse.status, 429); assert.equal(signups, 0);
  assert.deepEqual(await signupResponse.json(), { error: 'Too many attempts. Please wait a few minutes and try again.' });
  // Verify 24-hour and global budgets independently of the short window.
  const called: { p_limit: number; p_window_seconds: number }[] = [];
  const limiter = createAuthLimiter({ secret: () => 'secret', rpc: async (_: string, args: { p_bucket: string; p_limit: number; p_window_seconds: number }) => { called.push(args); return { data: true, error: null }; } });
  assert.equal(await limiter(request(), 'reset', 'person@example.com'), true);
  assert.deepEqual(called.map(x => [x.p_limit, x.p_window_seconds]), [[5,900],[3,900],[6,86400],[200,3600]]);
  const signupPayload = { email: 'person@example.com', password: 'password123', options: { data: { role: 'affiliate', username: 'person' } } };
  const signupRequest = (email: string, ip: string) => request(email, ip, { body: JSON.stringify({ ...signupPayload, email }) });
  const signupLimits = fixture();
  let signupCalls = 0;
  const successData = { session: null, user: { id: 'test-user' } };
  const signupWithLimits = createSignupHandler({ limit: signupLimits.limit, client: () => ({ auth: { signUp: async () => { signupCalls++; return { data: successData, error: null }; } } }) });
  for (let i = 0; i < 5; i++) assert.equal((await signupWithLimits(signupRequest('person@example.com', String(i)))).status, 200);
  assert.equal((await signupWithLimits(signupRequest('person@example.com', 'other'))).status, 429);
  assert.equal(signupCalls, 5);
  const signupIpLimits = createSignupHandler({ limit: fixture().limit, client: () => ({ auth: { signUp: async () => ({ data: successData, error: null }) } }) });
  for (let i = 0; i < 10; i++) assert.equal((await signupIpLimits(signupRequest(`person${i}@example.com`, 'same'))).status, 200);
  assert.equal((await signupIpLimits(signupRequest('person11@example.com', 'same'))).status, 429);
  const signupSuccess = createSignupHandler({ limit: async () => true, client: () => ({ auth: { signUp: async () => ({ data: successData, error: null }) } }) });
  assert.deepEqual(await (await signupSuccess(signupRequest('person@example.com', '1'))).json(), { data: successData });
  const signupErrors = async (message: string) => {
    const handler = createSignupHandler({ limit: async () => true, client: () => ({ auth: { signUp: async () => ({ data: null, error: { message } }) } }) });
    return await (await handler(signupRequest('person@example.com', '1'))).text();
  };
  assert.equal(await signupErrors('User already registered'), await signupErrors('Provider unavailable'));
  const sql = readFileSync('supabase/migrations/20261027120000_auth_rate_limits.sql', 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /SECURITY DEFINER SET search_path = public/i);
  assert.match(sql, /ON CONFLICT \(bucket\) DO UPDATE/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION[^;]+FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[^;]+TO service_role/i);
  assert.doesNotMatch(sql, /CREATE POLICY/i);
  const update = readFileSync('app/api/auth/update-password/route.ts', 'utf8');
  assert(update.indexOf('auth.getUser()') < update.indexOf('auth.updateUser('));
  assert.match(update, /if \(authError \|\| !user\)/);
  console.log('auth-rate-limit tests passed');
}
main().finally(() => { loader._load = original; }).catch(error => { console.error(error); process.exitCode = 1; });
