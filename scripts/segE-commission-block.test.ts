/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- Isolated dependency mocks. */
import assert from 'node:assert/strict';
import Module from 'node:module';
const loader = Module as any, originalLoad = loader._load;
let currency: string | null = 'USD', offerCurrency: string | null = 'USD', recurring = false;
let writes: any[] = [];
const db = { from(table: string) {
  let mutation: any;
  const query: any = { select: () => query, eq: () => query,
    update: (values: any) => { mutation=values; writes.push({table,values}); return query; },
    maybeSingle: async () => ({ data: table === 'wallet_payouts' ? {
      id:'payout',offer_id:'offer',currency,status:'pending',amount:10,
      recurring_instance_id: recurring ? 'recurring' : null,
    } : table === 'recurring_commission_instances' ? {id:'recurring',status:'active',term_months:12,payout_mode:'spread'} : { currency:offerCurrency }, error:null }),
    then: (resolve: any) => Promise.resolve({data:mutation,error:null}).then(resolve),
  }; return query;
} };
const stripe = new Proxy({}, { get() { throw new Error('Stripe operation forbidden'); } });
loader._load = function(name: string, ...args: any[]) {
  if (name === '@supabase/supabase-js') return {createClient: () => db};
  if (name.endsWith('/utils/stripe')) return {createStripeClient: () => stripe};
  if (name.includes('moneyFlowAudit')) return {tryWriteMoneyFlowAudit: async () => {}};
  return originalLoad.call(this,name,...args);
};
async function run() {
  globalThis.fetch = async () => { throw new Error('External calls forbidden'); };
  try {
    const { POST } = require('../app/api/run-payout/route');
    for (const code of ['USD','GBP','CAD',null]) for (recurring of [false,true]) {
      currency=code; offerCurrency=code; writes=[];
      const response = await POST(new Request('https://test/api/run-payout',{ method:'POST',body:JSON.stringify({payout_id:'payout'}) }));
      assert.equal(response.status,409);
      const body = await response.json();
      assert.equal(body.status,'blocked_currency'); assert.equal(body.skipped,true);
      assert.deepEqual(writes,[{table:'wallet_payouts',values:{status:'blocked_currency',payout_error_message:'Commission payout awaiting FX support.'}}]);
    }
    currency='AUD'; offerCurrency='USD'; recurring=false; writes=[];
    assert.equal((await POST(new Request('https://test',{method:'POST',body:JSON.stringify({payout_id:'payout'})}))).status,409,'Legacy mislabelled AUD row blocked by offer');
    console.log('Segment E one-off, recurring, unknown and legacy currencies skipped with no Stripe operations');
  } finally { loader._load=originalLoad; }
}
void run().catch(error => { console.error(error); process.exitCode=1; });
