import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveBillingRoute, isStripeBillingEligible } from '../lib/shopify/billingRoute';
import { billingConfig, subscriptionCreateVariables, appSubscriptionCreate, appSubscriptionCancel, querySubscription,
  stripeBillingEligible, growthPrice, claimShopifyBilling, shopifyTrialEligible, confirmShopifyBilling, changeShopifyPlan, uninstallShopifyBilling, mapShopifyStatus, syncShopifyBilling } from '../lib/shopify/billing';
import { protectedCallbackUrl } from '../lib/shopify/admin';
import { encryptToken } from '../lib/shopify/security';
import { syncBusinessEntitlementFromStripeSubscription } from '../utils/businessSubscriptions';

type Row = Record<string, unknown>;
async function main() {
  globalThis.fetch = async () => { throw new Error('Network forbidden'); };
  assert.equal(shopifyTrialEligible({}, {}), false, 'unknown legacy trial schema fails closed');
  assert.equal(shopifyTrialEligible({ growth_trial_used: false }, { trial_used: true }), false);
  const empty = { billing_provider: 'stripe', billing_status: 'free' };
  assert.equal(resolveBillingRoute(empty), 'stripe');
  assert.equal(resolveBillingRoute(empty, true), 'shopify');
  for (const evidence of [ { stripe_subscription_id: 'sub' }, { subscription_stripe_customer_id: 'cus' },
    { subscription_started_at: '2026-01-01' }, { growth_trial_used: true }, { growth_trial_started_at: '2026-01-01' },
    { is_grandfathered: true }, { stripe_billing_reserved: true }, ...['grandfathered', 'subscription_active', 'subscription_trialing', 'subscription_past_due', 'subscription_cancelled'].map(billing_status => ({ billing_status })) ]) {
    assert.equal(resolveBillingRoute({ ...empty, ...evidence }, true), 'stripe', JSON.stringify(evidence));
  }
  assert.equal(resolveBillingRoute({ billing_provider: 'shopify', growth_trial_used: true }), 'shopify');
  assert.equal(resolveBillingRoute({ billing_provider: 'shopify', stripe_subscription_id: 'sub' }), 'stripe');
  for (const VERCEL_ENV of [undefined, 'preview', 'development', 'production']) {
    for (const SHOPIFY_BILLING_TEST of [undefined, '', 'true', 'FALSE', 'false']) {
      assert.equal(billingConfig({ VERCEL_ENV, SHOPIFY_BILLING_TEST }).test, !(VERCEL_ENV === 'production' && SHOPIFY_BILLING_TEST === 'false'));
    }
  }
  const protectedReturn = new URL(protectedCallbackUrl('https://preview.invalid/api/shopify/billing/confirm', { VERCEL_ENV: 'preview', VERCEL_AUTOMATION_BYPASS_SECRET: 'mock-bypass' }));
  assert.equal(protectedReturn.pathname, '/api/shopify/billing/confirm');
  assert.equal(protectedReturn.searchParams.get('x-vercel-protection-bypass'), 'mock-bypass');
  const vars = subscriptionCreateVariables('https://example.invalid/api/shopify/billing/confirm', true, {});
  assert.equal(vars.trialDays, 14);
  assert.equal(vars.returnUrl, 'https://example.invalid/api/shopify/billing/confirm');
  assert.deepEqual(vars.lineItems, [{ plan: { appRecurringPricingDetails: { price: { amount: '49.00', currencyCode: 'AUD' }, interval: 'EVERY_30_DAYS' } } }]);
  assert.equal(subscriptionCreateVariables(vars.returnUrl, false, {}).trialDays, 0);
  assert.deepEqual(subscriptionCreateVariables(vars.returnUrl, false, { SHOPIFY_GROWTH_PRICE_USD_AMOUNT: '32.50' }, 'EUR').lineItems[0].plan.appRecurringPricingDetails.price, { amount: '32.50', currencyCode: 'USD' });
  assert.deepEqual(growthPrice('AUD', {}), { amount: '49.00', currencyCode: 'AUD', test: true });
  assert.deepEqual(growthPrice('CAD', { SHOPIFY_GROWTH_PRICE_USD_AMOUNT: '32.50' }), { amount: '32.50', currencyCode: 'USD', test: true });
  for (const amount of [undefined, '', '-1', '0', 'NaN', '49.123']) assert.throws(() => growthPrice('USD', { SHOPIFY_GROWTH_PRICE_USD_AMOUNT: amount }), /growth_unavailable_currency/);
  for (const amount of ['-1', '0', 'NaN', '49.123']) assert.throws(() => billingConfig({ SHOPIFY_GROWTH_PRICE_AMOUNT: amount }));
  for (const connected of [true, false]) {
    for (const status of ['ACTIVE', 'FROZEN', 'PENDING', 'CANCELLED', 'DECLINED', 'EXPIRED', null]) {
      assert.equal(isStripeBillingEligible('shopify', connected, status), !connected && !['ACTIVE', 'FROZEN', 'PENDING'].includes(status || ''));
      assert.equal(isStripeBillingEligible('stripe', connected, status), true);
    }
  }
  assert.equal(shopifyTrialEligible({ growth_trial_used: false, stripe_subscription_id: 'sub' }, {}), false);
  const shop = 'billing.myshopify.com', businessId = 'business';
  const gid = 'gid://shopify/AppSubscription/1';
  let queriedStatus = 'PENDING', createCalls = 0, cancelCalls = 0, graphqlCalls = 0;
  let uncertainCreate = false, billingCurrency = 'AUD';
  const requestedTrialDays: number[] = [];
  const request: typeof fetch = async (url, options) => {
    graphqlCalls++;
    assert.match(String(url), /^https:\/\/billing.myshopify.com\/admin\/api\/\d{4}-\d{2}\/graphql.json$/);
    const body = JSON.parse(String(options?.body));
    assert.equal(options?.redirect, 'error');
    if (body.query.includes('shopBillingPreferences')) return Response.json({ data: { shopBillingPreferences: { currency: billingCurrency } } });
    if (body.query.includes('appSubscriptionCreate')) {
      createCalls++;
      requestedTrialDays.push(body.variables.trialDays);
      if (uncertainCreate) throw new Error('mock timeout');
      assert.equal(body.variables.test, true);
      assert.equal(body.variables.returnUrl, vars.returnUrl);
      return Response.json({ data: { appSubscriptionCreate: { confirmationUrl: 'https://billing.myshopify.com/approve', appSubscription: {
        id: gid, status: 'PENDING', test: true, trialDays: body.variables.trialDays, createdAt: new Date().toISOString(),
      }, userErrors: [] } } });
    }
    if (body.query.includes('appSubscriptionCancel')) {
      cancelCalls++;
      assert.equal(body.variables.id, gid);
      assert.match(body.query, /prorate: false/);
      queriedStatus = 'CANCELLED';
      return Response.json({ data: { appSubscriptionCancel: { appSubscription: { id: gid, status: 'CANCELLED' }, userErrors: [] } } });
    }
    const subscription = { id: gid, status: queriedStatus, currentPeriodEnd: '2026-12-16T00:00:00Z' };
    return Response.json({ data: { currentAppInstallation: { activeSubscriptions: queriedStatus === 'ACTIVE' ? [subscription] : [] }, node: body.variables.id === gid ? subscription : null } });
  };
  await appSubscriptionCreate(shop, 'mock-token', vars.returnUrl, true, request);
  assert.equal(createCalls, 1);
  billingCurrency = 'CAD';
  const createsBeforeCurrency = createCalls;
  const previousUSD = process.env.SHOPIFY_GROWTH_PRICE_USD_AMOUNT;
  delete process.env.SHOPIFY_GROWTH_PRICE_USD_AMOUNT;
  await assert.rejects(appSubscriptionCreate(shop, 'mock-token', vars.returnUrl, true, request), /growth_unavailable_currency/);
  assert.equal(createCalls, createsBeforeCurrency, 'unsupported currency never sends a charge mutation');
  if (previousUSD !== undefined) process.env.SHOPIFY_GROWTH_PRICE_USD_AMOUNT = previousUSD;
  billingCurrency = 'AUD';
  await appSubscriptionCancel(shop, 'mock-token', gid, request);
  assert.equal(cancelCalls, 1);
  await assert.rejects(appSubscriptionCreate(shop, 'mock-token', vars.returnUrl, true, async (_url, options) => Response.json({ data: JSON.parse(String(options?.body)).query.includes('shopBillingPreferences') ? { shopBillingPreferences: { currency: 'AUD' } } : { appSubscriptionCreate: { userErrors: [{ message: 'no' }] } } })), /billing_create_rejected/);
  await assert.rejects(querySubscription(shop, 'mock-token', gid, async () => Response.json({ data: { currentAppInstallation: { activeSubscriptions: [{ id: 'other' }] } } })), /reconciliation/);
  for (const [status, billing] of Object.entries({ ACTIVE: 'subscription_active', CANCELLED: 'subscription_cancelled', DECLINED: 'subscription_cancelled', EXPIRED: 'subscription_cancelled', FROZEN: 'subscription_past_due', PENDING: 'subscription_incomplete' })) assert.equal(mapShopifyStatus(status), billing);
  assert.equal(mapShopifyStatus('ACTIVE', '2099-01-01'), 'subscription_trialing');
  assert.throws(() => mapShopifyStatus('UNKNOWN'));

  // In-memory Supabase adapter. RPC behavior models the checked-in transactional SQL;
  // no database connection is made. Static assertions below also check SQL guards.
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  const entitlement: Row = { business_id: businessId, business_email: 'mock@example.invalid', billing_provider: 'shopify', billing_status: 'free', growth_trial_used: false };
  const subscription: Row = { business_id: businessId, shop_domain: shop, shopify_app_subscription_id: null, shopify_plan: 'free', status: 'CANCELLED', mutation_pending: false, observed_at: '' };
  const store: Row = { business_id: businessId, shop_domain: shop, status: 'connected', installed_at: '2026-01-01', access_token_encrypted: encryptToken('mock-token'), refresh_token_encrypted: encryptToken('mock-refresh'),
    access_token_expires_at: new Date(Date.now() + 3600000).toISOString(), refresh_token_expires_at: new Date(Date.now() + 7200000).toISOString() };
  const tables: Record<string, Row[]> = { business_entitlements: [entitlement], shopify_app_subscriptions: [subscription], shopify_stores: [store],
    business_profiles: [{ id: businessId, business_email: 'mock@example.invalid' }], profiles: [{ id: businessId, role: 'business' }], shopify_pending_installs: [] };
  let syncWrites = 0;
  const adapter = {
    auth: { getUser: async () => ({ data: { user: { id: businessId, email: 'mock@example.invalid' } } }) },
    from(table: string) {
      let matches = [...(tables[table] || [])], update: Row | null = null, deletion = false;
      const result = () => {
        if (update) matches.forEach(row => Object.assign(row, update));
        if (deletion) tables[table] = tables[table].filter(row => !matches.includes(row));
        return { data: matches, error: null };
      };
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { matches = matches.filter(row => row[key] === value); return query; },
        neq(key: string, value: unknown) { matches = matches.filter(row => row[key] !== value); return query; },
        lt(key: string, value: string) { matches = matches.filter(row => String(row[key]) < value); return query; },
        limit() { return query; },
        update(values: Row) { update = values; return query; },
        delete() { deletion = true; return query; },
        async maybeSingle() { return { ...result(), data: matches[0] || null }; },
        async single() { return query.maybeSingle(); },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return query;
    },
    async rpc(name: string, args: Row) {
      if (name === 'claim_shopify_billing') return { data: entitlement.billing_provider === 'shopify', error: null };
      if (name === 'sync_shopify_billing') {
        if (entitlement.billing_provider !== 'shopify' || String(subscription.observed_at) >= String(args.p_observed)) return { data: false, error: null };
        const state = args.p_state as Row;
        assert.equal(state.id, subscription.shopify_app_subscription_id);
        subscription.status = state.status; subscription.observed_at = args.p_observed;
        entitlement.billing_status = subscription.shopify_plan === 'free' ? 'free' : mapShopifyStatus(String(state.status), subscription.trial_end as string);
        if (state.status === 'ACTIVE' && subscription.trial_end) subscription.trial_used = true;
        syncWrites++;
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  const db = adapter as unknown as SupabaseClient;
  // An App Store reinstall reconnects first, claims the same Shopify provider, and
  // the cancelled approval must be replaced rather than granting paid access.
  entitlement.billing_status = 'subscription_cancelled';
  assert.equal(await claimShopifyBilling(db, businessId, shop, true), true);
  assert.equal(subscription.status, 'CANCELLED');
  for (const path of ['app/business/shopify/complete/route.ts', 'app/api/shopify/callback/route.ts']) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /claimShopifyBilling/);
    assert.match(source, /destination.pathname = ['"]\/business\/choose-plan/);
  }

  tables.shopify_stores = [];
  assert.equal(await stripeBillingEligible(db, businessId, 'shopify'), true, 'uninstalled cancelled business can recover through Stripe');
  for (const status of ['ACTIVE', 'FROZEN', 'PENDING']) {
    subscription.status = status;
    assert.equal(await stripeBillingEligible(db, businessId, 'shopify'), false);
  }
  subscription.status = 'CANCELLED';
  const beforeUnowned = graphqlCalls;
  await assert.rejects(confirmShopifyBilling(db, businessId, request), /shop_not_owned/);
  assert.equal(graphqlCalls, beforeUnowned, 'ownership rejected before external request');
  tables.shopify_stores = [store];
  assert.equal(await stripeBillingEligible(db, businessId, 'shopify'), false, 'connected businesses keep Shopify even on Free');
  queriedStatus = 'PENDING'; createCalls = 0; cancelCalls = 0;
  const [first, second] = await Promise.allSettled([
    changeShopifyPlan(db, businessId, 'growth', vars.returnUrl, request), changeShopifyPlan(db, businessId, 'growth', vars.returnUrl, request),
  ]);
  assert.equal(first.status, 'fulfilled'); assert.equal(second.status, 'rejected');
  assert.equal(createCalls, 1, 'concurrent clicks create one approval');
  assert.equal(subscription.mutation_pending, false);
  assert.equal((await changeShopifyPlan(db, businessId, 'growth', vars.returnUrl, request)).url, 'https://billing.myshopify.com/approve');
  assert.equal(createCalls, 1, 'pending approval is reused');
  await confirmShopifyBilling(db, businessId, request);
  assert.equal(entitlement.billing_status, 'subscription_incomplete', 'pending never grants active access');
  queriedStatus = 'ACTIVE';
  subscription.observed_at = '';
  await confirmShopifyBilling(db, businessId, request);
  assert.equal(entitlement.billing_status, 'subscription_trialing');
  assert.equal(subscription.trial_used, true);
  const observed = '2090-01-01T00:00:00Z';
  await syncShopifyBilling(db, businessId, shop, { id: gid, status: 'FROZEN' }, observed);
  const count = syncWrites;
  await syncShopifyBilling(db, businessId, shop, { id: gid, status: 'FROZEN' }, observed);
  await syncShopifyBilling(db, businessId, shop, { id: gid, status: 'ACTIVE' }, '2089-01-01');
  assert.equal(syncWrites, count, 'duplicate and older observations do not rewrite state');
  subscription.observed_at = '';
  await changeShopifyPlan(db, businessId, 'free', vars.returnUrl, request);
  assert.equal(cancelCalls, 1);
  assert.equal(entitlement.billing_status, 'free');
  assert.equal(subscription.trial_used, true, 'downgrade retains trial consumption');
  entitlement.billing_provider = 'stripe';
  await assert.rejects(changeShopifyPlan(db, businessId, 'growth', vars.returnUrl, request), /stripe_billing_required/);
  const previous = entitlement.billing_status;
  await uninstallShopifyBilling(db, shop, '2091-01-01');
  assert.equal(entitlement.billing_status, previous, 'uninstall does not change Stripe entitlement');
  entitlement.billing_provider = 'shopify'; subscription.shopify_plan = 'growth';
  await uninstallShopifyBilling(db, shop, '2025-01-01');
  assert.equal(entitlement.billing_status, previous, 'old uninstall cannot cancel a newer install');
  await uninstallShopifyBilling(db, shop, '2091-01-01');
  assert.equal(entitlement.billing_status, 'subscription_cancelled');
  const writesAfterUninstall = syncWrites;
  await uninstallShopifyBilling(db, shop, '2091-01-01');
  assert.equal(syncWrites, writesAfterUninstall, 'uninstall replay is idempotent');
  const skipped = await syncBusinessEntitlementFromStripeSubscription({ supabase: db, subscription: { id: 'stripe-sub', metadata: { business_id: businessId }, status: 'active' }, sourceEventType: 'customer.subscription.updated' });
  assert.equal(skipped, null);
  assert.equal(entitlement.billing_status, 'subscription_cancelled', 'Stripe sync cannot overwrite Shopify');

  // Exercise actual authenticated HTTP handlers with injected server dependencies.
  const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
  const originalLoad = loader._load;
  const load = createRequire(__filename);
  let signedIn = true;
  loader._load = function(name, parent, isMain) {
    if (name.includes('supabase/createServerClient')) return { createServerSupabaseClient: () => db };
    if (name.includes('lib/shopify/server')) return { requireBusiness: async () => { if (!signedIn) throw new Error('unauthorized'); return { admin: db, businessId }; }, webhookBaseUrl: () => 'https://example.invalid' };
    if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => adapter };
    if (name === 'next/headers') return { cookies: () => ({}) };
    return originalLoad.call(this, name, parent, isMain);
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = request;
  try {
    // businessSubscriptions was imported before the hook: its server factory still
    // reads dummy env; the route's re-export is replaced below via module injection.
    const original = loader._load;
    loader._load = function(name, parent, isMain) {
      const result = original.call(this, name, parent, isMain);
      if (name.includes('utils/businessSubscriptions')) return { ...(result as object), createServerSupabaseClient: () => db };
      return result;
    };
    const checkout = load('../app/api/business-subscription/create-checkout-session/route') as { POST(req: Request): Promise<Response> };
    const portal = load('../app/api/business-subscription/create-portal-session/route') as typeof checkout;
    for (const route of [checkout, portal]) {
      const before = graphqlCalls;
      const response = await route.POST(new Request('https://example.invalid/api', { method: 'POST', body: JSON.stringify({ businessId }) }));
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, 'SHOPIFY_BILLING_REQUIRED');
      assert.equal(graphqlCalls, before);
    }
    const confirm = load('../app/api/shopify/billing/confirm/route') as { GET(req: Request): Promise<Response> };
    signedIn = false;
    const loginResponse = await confirm.GET(new Request('https://example.invalid/api/shopify/billing/confirm'));
    const loginUrl = new URL(loginResponse.headers.get('location')!);
    assert.equal(loginUrl.pathname, '/login/business');
    assert.equal(loginUrl.searchParams.get('next'), '/business/choose-plan');
    signedIn = true;
    queriedStatus = 'PENDING'; subscription.observed_at = '';
    const response = await confirm.GET(new Request('https://example.invalid/api/shopify/billing/confirm?charge_id=forged&status=ACTIVE'));
    assert.equal(new URL(response.headers.get('location')!).searchParams.get('shopify_billing'), 'pending');
    assert.equal(entitlement.billing_status, 'subscription_incomplete', 'forged query status cannot activate');
    tables.shopify_stores = [];
    assert.equal(new URL((await confirm.GET(new Request('https://example.invalid/api/shopify/billing/confirm?shop=other.myshopify.com'))).headers.get('location')!).searchParams.get('shopify_billing'), 'error');
    tables.shopify_stores = [store];
    const webhooks = load('../app/api/shopify/webhooks/route') as { POST(req: NextRequest): Promise<Response> };
    process.env.SHOPIFY_CLIENT_SECRET = 'mock-webhook-secret';
    const webhook = (valid: boolean) => {
      const raw = JSON.stringify({ app_subscription: { admin_graphql_api_id: gid, status: 'ACTIVE' } });
      return new NextRequest('https://example.invalid/api/shopify/webhooks', { method: 'POST', body: raw, headers: {
        'x-shopify-topic': 'app_subscriptions/update', 'x-shopify-shop-domain': shop,
        'x-shopify-hmac-sha256': valid ? createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET!).update(raw).digest('base64') : 'invalid',
      } });
    };
    assert.equal((await webhooks.POST(webhook(false))).status, 401);
    subscription.mutation_pending = true;
    const retry = await webhooks.POST(webhook(true));
    assert.equal(retry.status, 503, 'pending plan mutation must request Shopify retry');
    assert.equal(await retry.text(), '', 'retry response leaks no details');
    subscription.mutation_pending = false;
    queriedStatus = 'FROZEN';
    assert.equal((await webhooks.POST(webhook(true))).status, 200);
    assert.equal(entitlement.billing_status, 'subscription_past_due', 'signed ACTIVE payload cannot override re-queried FROZEN');
    assert.equal((await webhooks.POST(webhook(true))).status, 200);
    assert.equal(entitlement.billing_status, 'subscription_past_due');
  } finally { loader._load = originalLoad; globalThis.fetch = originalFetch; }
  subscription.observed_at = ''; subscription.status = 'CANCELLED'; queriedStatus = 'CANCELLED';
  const beforeReinstall = createCalls;
  assert.equal(await claimShopifyBilling(db, businessId, shop, true), true);
  await changeShopifyPlan(db, businessId, 'growth', vars.returnUrl, request);
  assert.equal(createCalls, beforeReinstall + 1, 'reinstall requires fresh merchant approval');
  assert.equal(subscription.status, 'PENDING');
  assert.equal(requestedTrialDays.at(-1), 0, 'reinstall does not restart the used trial');
  subscription.status = 'CANCELLED'; queriedStatus = 'CANCELLED';
  uncertainCreate = true;
  await assert.rejects(changeShopifyPlan(db, businessId, 'growth', vars.returnUrl, request), /mock timeout/);
  assert.equal(subscription.mutation_pending, true);
  assert.equal(requestedTrialDays.at(-1), 0, 'used trial is not offered again');
  await assert.rejects(changeShopifyPlan(db, businessId, 'growth', vars.returnUrl, request), /reconciliation/);

  const sql = readFileSync('supabase/migrations/20261116120000_shopify_billing.sql', 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public.shopify_app_subscriptions FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /billing_provider_change/);
  assert.match(sql, /business_subscription_status_synced/);
  assert.doesNotMatch(sql, /to_jsonb/);
  assert.match(sql, /status IN \('ACTIVE','FROZEN','PENDING'\)/);
  assert.match(sql, /s.observed_at >= p_observed/);
  assert.match(sql, /e.billing_provider<>'shopify'/);
  for (const name of ['payment-recovery', 'trial-reminders']) assert.match(readFileSync(`app/api/business-subscription/${name}/route.ts`, 'utf8'), /eq\("billing_provider", "stripe"\)/);
  console.log('shopify-billing: all tests passed (offline mocks; SQL not executed)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
