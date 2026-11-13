/* eslint-disable @typescript-eslint/no-require-imports -- Install mocks before loading server modules. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { normalizeStoreUrl, resolveStore, publicAddress } from '../lib/woocommerce/url';
import { encrypt, decrypt, deriveKey, verifySignature, deliveryUrl, nonceHash, readBody } from '../lib/woocommerce/security';
import { reduceOrder, extractAttribution, addWooUtms, isPing } from '../lib/woocommerce/orders';
import { computeEligibleConversionAmount } from '../utils/offers/conversionScope';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='mock-only-service-key';
process.env.WOOCOMMERCE_ENCRYPTION_KEY = 'ab'.repeat(32);
const storeId = '11111111-1111-4111-8111-111111111111', affiliateId = '22222222-2222-4222-8222-222222222222', campaignId = '33333333-3333-4333-8333-333333333333';
let connectionMode = false, limited = false, oldWooRow: Record<string,unknown> | null = null;
let pendingSaved: Record<string,unknown> | null = null;
let connected = false, failLookup = false, mockApproval = false, testTransport = false;
const transports: { url: URL; options: Record<string,unknown> }[] = [];
const fakeHttps = { request: (url: URL, options: Record<string,unknown>, receive: (r: EventEmitter & { statusCode?: number }) => void) => {
  transports.push({ url,options });
  const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: (e: Error) => void };
  request.destroy = e => { request.emit('error',e); request.emit('close'); };
  request.end = () => queueMicrotask(() => {
    const response = new EventEmitter() as EventEmitter & { statusCode?: number }; response.statusCode=transports.length === 1 ? 401 : 200; receive(response);
    response.emit('data',Buffer.from('{}')); response.emit('end'); request.emit('close');
  });
  return request;
} };
const calls: string[] = [];
let restFailureAt = '', callbackSaved: Record<string,unknown> | null = null;
const restCalls: { path: string; method: string }[] = [];
const mockRest = async (_store: string, path: string, _key: string, _secret: string, method = 'GET') => {
  restCalls.push({ path, method }); if (path === restFailureAt) throw new Error('mock_failure');
  return { id: restCalls.length + 100 };
};
const loader = Module as unknown as { _load: (...args: unknown[]) => unknown }, original = loader._load;
const goDb = {
  from(table: string) {
    const data = connectionMode && table === 'woocommerce_stores' ? oldWooRow : connectionMode && table === 'business_profiles' ? { id:storeId } : table === 'live_campaigns' ? { id: campaignId, offer_id: 'offer', affiliate_email: 'affiliate@internal.test', status: 'active' }
      : table === 'offers' ? { website: 'https://store.test/product?utm_medium=merchant' } : table === 'profiles' ? { id: affiliateId, email: 'affiliate@internal.test', role:'business' } : null;
    const q = { select: () => q, eq: () => q, neq: () => q,
      update: (v: Record<string,unknown>) => { pendingSaved=v; return q; },
      maybeSingle: async () => ({ data, error: null }), single: async () => ({ data, error: null }),
      insert: async (v: Record<string,unknown>) => { pendingSaved=v; return { error: null }; },
      then: (resolve: (v: unknown) => void) => resolve({ data:[{ id:storeId }],error:null }) }; return q;
  },
  rpc(name: string) { if (name === 'auth_rate_limit_hit') return { abortSignal: async () => ({ data:!limited,error:null }) }; if (name === 'woocommerce_offer_connected') return { abortSignal: async () => { if (failLookup) throw new Error('offline'); return { data: connected, error: null }; } }; return Promise.resolve({ error: null }); },
};
loader._load = function(name: unknown, ...args: unknown[]) {
  if (mockApproval && typeof name === 'string' && name.includes('approvals/enforcement')) return { assertAffiliateOfferApproved: async () => ({ ok:true }) };
  if (testTransport && name === 'node:https') return fakeHttps;
  if (testTransport && name === './url') return { resolveStore: async () => ({ url:'https://store.test', address:'8.8.8.8',family:4 }) };
  if (name === './url') return { normalizeStoreUrl, resolveStore: async (url: string) => ({ url,address:'8.8.8.8',family:4 }) };
  if (name === 'server-only') return {};
  if (name === '@supabase/supabase-js') return { createClient: () => goDb };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => ({ auth: { getUser: async () => ({ data: { user: { email: 'affiliate@internal.test' } } }) } }) };
  if (!testTransport && typeof name === 'string' && name.endsWith('/rest')) return { wcRest: mockRest, storeRequest: async () => ({ status:200,data:{ namespaces:['wc/v3'] } }) };
  return original.call(this,name,...args);
};
// Block all actual transports, including accidental fetch/DB calls.
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network forbidden in mock tests'); };
const { createWebhookHandler } = require('../lib/woocommerce/webhooks');
const { disconnectStore, callback, businessRoute, SAFE_COLUMNS } = require('../lib/woocommerce/connections');
const meta = (entry: string) => [{ key: '_wc_order_attribution_session_entry', value: entry }];
const order = (status = 'processing') => ({ id: 99, status, total: '25.00', currency: 'AUD', date_created_gmt: '2026-11-10T00:00:00', line_items: [{ product_id: 10, variation_id: 12, quantity: 2, total: '20.00', name: 'private product detail' }], meta_data: meta(`https://store.test/?nm_aff=${affiliateId}&nm_camp=${campaignId}&nm_src=nettmark&email=private@example.test`), billing: { email: 'private@example.test', phone: 'secret-phone' }, shipping: { address_1: 'secret-address' }, customer_id: 55, customer_ip_address: 'secret-ip', customer_user_agent: 'secret-agent', customer_note: 'secret-note', order_key: 'secret-key', payment_method: 'secret-payment' });
function fixture(opts: { wrongBusiness?: boolean; wrongAffiliate?: boolean; unapproved?: boolean; dbError?: boolean; failProcess?: boolean; storeStatus?: string } = {}) {
  let recorded = false, eventCount = 0, processed = 0, reversed = 0;
  const db = {
    from(table: string) {
      let update: Record<string,unknown> | undefined;
      const q = { select: () => q, eq: () => q, update: (v: Record<string,unknown>) => { update=v; return q; }, maybeSingle: async () => ({ data: table === 'woocommerce_stores' ? { status: opts.storeStatus || 'connected', business_id: storeId, webhook_secret_encrypted: encrypt('webhook-secret') }
        : table === 'profiles' ? { email: 'affiliate@internal.test' }
        : table === 'live_campaigns' ? { id: campaignId, offer_id: 'offer', affiliate_email: opts.wrongAffiliate ? 'other@internal.test' : 'affiliate@internal.test', business_email: 'business@internal.test', business_id: opts.wrongBusiness ? 'other-business' : storeId }
        : table === 'offers' || table === 'business_profiles' ? { business_email: 'business@internal.test' }
        : table === 'affiliate_requests' ? { status: opts.unapproved ? 'pending' : 'approved' } : null, error: opts.dbError ? { code: 'offline' } : null }),
        then(resolve: (v: unknown) => void) { if (table === 'woocommerce_order_conversions' && update && recorded) reversed++; resolve({ error: null }); } }; return q;
    },
    rpc: async (_name: string, args: Record<string,unknown>) => { assert.equal(args.p_currency, 'aud'); const data = { duplicate: recorded, event_id: 'event' }; if (!recorded) eventCount++; recorded=true; return { data, error: null }; },
  };
  const handler = createWebhookHandler({ admin: () => db, process: async () => { processed++; if (opts.failProcess) throw new Error('offline'); }, log: (_id: string, outcome: string) => calls.push(outcome) });
  const send = (value: unknown, signature = true, topic = 'order.updated') => {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    return handler(new Request(`https://nettmark.test/api/woocommerce/webhooks?store=${storeId}`, { method: 'POST', headers: { 'x-wc-webhook-topic': topic, ...(signature ? { 'x-wc-webhook-signature': createHmac('sha256','webhook-secret').update(raw).digest('base64') } : {}) }, body: raw }));
  };
  return { send, counts: () => ({ eventCount, processed, reversed }) };
}
async function main() {
  assert.equal(normalizeStoreUrl('https://STORE.test/shop/'), 'https://store.test/shop');
  assert.equal(normalizeStoreUrl('https://store.test:8443'), 'https://store.test:8443');
  for (const input of ['http://store.test','https://user:secret@store.test','https://127.0.0.1','https://0x7f000001','https://169.254.169.254','https://10.0.0.1','https://[::1]','https://[::ffff:127.0.0.1]','https://localhost','https://store.local','https://store.test/?secret=x']) assert.throws(() => normalizeStoreUrl(input));
  assert(!publicAddress('172.16.0.1')); assert(!publicAddress('192.168.1.1')); assert(!publicAddress('100.64.0.1')); assert(publicAddress('8.8.8.8'));
  await assert.rejects(resolveStore('https://store.test', (async () => [{ address: '127.0.0.1', family: 4 }]) as never));
  await assert.rejects(resolveStore('https://store.test', (async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]) as never));
  await assert.rejects(resolveStore('https://store.test', (async () => { throw new Error('ENOTFOUND'); }) as never), /store_unreachable/);
  assert.equal((await resolveStore('https://store.test', (async () => [{ address: '8.8.8.8', family: 4 }]) as never)).address,'8.8.8.8');
  const cipher = encrypt('test-only-credential'); assert.equal(decrypt(cipher),'test-only-credential'); assert.notDeepEqual(deriveKey(),Buffer.from('ab'.repeat(32),'hex'));
  assert.throws(() => decrypt(cipher,'cd'.repeat(32))); assert.throws(() => decrypt(cipher.replace('v1','v2')));
  const raw = Buffer.from('exact body'), signature = createHmac('sha256','test').update(raw).digest('base64');
  assert(verifySignature(raw,signature,'test')); assert(!verifySignature(Buffer.from('tampered'),signature,'test')); assert(!verifySignature(raw,'bad','test'));
  assert(isPing(Buffer.from('webhook_id=1'))); assert(!isPing(Buffer.from('webhook_id=1&order=x')));
  const reduced = reduceOrder(order()), serialized = JSON.stringify(reduced);
  for (const forbidden of ['billing','shipping','email','phone','address','customer','user_agent','secret-','order_key','payment','store.test']) assert(!serialized.includes(forbidden),forbidden);
  assert.deepEqual(reduced.line_items,[{ product_id:'10',variation_id:'12',quantity:2,line_total:20 }]);
  assert.equal(reduced.attribution?.nm_aff,affiliateId);
  const time = Date.parse('2026-11-10T00:00:00Z');
  const utm = ['utm_source','utm_campaign','utm_content'].map((key,i) => ({ key: `_wc_order_attribution_${key}`, value: ['nettmark',campaignId,affiliateId][i] }));
  assert.equal(extractAttribution(utm,time)?.nm_camp,campaignId); assert.equal(extractAttribution([],time),null);
  assert.equal(extractAttribution([...order().meta_data,{ key:'_wc_order_attribution_session_start_time',value:'2026-11-01 00:00:00' }],time),null);
  assert.equal(extractAttribution(utm.map(x => ({ key:x.key,value:x.value === 'nettmark' ? 'other' : x.value })),time),null);
  const url = new URL(`https://store.test/?nm_aff=${affiliateId}&nm_camp=${campaignId}&utm_source=merchant`); addWooUtms(url); assert.equal(url.searchParams.get('utm_source'),'merchant'); assert.equal(url.searchParams.get('utm_medium'),'affiliate');
  const offer = { conversion_scope:'specific_products',eligible_variant_ids:['12'] };
  const eligible = computeEligibleConversionAmount({ offer, grossAmount:25, eventData:{ source: 'woocommerce_webhook', line_items:reduced.line_items } });
  assert.equal(eligible.eligibleAmount,20);
  assert.equal(computeEligibleConversionAmount({ offer,grossAmount:25,eventData:{ line_items:reduced.line_items } }).eligibleAmount,0,'Woo variation alias must not affect other sources');
  let f = fixture(); assert.equal((await f.send('webhook_id=3',false)).status,200); assert.equal((await f.send(order(),false)).status,401);
  assert.equal((await f.send(order('pending'))).status,200); assert.equal(f.counts().eventCount,0);
  assert.equal((await f.send(order())).status,200); assert.equal(f.counts().eventCount,1); assert.equal(f.counts().processed,1);
  assert.deepEqual(await (await f.send(order('completed'))).json(),{ duplicate:true }); assert.equal(f.counts().processed,1);
  await f.send(order('refunded')); assert.equal(f.counts().reversed,1); assert.equal(f.counts().processed,1);
  for (const options of [{ wrongBusiness:true },{ wrongAffiliate:true },{ unapproved:true }]) { f=fixture(options); assert.equal((await f.send(order())).status,200); assert.equal(f.counts().eventCount,0); }
  f=fixture({ storeStatus:'disconnected' }); assert.equal((await f.send(order())).status,404);
  f=fixture({ storeStatus:'pending' }); assert.equal((await f.send('webhook_id=1',false)).status,200); assert.equal((await f.send(order())).status,404);
  f=fixture({ dbError:true }); assert.equal((await f.send(order())).status,503);
  f=fixture({ failProcess:true }); assert.equal((await f.send(order())).status,503); assert.deepEqual(await (await f.send(order())).json(),{ duplicate:true }); assert.equal(f.counts().processed,1);
  await assert.rejects(readBody(new Request('https://test',{ method:'POST',body:'x'.repeat(9) }),8));
  process.env.VERCEL_ENV='preview'; process.env.VERCEL_AUTOMATION_BYPASS_SECRET='mock-bypass'; assert(new URL(deliveryUrl(new Request('https://nettmark.test'),'/api/test')).searchParams.has('x-vercel-protection-bypass'));
  process.env.VERCEL_ENV='production'; assert(!deliveryUrl(new Request('https://nettmark.test'),'/api/test').includes('bypass'));
  const sequence: string[] = [];
  await disconnectStore({ from: () => ({ update: (v: Record<string,unknown>) => { sequence.push('redact'); for (const key of ['consumer_key_encrypted','consumer_secret_encrypted','webhook_secret_encrypted','auth_nonce_hash']) assert.equal(v[key],null); return { eq: () => ({ eq: async () => ({ error:null }) }) }; } }) }, { id:storeId,business_id:storeId,store_url:'https://store.test',consumer_key_encrypted:encrypt('key'),consumer_secret_encrypted:encrypt('secret'),webhook_ids:[1,2] }, async (_s: string,p: string,_k: string,_sec: string,m: string) => { sequence.push(`${m}:${p}`); if (p.includes('/1?')) throw new Error('mock'); });
  assert.deepEqual(sequence,['DELETE:/webhooks/1?force=true','DELETE:/webhooks/2?force=true','redact']);
  const callbackDb = { from: () => {
    const q = { select: () => q, eq: () => q, gt: () => q, maybeSingle: async () => ({ data:{ id:storeId,business_id:storeId,store_url:'https://store.test' },error:null }), update: (v: Record<string,unknown>) => { callbackSaved=v; return q; }, then: (resolve: (v: unknown) => void) => resolve({ data:[{ id:storeId }],error:null }) }; return q;
  } };
  connectionMode=true; process.env.RATE_LIMIT_SECRET='mock-rate-limit';
  const connectRequest = (origin = 'https://nettmark.test') => new Request('https://nettmark.test/api/woocommerce/connect',{ method:'POST',headers:{ origin },body:JSON.stringify({ storeUrl:'https://store.test' }) });
  assert.equal((await businessRoute(connectRequest('https://evil.test'),'connect')).status,403);
  limited=true; const limitedResponse = await businessRoute(connectRequest(),'connect'); assert.equal(limitedResponse.status,429,JSON.stringify(await limitedResponse.json())); limited=false;
  const connectResponse = await businessRoute(connectRequest(),'connect'); assert.equal(connectResponse.status,200);
  const authorize = new URL((await connectResponse.json()).authorizeUrl);
  assert.equal(authorize.pathname,'/wc-auth/v1/authorize'); assert.equal(authorize.searchParams.get('scope'),'read_write');
  assert.equal((pendingSaved as unknown as Record<string,unknown>).auth_nonce_hash,nonceHash(authorize.searchParams.get('user_id')!));
  assert(!JSON.stringify(pendingSaved).includes(authorize.searchParams.get('user_id')!));
  oldWooRow={ id:storeId,business_id:'other-business',status:'disconnected' };
  assert.equal((await businessRoute(connectRequest(),'connect')).status,200,'a disconnected store can be re-claimed by a business that approves it');
  assert.equal((pendingSaved as unknown as Record<string,unknown>).business_id,storeId);
  oldWooRow={ id:storeId,business_id:'other-business',status:'pending' };
  assert.equal((await businessRoute(connectRequest(),'connect')).status,200,'an unapproved pending claim must not squat a store URL');
  oldWooRow={ id:storeId,business_id:'other-business',status:'connected' };
  assert.equal((await (await businessRoute(connectRequest(),'connect')).json()).error,'store_already_connected');
  oldWooRow={ id:storeId,business_id:storeId,status:'connected' };
  assert.equal((await (await businessRoute(connectRequest(),'connect')).json()).error,'already_connected');
  oldWooRow=null; connectionMode=false;
  const cbRequest = (permissions = 'read_write') => new Request('https://nettmark.test/api/woocommerce/callback',{ method:'POST',body:JSON.stringify({ user_id:'a'.repeat(43),key_permissions:permissions,key_id:1,consumer_key:`ck_${'a'.repeat(40)}`,consumer_secret:`cs_${'b'.repeat(40)}` }) });
  assert.equal((await callback(cbRequest(),callbackDb)).status,200); assert.equal((callbackSaved as unknown as Record<string,unknown>).tracking_status,'active'); assert.equal(restCalls.length,3);
  restFailureAt='/webhooks'; assert.equal((await callback(cbRequest(),callbackDb)).status,200); assert.equal((callbackSaved as unknown as Record<string,unknown>).tracking_status,'error');
  assert.equal((await callback(cbRequest('read'),callbackDb)).status,400); assert(!SAFE_COLUMNS.includes('encrypted')); assert(!SAFE_COLUMNS.includes('nonce'));
  const nonce='a'.repeat(43); assert(!nonceHash(nonce).includes(nonce));
  // Actual /go route with mocked DB: connected-only UTMs and fail-open behavior.
  mockApproval=true;
  try {
    const { GET } = require('../app/go/[ref]/route');
    const visit = async () => new URL((await GET(new NextRequest('https://nettmark.test/go/ref',{ headers:{ 'user-agent':'Mozilla/5.0' } }),{ params:Promise.resolve({ ref:`${campaignId}___${affiliateId}___organic` }) })).headers.get('location'));
    connected=false; let landing=await visit(); assert.equal(landing.searchParams.get('utm_source'),null);
    connected=true; landing=await visit(); assert.equal(landing.searchParams.get('utm_source'),'nettmark'); assert.equal(landing.searchParams.get('utm_medium'),'merchant');
    failLookup=true; landing=await visit(); assert.equal(landing.searchParams.get('utm_source'),null);
  } finally { mockApproval=false; }
  testTransport=true;
  try {
    const { wcRest: realRest } = require('../lib/woocommerce/rest');
    await realRest('https://store.test','/webhooks?per_page=1','mock-key','mock-secret');
    assert.equal(transports.length,2);
    assert.equal((transports[0].options.headers as Record<string,string>).Authorization,`Basic ${Buffer.from('mock-key:mock-secret').toString('base64')}`);
    assert.equal(transports[1].url.searchParams.get('consumer_key'),'mock-key');
    assert.equal((transports[1].options.headers as Record<string,string>).Authorization,undefined);
    assert.equal(transports[0].options.family,4);
    await assert.rejects(realRest('https://store.test','/orders','mock-key','mock-secret'));
  } finally { testTransport=false; }
  const card=readFileSync('components/WooCommerceConnectCard.tsx','utf8'); assert.match(card,/window.confirm/); assert.match(card,/Settings → Advanced → REST API/);
  const sql=readFileSync('supabase/migrations/20261110150000_woocommerce_integration.sql','utf8'); assert.match(sql,/FOR SHARE/); assert.match(sql,/ON CONFLICT\(store_id,order_id\) DO NOTHING/); assert.match(sql,/NULL,NULL/); assert.match(sql,/SECURITY INVOKER/); assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  console.log('WooCommerce mock integration tests passed');
}
main().finally(() => { loader._load=original; globalThis.fetch=originalFetch; }).catch(error => { console.error(error); process.exitCode=1; });
