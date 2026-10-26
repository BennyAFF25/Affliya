import assert from 'node:assert/strict';
import Module from 'node:module';
const tables = ['affiliate_requests','ad_ideas','organic_posts','live_ads','affiliate_shop_items'];
let active: string | null = null, failed = false, calls = 0;
const original = (Module as any)._load;
(Module as any)._load = function(name: string, ...args: any[]) {
 if (name === '../supabase/pages-client') return { supabase: { from(table: string) {
  calls++;
  const builder = { select: () => builder, eq: () => builder, limit: () => builder,
   abortSignal: async () => ({ data: table === active ? [{id:'fixture'}] : [], error:failed ? {message:'unavailable'} : null }) };
  return builder;
 } } };
 return original.call(this,name,...args);
};
const { affiliateLoginDestination } = require('../utils/affiliate/loginDestination');
async function main() {
 assert.equal(await affiliateLoginDestination(null,'fixture@example.com'),'/onboarding/for-partners');
 for (const table of tables) {
  active=table;
  assert.equal(await affiliateLoginDestination(null,'fixture@example.com'),'/affiliate/dashboard');
 }
 active=null; failed=true;
 assert.equal(await affiliateLoginDestination(null,'fixture@example.com'),'/affiliate/dashboard');
 calls=0;
 assert.equal(await affiliateLoginDestination('/affiliate/inbox','fixture@example.com'),'/affiliate/inbox');
 assert.equal(calls,0);
 console.log('Affiliate login participation and read failure tests passed');
}
main().finally(() => { (Module as any)._load=original; }).catch(error => { console.error(error); process.exitCode=1; });
