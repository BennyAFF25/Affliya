import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { promotionDraftKey, readPromotionDraft, promotionJson, withPromotionTimeout } from '../utils/affiliate/promotionDraft';
import { promotionRequestId, PAID_DEMAND_WINDOW_MS } from '../utils/affiliate/promotionRequests';
import { ensureAffiliateOfferParticipation } from '../utils/approvals/enforcement';

type Row = Record<string, any>;
const email = 'affiliate@test.invalid';
const offerId = '11111111-1111-4111-8111-111111111111';
let rows: Record<string, Row[]>;
let authenticated = true, failTable = '', failCode = 'XX000', failInsertOnly = false;
let sent = 0;
const deferred: (() => Promise<void>)[] = [];
const db = {
  auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'user', email } : null }, error: null }) },
  from(table: string) {
    let matches = [...(rows[table] || [])];
    let insertion: Row | undefined, update: Row | undefined;
    const result = () => {
      if (failTable === table && (!failInsertOnly || insertion)) return { data: null, error: { code: failCode, message: 'fixture database failure' } };
      if (insertion) {
        if ((rows[table] || []).some(row => row.id === insertion!.id)) return { data: null, error: { code: '23505' } };
        (rows[table] ||= []).push({ created_at: new Date().toISOString(), ...insertion });
      }
      if (update) matches.forEach(row => Object.assign(row, update));
      return { data: matches, error: null };
    };
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { matches = matches.filter(row => row[key] === value); return query; },
      ilike: (key: string, value: string) => { matches = matches.filter(row => String(row[key]).toLowerCase() === value.toLowerCase()); return query; },
      single: async () => { const value = result(); return { ...value, data: value.error ? null : insertion || matches[0] || null }; },
      is: (key: string, value: unknown) => { matches = matches.filter(row => row[key] === value); return query; },
      order: (key: string) => { matches.sort((a, b) => String(b[key]).localeCompare(String(a[key]))); return query; },
      limit: (n: number) => { matches = matches.slice(0, n); return query; },
      insert: (row: Row) => { insertion = row; return query; },
      update: (row: Row) => { update = row; return query; },
      maybeSingle: async () => { const value = result(); return { ...value, data: value.error ? null : matches[0] || null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
};
function reset() {
  rows = { profiles: [{ id: 'user', role: 'affiliate' }], offers: [{ archived_at: null, id: offerId, business_email: 'brand@test.invalid', title: 'Offer', status: 'active', participation_mode: 'approval_required', currency: 'AUD' }], affiliate_requests: [], product_events: [] };
  authenticated = true; failTable = ''; failCode = 'XX000'; failInsertOnly = false; sent = 0; deferred.length = 0;
}
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => any };
const original = loader._load;
const requireMocked = createRequire(__filename);
let stateIndex = 0, refIndex = 0;
let states: any[] = [], refs: any[] = [];
const errors: string[] = [];
loader._load = function(name, parent, isMain) {
  if (name === 'next/server') return { NextResponse: { json: Response.json }, after: (fn: () => Promise<void>) => deferred.push(fn) };
  if (name === 'next/headers') return { cookies: () => ({}) };
  if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => db };
  if (name.includes('supabase/server-client')) return { __esModule: true, default: db };
  if (name.includes('businessSubscriptions')) return { createServerSupabaseClient: () => db };
  if (name.includes('businessEntitlements')) return { getBusinessEntitlement: async () => ({ canLaunchCampaign: false }) };
  if (name.includes('profileIdentity')) return { getAffiliateUsername: async () => 'Affiliate' };
  if (name.includes('email/templates')) return { businessNewAffiliateRequestEmail: () => ({ subject: 'Access', html: 'Access' }) };
  if (name.includes('email/send')) return { sendEmail: async () => { sent++; } };
  if (name.includes('MetaInterestPicker')) return { MetaInterestPicker: () => null };
  if (name.includes('components/ui/toast')) return { nmToast: { error: (message: string) => errors.push(message) } };
  if (name === 'react') return { ...React,
    useState: (initial: any) => { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], (value: any) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: (initial: any) => { const i = refIndex++; return refs[i] ||= { current: initial }; },
    useMemo: (fn: () => unknown) => fn(),
  };
  return original.call(this, name, parent, isMain);
};
async function run() {
  try {
    reset();
    const start = requireMocked('../app/api/affiliate/offers/[offerId]/start/route');
    const createIdea = requireMocked('../app/api/affiliate/ad-ideas/create/route');
    const demand = requireMocked('../app/api/affiliate/offers/[offerId]/paid-promotion-request/route');
    const context = { params: Promise.resolve({ offerId }) };
    const request = () => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ budget: 20 }) });
    rows.offers[0].archived_at = '2026-10-30T12:00:00Z';
    assert.equal((await start.POST(request(), context)).status, 404, 'archived offers reject new participation');
    assert.equal((await demand.POST(request(), context)).status, 404, 'archived offers reject new paid demand');
    assert.equal(rows.affiliate_requests.length, 0);
    rows.offers[0].archived_at = null;
    assert.equal((await (await start.GET(request(), context)).json()).participation.status, 'none');
    assert.equal(rows.affiliate_requests.length, 0, 'opening the wizard is read only');
    const access = await Promise.all([start.POST(request(), context), start.POST(request(), context)]);
    for (const response of access) assert.equal((await response.json()).participation.status, 'pending');
    assert.equal(rows.affiliate_requests.length, 1, 'concurrent requests arbitrate on primary key');
    assert.equal(rows.product_events.length, 0, 'pending access is not promotion_started');
    assert.equal(deferred.length, 1, 'only the creating request schedules email');
    assert.equal((await (await start.GET(request(), context)).json()).participation.status, 'pending');
    await deferred.shift()!(); assert.equal(sent, 1);
    const paid = await Promise.all([demand.POST(request(), context), demand.POST(request(), context)]);
    for (const response of paid) assert.equal(response.status, 200, 'pending affiliates can express demand');
    assert.equal(rows.product_events.length, 1);
    assert.equal(rows.product_events[0].event_type, 'paid_promotion_meta_requested');
    assert.equal(deferred.length, 1); assert.equal(sent, 1, 'request does not wait for email');
    await deferred.shift()!(); assert.equal(sent, 2);
    assert.equal((await (await demand.POST(request(), context)).json()).existing, true);
    assert.equal(deferred.length, 0);
    rows.product_events[0].created_at = new Date(Date.now() - PAID_DEMAND_WINDOW_MS - 1000).toISOString();
    assert.equal((await demand.POST(request(), context)).status, 200);
    assert.equal(rows.product_events.length, 2, 'new rolling window permits a request');
    rows.affiliate_requests[0].status = 'approved';
    await Promise.all([start.POST(request(), context), start.POST(request(), context)]);
    await start.POST(request(), context);
    assert.equal(rows.product_events.filter(row => row.event_type === 'promotion_started').length, 1);
    assert.equal(deferred.length, 1, 'approved resumes do not schedule access emails');
    rows.affiliate_requests[0].status = 'rejected';
    assert.equal((await (await start.GET(request(), context)).json()).participation.status, 'rejected');
    assert.equal((await start.POST(request(), context)).status, 403);
    assert.equal((await demand.POST(request(), context)).status, 403);
    reset(); rows.profiles[0].role = 'business';
    assert.equal((await start.GET(request(), context)).status, 403);
    assert.equal((await demand.POST(request(), context)).status, 403);
    authenticated = false; assert.equal((await start.GET(request(), context)).status, 401);
    reset(); await start.POST(request(), context); failTable = 'product_events'; failCode = '23514'; failInsertOnly = true;
    const policyFailure = await demand.POST(request(), context);
    assert.equal(policyFailure.status, 500);
    assert.match((await policyFailure.json()).error, /database event policy/);
    assert.equal(deferred.length, 1, 'failed event never schedules demand email');
    failTable = 'affiliate_requests'; failInsertOnly = false;
    assert.equal((await start.GET(request(), context)).status, 503);
    reset(); rows.offers[0].participation_mode = 'open';
    const results = await Promise.all([ensureAffiliateOfferParticipation(db, { offerId, affiliateEmail: email, participationMode: 'open' }), ensureAffiliateOfferParticipation(db, { offerId, affiliateEmail: email, participationMode: 'open' })]);
    assert.equal(results.filter(result => result.ok && result.created).length, 1);
    assert.equal(promotionRequestId('participation', offerId, email.toUpperCase()), rows.affiliate_requests[0].id);

    reset(); await start.POST(request(), context);
    const proposal = { offer_id: offerId, currency: 'AUD', headline: 'Headline', caption: 'Caption', campaign_name: 'Saved draft', objective: 'OUTCOME_TRAFFIC', budget_amount: 2000, budget_type: 'DAILY', end_time: new Date(Date.now() + 7 * 86400000).toISOString(), location: 'AU', age_range: [18, 65], interests: [], manual_placements: ['facebook_feed'], placements_type: 'MANUAL', advantage_audience: false, call_to_action: 'LEARN_MORE', bid_strategy: 'LOWEST_COST', media_type: 'IMAGE', file_url: 'https://assets.test/restored.png', display_link: 'https://brand.test' };
    const proposalRequest = () => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(proposal) });
    assert.equal((await createIdea.POST(proposalRequest())).status, 409, 'pending cannot bypass UI approval gate');
    assert.equal(rows.ad_ideas?.length || 0, 0);
    rows.affiliate_requests[0].status = 'approved';
    assert.equal((await createIdea.POST(proposalRequest())).status, 201, 'saved draft can be submitted after approval');
    assert.equal(rows.ad_ideas[0].file_url, proposal.file_url);
    assert.equal(rows.ad_ideas[0].status, 'pending', 'proposal still requires creative review');

    const { AdCampaignWizard } = requireMocked('../app/affiliate/dashboard/promote/components/AdCampaignWizard');
    const form = { campaign_name: 'Draft', objective: 'OUTCOME_TRAFFIC', headline: '', caption: '', interests: [], placements: {}, location_countries: 'AU', age_min: 18, age_max: 65, start_time: '', end_time: '', budget_type: 'DAILY', budget_amount_dollars: 20 };
    let step = 4, saves = 0, finish: (result: boolean) => void = () => {};
    const props: any = { step, setStep: (value: number) => { step = value; }, form, currency: 'AUD', onInput: () => () => {}, setForm: () => {}, handleAdSubmit: async () => { saves++; return new Promise<boolean>(resolve => { finish = resolve; }); } };
    let submit: any;
    const render = () => {
      stateIndex = refIndex = 0; props.step = step;
      const tree = AdCampaignWizard(props);
      const walk = (node: any) => { if (!node || typeof node !== 'object') return; if (node.type === 'button' && 'aria-busy' in node.props) submit = node.props; React.Children.forEach(node.props?.children, walk); };
      walk(tree); return renderToStaticMarkup(tree);
    };
    render(); await submit.onClick(); assert.equal(step, 3); assert.equal(saves, 0);
    assert.match(render(), /role="alert"/); assert.match(errors.join(' '), /headline.*caption/);
    form.headline = 'Headline'; form.caption = 'Caption'; step = 4;
    props.submitBlockedReason = 'Request sent — waiting for the business to approve';
    const pendingMarkup = render();
    assert.match(pendingMarkup, /waiting for the business/); assert.doesNotMatch(pendingMarkup, /Campaign not submitted/); assert.equal(submit.disabled, true);
    props.submitBlockedReason = null; render();
    const first = submit.onClick(); await submit.onClick(); assert.equal(saves, 1, 'double click does not replay submission');
    finish(false); await first; assert.match(render(), /proposal was not saved/);

    const draft = { version: 1, form, step: 4, source: 'upload', logo: false, brand: null, media: { url: 'https://assets.test/video.mp4', type: 'video', thumbnail: 'https://assets.test/thumb.jpg' }, reselect: false };
    assert.deepEqual(readPromotionDraft(JSON.stringify(draft)), draft);
    assert.equal(promotionDraftKey(email, offerId), promotionDraftKey(email.toUpperCase(), offerId));
    assert.notEqual(promotionDraftKey(email, offerId), promotionDraftKey('another@test.invalid', offerId));
    assert.throws(() => readPromotionDraft('{broken'));
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json({ ok: false, error: 'Access denied' }, { status: 403 });
      await assert.rejects(promotionJson('/test'), /Access denied/);
      globalThis.fetch = async () => Response.json({ ok: true, participation: { status: 'pending' } });
      assert.equal((await promotionJson('/test')).participation.status, 'pending');
      const originalTimer = globalThis.setTimeout;
      try {
        globalThis.setTimeout = ((callback: () => void) => originalTimer(callback, 0)) as typeof setTimeout;
        globalThis.fetch = async (_url, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
        await assert.rejects(promotionJson('/slow'), /took too long/);
        await assert.rejects(withPromotionTimeout(new Promise(() => {})), /sign-in took too long/);
      } finally { globalThis.setTimeout = originalTimer; }
    } finally { globalThis.fetch = originalFetch; }
    console.log('Affiliate paid wizard: access states, concurrent idempotency, rolling demand window, database failures, notification isolation, copy feedback, double-click guard, and draft isolation pass.');
  } finally { loader._load = original; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
