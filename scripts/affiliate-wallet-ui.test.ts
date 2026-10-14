import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatAUD } from "../utils/currency";

const source = readFileSync("app/affiliate/wallet/page.tsx", "utf8");

function sliceBetween(start: string, end: string) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "Missing protected section: " + start);
  return source.slice(a, b);
}
function handler(name: string) {
  const begin = source.indexOf("  const " + name + " = ");
  const end = source.indexOf("\n  };", begin);
  assert.ok(begin >= 0 && end >= begin, "Missing action handler " + name);
  return source.slice(begin, end + 6);
}
function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// Snapshot signatures from the original pre-redesign main revision
// 730c6e723b30b03c3a8e1bc1415aa55b8f2d9745.
// These protect every existing Stripe handler, billing read, reconciliation
// and database SELECT while allowing the intentional round-4 business-stop status read.
assert.equal(fnv1a(sliceBetween("function calculateChargeOnTopPreview(", "function pluralize(")), "e2a21bc9");
assert.equal(fnv1a(sliceBetween("    ] = await Promise.all([", "    if (refundsResult.error)").replace(".select('*')", ".select('id, status, billing_state, spend, spend_transferred')")), "fa03b474");
assert.equal(fnv1a(sliceBetween("  useEffect(() => {\n    const loadBillingStatus", "  const refreshWalletState")), "ef682312");
assert.equal(fnv1a(sliceBetween("  useEffect(() => {\n    const confirmPendingSession", "  if (session === undefined)")), "cfa2e5dc");
assert.equal(fnv1a(handler("handleTopUp")), "1e60db74");
assert.equal(fnv1a(handler("handleWithdrawAll")), "5a34ac46");
assert.equal(fnv1a(handler("handleRequestRefund")), "046b7570");

// UI now has one wallet balance, existing refund restrictions, and a
// conservative view of campaigns derived from the already fetched rows.
assert.match(source, /Available to spend/);
// The large wallet figure reflects Meta spend that has been reported but not
// yet converted into wallet deductions. Once a settlement moves that amount
// into the canonical ledger it must not be subtracted a second time.
assert.match(source, /const displayedSpendableBalance = calculateSpendableBalance\(availableBalance, refundLockState\.totalUnpaidSpend\)/);
assert.match(source, /walletMoney\(displayedSpendableBalance\)/);
assert.match(source, /pending Meta spend already deducted/);
assert.match(source, /const availableToRefund = refundLockState\.locked \? 0 : refundableBalance/);
assert.match(source, /const walletSnapshot = calculateWalletBalance\(/);
assert.doesNotMatch(source, /const availableBalance = walletSnapshot\.availableBalance - /);
// Examples: a 15.00 recorded balance and 1.25 unsettled spend displays 13.75.
// After settlement: 13.75 recorded balance and 0.00 unsettled displays 13.75.
const displayedSpendable = (wallet: number, unsettled: number) =>
  Math.max(0, Math.round((wallet - unsettled) * 100) / 100);
assert.equal(displayedSpendable(15, 1.25), 13.75);
assert.equal(displayedSpendable(13.75, 0), 13.75);
assert.equal(displayedSpendable(1, 2), 0);
assert.match(source, /const walletMoney =/);
assert.match(source, /return formatAUD\(value\)/);
assert.equal(formatAUD(12.47), 'A$12.47');
assert.equal(formatAUD('12.47'), 'A$12.47');
assert.equal(formatAUD(Number.NaN), 'A$0.00');
assert.match(source, /const withdrawDisabled = refundLockState\.locked \|\| availableToRefund <= 0 \|\| refundableTopups\.length === 0/);
assert.match(source, /setLiveAdRows\(\(lockStateResult\.data \|\| \[\]\) as WalletLiveAd\[\]\)/);
assert.match(source, /Money in campaigns/);
assert.match(source, /Awaiting settlement/);
assert.match(source, /\/affiliate\/dashboard\/manage-campaigns\//);
assert.match(source, /No live campaigns/);
assert.match(source, /Per-campaign funded balances, remaining days and Meta sync times aren't available/);

// One expandable wallet-only ledger instead of combined earnings and wallet,
// with existing references and real settled Stripe fee details on click.
assert.match(source, /const walletActivity = activity/);
assert.match(source, /!item\.id\.startsWith\('payout-'\)/);
assert.match(source, /Filter wallet activity/);
assert.match(source, /Ad spend settled/);
assert.match(source, /Refunds \/ withdrawals/);
assert.match(source, /<details key=\{item\.id\}/);
assert.match(source, /item\.note/);
assert.match(source, /topupQueryState === 'success'/);
assert.match(source, /recentTopupActuals\.stripe_fees/);
assert.match(source, /recentTopupActuals\.nettmark_fee_amount/);
assert.match(source, /<details className="group rounded-\[22px\]/);
assert.match(source, /aria-controls="topup-wallet"/);
assert.match(source, /aria-controls="refund-wallet"/);
assert.doesNotMatch(source, /showLedger|Locked balance<\/p>|Pending payout receipts<\/p>|View detailed ledger|bg-\[#00C2CB\].*blur-3xl/);

// Forms are conditional but the original financial actions remain attached.
assert.match(source, /onClick=\{handleTopUp\}/);
assert.match(source, /onClick=\{handleWithdrawAll\}/);
assert.match(source, /onClick=\{handleRequestRefund\}/);
console.log("affiliate wallet UI and immutable financial-flow regressions passed");
