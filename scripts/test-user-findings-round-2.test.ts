import assert from 'node:assert/strict';
import { defaultCampaignEnd, resolveCampaignSchedule } from '../utils/campaignSchedule';
import { validateCampaignIntent } from '../utils/meta/campaignConfiguration';
import { validatePaidCampaignTiming } from '../utils/paidCampaignLaunchReadiness';
import { calculateWalletBalance } from '../utils/wallet/balance';
import { calculateRefundLockState } from '../utils/wallet/refundLock';
import { calculateSpendableBalance, isFundingPaused } from '../utils/wallet/spendableBalance';
import { parseSiteEventInput, insertSiteEvent, restoreSiteEventType } from '../utils/marketing/siteEventInput';
import { displayTrackingUrl } from '../utils/tracking/buildTrackingUrl';
import { parseTrackingRef } from '../utils/tracking/parseTrackingRef';

async function main() {
  const local = new Date(2026, 9, 14, 9, 15);
  assert.equal(defaultCampaignEnd(local), '2026-10-28T23:59');
  const now = Date.parse('2026-10-14T10:00:00Z');
  const old = { start_time: '2026-09-01T10:00:00Z', end_time: '2026-09-15T10:00:00Z' };
  const rolled = resolveCampaignSchedule(old, now);
  assert.equal(Date.parse(rolled.start_time!) > now, true);
  assert.equal(Date.parse(rolled.end_time!) - Date.parse(rolled.start_time!), 14 * 86400000);
  assert.equal(validatePaidCampaignTiming(old, now).ok, true);
  assert.deepEqual(old, { start_time: '2026-09-01T10:00:00Z', end_time: '2026-09-15T10:00:00Z' }, 'Resolution must not mutate stored proposals');
  const relative = { start_time: null, created_at: '2026-09-01T10:00:00Z', end_time: '2026-09-15T23:59:00Z' };
  assert.equal(validatePaidCampaignTiming(relative, now).ok, true, 'Approval-relative schedule remains ready after weeks of review');
  assert.equal(Date.parse(resolveCampaignSchedule(relative, now).end_time!) - Date.parse(resolveCampaignSchedule(relative, now).start_time!), Date.parse(relative.end_time) - Date.parse(relative.created_at));
  const future = { start_time: '2027-01-01T10:00:00Z', end_time: '2027-01-15T10:00:00Z' };
  assert.deepEqual(resolveCampaignSchedule(future, now), future);
  assert.equal(validatePaidCampaignTiming({ start_time: 'invalid', end_time: future.end_time }, now).ok, false);
  assert.equal(validatePaidCampaignTiming({ ...old, end_time: old.start_time }, now).ok, false);
  assert.equal(validatePaidCampaignTiming({ start_time: old.end_time, end_time: old.start_time }, now).ok, false);
  const intent = { campaign_name: 'Test', objective: 'OUTCOME_TRAFFIC', budget_amount: 2200, budget_type: 'DAILY', currency: 'AUD',
    ...relative, location: 'AU', age_range: [18, 65], manual_placements: ['facebook_feed'], call_to_action: 'LEARN_MORE' };
  assert.equal(validateCampaignIntent(intent, { now }).ok, true);

  const ledger = calculateWalletBalance({ topups: [{ amount_net: 15, status: 'succeeded' }], deductions: [] });
  const liveAds = [{ spend: 12.47, spend_transferred: 0, status: 'paused', billing_state: 'PAUSED' }];
  const pending = calculateRefundLockState(liveAds).totalUnpaidSpend;
  assert.equal(calculateSpendableBalance(ledger.availableBalance, pending), 2.53);
  assert.equal(calculateSpendableBalance(2.53, calculateRefundLockState([{ spend: 12.47, spend_transferred: 12.47 }]).totalUnpaidSpend), 2.53, 'Settled spend must not be subtracted twice');
  assert.equal(calculateSpendableBalance(1, 10), 0);
  assert.equal(isFundingPaused(liveAds[0]), true);
  assert.equal(isFundingPaused({ status: 'stopped', billing_state: 'TERMINATED_BY_BUSINESS' }), false);

  for (const bad of [null, [], 'text', {}, { eventType: {}, pagePath: '/' }, { eventType: 'page_view', pagePath: '/private' },
    { eventType: 'page_view', pagePath: '/', audience: {} }, { eventType: 'page_view', pagePath: '/', meta: [] },
    { eventType: 'page_view', pagePath: '/', meta: { large: 'x'.repeat(16001) } }]) {
    assert.equal(parseSiteEventInput(bad), null);
  }
  assert.ok(parseSiteEventInput({ eventType: 'landing_cta_click', pagePath: '/lp/business-demo', meta: { visitor_id: 'test' } }));
  const writes: Record<string, unknown>[] = [];
  const client = { from: (table: string) => {
    assert.equal(table, 'marketing_site_events');
    return { insert: async (row: Record<string, unknown>) => {
      writes.push(row);
      return writes.length === 1 ? { error: { code: '23514', message: 'violates marketing_site_events_event_type_check' } } : { error: null };
    } };
  } };
  assert.equal((await insertSiteEvent(client, { event_type: 'landing_cta_click', page_path: '/lp/business-demo', meta: { visitor_id: 'test' } })).error, null);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].event_type, 'create_account_start');
  assert.deepEqual(restoreSiteEventType(writes[1] as { event_type: string; meta: Record<string, unknown> }).event_type, 'landing_cta_click');
  assert.equal((writes[1].meta as Record<string, unknown>).visitor_id, 'test');
  let calls = 0;
  await insertSiteEvent({ from: () => ({ insert: async () => { calls++; return { error: { code: '42501', message: 'RLS' } }; } }) }, { event_type: 'landing_cta_click' });
  assert.equal(calls, 1, 'Do not retry permission or non-constraint failures');

  const id = '11111111-1111-4111-8111-111111111111';
  const oldUrl = `https://www.nettmark.com/go/${id}-person%40example.com`;
  assert.equal(displayTrackingUrl(oldUrl), `https://www.nettmark.com/go/${id}`);
  assert.deepEqual(parseTrackingRef(`${id}-person@example.com`), [id, 'person@example.com'], 'Legacy redirect still parses');
  assert.equal(displayTrackingUrl(`https://www.nettmark.com/go/${id}___person@example.com`), `https://www.nettmark.com/go/${id}`);
  assert.equal(displayTrackingUrl('https://example.com/go/test-email'), 'https://example.com/go/test-email');
  assert.equal(displayTrackingUrl(oldUrl, { runtimeId: '22222222-2222-4222-8222-222222222222' }), 'https://www.nettmark.com/go/22222222-2222-4222-8222-222222222222');
  assert.equal(displayTrackingUrl(oldUrl, { affiliateId: '33333333-3333-4333-8333-333333333333' }), `https://www.nettmark.com/go/${id}___33333333-3333-4333-8333-333333333333`);
  assert.equal(displayTrackingUrl(''), '');
  console.log('Round 2 behavior regression tests passed');
}
void main();
