/* eslint-disable @typescript-eslint/no-explicit-any -- Offline Supabase fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deleteOfferRequest } from '../utils/offers/deleteOffer';
import { affiliateWebhookScopeDecision, deliverPendingAffiliateWebhookEvents } from '../utils/affiliateAssistantWebhook';

async function run() {
  globalThis.fetch = async () => { throw new Error('Network forbidden'); };
  let user: any = null;
  let offer: any = { id: 'offer', title: 'Original title', business_id: 'legacy', business_email: 'owner@test', archived_at: null };
  let dependent = false, failure = false, calls = 0;
  const events: any[] = [];
  const db: any = {
    from(table: string) {
      const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'offers' ? offer : { id: 'legacy' }, error: null }) };
      return q;
    },
    // Model the RPC contract; SQL transaction assertions below cover the prepared implementation.
    async rpc(name: string, params: any) {
      calls++;
      assert.equal(name, 'delete_business_offer'); assert.equal(params.p_offer_id, 'offer');
      if (failure) return { error: { message: 'queue unavailable' }, data: null };
      if (!offer) return { data: null, error: null };
      if (offer.archived_at) return { data: { action: 'archived', offer }, error: null };
      const type = dependent ? 'offer.archived' : 'offer.deleted';
      events.push({ event_type: type, dedupe_key: `${type}:offer`, business_id: offer.business_id,
        business_email: offer.business_email, offer_id: offer.id, entity_id: offer.id,
        data: dependent ? { reason: 'delete_requested_has_dependents', title: offer.title } : { title: offer.title, business_id: offer.business_id, business_email: offer.business_email } });
      if (dependent) { offer = { ...offer, archived_at: '2026-10-30T12:00:00Z', archived_reason: 'delete_requested_has_dependents' }; return { data: { action: 'archived', offer }, error: null }; }
      offer = null; return { data: { action: 'deleted', id: 'offer' }, error: null };
    },
  };
  const deps = { getUser: async () => user, database: () => db };
  const request = () => new Request('http://offline.test/api/business/offers/offer/delete', { method: 'POST', headers: { 'x-cron-secret': 'no-bypass' } });
  const invoke = () => deleteOfferRequest(request(), 'offer', deps);
  assert.equal((await invoke()).status, 401); assert.equal(calls, 0);
  user = { id: 'intruder', email: 'intruder@test' };
  // The intruder's profile must not match the legacy owner.
  offer.business_id = 'other';
  assert.equal((await invoke()).status, 403); assert.equal(calls, 0);
  user = { id: 'auth-owner', email: 'owner@test' }; offer.business_id = 'legacy';
  dependent = true;
  let result = await invoke(); assert.equal(result.status, 200);
  assert.equal((await result.json()).action, 'archived');
  assert.equal(events[0].event_type, 'offer.archived'); assert.equal(events[0].data.title, 'Original title');
  assert.equal(events[0].data.reason, 'delete_requested_has_dependents');
  result = await invoke(); assert.equal(result.status, 200); assert.equal(events.length, 1);
  offer = { id: 'offer', title: 'Snapshot title', business_id: 'legacy', business_email: 'owner@test', archived_at: null };
  dependent = false;
  result = await invoke(); assert.equal((await result.json()).action, 'deleted');
  assert.deepEqual(events[1].data, { title: 'Snapshot title', business_id: 'legacy', business_email: 'owner@test' });
  assert.equal(events[1].dedupe_key, 'offer.deleted:offer');
  assert.equal(events[1].entity_id, 'offer');
  assert.equal((await invoke()).status, 404); assert.equal(events.length, 2);
  offer = { id: 'offer', business_id: 'auth-owner', business_email: 'different@test', title: 'Owner by id' };
  failure = true;
  const originalError = console.error; console.error = () => {};
  try { assert.equal((await invoke()).status, 500); assert.equal(offer.title, 'Owner by id'); assert.equal(events.length, 2); }
  finally { console.error = originalError; }
  for (const type of ['offer.archived', 'offer.deleted'] as const) assert.equal(affiliateWebhookScopeDecision(type, null), 'deliver');
  // Both new events use the existing worker even after the offer is gone.
  const deliveries: any[] = [], patches: any[] = [];
  const webhookDb: any = {
    rpc: async (name: string) => {
      assert.equal(name, 'claim_affiliate_webhook_delivery');
      return { error: null, data: events.map((event, index) => ({ ...event, id: String(index), event_id: `event-${index}`, lease_token: 'lease', attempt_count: 1, created_at: '2026-10-30T12:00:00Z' })) };
    },
    from(table: string) {
      const data = table === 'business_profiles' ? { id: 'legacy', business_email: 'owner@test', business_name: 'Brand' } : null;
      const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q,
        update: (patch: any) => { patches.push(patch); return q; },
        maybeSingle: async () => ({ data, error: null }),
        then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve) };
      return q;
    },
  };
  process.env.AFFILIATE_WEBHOOK_URL = 'https://offline.test/webhook';
  process.env.AFFILIATE_WEBHOOK_AUTH = 'Bearer offline-fixture';
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://offline.test/webhook');
    deliveries.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 200 });
  };
  const delivery = await deliverPendingAffiliateWebhookEvents(webhookDb);
  assert.equal(delivery.sent, 2); assert.equal(delivery.failed, 0);
  assert.deepEqual(deliveries.map(row => row.type), ['offer.archived', 'offer.deleted']);
  assert.equal(deliveries[1].data.title, 'Snapshot title');
  assert.deepEqual(patches.map(row => row.status), ['delivered', 'delivered']);
  delete process.env.AFFILIATE_WEBHOOK_URL; delete process.env.AFFILIATE_WEBHOOK_AUTH;
  const sql = fs.readFileSync('supabase/migrations/20261030120000_offers_archived_at.sql', 'utf8');
  assert.match(sql, /FOR UPDATE/); assert.match(sql, /LOCK TABLE/);
  assert.match(sql, /launch_offer_id.*allocated_for_offer_id/);
  assert.match(sql, /status IS NULL OR lower\(status::text\) NOT IN \(''rejected'',''withdrawn'',''declined''\)/);
  assert.match(sql, /EXCEPTION WHEN foreign_key_violation/);
  assert.equal((sql.match(/PERFORM private.queue_affiliate_webhook_event/g) || []).length, 2);
  assert.ok(sql.indexOf("'offer.deleted'") < sql.indexOf('DELETE FROM public.offers'));
  assert.match(sql, /REVOKE ALL.*FROM PUBLIC, anon, authenticated/);
  const ui = fs.readFileSync('app/business/my-business/page.tsx', 'utf8');
  assert.match(ui, /<Dialog open=\{!!deleteOffer\}/); assert.match(ui, /!offer.archived_at && <button/);
  assert.doesNotMatch(ui, /\.delete\(\)/);
  console.log('offer delete safeguards passed (offline route mocks and SQL contract checks)');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
