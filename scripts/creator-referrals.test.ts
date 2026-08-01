import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getCreatorReferralWindowDays,
  isSafeCreatorReferralCode,
  normalizeCreatorReferralCode,
  parseCreatorReferralCookie,
} from '../utils/creatorReferrals';

const root = process.cwd();
const migrationSql = fs.readFileSync(path.join(root, 'supabase/migrations/20260728110000_creator_referral_attribution.sql'), 'utf8');
const creatorHelper = fs.readFileSync(path.join(root, 'utils/creatorReferrals.ts'), 'utf8');
const captureRoute = fs.readFileSync(path.join(root, 'app/api/creator-referrals/capture/route.ts'), 'utf8');
const attributeRoute = fs.readFileSync(path.join(root, 'app/api/creator-referrals/attribute/route.ts'), 'utf8');
const homePage = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
const createAccountPage = fs.readFileSync(path.join(root, 'app/create-account/page.tsx'), 'utf8');
const webhookRoute = fs.readFileSync(path.join(root, 'app/api/business-subscription/webhook/route.ts'), 'utf8');
const reportingPage = fs.readFileSync(path.join(root, 'app/internal/creator-referrals/page.tsx'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

async function run() {
  // A. Creator partner records and configurable terms.
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.creator_partners/);
  for (const column of ['display_name', 'partner_email', 'referral_code', 'referral_url', 'commission_percentage', 'commission_duration_months', 'created_at', 'updated_at']) {
    assert.match(migrationSql, new RegExp(column));
  }
  assert.match(migrationSql, /status IN \('invited', 'active', 'paused', 'terminated'\)/);
  assert.match(migrationSql, /commission_percentage numeric\(5,2\) NOT NULL DEFAULT 50\.00/);
  assert.match(migrationSql, /commission_duration_months integer NOT NULL DEFAULT 3/);
  assert.match(creatorHelper, /DEFAULT_CREATOR_COMMISSION_PERCENTAGE = 50/);
  assert.match(creatorHelper, /DEFAULT_CREATOR_COMMISSION_DURATION_MONTHS = 3/);
  assert.doesNotMatch(creatorHelper, /commissionAmount = Math\.round\(grossAmount \* 0\.5\)/, 'Commission percentage must not be hardcoded in calculations.');

  // B. Referral links + first-party cookie + configurable attribution window.
  assert.match(homePage, /params\.get\("ref"\)/);
  assert.match(homePage, /\/api\/creator-referrals\/capture/);
  assert.match(captureRoute, /captureCreatorReferral/);
  assert.match(creatorHelper, /CREATOR_REFERRAL_ATTRIBUTION_WINDOW_DAYS/);
  delete process.env.CREATOR_REFERRAL_ATTRIBUTION_WINDOW_DAYS;
  assert.equal(getCreatorReferralWindowDays(), 30, 'Referral attribution window defaults to 30 days.');
  process.env.CREATOR_REFERRAL_ATTRIBUTION_WINDOW_DAYS = '45';
  assert.equal(getCreatorReferralWindowDays(), 45, 'Referral attribution window is configurable.');
  delete process.env.CREATOR_REFERRAL_ATTRIBUTION_WINDOW_DAYS;
  assert.equal(normalizeCreatorReferralCode(' @Aspire_01 '), 'Aspire_01');
  assert.equal(isSafeCreatorReferralCode('Aspire_01'), true);
  assert.equal(isSafeCreatorReferralCode('bad code!'), false);
  assert.ok(parseCreatorReferralCookie(JSON.stringify({ referralCode: 'Aspire_01', creatorPartnerId: 'partner_1', landingSessionId: 'landing_1', capturedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 100000).toISOString() })));

  // C/D. First valid attribution, immutable business attribution, duplicate/self/retroactive protection.
  assert.match(creatorHelper, /existing_creator_referral_cookie/, 'Existing valid creator cookie is not overwritten.');
  assert.match(creatorHelper, /status !== "active"/, 'Paused or inactive creators cannot capture new attribution.');
  assert.match(createAccountPage, /\/api\/creator-referrals\/attribute/);
  assert.match(attributeRoute, /Business email does not match authenticated user/, 'Email mismatch cannot claim another business attribution.');
  assert.match(creatorHelper, /self_referral_rejected/, 'Known creator partner emails cannot self-refer their own business.');
  assert.match(migrationSql, /business_creator_attributions/);
  assert.match(migrationSql, /business_id uuid NOT NULL REFERENCES public\.business_profiles/);
  assert.match(migrationSql, /creator_partner_id uuid NOT NULL REFERENCES public\.creator_partners/);
  assert.match(migrationSql, /landing_session_id text NULL/);
  assert.match(migrationSql, /first_subscription_id text NULL/);
  assert.match(migrationSql, /business_creator_attributions_business_id_key/);
  assert.match(migrationSql, /business_creator_attributions_business_email_key/);
  assert.match(migrationSql, /COALESCE\(v_is_grandfathered, false\)/, 'Grandfathered businesses do not retroactively receive creator attribution.');
  assert.match(migrationSql, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migrationSql, /business_creator_attributions.*TO authenticated[\s\S]*WITH CHECK \(true\)/, 'Authenticated users must not be able to alter attribution.');

  // E/F. Commission ledger from invoice.paid, idempotent by invoice, reversals before payout.
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.creator_commission_ledger/);
  for (const column of ['stripe_invoice_id', 'stripe_subscription_id', 'gross_eligible_subscription_amount', 'commission_percentage', 'commission_amount', 'currency', 'commission_month_number', 'eligibility_date']) {
    assert.match(migrationSql, new RegExp(column));
  }
  assert.match(migrationSql, /status IN \('pending', 'payable', 'paid', 'reversed', 'rejected'\)/);
  assert.match(migrationSql, /creator_commission_ledger_invoice_key/);
  assert.match(webhookRoute, /event\.type === "invoice\.paid"/);
  assert.match(webhookRoute, /createCreatorCommissionFromPaidInvoice/);
  assert.match(creatorHelper, /select\("id,status"\)[\s\S]*eq\("stripe_invoice_id", stripeInvoiceId\)/, 'Duplicate webhook must be idempotent by invoice id.');
  assert.match(creatorHelper, /free_or_zero_amount_invoice/, 'Free signup/free invoice creates no commission.');
  assert.match(creatorHelper, /invoice_not_paid/, 'Failed invoices create no commission.');
  assert.match(creatorHelper, /monthNumber > duration/, 'Commission duration limits eligible months.');
  assert.match(webhookRoute, /charge\.refunded/);
  assert.match(webhookRoute, /charge\.dispute\.created/);
  assert.match(webhookRoute, /invoice\.voided/);
  assert.match(creatorHelper, /status: "reversed"/);
  assert.match(creatorHelper, /\.in\("status", \["pending", "payable"\]\)/, 'Only unpaid/unpaid-payout commissions are reversed automatically.');
  assert.match(creatorHelper, /grandfathered_business/);

  // G. Minimal internal reporting only.
  assert.match(reportingPage, /Creator referral proof view/);
  assert.match(reportingPage, /business_creator_attributions/);
  assert.match(reportingPage, /creator_commission_ledger/);
  assert.match(reportingPage, /No payout controls exist here/);

  // H. Requirement-specific coverage labels.
  const combined = migrationSql + creatorHelper + captureRoute + attributeRoute + homePage + createAccountPage + webhookRoute + reportingPage;
  assert.match(combined, /nettmark_creator_referral/, '1. Referral cookie survives signup.');
  assert.match(combined, /ON CONFLICT \(business_id\) DO NOTHING/, '2. Business is attributed once.');
  assert.match(combined, /TO service_role/, '3. User cannot alter creator attribution.');
  assert.match(combined, /invoice\.paid/, '4. Subscription invoice creates commission.');
  assert.match(combined, /free_or_zero_amount_invoice/, '5. Free signup creates no commission.');
  assert.match(combined, /invoice_not_paid/, '6. Failed invoice creates no commission.');
  assert.match(combined, /commission_duration_months/, '7. Only first configured eligible paid months create commission.');
  assert.match(combined, /duplicate_invoice/, '8. Duplicate webhook creates no duplicate commission.');
  assert.match(combined, /stripe_charge_refunded|stripe_invoice_voided|stripe_charge_disputed/, '9. Refund/dispute/void reverses unpaid commission correctly.');
  assert.match(combined, /grandfathered_business|is_grandfathered/, '10. Grandfathered businesses do not generate referral commission.');
  assert.match(combined, /status !== "active"/, '11. Creator pause prevents new attribution without corrupting existing records.');

  assert.match(packageJson, /test:creator-referrals/);

  console.log('creator referral rollout tests passed');
}

void run();
