import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const requireMocked = createRequire(__filename);
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
const afterTasks: (() => Promise<void>)[] = [];
let created = true;
let emailCalls = 0;
let step = 3;
let states: unknown[] = [];
let stateIndex = 0;
let ref = { current: false };
let submitClick: (() => Promise<void>) | undefined;
let graphCalls = 0;
let role = 'affiliate';
let graphFailure = false;
const db = { auth: { getUser: async () => ({ data: { user: { id: 'user', email: 'affiliate@test.invalid' } } }) }, from(table: string) {
  const row = table === 'profiles' ? { role } : { id: 'offer', business_email: 'brand@test.invalid', status: 'active', participation_mode: 'open' };
  const query = { select: () => query, eq: () => query, insert: () => query,
    maybeSingle: async () => ({ data: row, error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  return query;
} };
loader._load = function(name, parent, isMain) {
  if (name === 'next/server') return { NextResponse: { json: Response.json }, after: (fn: () => Promise<void>) => afterTasks.push(fn) };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => db };
  if (name.includes('supabase/server-client')) return { __esModule: true, default: db };
  if (name.includes('businessSubscriptions')) return { createServerSupabaseClient: () => db };
  if (name.includes('approvals/enforcement')) return { normalizeOfferParticipationMode: () => 'open', ensureAffiliateOfferParticipation: async () => ({ ok: true, status: 'approved', created }) };
  if (name.includes('profileIdentity')) return { getAffiliateUsername: async () => 'Affiliate' };
  if (name.includes('email/templates')) return { businessNewAffiliateRequestEmail: () => ({ subject: 'mock', html: 'mock' }) };
  if (name.includes('email/send')) return { sendEmail: async () => { emailCalls++; throw new Error('mock notification failure'); } };
  if (name.includes('MetaInterestPicker')) return { MetaInterestPicker: () => null };
  if (name.includes('components/ui/toast')) return { nmToast: { error: () => {} } };
  if (name === 'react') return { ...React,
    useState: (initial: unknown) => { const index = stateIndex++; if (!(index in states)) states[index] = index === 0 ? step : initial; return [states[index], (value: unknown) => { states[index] = value; }]; },
    useRef: () => ref,
    useMemo: (fn: () => unknown) => fn(),
  };
  return original.call(this, name, parent, isMain);
};
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'graph.facebook.com');
  assert.equal(url.pathname, '/v26.0/search');
  assert.equal(url.searchParams.get('type'), 'adinterest');
  assert.equal(url.searchParams.get('q'), 'fitness');
  assert.equal((init?.headers as { Authorization: string }).Authorization, 'Bearer fixture-token');
  graphCalls++;
  if (graphFailure) return Response.json({ error: { message: 'fixture rejected token' } }, { status: 401 });
  return Response.json({ data: [{ id: '1234', name: 'Fitness' }, { id: 'invalid', name: 'Invalid' }] });
};
function visit(node: unknown) {
  if (!node || typeof node !== 'object') return;
  const element = node as { type?: unknown; props?: { children?: unknown; onClick?: () => Promise<void>; 'aria-busy'?: boolean } };
  if (element.type === 'button' && element.props && 'aria-busy' in element.props) submitClick = element.props.onClick;
  const children = element.props?.children;
  if (Array.isArray(children)) children.forEach(visit); else visit(children);
}
async function run() {
  try {
    const start = requireMocked('../app/api/affiliate/offers/[offerId]/start/route');
    const context = { params: Promise.resolve({ offerId: '11111111-1111-1111-1111-111111111111' }) };
    const first = await start.POST(new Request('https://test.invalid'), context);
    assert.equal(first.status, 200);
    assert.equal(emailCalls, 0, 'First response does not wait for notification');
    assert.equal(afterTasks.length, 1);
    await afterTasks[0](); // Notification failure remains isolated from successful participation.
    created = false;
    assert.equal((await start.POST(new Request('https://test.invalid'), context)).status, 200);
    assert.equal(afterTasks.length, 1, 'Resumed participation does not send a duplicate notification');

    const interests = requireMocked('../app/api/meta/interests/route');
    process.env.META_TARGETING_SEARCH_TOKEN = ' fixture-token ';
    const req = { nextUrl: new URL('https://test.invalid?offerId=11111111-1111-1111-1111-111111111111&q=fitness') };
    assert.deepEqual(await (await interests.GET(req)).json(), { interests: [{ id: '1234', name: 'Fitness' }] });
    role = 'business';
    assert.equal((await interests.GET(req)).status, 403);
    assert.equal(graphCalls, 1, 'Unauthorized role never contacts Meta');
    role = 'affiliate'; graphFailure = true;
    assert.equal((await interests.GET(req)).status, 502, 'Configured token alone does not guarantee Meta acceptance');
    delete process.env.META_TARGETING_SEARCH_TOKEN;
    assert.equal((await interests.GET(req)).status, 409, 'Missing token has a visible configuration error');
    assert.equal(graphCalls, 2, 'Missing configuration never contacts Meta');

    const { AdCampaignWizard } = requireMocked('../app/affiliate/dashboard/promote/components/AdCampaignWizard');
    const noop = () => {};
    let saves = 0;
    let resolveSave: (value: boolean) => void = () => {};
    const props = { form: { campaign_name: 'Proposal', objective: 'OUTCOME_TRAFFIC', budget_type: 'DAILY', budget_amount_dollars: 20, interests: [], placements: {}, location_countries: 'AU', age_min: 18, age_max: 65, start_time: '', end_time: '' }, currency: 'USD', currencyLoading: false,
      walletBalance: 15, walletLoading: false, canRunWithWallet: false, walletDeficit: 5, starterSpendRemaining: 0,
      onInput: () => noop, setForm: noop, suggestedLogoUrl: 'https://test.invalid/logo.png', onUseSuggestedLogo: noop,
      handleAdSubmit: () => { saves++; return new Promise<boolean>(resolve => { resolveSave = resolve; }); } };
    const render = () => { stateIndex = 0; const tree = AdCampaignWizard(props); visit(tree); return renderToStaticMarkup(tree); };
    assert.match(render(), /Use brand logo/);
    states = []; step = 4; ref = { current: false };
    render();
    const pending = submitClick!();
    await submitClick!();
    assert.equal(saves, 1, 'Immediate second click does not replay save');
    assert.match(render(), /Uploading and saving…/);
    resolveSave(false); await pending;
    assert.match(render(), /role="alert"/);
    assert.match(render(), /proposal was not saved/);
    const retry = submitClick!(); resolveSave(true); await retry;
    assert.equal(saves, 2, 'Failed save unlocks retry');
    assert.doesNotMatch(render(), /proposal was not saved/);
    props.handleAdSubmit = async () => { throw new Error('Upload failed'); };
    render();
    await submitClick!();
    assert.match(render(), /Campaign not submitted: Upload failed/);
    const { PendingProposalRow } = requireMocked('../app/affiliate/dashboard/manage-campaigns/PendingProposalRow');
    const card = renderToStaticMarkup(React.createElement(PendingProposalRow, { proposal: { id: 'proposal', kind: 'paid', state: 'funding_required', currency: 'USD', offerTitle: 'Brand', funding: { requiredAmount: 20, deficit: 5 } } }));
    assert.match(card, /PAID LAUNCH BLOCKED/); assert.match(card, /Paid launches currently support AUD ad accounts only; multi-currency support is coming/);
    assert.doesNotMatch(card, /Add AUD|Required at launch|Top up wallet/);
    console.log('Round 6 offline first-participation, notification failure, submit/loading/error/retry, logo, currency and targeting regressions passed');
  } finally { loader._load = original; delete process.env.META_TARGETING_SEARCH_TOKEN; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
