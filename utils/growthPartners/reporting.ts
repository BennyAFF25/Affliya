import type { SupabaseClient } from '@supabase/supabase-js';
export type LedgerSummaryRow = { status: string; entry_type: string; commission_amount: number; currency: string };
export function commissionTotals(rows: LedgerSummaryRow[]) {
  const totals: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const currency = totals[row.currency] ||= { pending:0, approved:0, paid:0, clawback:0 };
    if (['pending','approved','paid'].includes(row.status)) currency[row.status] += row.commission_amount;
    if (row.entry_type === 'clawback' && row.status === 'pending') currency.clawback += row.commission_amount;
  }
  return totals;
}
// Supabase's default 1000-row cap must not silently understate financial totals.
export async function allPartnerRows(db: SupabaseClient, table: 'creator_commission_ledger' | 'business_creator_attributions' | 'creator_referral_events', partnerId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset=0; ; offset+=1000) {
    const { data,error } = await db.from(table).select('*').eq('creator_partner_id',partnerId).order('id').range(offset,offset+999);
    if (error) throw new Error('Partner report unavailable');
    rows.push(...data || []);
    if (!data || data.length<1000) break;
  }
  return rows;
}
export function suspiciousFlags(partnerEmail: string, referrals: Record<string, unknown>[], events: Record<string, unknown>[]) {
  const flags: string[] = [];
  const domain = partnerEmail.toLowerCase().split('@')[1];
  const free = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|aol|protonmail|proton)\./;
  if (domain && !free.test(domain) && referrals.some(row => String(row.business_email).toLowerCase().split('@')[1] === domain)) flags.push('Business and partner share a non-free-mail domain');
  const rejections = events.filter(row => row.event_type === 'attribution_rejected');
  if (rejections.length) flags.push(`${rejections.length} attribution rejection(s); inspect event reasons`);
  const clickIps = new Map<string,number>();
  for (const row of events) {
    const metadata = row.metadata as { ip_hash?: string } | null;
    if (row.event_type === 'click' && metadata?.ip_hash) clickIps.set(metadata.ip_hash,(clickIps.get(metadata.ip_hash) || 0)+1);
  }
  if ([...clickIps.values()].some(count => count>=10)) flags.push('Repeated clicks from the same hashed IP; investigate');
  if (events.filter(row => row.event_type === 'click').length>=100 && !referrals.length) flags.push('High clicks with no registrations');
  if (referrals.some(row => !row.first_trial_started_at)) flags.push('Registration(s) without a trial');
  return flags;
}
