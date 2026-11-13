/* eslint-disable @typescript-eslint/no-explicit-any -- Mock database/Shopify SDK shapes for offline boundary tests. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createPixelEventsHandler, createPixelLimiter, parsePixelPayload, pixelOptions } from '../lib/shopify/pixel-events';
import { activatePixel, deletePixel, readPixel } from '../lib/shopify/pixel';
import { computeEligibleConversionAmount } from '../utils/offers/conversionScope';

const aff = '11111111-1111-1111-1111-111111111111';
const campaignId = '22222222-2222-2222-2222-222222222222';
const shop = 'demo.myshopify.com';
function payload(overrides: Record<string, unknown> = {}) {
  return { shop_domain: shop, order_id: 'gid://shopify/Order/123', checkout_token: 'checkout-test', total_value: 99.5, currency: 'AUD', nm_aff: aff, nm_camp: campaignId, nm_src: 'nettmark', timestamp: new Date().toISOString(), line_items: [{ product_id: 'gid://shopify/Product/1', variant_id: '2', quantity: 2, line_total: 99.5 }], ...overrides };
}
const request = (value: unknown = payload(), extra: Record<string, string> = {}) => new Request('https://nettmark.test/api/shopify/pixel-events', { method: 'POST', headers: { 'Content-Type': 'text/plain', ...extra }, body: typeof value === 'string' ? value : JSON.stringify(value) });
function fixture() {
  const state: any = {
    store: { business_id: 'business', status: 'connected', access_token_encrypted: 'mock-ciphertext' },
    profile: { email: 'affiliate@fixture.invalid' },
    campaign: { id: campaignId, offer_id: 'offer', affiliate_email: 'affiliate@fixture.invalid', business_email: 'business@fixture.invalid' },
    offer: { business_email: 'business@fixture.invalid' }, business: { business_email: 'business@fixture.invalid' }, participation: { status: 'approved' },
    limited: false, failRecording: false, failProcessing: false, queries: 0,
  };
  const events: any[] = [], processed: string[] = [], quarantine: any[] = [];
  const orders = new Map<string, string>();
  const db: any = {
    from(table: string) {
      state.queries++;
      const row = ({ shopify_stores: state.store, profiles: state.profile, live_campaigns: state.campaign, offers: state.offer, business_profiles: state.business, affiliate_requests: state.participation } as any)[table];
      let filtersMatch = true;
      const q: any = {
        select: () => q, eq: (key: string, value: unknown) => { if (row && key in row && row[key] !== value) filtersMatch = false; return q; },
        maybeSingle: async () => ({ data: filtersMatch ? row || null : null, error: null }),
        insert: async (value: any) => { quarantine.push(value); return { error: null }; },
      };
      return q;
    },
    async rpc(name: string, args: any) {
      assert.equal(name, 'record_shopify_conversion');
      if (state.failRecording) return { error: {} };
      const key = `${args.p_shop}:${args.p_order}`;
      if (orders.has(key)) return { data: { event_id: orders.get(key), duplicate: true }, error: null };
      const eventId = `event-${events.length}`;
      // Mock the migration's transactional uniqueness result; no database is contacted.
      orders.set(key, eventId); events.push(args);
      return { data: { event_id: eventId, duplicate: false }, error: null };
    },
  };
  const handler = createPixelEventsHandler({ admin: () => db, limit: async () => !state.limited, process: async id => { processed.push(id); if (state.failProcessing) throw new Error('mock'); } });
  return { state, events, processed, quarantine, handler, orders };
}
async function ingressTests() {
  assert.equal(pixelOptions().headers.get('Access-Control-Allow-Origin'), '*');
  let f = fixture();
  const pii = { email: 'buyer@private.invalid', name: 'Private Buyer', phone: '555-private', address: { city: 'private-city' }, customer_id: 'private-id', ip: 'private-ip' };
  const dirty = payload({ ...pii, checkout: { ...pii }, line_items: [{ ...payload().line_items[0], ...pii }] });
  const response = await f.handler(request(dirty));
  assert.equal(response.status, 200);
  assert.equal(f.events.length, 1); assert.equal(f.processed.length, 1);
  const serialized = JSON.stringify(f.events);
  for (const secret of Object.values(pii).filter(x => typeof x === 'string')) assert(!serialized.includes(secret as string));
  assert(!serialized.includes('private-city'));
  const event = f.events[0];
  assert.deepEqual(Object.keys(event.p_event_data).sort(), ['source','shop_domain','order_id','checkout_token','total_value','currency','nm_aff','nm_camp','nm_src','timestamp','line_items'].sort());
  assert.equal(event.p_event_data.source, 'shopify_pixel');
  assert.equal(event.p_event_data.order_id, '123');
  assert.equal(event.p_amount, 99.5);
  assert.equal(computeEligibleConversionAmount({ offer: { conversion_scope: 'specific_products', eligible_product_ids: ['1'] }, grossAmount: 99.5, eventData: event.p_event_data }).eligibleAmount, 99.5);
  assert.deepEqual(await (await f.handler(request())).json(), { duplicate: true });
  assert.deepEqual(await (await f.handler(request(payload({ order_id: '123' })))).json(), { duplicate: true }, 'GID and numeric aliases dedupe');
  assert.equal(f.events.length, 1); assert.equal(f.processed.length, 1);
  f = fixture();
  const parallel = await Promise.all(Array.from({ length: 12 }, () => f.handler(request())));
  assert.equal(f.events.length, 1); assert.equal(f.processed.length, 1);
  assert.equal((await Promise.all(parallel.map(r => r.json()))).filter(r => r.duplicate).length, 11);
  for (const store of [null, { status: 'disconnected', access_token_encrypted: null }, { status: 'uninstalled' }, { status: 'connected', access_token_encrypted: null }]) {
    f = fixture(); f.state.store = store;
    assert.equal((await f.handler(request())).status, 404); assert.equal(f.events.length, 0);
  }
  for (const attrs of [{ nm_aff: null }, { nm_camp: null }, { nm_aff: '', nm_camp: '' }]) {
    f = fixture(); assert.equal((await f.handler(request(payload(attrs)))).status, 202); assert.equal(f.events.length, 0); assert.equal(f.quarantine.length, 0);
  }
  for (const invalid of ['{', 'null', '[]', payload({ shop_domain: 'evil.com' }), payload({ total_value: -1 }), payload({ total_value: '99.5' }), payload({ currency: 'aud' }), payload({ order_id: '' }), payload({ nm_aff: 'buyer@private.invalid' }), payload({ timestamp: '2000-01-01T00:00:00Z' }), payload({ timestamp: new Date(Date.now()+600000).toISOString() }), payload({ line_items: [{}] }), ' '.repeat(8193), JSON.stringify(payload({ padding: '😀'.repeat(2200) }))]) {
    f = fixture(); assert.equal((await f.handler(request(invalid))).status, 400); assert.equal(f.state.queries, 0);
  }
  f = fixture(); assert.equal((await f.handler(request(payload(), { 'Content-Length': '8193' }))).status, 400);
  for (const change of [ (s: any) => { s.campaign.affiliate_email = 'other@fixture.invalid'; }, (s: any) => { s.campaign.business_id = 'another-business'; }, (s: any) => { s.offer.business_email = 'other@fixture.invalid'; }, (s: any) => { s.campaign.business_email = 'other@fixture.invalid'; }, (s: any) => { s.profile = null; }, (s: any) => { s.participation.status = 'pending'; } ]) {
    f = fixture(); change(f.state); assert.equal((await f.handler(request())).status, 202); assert.equal(f.events.length, 0); assert.equal(f.processed.length, 0);
  }
  f = fixture(); f.state.campaign = null;
  assert.equal((await f.handler(request())).status, 202); assert.equal(f.events.length, 0);
  assert(!JSON.stringify(f.quarantine).includes('checkout-test'));
  f = fixture(); f.state.limited = true; assert.equal((await f.handler(request())).status, 429); assert.equal(f.state.queries, 0);
  f = fixture(); f.state.failRecording = true; assert.equal((await f.handler(request())).status, 503); assert.equal(f.orders.size, 0); assert.equal(f.processed.length, 0);
  f.state.failRecording = false; assert.equal((await f.handler(request())).status, 200); assert.equal(f.events.length, 1);
  f = fixture(); f.state.failProcessing = true; assert.equal((await f.handler(request())).status, 200); await f.handler(request()); assert.equal(f.events.length, 1);
  const buckets = new Map<string, number>();
  const limit = createPixelLimiter(async (_name, args) => { assert(!args.p_bucket.includes('private-ip')); const n = (buckets.get(args.p_bucket) || 0)+1; buckets.set(args.p_bucket, n); return { data: n <= args.p_limit, error: null }; }, () => 'fixture-secret');
  for (let i = 0; i < 60; i++) assert(await limit(request(payload(), { 'x-forwarded-for': 'private-ip' }), shop));
  assert(!await limit(request(payload(), { 'x-forwarded-for': 'private-ip' }), shop));
  assert(await limit(request(payload(), { 'x-forwarded-for': 'other-ip' }), shop));
  assert(!await createPixelLimiter(async () => { throw new Error('mock'); }, () => 'fixture')(request(), shop));
  assert(!await createPixelLimiter(async () => ({ data: true, error: null }), () => undefined)(request(), shop));
  assert.equal(parsePixelPayload(dirty).line_items.length, 1);
}
async function adminTests() {
  const calls: string[] = [];
  let id: string | null = null, undeployed = false;
  const mock: typeof fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body)); calls.push(body.query);
    if (body.query.startsWith('query')) return id ? Response.json({ data: { webPixel: { id } } }) : Response.json({ errors: [{ message: 'No web pixel was found for this app.' }] });
    if (undeployed) return Response.json({ data: { webPixelCreate: { userErrors: [{ message: 'No web pixel extension found for this app.' }] } } });
    const action = body.query.includes('webPixelUpdate') ? 'webPixelUpdate' : body.query.includes('webPixelDelete') ? 'webPixelDelete' : 'webPixelCreate';
    if (action === 'webPixelDelete') { const old = id; id = null; return Response.json({ data: { webPixelDelete: { deletedWebPixelId: old } } }); }
    const settings = JSON.parse(body.variables.pixel.settings);
    assert.deepEqual(settings, { shopKey: shop, ingestUrl: 'https://nettmark.test/api/shopify/pixel-events' });
    id = 'gid://shopify/WebPixel/1';
    return Response.json({ data: { [action]: { webPixel: { id }, userErrors: [] } } });
  };
  assert.equal(await readPixel(shop, 'mock-token', mock), null);
  assert.equal((await activatePixel(shop, 'mock-token', 'https://nettmark.test', mock)).pixel_status, 'active');
  assert(calls.some(q => q.includes('webPixelCreate')));
  assert.equal((await activatePixel(shop, 'mock-token', 'https://nettmark.test', mock)).pixel_status, 'active');
  assert(calls.some(q => q.includes('webPixelUpdate')));
  await deletePixel(shop, 'mock-token', mock); assert.equal(id, null);
  undeployed = true;
  assert.equal((await activatePixel(shop, 'mock-token', 'https://nettmark.test', mock)).pixel_error, 'extension_not_deployed');
  assert.equal((await activatePixel(shop, 'mock-token', 'https://nettmark.test', async () => new Response(null, { status: 500 }))).pixel_error, 'pixel_activation_failed');
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'mock +/&?=bypass';
  const preview: typeof fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    if (body.query.startsWith('query')) return Response.json({ data: { webPixel: null } });
    const settings = JSON.parse(body.variables.pixel.settings);
    assert.deepEqual(Object.keys(settings).sort(), ['ingestUrl', 'shopKey']);
    const url = new URL(settings.ingestUrl);
    assert.equal(url.pathname, '/api/shopify/pixel-events');
    assert.equal(url.searchParams.get('x-vercel-protection-bypass'), 'mock +/&?=bypass');
    return Response.json({ data: { webPixelCreate: { webPixel: { id: 'pixel' } } } });
  };
  assert.equal((await activatePixel(shop, 'mock-token', 'https://nettmark.test', preview)).pixel_status, 'active');
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
}
async function extensionTests() {
  const subscribers: Record<string, (event: any) => Promise<void>> = {};
  const storage = new Map<string,string>(), cookies = new Map<string,string>();
  const sent: any[] = [];
  const source = ts.transpileModule(readFileSync('extensions/nettmark-pixel/src/index.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const browser = {
    localStorage: { getItem: async (key: string) => storage.get(key), setItem: async (key: string, value: string) => { storage.set(key,value); } },
    cookie: { get: async (key: string) => cookies.get(key), set: async (value: string) => { assert(value.includes('max-age=604800')); const [key, data] = value.split(';')[0].split('='); cookies.set(key,data); } },
  };
  vm.runInNewContext(source, { exports: {}, require: () => ({ register: (run: any) => run({ analytics: { subscribe: (name: string, fn: any) => { subscribers[name] = fn; } }, browser, settings: { shopKey: shop, ingestUrl: 'https://nettmark.test/api/shopify/pixel-events' } }) }), URL, Date, TextEncoder, fetch: async (_url: string, options: any) => { assert.equal(options.headers['Content-Type'], 'text/plain'); assert.equal(options.credentials,'omit'); assert.equal(options.keepalive,true); sent.push(JSON.parse(options.body)); } });
  const checkout: any = { timestamp: new Date().toISOString(), data: { checkout: { order: { id: '123' }, token: 'token', totalPrice: { amount: '10' }, currencyCode: 'AUD', email: 'private@buyer.invalid', lineItems: [{ variant: { id: '2', product: { id: '1' } }, quantity: 1, finalLinePrice: { amount: '10' }, title: 'private-title' }] } } };
  await subscribers.checkout_completed(checkout); assert.equal(sent.length,0);
  const page = (query: string) => subscribers.page_viewed({ context: { document: { location: { href: `https://store.test/?${query}` } } } });
  await page(`nm_aff=${aff}&nm_camp=${campaignId}&nm_src=nettmark`);
  await page('');
  await subscribers.checkout_completed(checkout); assert.equal(sent.length,1);
  assert(!JSON.stringify(sent).includes('private')); assert.equal(sent[0].nm_aff, aff);
  // Cookie fallback and expiration both respect the seven-day window.
  storage.clear(); await subscribers.checkout_completed(checkout); assert.equal(sent.length,2);
  cookies.clear(); storage.set('nettmark_attribution_v1', JSON.stringify({ nm_aff: aff, nm_camp: campaignId, captured_at: Date.now()-8*86400000 }));
  await subscribers.checkout_completed(checkout); assert.equal(sent.length,2);
}
async function main() {
  globalThis.fetch = async () => { throw new Error('Network forbidden in mock suite'); };
  delete process.env.VERCEL_ENV;
  await ingressTests(); await adminTests(); await extensionTests();
  const sql = readFileSync('supabase/migrations/20261110130000_shopify_pixel.sql','utf8');
  assert.match(sql,/UNIQUE \(shop_domain, order_id\)/); assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/SECURITY INVOKER/); assert.match(sql,/REVOKE ALL ON FUNCTION[^;]+FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/ON CONFLICT \(shop_domain, order_id\) DO NOTHING/);
  assert.match(sql,/NULL, NULL/,'IP and user-agent are not recorded');
  assert(!readFileSync('app/api/shopify/status/route.ts','utf8').includes('pixel_id'));
  console.log('shopify-pixel: ingress, privacy, identity, dedupe, limiter, Admin API and extension mocks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
