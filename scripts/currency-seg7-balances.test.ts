import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateBalancesByCurrency } from '../utils/wallet/balancesByCurrency';
import { calculateWalletBalance } from '../utils/wallet/balance';
import { calculateRefundLockState } from '../utils/wallet/refundLock';

const identity = { affiliate_email: 'a@example.test', currency: null };
const fixtures = [
  { topups: [{ status: 'succeeded', credited_amount: 100, amount_net: 99, amount_refunded: 20 }], deductions: [{ amount: 12 }], refunds: [{ amount: 20, status: 'succeeded' }] },
  { topups: [
    { status: 'REFUNDED', credited_amount: 0, amount_net: 10, amount_refunded: 30 },
    { status: '', credited_amount: -2, amount_net: 15, amount_refunded: -2 },
    { status: 'pending', credited_amount: 1000 },
    { status: ' succeeded ', credited_amount: 1000 },
    { status: null, credited_amount: 'NaN', amount_net: '1.005' },
  ], deductions: [{ amount: -1.005 }, { amount: 'NaN' }], refunds: [] },
  { topups: [], deductions: [{ amount: 100 }], refunds: [] },
  { topups: [], deductions: [], refunds: [{ amount: 200, status: 'succeeded' }] },
];
for (const f of fixtures) {
  const liveAds = [
    { ...identity, spend: 12.47, spend_transferred: 2, status: 'paused' },
    { ...identity, spend: 2, spend_transferred: 5, status: 'ACTIVE' },
    { ...identity, spend: -1.005, spend_transferred: -2.005 },
  ];
  const buckets = calculateBalancesByCurrency({
    topups: f.topups.map(r => ({ ...r, ...identity })),
    deductions: f.deductions.map(r => ({ ...r, ...identity })),
    refunds: f.refunds.map(r => ({ ...r, ...identity })), liveAds,
  });
  assert.equal(buckets.length, 1);
  const [b] = buckets;
  const canonical = calculateWalletBalance(f);
  assert.equal(b.currency_bucket, 'UNRECORDED');
  assert.equal(b.available, canonical.availableBalance);
  assert.equal(b.credited_total, canonical.totalTopupsCredited);
  assert.equal(b.refunded_total, canonical.totalTopupRefunded);
  assert.equal(b.topups_net_available, canonical.totalTopupsNetAvailable);
  assert.equal(b.deducted_total, canonical.totalDeductions);
  assert.equal(b.refund_ledger_total, canonical.totalRefundLedger);
  assert.equal(b.pending_unpaid_spend, calculateRefundLockState(liveAds).totalUnpaidSpend);
  assert.equal(b.money, null);
}
const mixed = calculateBalancesByCurrency({
  topups: [null, 'AUD', 'USD', 'ZZZ', 'JPY'].map(currency => ({ ...identity, currency, amount_net: 10 })),
  deductions: [{ ...identity, currency: 'USD', amount: 3 }, { ...identity, affiliate_email: 'b@example.test', currency: 'AUD', amount: 5 }],
  refunds: [{ ...identity, currency: 'USD', amount: 100, status: 'failed' }],
  liveAds: [{ ...identity, currency: 'USD', spend: 4, spend_transferred: 1, status: 'stopped' }],
});
assert.equal(mixed.length, 6);
assert.equal(mixed.find(b => b.currency_bucket === 'USD')?.available, 7);
assert.equal(mixed.find(b => b.currency_bucket === 'USD')?.money?.available?.minor, BigInt(700));
assert.equal(mixed.find(b => b.currency_bucket === 'JPY')?.money?.available?.minor, BigInt(10));
assert.equal(mixed.find(b => b.currency_bucket === 'ZZZ')?.money, null);
assert.equal(mixed.find(b => b.currency_bucket === 'UNRECORDED')?.available, 10);
assert.equal(mixed.find(b => b.affiliate_email === 'b@example.test')?.available, 0);
assert.equal(mixed.find(b => b.currency_bucket === 'USD')?.pending_unpaid_spend, 3);
assert.deepEqual(calculateBalancesByCurrency({}), []);
assert.throws(() => calculateBalancesByCurrency({ topups: [{ ...identity, currency: 'JPY', amount_net: 1.5 }] }), /decimal places/);
const name = '20261015150000_currency_seg7_balances_by_currency';
const sql = readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replace(/--[^\n]*/g, '').replace(/\s+/g, ' ');
const undo = readFileSync(`supabase/undo/${name}.undo.sql`, 'utf8');
assert.match(sql, /^BEGIN;.*COMMIT;\s*$/);
assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE)\b|ALTER\s+TABLE/i);
assert.equal((sql.match(/security_invoker = true/g) ?? []).length, 2);
for (const view of ['affiliate_wallet_balances_by_currency', 'affiliate_pending_spend_by_currency']) {
  assert.ok(sql.includes(`REVOKE ALL ON public.${view} FROM PUBLIC, anon, authenticated;`));
  assert.ok(sql.includes(`GRANT SELECT ON public.${view} TO service_role;`));
  assert.ok(sql.includes(`COMMENT ON VIEW public.${view}`));
  assert.ok(undo.includes(`DROP VIEW IF EXISTS public.${view};`));
}
assert.match(sql, /greatest\(0, preferred - refunded\)/);
assert.match(sql, /greatest\(0, sum\(net_available\) - sum\(deducted\)\)/);
assert.match(sql, /FROM public.wallet_refunds WHERE status = 'succeeded'/);
assert.doesNotMatch(sql, /sum\(net_available\).*-[^;]*sum\(refund_ledger\)/);
console.log('Currency Segment 7 balances tests passed');
