import assert from 'node:assert/strict';
import Module from 'node:module';
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
let reads = 0;
let fail = false;
let role = 'affiliate';
const client = { from: () => {
  reads++;
  const query = { select: () => query, eq: () => query, abortSignal: () => query,
    maybeSingle: async () => ({ data: { role }, error: fail ? Error('failed') : null }) };
  return query;
} };
loader._load = function(name, parent, isMain) {
  if (name === '../supabase/pages-client') return { supabase: client };
  return original.call(this, name, parent, isMain);
};
async function run() {
  try {
    const { getAccountRole, clearAccountRoleCache } = require('../utils/affiliate/accountRole');
    const [a, b] = await Promise.all([getAccountRole('one'), getAccountRole('one')]);
    assert.equal(a, 'affiliate'); assert.equal(b, 'affiliate'); assert.equal(reads, 1);
    await getAccountRole('one'); assert.equal(reads, 1);
    await getAccountRole('two'); assert.equal(reads, 2);
    clearAccountRoleCache(); fail = true;
    await assert.rejects(getAccountRole('one'));
    fail = false; assert.equal(await getAccountRole('one'), 'affiliate');
    assert.equal(reads, 4, 'failed verification is retried rather than cached');
    clearAccountRoleCache(); role = '';
    await assert.rejects(getAccountRole('one'));
    role = 'affiliate'; assert.equal(await getAccountRole('one'), 'affiliate');
    console.log('role lookup deduplication, user scoping, cache reuse and failed retry passed');
  } finally { loader._load = original; }
}
void run();
