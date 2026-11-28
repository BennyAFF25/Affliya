import type { SupabaseClient } from '@supabase/supabase-js';
import { adminGraphql } from './admin';
import { validAccessToken } from './tokens';
import { isStripeBillingEligible, resolveBillingRoute } from './billingRoute';
import { BUSINESS_GROWTH_TRIAL_DAYS } from '../../utils/businessSubscriptions';

export type ShopifySubscription = { id: string; status: string; currentPeriodEnd?: string | null; test?: boolean; createdAt?: string; trialDays?: number };
export function billingConfig(environment: Record<string, string | undefined> = process.env) {
  const amount = environment.SHOPIFY_GROWTH_PRICE_AMOUNT?.trim() || '49.00';
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('configuration');
  return { amount, currencyCode: 'AUD', test: !(environment.SHOPIFY_BILLING_TEST === 'false' && environment.VERCEL_ENV === 'production') };
}
export function growthPrice(currency: string, environment: Record<string, string | undefined> = process.env) {
  if (currency === 'AUD') return billingConfig(environment);
  const amount = environment.SHOPIFY_GROWTH_PRICE_USD_AMOUNT?.trim() || '';
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('growth_unavailable_currency');
  return { ...billingConfig(environment), amount, currencyCode: 'USD' };
}
// Reviewer-verified trial history; incomplete evidence fails closed.
export function shopifyTrialEligible(history: Record<string, unknown>, row: Record<string, unknown>) {
  return history.growth_trial_used === false && !history.growth_trial_started_at && !history.stripe_subscription_id && !row.trial_used && !row.trial_started_at;
}
export function subscriptionCreateVariables(returnUrl: string, trialEligible: boolean, environment: Record<string, string | undefined> = process.env, currency = 'AUD') {
  const { amount, currencyCode, test } = growthPrice(currency, environment);
  return { name: 'Nettmark Growth', returnUrl, test, trialDays: trialEligible ? BUSINESS_GROWTH_TRIAL_DAYS : 0,
    replacementBehavior: 'APPLY_IMMEDIATELY',
    lineItems: [{ plan: { appRecurringPricingDetails: { price: { amount, currencyCode }, interval: 'EVERY_30_DAYS' } } }] };
}
export function mapShopifyStatus(status: string, trialEnd?: string | null, now = Date.now()) {
  switch (status) {
    case 'ACTIVE': return trialEnd && Date.parse(trialEnd) > now ? 'subscription_trialing' : 'subscription_active';
    case 'FROZEN': return 'subscription_past_due';
    case 'PENDING': return 'subscription_incomplete';
    case 'CANCELLED': case 'DECLINED': case 'EXPIRED': return 'subscription_cancelled';
    default: throw new Error('invalid_subscription_status');
  }
}
export async function billingGraphql(shop: string, token: string, query: string, variables: Record<string, unknown>, request = fetch) {
  const body = await adminGraphql(shop, token, query, variables, request, 'billing_unavailable');
  if (body.errors?.length || !body.data) throw new Error('billing_unavailable');
  return body.data;
}
const fields = 'id status currentPeriodEnd test createdAt trialDays';
export async function appSubscriptionCreate(shop: string, token: string, returnUrl: string, trialEligible: boolean, request = fetch) {
  const preferences = await billingGraphql(shop, token, 'query BillingPreferences { shopBillingPreferences { currency } }', {}, request);
  const currency = preferences.shopBillingPreferences?.currency;
  if (typeof currency !== 'string') throw new Error('billing_unavailable');
  const variables = subscriptionCreateVariables(returnUrl, trialEligible, process.env, currency);
  const data = await billingGraphql(shop, token,
    `mutation Growth($name: String!, $returnUrl: URL!, $test: Boolean!, $trialDays: Int!, $lineItems: [AppSubscriptionLineItemInput!]!, $replacementBehavior: AppSubscriptionReplacementBehavior!) {
      appSubscriptionCreate(name: $name, returnUrl: $returnUrl, test: $test, trialDays: $trialDays, lineItems: $lineItems, replacementBehavior: $replacementBehavior) {
        confirmationUrl appSubscription { ${fields} } userErrors { field message } } }`,
    variables, request);
  const result = data.appSubscriptionCreate;
  if (result?.userErrors?.length) throw new Error('billing_create_rejected');
  if (!result?.appSubscription?.id || !result.confirmationUrl) throw new Error('billing_create_failed');
  return result as { confirmationUrl: string; appSubscription: ShopifySubscription };
}
export async function appSubscriptionCancel(shop: string, token: string, id: string, request = fetch) {
  const data = await billingGraphql(shop, token,
    `mutation Cancel($id: ID!) { appSubscriptionCancel(id: $id, prorate: false) { appSubscription { ${fields} } userErrors { field message } } }`, { id }, request);
  if (data.appSubscriptionCancel?.userErrors?.length) throw new Error('billing_cancel_rejected');
  if (data.appSubscriptionCancel?.appSubscription?.status !== 'CANCELLED') throw new Error('billing_cancel_failed');
}
export async function querySubscription(shop: string, token: string, id: string | null, request = fetch): Promise<ShopifySubscription | null> {
  const data = await billingGraphql(shop, token,
    id ? `query Billing($id: ID!) { currentAppInstallation { activeSubscriptions { ${fields} } } node(id: $id) { ... on AppSubscription { ${fields} } } }`
      : `query Billing { currentAppInstallation { activeSubscriptions { ${fields} } } }`,
    id ? { id } : {}, request);
  if (!data.currentAppInstallation || !Array.isArray(data.currentAppInstallation.activeSubscriptions)) throw new Error('billing_unavailable');
  const active = data.currentAppInstallation.activeSubscriptions as ShopifySubscription[];
  // An unknown live charge is unsafe to replace or silently ignore.
  if (active.some(sub => sub.id !== id)) throw new Error('subscription_reconciliation_required');
  const subscription = active.find(sub => sub.id === id) || data.node || null;
  if (id && (!subscription || subscription.id !== id)) throw new Error('subscription_reconciliation_required');
  return subscription;
}
export async function billingRow(admin: SupabaseClient, businessId: string) {
  const result = await admin.from('shopify_app_subscriptions').select('*').eq('business_id', businessId).maybeSingle();
  if (result.error) throw new Error('database');
  return result.data;
}
export async function claimShopifyBilling(admin: SupabaseClient, businessId: string, shop: string, appStoreFirst: boolean) {
  const { data: entitlement, error } = await admin.from('business_entitlements').select('*').eq('business_id', businessId).maybeSingle();
  if (error || !entitlement) throw new Error('database');
  if (resolveBillingRoute(entitlement, appStoreFirst) !== 'shopify') return false;
  const result = await admin.rpc('claim_shopify_billing', { p_business: businessId, p_shop: shop });
  if (result.error) throw new Error('database');
  return result.data === true;
}
export async function ownedBilling(admin: SupabaseClient, businessId: string) {
  const row = await billingRow(admin, businessId);
  if (!row) throw new Error('shop_not_owned');
  const { data: store, error } = await admin.from('shopify_stores').select('business_id').eq('business_id', businessId).eq('shop_domain', row.shop_domain).eq('status', 'connected').maybeSingle();
  if (error) throw new Error('database');
  if (!store) throw new Error('shop_not_owned');
  if (!await claimShopifyBilling(admin, businessId, row.shop_domain, false)) throw new Error('stripe_billing_required');
  return row;
}
export async function syncShopifyBilling(admin: SupabaseClient, businessId: string, shop: string, subscription: ShopifySubscription, observed: string) {
  mapShopifyStatus(subscription.status); // Reject unknown statuses before persistence.
  const { error } = await admin.rpc('sync_shopify_billing', { p_business: businessId, p_shop: shop,
    p_state: { id: subscription.id, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd || null }, p_observed: observed });
  if (error) throw new Error('database');
}
export async function confirmShopifyBilling(admin: SupabaseClient, businessId: string, request = fetch) {
  const row = await ownedBilling(admin, businessId);
  if (row.mutation_pending) throw new Error('subscription_reconciliation_required');
  const token = await validAccessToken(admin, row.shop_domain, businessId, request);
  const observed = new Date().toISOString();
  const subscription = await querySubscription(row.shop_domain, token, row.shopify_app_subscription_id, request);
  if (subscription) await syncShopifyBilling(admin, businessId, row.shop_domain, subscription, observed);
  return subscription;
}
export async function changeShopifyPlan(admin: SupabaseClient, businessId: string, plan: 'free' | 'growth', returnUrl: string, request = fetch) {
  await ownedBilling(admin, businessId);
  // Durable claim serializes concurrent plan mutations. Never auto-retry an uncertain external mutation.
  const { data: locked, error } = await admin.from('shopify_app_subscriptions').update({ mutation_pending: true })
    .eq('business_id', businessId).eq('mutation_pending', false).select('*').maybeSingle();
  if (error) throw new Error('database');
  if (!locked) throw new Error('subscription_reconciliation_required');
  const row = locked; // Use the state returned by the claim, not a stale pre-lock read.
  let mutationSent = false;
  const save = async (values: Record<string, unknown>, release = true) => {
    const { error } = await admin.from('shopify_app_subscriptions').update({ ...values, updated_at: new Date().toISOString(), mutation_pending: !release }).eq('business_id', businessId);
    if (error) throw new Error('database');
  };
  try {
    const token = await validAccessToken(admin, row.shop_domain, businessId, request);
    const current = await querySubscription(row.shop_domain, token, row.shopify_app_subscription_id, request);
    if (plan === 'free') {
      if (current && ['ACTIVE', 'FROZEN', 'PENDING'].includes(current.status)) {
        mutationSent = true;
        await appSubscriptionCancel(row.shop_domain, token, current.id, request);
      }
      await save({ shopify_plan: 'free', status: 'CANCELLED', confirmation_url: null }, false);
      const { error } = await admin.rpc('sync_shopify_billing', { p_business: businessId, p_shop: row.shop_domain,
        p_state: { id: row.shopify_app_subscription_id, status: 'CANCELLED', currentPeriodEnd: null }, p_observed: new Date().toISOString() });
      if (error) throw new Error('database');
      await save({});
      return { ok: true };
    }
    if (current && ['ACTIVE', 'FROZEN'].includes(current.status)) {
      await syncShopifyBilling(admin, businessId, row.shop_domain, current, new Date().toISOString());
      await save({});
      return { ok: true };
    }
    if (current?.status === 'PENDING') {
      if (!row.confirmation_url) throw new Error('subscription_reconciliation_required');
      await save({});
      return { url: row.confirmation_url };
    }
    const { data: history, error } = await admin.from('business_entitlements').select('*').eq('business_id', businessId).single();
    if (error) throw new Error('database');
    const trialEligible = shopifyTrialEligible(history, row);
    mutationSent = true;
    const created = await appSubscriptionCreate(row.shop_domain, token, returnUrl, trialEligible, request);
    const sub = created.appSubscription;
    await save({ shopify_app_subscription_id: sub.id, shopify_plan: 'growth', status: sub.status,
      test: sub.test ?? billingConfig().test, confirmation_url: created.confirmationUrl,
      trial_used: Boolean(row.trial_used || trialEligible), // Like Stripe subscription history, an offered trial cannot be restarted.
      trial_end: sub.trialDays && sub.createdAt ? new Date(Date.parse(sub.createdAt) + sub.trialDays * 86400000).toISOString() : null });
    return { url: created.confirmationUrl };
  } catch (error) {
    if (!mutationSent || (error instanceof Error && ['billing_create_rejected', 'billing_cancel_rejected', 'growth_unavailable_currency', 'configuration'].includes(error.message))) await save({});
    throw error;
  }
}
// The verified uninstall event needs no token (Shopify revokes it). Preserve delayed-event protection.
export async function uninstallShopifyBilling(admin: SupabaseClient, shop: string, triggeredAt: string) {
  const { data: store, error } = await admin.from('shopify_stores').select('business_id').eq('shop_domain', shop).lt('installed_at', triggeredAt).maybeSingle();
  if (error) throw new Error('database');
  if (!store) return;
  const row = await billingRow(admin, store.business_id);
  if (!row || row.shop_domain !== shop) return;
  const { error: syncError } = await admin.rpc('sync_shopify_billing', { p_business: store.business_id, p_shop: shop,
    p_state: { id: row.shopify_app_subscription_id, status: 'CANCELLED', currentPeriodEnd: null }, p_observed: triggeredAt });
  if (syncError) throw new Error('database');
}

export async function stripeBillingEligible(admin: SupabaseClient, businessId: string, provider: string | undefined) {
  if (provider !== 'shopify') return true;
  const [row, stores] = await Promise.all([
    billingRow(admin, businessId),
    admin.from('shopify_stores').select('business_id').eq('business_id', businessId).eq('status', 'connected').limit(1).maybeSingle(),
  ]);
  if (stores.error) throw new Error('database');
  return isStripeBillingEligible(provider, Boolean(stores.data), row?.status);
}
