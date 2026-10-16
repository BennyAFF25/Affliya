import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { loadAffiliateSubmissions } from '../utils/affiliate/portalData';
let email: string | null = 'owner@example.test';
let failures: string[] = [];
let mutations: Record<string, unknown>[] = [];
const db = {
  auth: { getUser: async () => ({ data: { user: email ? { email } : null }, error: null }) },
  from(table: string) {
    const q = { select: () => q, eq: () => q,
      maybeSingle: async () => ({ data: table === 'ad_ideas' ? { id: 'idea', business_email: 'owner@example.test', affiliate_email: null } : null, error: null }),
      update: (value: Record<string, unknown>) => { mutations.push(value); return q; },
      single: async () => ({ data: { id: 'idea', status: 'rejected' }, error: failures.length ? { code: failures.shift(), message: 'fixture update failure' } : null }),
    }; return q;
  },
};
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function(name, parent, isMain) {
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => db };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name.endsWith('/utils/businessSubscriptions')) return { createServerSupabaseClient: () => db };
  if (name.endsWith('/lib/email/send')) return { sendEmail: async () => { throw Error('No email expected'); } };
  return original.call(this, name, parent, isMain);
};
async function run() {
  try {
    const { POST } = require('../app/api/business/ad-ideas/update-status/route');
    const reject = (rejectionReason?: unknown) => POST(new Request('https://local.invalid', { method: 'POST', body: JSON.stringify({ id: 'idea', status: 'rejected', rejectionReason }) }));
    assert.equal((await reject('  Offer paused  ')).status, 200);
    const first = mutations.pop()!;
    assert.ok(Number.isFinite(Date.parse(String(first.rejected_at))));
    assert.deepEqual({ ...first, rejected_at: undefined }, { status: 'rejected', rejection_reason: 'Offer paused', rejected_at: undefined });
    assert.equal((await reject('x'.repeat(500))).status, 200); mutations = [];
    assert.equal((await reject('x'.repeat(501))).status, 400);
    assert.equal((await reject({ text: 'bad' })).status, 400);
    assert.equal(mutations.length, 0);
    assert.equal((await reject()).status, 200);
    assert.equal(mutations.pop()!.status, 'rejected', 'reason remains optional');
    for (const code of ['42703', 'PGRST204']) {
      failures = [code];
      assert.equal((await reject('Offer paused')).status, 200);
      assert.deepEqual(mutations[1], { status: 'rejected', rejection_reason: 'Offer paused' });
      assert.ok(mutations[0].rejected_at); mutations = [];
    }
    failures = ['42501'];
    assert.equal((await reject()).status, 500);
    assert.equal(mutations.length, 1); mutations = [];
    failures = ['42703', '42501'];
    assert.equal((await reject()).status, 500);
    assert.equal(mutations.length, 2); mutations = [];
    const pending = await POST(new Request('https://local.invalid', { method: 'POST', body: JSON.stringify({ id: 'idea', status: 'pending' }) }));
    assert.equal(pending.status, 200);
    assert.deepEqual(mutations.pop(), { status: 'pending' });
    email = null; assert.equal((await reject('reason')).status, 401);
    email = 'other@example.test'; assert.equal((await reject('reason')).status, 403);
    assert.equal(mutations.length, 0);
    const queried: string[] = [];
    const client = { from(table: string) {
      const q = { select: (columns: string) => { queried.push(columns); return q; }, eq: () => q, order: () => q, range: () => q,
        abortSignal: async () => ({ error: null, data: table === 'ad_ideas' ? [{ id: 'rejected', status: 'rejected', rejection_reason: 'Offer paused' }] : [] }) };
      return q;
    } };
    const rows = await loadAffiliateSubmissions(client as never, 'affiliate@example.test', async () => []);
    assert.equal(rows[0].status, 'rejected'); assert.equal(rows[0].rejectionReason, 'Offer paused');
    assert.ok(queried.some(value => value.includes('rejection_reason')));
    for (const code of ['42703', 'PGRST204']) {
      const projections: string[] = [];
      const legacy = { from(table: string) {
        let columns = '';
        const q = { select: (value: string) => { columns = value; projections.push(value); return q; }, eq: () => q, order: () => q, range: () => q,
          abortSignal: async () => columns.includes('rejected_at')
            ? { data: null, error: { code } }
            : { data: table === 'ad_ideas' ? [{ id: 'legacy', status: 'rejected', campaign_name: 'Proposal name' }] : [], error: null } };
        return q;
      } };
      const legacyRows = await loadAffiliateSubmissions(legacy as never, 'affiliate@example.test', async () => []);
      assert.equal(legacyRows[0].campaignName, 'Proposal name');
      assert.equal(legacyRows[0].rejectedAt, null);
      assert.ok(projections.some(value => value.includes('campaign_name') && !value.includes('rejected_at')));
    }
    const page = readFileSync('app/affiliate/dashboard/manage-campaigns/page.tsx', 'utf8');
    assert.match(page, /row.kind === "paid" && row.status === "rejected"/);
    assert.match(page, /REJECTED/);
    assert.match(page, /proposal.campaignName \|\| offerNameById/);
    assert.match(page, /proposal.rejectedAt \?/); assert.match(page, /No reason given/);
    const workspace = readFileSync('components/business/ManageCampaignsWorkspace.tsx', 'utf8');
    assert.match(workspace, /tab === "archived" \|\| tab === "rejected"/);
    const migration = readFileSync('supabase/migrations/20261016150000_ad_ideas_rejected_at.sql', 'utf8');
    assert.match(migration, /^BEGIN;/); assert.match(migration, /COMMIT;/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS rejected_at timestamptz NULL/);
    assert.match(migration, /COMMENT ON COLUMN public.ad_ideas.rejected_at/);
    assert.doesNotMatch(migration, /UPDATE |DEFAULT /);
    assert.match(readFileSync('supabase/undo/20261016150000_ad_ideas_rejected_at.undo.sql', 'utf8'), /DROP COLUMN IF EXISTS rejected_at/);
    console.log('rejected proposal loading, display contract, reason limits, optional reason and ownership passed');
  } finally { loader._load = original; }
}
void run();
