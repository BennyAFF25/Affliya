/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase query-chain test doubles. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAudRate, fxBufferBps } from '../utils/fx/rates';
import { resolveOfferCurrency, checkPaidCurrency } from '../utils/currency/paidCurrencyGuard';
import { reserveLaunchHold, audHoldAmount } from '../utils/wallet/launchHolds';
import { createFxRatesHandler } from '../app/api/cron/fx-rates/route';

const now = new Date('2026-10-19T00:00:00Z');
const quote = (date = '2026-10-19', rate = 1.5) => ({ rate, source: 'frankfurter', rate_date: date });
function client(rows: unknown[] = [], readError = false, writeError = false, offerCurrency: string | null = 'USD', proposalCurrency: string | null = null) {
  const writes: any[] = []; const calls: any[] = [];
  const query: any = { maybeSingle: async () => ({ data: null }), then: (resolve: any) => Promise.resolve({ data: rows, error: readError ? {} : null }).then(resolve) };
  for (const method of ['select','eq','lte','order','limit']) query[method] = () => query;
  return { writes, calls, from: (table: string) => { query.maybeSingle = async () => ({ data: table === 'ad_ideas' ? { offer_id: 'offer', currency: proposalCurrency } : { currency: offerCurrency } }); return ({ ...query, upsert: async (row: any) => { writes.push(row); return { error: writeError ? {} : null }; } }); },
    rpc: async (name: string, args: any) => { calls.push({ name, args }); return { data: 'hold', error: null }; } };
}
const primary = (rate = 1.5, date = '2026-10-19') => async (url: any, init: any) => { assert.equal(String(url), 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD'); assert.equal(init.redirect, 'manual'); return Response.json({ amount: 1, base: 'USD', date, rates: { AUD: rate } }); };
const offline = async () => { throw new Error('offline'); };
async function main() {
  assert.equal((await getAudRate('AUD')).rate, 1);
  await assert.rejects(getAudRate('EUR'), /Unsupported/);
  assert.equal(fxBufferBps(), 400);
  process.env.FX_BUFFER_BPS = '250';
  assert.equal(fxBufferBps(), 250);
  process.env.FX_BUFFER_BPS = '-1';
  assert.throws(fxBufferBps, /Invalid/);
  delete process.env.FX_BUFFER_BPS;
  for (const base of ['GBP','CAD']) {
    const provider: typeof fetch = async () => Response.json({ base, date: '2026-10-19', rates: { AUD: 1.8 } });
    assert.equal((await getAudRate(base,{client:client(),now,fetch:provider})).rate,1.8);
  }
  process.env.FX_MAX_STALENESS_HOURS = '1';
  await assert.rejects(getAudRate('USD',{client:client([quote('2026-10-18')]),now,fetch:offline}), /1h/);
  delete process.env.FX_MAX_STALENESS_HOURS;
  const cached = client([quote()]);
  assert.equal((await getAudRate('USD', { client: cached, now, fetch: offline })).rate, 1.5);
  assert.equal(cached.writes.length, 0);
  const empty = client();
  await getAudRate('USD', { client: empty, now, fetch: primary() });
  assert.equal(empty.writes[0].base, 'USD');
  let redirects = 0;
  const redirected: typeof fetch = async () => ++redirects === 1
    ? new Response(null, { status: 301, headers: { location: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD' } })
    : Response.json({ amount: 1, base: 'USD', date: '2026-10-19', rates: { AUD: 1.447 } });
  assert.equal((await getAudRate('USD', { client: client(), now, fetch: redirected })).rate, 1.447);
  for (const location of ['http://api.frankfurter.dev/latest', 'https://evil.example/latest', 'https://user:password@api.frankfurter.dev/latest']) {
    const visited: string[] = [];
    await assert.rejects(getAudRate('USD', { client: client(), now, fetch: async url => {
      visited.push(String(url));
      return new Response(null, { status: 301, headers: { location } });
    } }), /No usable/);
    assert.ok(visited.every(url => !url.includes('evil.example') && !url.startsWith('http:') && !url.includes('password')));
  }
  const fallback: typeof fetch = async url => String(url).includes('frankfurter') ? Response.json({}, { status: 500 })
    : Response.json({ result: 'success', base_code: 'USD', time_last_update_unix: now.getTime()/1000, rates: { AUD: 1.52 } });
  assert.equal((await getAudRate('USD', { client: client([quote('2026-10-16')]), now, fetch: fallback })).source, 'open.er-api');
  await assert.rejects(getAudRate('USD', { client: client(), now, fetch: fallback }), /No usable/);
  assert.equal((await getAudRate('USD', { client: client([quote('2026-10-16')]), now, fetch: offline })).rate, 1.5);
  await assert.rejects(getAudRate('USD', { client: client([quote('2026-10-15')]), now, fetch: offline }), /72h/);
  await assert.rejects(getAudRate('USD', { client: client([quote('2026-10-15', 1)]), now, fetch: fallback }), /No usable/);
  await assert.rejects(getAudRate('USD', { client: client(), now, fetch: primary(99) }), /No usable/);
  await assert.rejects(getAudRate('USD', { client: client(), now, fetch: primary(1.5,'2026-10-20') }), /No usable/);
  await assert.rejects(getAudRate('USD', { client: client([], true), now, fetch: primary() }), /read failed/);
  await assert.rejects(getAudRate('USD', { client: client([], false, true), now, fetch: primary() }), /write failed/);
  assert.equal(audHoldAmount(100,1.5,400),156);
  assert.equal(audHoldAmount(0.01,1.501,400),0.02);
  const today = new Date().toISOString().slice(0,10);
  const holds = client([quote(today)]);
  await reserveLaunchHold(holds,'a',100,'idea','USD');
  assert.equal(holds.calls[0].name,'reserve_launch_hold_fx');
  assert.equal(holds.calls[0].args.p_amount,156);
  assert.equal(holds.calls[0].args.p_original_currency,'USD');
  const aud = client([], false, false, 'AUD');
  await reserveLaunchHold(aud,'a',100,'aud');
  assert.equal(aud.calls[0].name,'reserve_launch_hold');
  for (const [offer, saved, supplied, message] of [
    [null, 'AUD', 'AUD', /no currency set/],
    ['USD', 'AUD', 'USD', /offer USD, proposal AUD/],
    ['USD', null, 'AUD', /offer USD, proposal AUD/],
  ] as const) {
    const blocked = client([], false, false, offer, saved);
    await assert.rejects(reserveLaunchHold(blocked,'a',100,'idea',supplied), message);
    assert.equal(blocked.calls.length, 0);
    assert.equal(blocked.writes.length, 0);
  }
  assert.equal(resolveOfferCurrency(null,'USD').campaignCurrency,'USD');
  assert.equal(resolveOfferCurrency('', 'AUD').allowed,true);
  assert.match(checkPaidCurrency('AUD',null,'AUD').message!, /no currency set/);
  assert.match(checkPaidCurrency(null,'USD','AUD').message!, /offer USD, ad account AUD/);
  assert.equal(checkPaidCurrency(null,'USD','USD').allowed,false);
  let refreshed = 0;
  process.env.CRON_SECRET = 'test-secret';
  const handler = createFxRatesHandler(async () => { refreshed++; return quote(); });
  assert.equal((await handler(new Request('http://test'))).status,401);
  assert.equal(refreshed,0);
  assert.equal((await handler(new Request('http://test',{headers:{authorization:'Bearer test-secret'}}))).status,200);
  assert.equal(refreshed,3);
  const failedHandler = createFxRatesHandler(async () => { throw new Error('private provider error'); });
  const failed = await failedHandler(new Request('http://test',{headers:{authorization:'Bearer test-secret'}}));
  assert.equal(failed.status,503);
  assert.ok(!(await failed.text()).includes('private provider'));
  const migration = readFileSync('supabase/migrations/20261016210000_segC_fx_rates.sql','utf8');
  assert.ok(migration.includes('ENABLE ROW LEVEL SECURITY'));
  assert.ok(migration.includes("public.reserve_launch_hold(p_affiliate_email,'AUD'"));
  assert.ok(!migration.includes('CREATE OR REPLACE'));
  const undo = readFileSync('supabase/undo/20261016210000_segC_fx_rates.undo.sql','utf8');
  for (const column of ['original_amount','original_currency','fx_rate','fx_source','fx_rate_date','fx_buffer_bps']) assert.ok(undo.includes('DROP COLUMN '+column));
  for (const path of ['app/api/meta/control-ad/route.ts','app/api/meta/callback/upload-video/route.ts']) {
    const code = readFileSync(path,'utf8');
    assert.ok(code.indexOf('if (!currency') < code.indexOf('await reserveLaunchHold'));
  }
  console.log('Segment C FX tests passed');
}
main().catch(error => { console.error(error); process.exitCode=1; });
