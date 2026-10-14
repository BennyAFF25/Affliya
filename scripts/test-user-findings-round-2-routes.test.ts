import assert from 'node:assert/strict';
import Module from 'node:module';
type Row = Record<string, unknown>;
let user: { id: string; email: string } | null = { id: 'business-id', email: 'business@example.test' };
let rows: Record<string, Row[]> = {};
let databaseError: { code: string; message: string } | null = null;
let inserts: Row[] = [];
let constraintFailure = false;
let useIdentityHooks = false;
let identityEffect: (() => void | (() => void)) | undefined;
let identityContext: { session: unknown; isLoading: boolean } = { session: null, isLoading: false };
let browserSession: unknown = null;
let identityFetches = 0;
const database = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from(table: string) {
    let matched = rows[table] || [];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { matched = matched.filter(row => row[key] === value); return query; },
      contains: (key: string, value: Row) => { matched = matched.filter(row => Object.entries(value).every(([k,v]) => (row[key] as Row)?.[k] === v)); return query; },
      limit: () => query,
      maybeSingle: async () => ({ data: matched[0] || null, error: databaseError }),
      insert: async (row: Row) => {
        assert.equal(table, 'marketing_site_events');
        inserts.push(row);
        if (constraintFailure && inserts.length === 1) return { error: { code: '23514', message: 'marketing_site_events_event_type_check' } };
        return { error: databaseError };
      },
    };
    return query;
  },
};
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const originalLoad = loader._load;
loader._load = function(name, parent, isMain) {
  if (useIdentityHooks && name === 'react') return { useEffect: (effect: () => void | (() => void)) => { identityEffect = effect; } };
  if (name === '@supabase/auth-helpers-react') return { useSessionContext: () => identityContext };
  if (name.endsWith('supabase/pages-client')) return { supabase: { auth: { getSession: async () => ({ data: { session: browserSession } }) } } };
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => database };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name.includes('utils/supabase/server-client')) return { __esModule: true, default: database };
  if (name.includes('utils/businessSubscriptions')) return { createServerSupabaseClient: () => database };
  return originalLoad.call(this, name, parent, isMain);
};
async function main() {
  try {
    const marketing = require('../app/api/marketing-events/route') as { POST: (request: Request) => Promise<Response> };
    const plan = require('../app/api/business-subscription/plan-step-status/route') as { GET: () => Promise<Response> };
    const request = (body: string) => new Request('https://nettmark.test/api/marketing-events', { method: 'POST', body });
    for (const body of ['{broken', 'null', '[]', '{}', '{"eventType":"bad","pagePath":"/"}', '{"eventType":"page_view","pagePath":"/","meta":[]}']) {
      assert.equal((await marketing.POST(request(body))).status, 400);
    }
    assert.equal(inserts.length, 0, 'Invalid client payloads cannot reach the database');
    constraintFailure = true;
    assert.equal((await marketing.POST(request('{"eventType":"landing_cta_click","pagePath":"/lp/business-demo"}'))).status, 200);
    assert.equal(inserts[1].event_type, 'create_account_start');
    assert.equal((inserts[1].meta as Row).original_event_type, 'landing_cta_click');
    constraintFailure = false;
    databaseError = { code: '22P05', message: 'invalid input' };
    assert.equal((await marketing.POST(request('{"eventType":"page_view","pagePath":"/"}'))).status, 400);
    databaseError = { code: '42501', message: 'fixture permission failure' };
    assert.equal((await marketing.POST(request('{"eventType":"page_view","pagePath":"/"}'))).status, 503);
    databaseError = null;
    rows = { profiles: [{ id: user!.id, role: 'business' }] };
    assert.equal((await (await plan.GET()).json()).required, true, 'Missing optional signup metadata and entitlement must still require plan choice');
    rows.business_entitlements = [{ business_email: user!.email, billing_status: 'free' }];
    assert.equal((await (await plan.GET()).json()).required, true);
    rows.product_events = [{ actor_email: user!.email, event_type: 'plan_free_clicked', meta: { choice_confirmed: false } }];
    assert.equal((await (await plan.GET()).json()).required, true);
    rows.product_events[0].meta = { choice_confirmed: true };
    assert.equal((await (await plan.GET()).json()).required, false, 'Confirmed Free choice survives the next sign-in');
    rows.product_events = [];
    rows.business_entitlements[0].billing_status = 'subscription_trialing';
    assert.equal((await (await plan.GET()).json()).required, false);
    rows.business_entitlements[0] = { business_email: user!.email, is_grandfathered: true };
    assert.equal((await (await plan.GET()).json()).required, false);
    rows.profiles[0].role = 'affiliate';
    assert.equal((await plan.GET()).status, 403);
    user = null;
    assert.equal((await plan.GET()).status, 401);
    useIdentityHooks = true;
    const Identity = require('../components/ChatbaseIdentity').default as () => null;
    const originalFetch = global.fetch;
    global.fetch = async () => { identityFetches++; return new Response('{"token":"fixture"}', { status: 200 }); };
    try {
      Identity(); identityEffect!();
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(identityFetches, 0, 'Anonymous page loads must never call identify');
      const session = { user: { id: 'affiliate-id' }, access_token: 'fixture', expires_at: Date.now() / 1000 + 3600 };
      identityContext = { session, isLoading: false };
      browserSession = null;
      Identity(); identityEffect!();
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(identityFetches, 0, 'Stale context after sign-out must not call identify');
      browserSession = { ...session, expires_at: 1 };
      Identity(); identityEffect!();
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(identityFetches, 0, 'Expired sessions must not call identify');
      browserSession = session;
      Identity();
      const cleanup = identityEffect!();
      if (cleanup) cleanup();
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(identityFetches, 0, 'Sign-out/unmount before the session check must cancel identification');
    } finally { global.fetch = originalFetch; useIdentityHooks = false; }
    const { signOutSession } = require('../utils/supabase/signOut') as { signOutSession: (client: unknown) => Promise<{ error: unknown }> };
    let stops = 0, signs = 0, restarts = 0;
    const auth = {
      stopAutoRefresh: () => { stops++; }, startAutoRefresh: () => { restarts++; },
      signOut: async (...args: unknown[]) => { assert.equal(args.length, 0, 'Retain default global sign-out'); signs++; await new Promise(resolve => setTimeout(resolve, 0)); return { error: null }; },
    };
    const first = signOutSession({ auth });
    assert.equal(signOutSession({ auth }), first, 'Deduplicate repeated sign-out clicks');
    await first;
    assert.equal(stops, 1); assert.equal(signs, 1); assert.equal(restarts, 0);
    auth.signOut = async () => ({ error: 'fixture auth failure' }) as unknown as { error: null };
    assert.ok((await signOutSession({ auth })).error);
    assert.equal(restarts, 1, 'A failed sign-out restores normal session refresh');
    console.log('Round 2 authenticated routing and marketing API tests passed (mocked database, no external writes)');
  } finally { loader._load = originalLoad; }
}
void main();
