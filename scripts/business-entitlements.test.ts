import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  canBusinessLaunchCampaign,
  evaluateBusinessEntitlement,
  getBusinessEntitlement,
} from '../utils/businessEntitlements';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260721063000_business_subscription_entitlements.sql',
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

function makeMockSupabase(tables: Record<string, any[]>) {
  return {
    from(table: string) {
      let rows = tables[table] || [];
      const builder: any = {
        select() {
          return builder;
        },
        eq(column: string, value: string) {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        async maybeSingle() {
          return { data: rows[0] ?? null, error: null };
        },
      };
      return builder;
    },
  } as any;
}

async function run() {
  // 1. Existing business is grandfathered.
  const grandfathered = evaluateBusinessEntitlement({
    business_id: 'existing-business-id',
    business_email: 'existing@example.com',
    billing_status: 'grandfathered',
    is_grandfathered: true,
    subscription_required: false,
  });
  assert.equal(grandfathered.isGrandfathered, true);
  assert.equal(grandfathered.billingStatus, 'grandfathered');
  assert.equal(grandfathered.subscriptionRequired, false);

  assert.match(
    migrationSql,
    /INSERT INTO public\.business_entitlements[\s\S]*'grandfathered'[\s\S]*true[\s\S]*false[\s\S]*FROM public\.business_profiles bp/,
    'migration must explicitly grandfather existing business_profiles rows',
  );

  // 2. New business defaults to subscription required.
  const fresh = evaluateBusinessEntitlement({
    business_id: 'new-business-id',
    business_email: 'new@example.com',
    billing_status: 'free',
    is_grandfathered: false,
    subscription_required: true,
  });
  assert.equal(fresh.isGrandfathered, false);
  assert.equal(fresh.billingStatus, 'free');
  assert.equal(fresh.subscriptionRequired, true);

  assert.match(
    migrationSql,
    /CREATE OR REPLACE FUNCTION public\.ensure_business_entitlement\(\)[\s\S]*'free'[\s\S]*false[\s\S]*true/,
    'future business profile insert trigger must default to free + subscription_required',
  );

  // 3. Grandfathered business passes launch entitlement.
  assert.equal(grandfathered.canLaunchCampaign, true);
  assert.equal(
    await canBusinessLaunchCampaign({
      businessEmail: 'existing@example.com',
      supabase: makeMockSupabase({
        business_entitlements: [
          {
            business_id: 'existing-business-id',
            business_email: 'existing@example.com',
            billing_status: 'grandfathered',
            is_grandfathered: true,
            subscription_required: false,
          },
        ],
      }),
    }),
    true,
  );

  // 4. Free new business fails launch entitlement.
  assert.equal(fresh.canLaunchCampaign, false);
  assert.equal(fresh.paymentRequiredBeforeCampaignActivation, true);
  assert.equal(
    await canBusinessLaunchCampaign({
      businessEmail: 'new@example.com',
      supabase: makeMockSupabase({
        business_entitlements: [
          {
            business_id: 'new-business-id',
            business_email: 'new@example.com',
            billing_status: 'free',
            is_grandfathered: false,
            subscription_required: true,
          },
        ],
      }),
    }),
    false,
  );

  // 5. Normal users cannot modify their own grandfathering or subscription status.
  assert.match(migrationSql, /ALTER TABLE public\.business_entitlements ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(
    migrationSql,
    /CREATE POLICY[^;]+business_entitlements[^;]+FOR (INSERT|UPDATE|DELETE)[^;]+TO authenticated/i,
    'authenticated users must not get insert/update/delete policies on business_entitlements',
  );
  assert.match(
    migrationSql,
    /CREATE POLICY business_entitlements_service_all[\s\S]*TO service_role[\s\S]*WITH CHECK \(true\)/,
    'trusted service role must own entitlement writes',
  );

  // 6. Existing offers and campaigns remain accessible/untouched by this rollout migration.
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE public\.(offers|affiliate_requests|ad_ideas|organic_posts|live_campaigns|live_ads)\b/i,
    'Rollout 1 migration must not alter existing offer/campaign tables',
  );
  assert.doesNotMatch(
    migrationSql,
    /(UPDATE|DELETE) public\.(offers|affiliate_requests|ad_ideas|organic_posts|live_campaigns|live_ads)\b/i,
    'Rollout 1 migration must not update/delete existing offer/campaign rows',
  );

  const fallback = await getBusinessEntitlement({
    businessEmail: 'fallback@example.com',
    supabase: makeMockSupabase({
      business_entitlements: [],
      business_profiles: [{ id: 'fallback-id', business_email: 'fallback@example.com' }],
    }),
  });
  assert.equal(fallback?.billingStatus, 'free');
  assert.equal(fallback?.subscriptionRequired, true);

  console.log('business-entitlements tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
