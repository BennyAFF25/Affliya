import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type BusinessBillingStatus =
  | 'free'
  | 'grandfathered'
  | 'subscription_required'
  | 'subscription_active'
  | 'subscription_trialing'
  | 'subscription_past_due'
  | 'subscription_unpaid'
  | 'subscription_incomplete'
  | 'subscription_cancelled';

export type BusinessEntitlement = {
  businessId: string | null;
  businessEmail: string | null;
  billingStatus: BusinessBillingStatus;
  isGrandfathered: boolean;
  subscriptionRequired: boolean;
  hasActiveSubscription: boolean;
  paymentRequiredBeforeCampaignActivation: boolean;
  canLaunchCampaign: boolean;
  subscriptionStripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStartedAt: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionCancelledAt: string | null;
};

type EntitlementRow = {
  business_id?: string | null;
  business_email?: string | null;
  billing_status?: string | null;
  is_grandfathered?: boolean | null;
  subscription_required?: boolean | null;
  subscription_stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_started_at?: string | null;
  subscription_current_period_end?: string | null;
  subscription_cancelled_at?: string | null;
};

type BusinessProfileRow = {
  id?: string | null;
  business_email?: string | null;
};

export function isBusinessSubscriptionsEnabled() {
  return String(process.env.BUSINESS_SUBSCRIPTIONS_ENABLED || 'false').toLowerCase() === 'true';
}

export function isBusinessSubscriptionGateEnabled() {
  return String(process.env.BUSINESS_SUBSCRIPTION_GATE_ENABLED || 'false').toLowerCase() === 'true';
}

export function evaluateBusinessEntitlement(row: EntitlementRow): BusinessEntitlement {
  const billingStatus = normalizeBillingStatus(row.billing_status);
  const isGrandfathered = Boolean(row.is_grandfathered) || billingStatus === 'grandfathered';
  const hasActiveSubscription = billingStatus === 'subscription_active' || billingStatus === 'subscription_trialing';
  const subscriptionRequired = isGrandfathered ? false : row.subscription_required !== false;
  const canLaunchCampaign = isGrandfathered || hasActiveSubscription;

  return {
    businessId: row.business_id ?? null,
    businessEmail: row.business_email ?? null,
    billingStatus,
    isGrandfathered,
    subscriptionRequired,
    hasActiveSubscription,
    paymentRequiredBeforeCampaignActivation: subscriptionRequired && !canLaunchCampaign,
    canLaunchCampaign,
    subscriptionStripeCustomerId: row.subscription_stripe_customer_id ?? null,
    stripeSubscriptionId: row.stripe_subscription_id ?? null,
    subscriptionStartedAt: row.subscription_started_at ?? null,
    subscriptionCurrentPeriodEnd: row.subscription_current_period_end ?? null,
    subscriptionCancelledAt: row.subscription_cancelled_at ?? null,
  };
}

export async function getBusinessEntitlement(params: {
  businessId?: string | null;
  businessEmail?: string | null;
  supabase?: SupabaseClient;
}): Promise<BusinessEntitlement | null> {
  const businessId = params.businessId?.trim() || null;
  const businessEmail = params.businessEmail?.trim() || null;

  if (!businessId && !businessEmail) {
    throw new Error('getBusinessEntitlement requires businessId or businessEmail');
  }

  const supabase = params.supabase ?? createServerSupabaseClient();

  let entitlementQuery = supabase
    .from('business_entitlements')
    .select(
      'business_id,business_email,billing_status,is_grandfathered,subscription_required,subscription_stripe_customer_id,stripe_subscription_id,subscription_started_at,subscription_current_period_end,subscription_cancelled_at',
    );

  entitlementQuery = businessId
    ? entitlementQuery.eq('business_id', businessId)
    : entitlementQuery.eq('business_email', businessEmail as string);

  const { data: entitlement, error: entitlementError } = await entitlementQuery.maybeSingle();

  if (entitlementError) {
    throw new Error(`Failed to load business entitlement: ${entitlementError.message}`);
  }

  if (entitlement) {
    return evaluateBusinessEntitlement(entitlement as EntitlementRow);
  }

  // Defensive fallback for environments where code is deployed before the migration is applied.
  // It preserves access checks as non-enforced until a real entitlement row exists.
  let profileQuery = supabase.from('business_profiles').select('id,business_email');
  profileQuery = businessId
    ? profileQuery.eq('id', businessId)
    : profileQuery.eq('business_email', businessEmail as string);

  const { data: profile, error: profileError } = await profileQuery.maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load business profile for entitlement fallback: ${profileError.message}`);
  }

  if (!profile) return null;

  const businessProfile = profile as BusinessProfileRow;
  return evaluateBusinessEntitlement({
    business_id: businessProfile.id ?? businessId,
    business_email: businessProfile.business_email ?? businessEmail,
    billing_status: 'free',
    is_grandfathered: false,
    subscription_required: true,
  });
}

export async function canBusinessLaunchCampaign(params: {
  businessId?: string | null;
  businessEmail?: string | null;
  supabase?: SupabaseClient;
}) {
  const entitlement = await getBusinessEntitlement(params);
  return Boolean(entitlement?.canLaunchCampaign);
}

export type BusinessSubscriptionGateResult =
  | { ok: true; entitlement: BusinessEntitlement | null; gateEnabled: boolean }
  | {
      ok: false;
      status: 402;
      error: 'BUSINESS_SUBSCRIPTION_REQUIRED';
      message: string;
      entitlement: BusinessEntitlement | null;
      gateEnabled: boolean;
    };

export async function assertBusinessSubscriptionGate(params: {
  businessId?: string | null;
  businessEmail?: string | null;
  supabase?: SupabaseClient;
}): Promise<BusinessSubscriptionGateResult> {
  const gateEnabled = isBusinessSubscriptionsEnabled() && isBusinessSubscriptionGateEnabled();
  const entitlement = await getBusinessEntitlement(params);

  if (!gateEnabled) {
    return { ok: true, entitlement, gateEnabled };
  }

  if (entitlement?.canLaunchCampaign) {
    return { ok: true, entitlement, gateEnabled };
  }

  return {
    ok: false,
    status: 402,
    error: 'BUSINESS_SUBSCRIPTION_REQUIRED',
    message:
      'Activate Nettmark Business to approve and launch affiliate campaigns.',
    entitlement,
    gateEnabled,
  };
}

function normalizeBillingStatus(value?: string | null): BusinessBillingStatus {
  const normalized = String(value || 'free').toLowerCase();
  switch (normalized) {
    case 'grandfathered':
    case 'subscription_required':
    case 'subscription_active':
    case 'subscription_trialing':
    case 'subscription_past_due':
    case 'subscription_unpaid':
    case 'subscription_incomplete':
    case 'subscription_cancelled':
    case 'free':
      return normalized;
    case 'active':
      return 'subscription_active';
    case 'trialing':
      return 'subscription_trialing';
    case 'past_due':
      return 'subscription_past_due';
    case 'unpaid':
      return 'subscription_unpaid';
    case 'incomplete':
      return 'subscription_incomplete';
    case 'cancelled':
    case 'canceled':
      return 'subscription_cancelled';
    default:
      return 'free';
  }
}

function createServerSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase server env for business entitlement lookup');
  }

  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
