import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { validateAdCopy } from '../utils/meta/adCopyValidation';
const requireMocked = createRequire(__filename);
let signedIn = true, adminReads = 0, inserts = 0, inserted: Record<string, unknown> = {};
const db = {
  auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'affiliate', email: 'affiliate@test.invalid' } : null } }) },
  from(table: string) {
    adminReads++;
    const result = () => ({ data: table === 'profiles' ? { role: 'affiliate' } : table === 'offers' ? { id: 'offer', business_email: 'brand@test.invalid', currency: 'AUD' } : { id: 'participation', status: 'approved' }, error: null });
    const query = { select: () => query, eq: () => query, ilike: () => query, limit: () => query,
      maybeSingle: async () => result(), insert: (row: Record<string, unknown>) => { inserts++; inserted = row; return query; }, single: async () => ({ data: { id: 'saved' }, error: null }) };
    return query;
  },
};
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function(name, parent, isMain) {
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => db };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name.endsWith('utils/businessSubscriptions')) return { createServerSupabaseClient: () => db };
  return original.call(this, name, parent, isMain);
};
globalThis.fetch = async () => { throw new Error('No network permitted'); };
async function run() {
  try {
    const { POST } = requireMocked('../app/api/affiliate/ad-ideas/create/route');
    const valid = { offer_id: '11111111-1111-1111-1111-111111111111', headline: 'Headline', caption: 'Caption', currency: 'AUD', campaign_name: 'Test', objective: 'OUTCOME_TRAFFIC', performance_goal: 'LINK_CLICKS', conversion_location: 'WEBSITE', budget_amount: 1000, budget_type: 'DAILY', location: 'AU', age_range: [18, 65], interests: [], placements_type: 'MANUAL', manual_placements: ['facebook_feed'], media_type: 'IMAGE', file_url: 'https://test.invalid/image.png', end_time: new Date(Date.now() + 86400000).toISOString() };
    const post = (body: unknown) => POST(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(body) }));
    for (const field of ['headline', 'caption'] as const) {
      for (const value of ['', ' \n ', null, undefined, 42, {}]) {
        assert.ok(validateAdCopy({ ...valid, [field]: value })[field]);
        const response = await post({ ...valid, [field]: value });
        assert.equal(response.status, 400); assert.match((await response.json()).message, new RegExp(`Enter a ${field}`));
      }
    }
    assert.equal(adminReads, 0); assert.equal(inserts, 0);
    const response = await post(valid); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    assert.equal(inserts, 1); assert.equal(inserted.headline, valid.headline); assert.equal(inserted.caption, valid.caption);
    signedIn = false; assert.equal((await post({})).status, 401); assert.equal(inserts, 1);
    console.log('Paid API copy: missing/blank/whitespace/non-string rejected with 400 before DB, valid proposal saved, unauthenticated denied');
  } finally { loader._load = original; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
