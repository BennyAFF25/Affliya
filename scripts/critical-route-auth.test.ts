/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated offline fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { withCriticalRouteAuth, type CriticalRoute } from '../utils/criticalRouteAuth';
import { authorizeCronRequest } from '../utils/internalAuthorization';

async function run() {
  globalThis.fetch = async () => { throw new Error('Network forbidden'); };
  process.env.CRON_SECRET = 'offline-critical-fixture';
  let user: any = null, queries = 0, workCalls = 0, lookupError = false;
  let captured: any;
  const rows: Record<string, any> = {
    business_profiles: { id: 'owner', business_email: 'owner@test', stripe_account_id: 'acct_owned' },
    affiliate_profiles: { user_id: 'owner', email: 'owner@test' },
    profiles: { id: 'owner', role: 'business' },
    wallet_payouts: { business_id: 'owner', business_email: 'owner@test' },
    live_ads: { business_id: 'owner', business_email: 'owner@test', affiliate_user_id: 'affiliate', affiliate_email: 'affiliate@test' },
    wallet_topups: { affiliate_user_id: 'owner', affiliate_email: 'owner@test' },
  };
  const db: any = { from(table: string) {
    queries++;
    let miss = false;
    const q: any = { select: () => q, eq: (c: string, v: unknown) => { const r = rows[table]; if (r && c in r && r[c] !== v) miss = true; return q; }, maybeSingle: async () => ({data:miss ? null : rows[table],error:lookupError ? {} : null}), then: (resolve: any) => Promise.resolve({data:[rows[table]],error:null}).then(resolve) };
    return q;
  } };
  const deps = {
    getUser: async () => user,
    trusted: (req: Request) => authorizeCronRequest(req).ok,
    database: () => db,
  };
  const cases: Array<[CriticalRoute, string, any]> = [
    ['business-connect','app/api/stripe/create-account/route.ts',{email:'owner@test'}],
    ['affiliate-connect','app/api/stripe/affiliates/create-account/route.ts',{email:'owner@test',user_id:'owner'}],
    ['refund','app/api/stripe/refund/route.ts',{email:'owner@test',refundAmount:5,stripe_charge_id:'ch_owned'}],
    ['payout','app/api/run-payout/route.ts',{payout_id:'payout'}],
    ['control-ad','app/api/meta/control-ad/route.ts',{liveAdId:'ad',action:'PAUSE',actor:'affiliate',skipSettlement:true}],
  ];
  for (const [route,path,body] of cases) {
    assert.match(fs.readFileSync(path,'utf8'), new RegExp(`export const POST = protectCriticalRoute\\("${route}", handlePost,`));
    const handler = withCriticalRouteAuth(route, async req => { workCalls++; captured = await req.json(); return Response.json({worked:true}); },deps);
    const request = (payload = body, headers: Record<string,string> = {}) => new Request('http://offline.test/api',{method:'POST',headers,body:JSON.stringify(payload)});
    const before = workCalls;
    user = null; queries = 0;
    assert.equal((await handler(request())).status,401,route);
    assert.equal(queries,0); assert.equal(workCalls,before);
    user = {id:'intruder',email:'intruder@test'};
    assert.equal((await handler(request())).status,403,route);
    assert.equal(workCalls,before);
    user = {id:'owner',email:'owner@test'};
    assert.equal((await handler(request())).status,200,route);
    assert.equal(workCalls,before+1);
    if (route === 'control-ad') { assert.equal(captured.actor,'business'); assert.equal(captured.skipSettlement,false); }
    user = null; queries = 0;
    assert.equal((await handler(request(body,{'authorization':'Bearer offline-critical-fixture'}))).status,200,route);
    assert.equal(queries,0);
    if (route === 'control-ad') { assert.equal(captured.actor,'affiliate'); assert.equal(captured.skipSettlement,true); }
    const count = workCalls;
    assert.equal((await handler(request(body,{'authorization':'Bearer bad'}))).status,401,route);
    user = {id:'owner',email:'owner@test'};
    assert.equal((await handler(request(body,{'x-cron-secret':'bad'}))).status,401,route);
    assert.equal(workCalls,count);
    lookupError = true;
    assert.equal((await handler(request())).status,500,route); assert.equal(workCalls,count);
    lookupError = false;
    if (route === 'payout') {
      const saved = rows.business_profiles;
      rows.business_profiles = { ...saved, id: 'legacy-profile' };
      rows.wallet_payouts = { business_id: 'legacy-profile', business_email: 'owner@test' };
      assert.equal((await handler(request())).status,200,'legacy business profile id owned via session email');
      user = {id:'intruder',email:'intruder@test'};
      assert.equal((await handler(request())).status,403);
      user = {id:'owner',email:'owner@test'};
      rows.business_profiles = saved; rows.wallet_payouts = { business_id: 'owner', business_email: 'owner@test' };
      assert.equal((await handler(request({}))).status,400);
    }
    if (route === 'business-connect') {
      assert.equal((await handler(request({...body,accountId:'acct_other'}))).status,403);
      assert.equal((await handler(request({...body,accountId:'acct_owned'}))).status,200);
    }
    if (route === 'affiliate-connect') {
      user = {id:'owner',email:'owner@test'};
      const saved=rows.affiliate_profiles;
      rows.affiliate_profiles=null; rows.profiles.role='affiliate';
      assert.equal((await handler(request())).status,200,'onboarding may create own missing profile');
      rows.profiles.role='business';
      assert.equal((await handler(request())).status,403);
      rows.affiliate_profiles=saved;
    }
    if (route === 'refund') {
      user = {id:'owner',email:'owner@test'};
      assert.equal((await handler(request({...body,stripe_charge_id:undefined}))).status,200);
      rows.wallet_topups.affiliate_user_id = 'other';
      assert.equal((await handler(request())).status,403);
      assert.equal((await handler(request({...body,stripe_charge_id:undefined}))).status,403);
      rows.wallet_topups.affiliate_user_id = 'owner';
    }
    if (route === 'control-ad') {
      user = {id:'affiliate',email:'affiliate@test'};
      assert.equal((await handler(request({...body,actor:'business'}))).status,200);
      assert.equal(captured.actor,'affiliate'); assert.equal(captured.skipSettlement,false);
      const bp = rows.business_profiles; rows.business_profiles = { ...bp, business_email: 'moved@test' };
      user = {id:'intruder',email:'owner@test'};
      assert.equal((await handler(request())).status,403,'stable ID wins over matching stale email');
      rows.business_profiles = bp;
      rows.live_ads.business_id = null; user = {id:'owner',email:'owner@test'};
      assert.equal((await handler(request())).status,200,'legacy email relationship');
      rows.live_ads.business_id = 'owner';
    }
  }
  // Exercise the actual server adapter: cookie verification, bearer verification,
  // auth errors and trusted requests without calling a real Supabase service.
  const loader = Module as any, original = loader._load;
  let receivedToken: unknown, authError = false, authCalls = 0;
  loader._load = function(name: string,...args: any[]) {
    if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => ({auth:{getUser:async(token: unknown) => {
      authCalls++; receivedToken=token;
      return {data:{user:token === 'valid-session' || token === undefined ? {id:'owner',email:'owner@test'} : null},error:authError ? {} : null};
    }}}) };
    if (name === 'next/headers') return {cookies:()=>({})};
    return original.call(this,name,...args);
  };
  try {
    const {protectCriticalRoute} = require('../utils/criticalRouteAuthServer');
    const handler = protectCriticalRoute('payout',async()=>Response.json({worked:true}),()=>db);
    const req = (headers={}) => new Request('http://offline.test',{method:'POST',headers,body:JSON.stringify({payout_id:'payout'})});
    assert.equal((await handler(req())).status,200); assert.equal(receivedToken,undefined);
    assert.equal((await handler(req({authorization:'Bearer valid-session'}))).status,200); assert.equal(receivedToken,'valid-session');
    assert.equal((await handler(req({authorization:'Bearer bad'}))).status,401);
    authError=true; assert.equal((await handler(req())).status,401);
    const count=authCalls;
    assert.equal((await handler(req({'x-cron-secret':'offline-critical-fixture'}))).status,200); assert.equal(authCalls,count);
    delete process.env.CRON_SECRET;
    assert.equal((await handler(req({'x-cron-secret':'offline-critical-fixture'}))).status,401);
  } finally { loader._load=original; }
  assert.doesNotMatch(fs.readFileSync('app/api/stripe-app/create-checkout-session/route.ts','utf8'), /secret\.slice|using key:/);
  console.log('Critical authorization: all five route matrices, identity/override boundaries and server adapter passed (offline).');
}
run().catch(error => { console.error(error); process.exitCode=1; });
