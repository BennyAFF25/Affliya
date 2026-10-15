import { calculateWalletBalance } from './balance';
import { calculateRefundLockState } from './refundLock';
import { CURRENCY_REGISTRY } from '../currency/registry';
import { add, subtract, compare, fromMajorString, type Money } from '../currency/money';

type Identity = { affiliate_email: string | null; currency?: string | null };
type Topup = Identity & NonNullable<Parameters<typeof calculateWalletBalance>[0]['topups']>[number];
type Deduction = Identity & NonNullable<Parameters<typeof calculateWalletBalance>[0]['deductions']>[number];
type Refund = Identity & { amount?: number | string | null; status?: string | null };
type Ad = Identity & NonNullable<Parameters<typeof calculateRefundLockState>[0]>[number];

/** Offline diagnostics only. No queries, writes, FX, capability enablement or runtime callers.
 * Input refunds are raw ledger rows; only succeeded rows enter the audit total.
 * Unrecorded/unknown codes retain numeric diagnostics and never masquerade as Money.
 * Canonical two-decimal results not representable by a known currency fail closed.
 */
export function calculateBalancesByCurrency(rows: {
  topups?: readonly Topup[]; deductions?: readonly Deduction[];
  refunds?: readonly Refund[]; liveAds?: readonly Ad[];
}) {
  const groups = new Map<string, {
    affiliate_email: string | null; currency_bucket: string;
    topups: Topup[]; deductions: Deduction[]; refunds: Refund[]; ads: Ad[];
  }>();
  function group(row: Identity) {
    const bucket = row.currency ?? 'UNRECORDED';
    const key = JSON.stringify([row.affiliate_email, bucket]);
    let entry = groups.get(key);
    if (!entry) {
      entry = { affiliate_email: row.affiliate_email, currency_bucket: bucket,
        topups: [], deductions: [], refunds: [], ads: [] };
      groups.set(key, entry);
    }
    return entry;
  }
  for (const row of rows.topups ?? []) group(row).topups.push(row);
  for (const row of rows.deductions ?? []) group(row).deductions.push(row);
  for (const row of rows.refunds ?? []) if (row.status === 'succeeded') group(row).refunds.push(row);
  for (const row of rows.liveAds ?? []) group(row).ads.push(row);
  return [...groups.values()].map(g => {
    const balance = calculateWalletBalance(g);
    const pending = calculateRefundLockState(g.ads);
    const known = Object.prototype.hasOwnProperty.call(CURRENCY_REGISTRY, g.currency_bucket);
    function money(value: number): Money | null {
      return known ? fromMajorString(g.currency_bucket, String(value)) : null;
    }
    // Fold known denominations with checked Money arithmetic, never across groups.
    let amounts: { credited: Money; refunded: Money; deducted: Money; available: Money; pending: Money } | null = null;
    if (known) {
      const zero = money(0)!;
      const sum = (values: number[]) => values.reduce((total, value) => add(total, money(value)!), zero);
      const topups = g.topups.map(t => calculateWalletBalance({ topups: [t] }));
      const net = sum(topups.map(t => t.totalTopupsNetAvailable));
      const deducted = sum(g.deductions.map(d => calculateWalletBalance({ deductions: [d] }).totalDeductions));
      const remainder = subtract(net, deducted);
      amounts = {
        credited: sum(topups.map(t => t.totalTopupsCredited)),
        refunded: sum(topups.map(t => t.totalTopupRefunded)), deducted,
        available: compare(remainder, zero) < 0 ? zero : remainder,
        pending: sum(g.ads.map(ad => calculateRefundLockState([ad]).totalUnpaidSpend)),
      };
    }
    return {
      affiliate_email: g.affiliate_email, currency_bucket: g.currency_bucket,
      credited_total: balance.totalTopupsCredited, refunded_total: balance.totalTopupRefunded,
      deducted_total: balance.totalDeductions, available: balance.availableBalance,
      topups_net_available: balance.totalTopupsNetAvailable, refund_ledger_total: balance.totalRefundLedger,
      topup_count: g.topups.length,
      countable_topup_count: g.topups.filter(t => ['', 'succeeded', 'refunded'].includes(String(t.status || '').toLowerCase())).length,
      deduction_count: g.deductions.length, refund_count: g.refunds.length,
      has_unrecorded: g.currency_bucket === 'UNRECORDED',
      pending_unpaid_spend: pending.totalUnpaidSpend, ad_count: g.ads.length,
      unpaid_ad_count: pending.unpaidAdCount, active_ad_count: pending.activeAdCount,
      money: amounts,
    };
  });
}
