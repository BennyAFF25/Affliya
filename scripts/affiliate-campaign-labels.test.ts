import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Workspace from '../components/business/ManageCampaignsWorkspace';
import { PendingProposalRow } from '../app/affiliate/dashboard/manage-campaigns/PendingProposalRow';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const requireLocal = createRequire(__filename);
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
const originalFetch = globalThis.fetch;
const title = 'Nettmark Partner Programme';
const description = 'Affiliates fund and run Meta ads for your brand. You approve every ad';
let states: unknown[] = [], index = 0;
let effects: (() => unknown)[] = [];
let fail = false;
let offerRows = true;
let releaseTitles: (() => void) | undefined;
let titlesReady: Promise<void> = Promise.resolve();
const selections: string[] = [];
const db = {
  auth: { getSession: async () => ({ data: { session: { user: { email: 'affiliate@test.invalid' } } } }) },
  from(table: string) {
    let columns = '';
    const query = {
      select(value: string) { columns = value; if (table === 'offers') selections.push(value); return query; },
      eq: () => query, order: () => query, range: () => query, abortSignal: () => query, in: () => query,
      then(resolve: (value: unknown) => unknown) {
        const rows = table === 'offers' ? (offerRows ? [{ id: 'offer', title, description }] : [])
          : table === 'live_ads' ? [{ id: '66f13993', offer_id: 'offer', ad_idea_id: 'idea', caption: description, status: 'archived' }]
          : table === 'ad_ideas' ? [{ id: 'idea', offer_id: 'offer', headline: description, status: 'pending' }] : [];
        // Respect the select projection: missing title must fail this regression.
        const data = rows.map(row => columns === '*' ? row : Object.fromEntries(Object.entries(row).filter(([key]) => columns.split(',').includes(key))));
        return (table === 'offers' ? titlesReady : Promise.resolve()).then(() => ({ data, error: fail && table === 'ad_ideas' ? new Error('fixture failure') : null })).then(resolve);
      },
    };
    return query;
  },
};
loader._load = function(name, parent, isMain) {
  if (name === 'react') return { ...React,
    useState(initial: unknown) { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], (value: unknown) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: (initial: unknown) => ({ current: initial }), useMemo: (fn: () => unknown) => fn(),
    useEffect: (fn: () => unknown) => { effects.push(fn); },
  };
  if (name.includes('supabase/pages-client')) return { supabase: db };
  if (name.includes('wallet/spendableBalance')) return { getSpendableWalletBalance: async () => null };
  return original.call(this, name, parent, isMain);
};
globalThis.fetch = async input => {
  assert.ok(String(input).startsWith('/api/affiliate/'), 'Only fixture requests allowed');
  return Response.json({ ok: true, campaigns: [{ id: 'organic', offer_id: 'offer', caption: description, status: 'archived' }], proposals: [] });
};
async function run() {
  try {
    const Page = requireLocal('../app/affiliate/dashboard/manage-campaigns/page').default;
    const render = () => { index = 0; effects = []; return Page(); };
    const initial = render();
    let html = renderToStaticMarkup(React.createElement(Workspace, initial.props));
    assert.match(html, /Loading proposals…/);
    assert.doesNotMatch(html, /Proposals temporarily unavailable/);
    titlesReady = new Promise(resolve => { releaseTitles = resolve; });
    effects[1]();
    await new Promise(resolve => setImmediate(resolve));
    const awaitingTitles = render();
    assert.equal(awaitingTitles.props.loading, false, 'Campaigns do not wait for title enrichment');
    for (const campaign of awaitingTitles.props.campaigns) assert.equal(campaign.titleLoading, true);
    html = renderToStaticMarkup(React.createElement(Workspace, awaitingTitles.props));
    assert.match(html, /Loading campaign title/);
    assert.match(html, /animate-pulse/);
    const campaignLinks = html.match(/<a\b[^>]*href="\/affiliate\/dashboard\/manage-campaigns\/[^"]*"[^>]*>[\s\S]*?<\/a>/g) || [];
    assert.ok(campaignLinks.length >= 2, 'Mobile and desktop campaign titles render');
    for (const link of campaignLinks.filter(link => !link.includes('View campaign'))) {
      assert.match(link, /Loading campaign title/);
      assert.doesNotMatch(link, /Affiliates fund and run Meta ads for your brand/);
    }
    releaseTitles!();
    await new Promise(resolve => setImmediate(resolve));
    const loaded = render();
    assert.deepEqual(selections, ['id,title'], 'One batched query selects every offer field consumed by rows');
    for (const campaign of loaded.props.campaigns) {
      assert.equal(campaign.display_title, title);
      assert.equal(campaign.titleLoading, false);
    }
    const proposal = loaded.props.pendingContent[0].props.proposal;
    assert.equal(proposal.offerTitle, title);
    assert.match(renderToStaticMarkup(React.createElement(PendingProposalRow, { proposal })), /Nettmark Partner Programme/);
    html = renderToStaticMarkup(React.createElement(Workspace, loaded.props));
    assert.match(html, /Nettmark Partner Programme/);
    assert.doesNotMatch(html, /Loading proposals…|Proposals temporarily unavailable/);
    const useState = React.useState;
    let hookIndex = 0;
    React.useState = ((initial: unknown) => {
      const state = useState(initial);
      return hookIndex++ === 0 ? ['archived', state[1]] : state;
    }) as typeof React.useState;
    try {
      html = renderToStaticMarkup(React.createElement(Workspace, loaded.props));
      assert.match(html, /Nettmark Partner Programme/, 'Archived tab retains the offer title');
    } finally { React.useState = useState; }
    states = []; offerRows = false;
    render(); effects[1]();
    await new Promise(resolve => setImmediate(resolve));
    const withoutTitle = render();
    const paid = withoutTitle.props.campaigns.find((campaign: { id: string }) => campaign.id === '66f13993');
    assert.equal(paid.titleLoading, false);
    assert.equal(paid.display_title, description);
    html = renderToStaticMarkup(React.createElement(Workspace, withoutTitle.props));
    assert.match(html, /Affiliates fund and run Meta ads for your brand/);
    assert.doesNotMatch(html, /Loading campaign title/);
    states = []; fail = true;
    render(); effects[1]();
    await new Promise(resolve => setImmediate(resolve));
    html = renderToStaticMarkup(React.createElement(Workspace, render().props));
    assert.match(html, /Proposals temporarily unavailable/);
    assert.match(html, /Your proposals could not be loaded/);
    assert.doesNotMatch(html, /Loading proposals…/);
    console.log('Offer-title projection and paid/organic live rows, submission row, proposal loading/success/failure rendering passed (offline fixtures).');
  } finally { loader._load = original; globalThis.fetch = originalFetch; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
