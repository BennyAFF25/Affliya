import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
const loadMockedModule = createRequire(__filename);
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { campaignStatusDetail } from '../utils/wallet/campaignStatus';
import { getSpendableWalletBalance } from '../utils/wallet/spendableBalance';
// tsx uses the repo's classic JSX mode; Next supplies the automatic runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function(name, parent, isMain) {
  if (name.includes('MetaInterestPicker')) return { MetaInterestPicker: () => null };
  if (name.includes('supabase/pages-client')) return { supabase: {} };
  // Render the actual Budget step without mounting a browser or running effects.
  if (name === 'react') return { ...React, useState: (initial: unknown) => React.useState(initial === 1 ? 2 : initial) };
  return original.call(this, name, parent, isMain);
};
globalThis.fetch = async () => { throw new Error('No network permitted in UI tests'); };
async function run() {
  try {
    const { PendingProposalRow } = loadMockedModule('../app/affiliate/dashboard/manage-campaigns/PendingProposalRow');
    const proposal = { id: 'proposal', offerId: 'offer', offerTitle: 'A brand', kind: 'paid', state: 'loading', growthReady: false, funding: null };
    const loading = renderToStaticMarkup(React.createElement(PendingProposalRow, { proposal }));
    assert.match(loading, /Checking status…/);
    assert.doesNotMatch(loading, /funding not checked|FUNDING REQUIRED|FUNDED/i);
    const resolved = renderToStaticMarkup(React.createElement(PendingProposalRow, { proposal: { ...proposal, state: 'funding_required', funding: { deficit: 20 } } }));
    assert.match(resolved, /FUNDING REQUIRED/);
    assert.doesNotMatch(resolved, /Checking status…/);
    const { AdCampaignWizard } = loadMockedModule('../app/affiliate/dashboard/promote/components/AdCampaignWizard');
    const noop = () => {};
    const props = { form: { campaign_name: 'Proposal', objective: 'OUTCOME_TRAFFIC', budget_type: 'DAILY', budget_amount_dollars: 20, interests: [], placements: {}, location_countries: 'AU', age_min: 18, age_max: 65, start_time: '', end_time: '' },
      currency: '', currencyLoading: true, walletBalance: 15, walletLoading: false, canRunWithWallet: false, walletDeficit: 5, starterSpendRemaining: 0, starterSpendLabel: null,
      onInput: () => noop, setForm: noop, incBudget: noop, setStartIn15m: noop, setEndIn7d: noop, reachStatus: 'idle', reachDaily: null, reachMonthly: null };
    const wizardLoading = renderToStaticMarkup(React.createElement(AdCampaignWizard, props));
    assert.match(wizardLoading, /Loading campaign currency…/);
    assert.match(wizardLoading, /Loading currency…/);
    assert.doesNotMatch(wizardLoading, /Budget \(AUD\)|Budget \(USD\)|currency needs setup|Currency unavailable/);
    assert.match(wizardLoading, /disabled=""/);
    const wizardResolved = renderToStaticMarkup(React.createElement(AdCampaignWizard, { ...props, currency: 'AUD', currencyLoading: false }));
    assert.match(wizardResolved, /Budget \(AUD\)/);
    assert.doesNotMatch(wizardResolved, /Loading campaign currency/);
    const stopped = { status: 'paused', billing_state: 'TERMINATED_BY_BUSINESS' };
    assert.equal(campaignStatusDetail(stopped, { confirmed: true, walletLeft: 2.53 }, 12.47), 'Stopped by business · settling A$12.47');
    const { default: Workspace } = loadMockedModule('../components/business/ManageCampaignsWorkspace');
    const renderWorkspace = (campaign: unknown, availableWalletBalance: number | null = 2.53) => renderToStaticMarkup(React.createElement(Workspace, {
      audience: 'affiliate', campaigns: [campaign], loading: false, loadError: null, metaCurrency: 'AUD', syncingById: {}, onRefresh: noop, onSyncSpend: noop,
      pendingCount: 0, unsettledSpend: 12.47, pendingContent: null, availableWalletBalance,
    }));
    const funding = renderWorkspace({ id: 'ad', _source: 'meta', status: 'paused', billing_state: 'PAUSED', pauseNotice: { confirmed: true, walletLeft: 2.53 } });
    assert.match(funding, /wallet funds ran low/);
    assert.match(funding, /Available to spend:/);
    assert.match(funding, /2\.53/);
    assert.match(renderWorkspace({ id: 'ad', _source: 'meta', ...stopped }), /Stopped by business/);
    assert.match(renderWorkspace({ id: 'ad', _source: 'meta', status: 'live' }, null), /Checking wallet…/);
    const rows: Record<string, unknown[]> = { wallet_topups: [{ amount_net: 15, status: 'succeeded' }], wallet_deductions: [], wallet_refunds: [], live_ads: [{ spend: 12.47, spend_transferred: 0, status: 'paused' }] };
    const client = { from: (table: string) => {
      const query = { select: () => query, eq: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table], error: null }).then(resolve) };
      return query;
    } };
    assert.equal(await getSpendableWalletBalance(client, 'affiliate@test.invalid'), 2.53);
    rows.wallet_deductions = [{ amount: 12.47 }]; rows.live_ads = [{ spend: 12.47, spend_transferred: 12.47 }];
    assert.equal(await getSpendableWalletBalance(client, 'affiliate@test.invalid'), 2.53, 'Settled spend not subtracted twice');
    const walletSource = readFileSync('app/affiliate/wallet/page.tsx', 'utf8');
    assert.match(walletSource, /campaignStatusDetail\(ad, pauseNotices\[ad.id\], unsettled, walletMoney\)/);
    assert.match(walletSource, /break-words text-\[10px\] leading-5/);
    const workspaceSource = readFileSync('components/business/ManageCampaignsWorkspace.tsx', 'utf8');
    assert.match(workspaceSource, /w-full sm:w-auto sm:flex-none/);
    const schedule = JSON.parse(readFileSync('vercel.json', 'utf8'));
    assert.ok(schedule.crons.some((cron: { path: string; schedule: string }) => cron.path === '/api/meta/sync-active-ads' && cron.schedule === '*/5 * * * *'));
    console.log('Round 4 rendered loading/currency/status/header and mocked balance regressions passed');
  } finally { loader._load = original; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
