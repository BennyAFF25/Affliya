import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../../utils/businessSubscriptions';
import { getGrowthPartnerForUser } from '../../../utils/growthPartners/accounts';
import { allPartnerRows, commissionTotals, type LedgerSummaryRow } from '../../../utils/growthPartners/reporting';
import DashboardActions from './DashboardActions';
export const dynamic = 'force-dynamic';
export default async function DashboardPage() {
  const { data:{user} } = await createServerComponentClient({ cookies }).auth.getUser();
  if (!user) redirect('/growth-partners/login');
  const db = createServerSupabaseClient();
  const partner = await getGrowthPartnerForUser(db,user.id);
  if (!partner) redirect('/growth-partners/login');
  const [referrals,ledger,profileResult] = await Promise.all([allPartnerRows(db,'business_creator_attributions',partner.id),allPartnerRows(db,'creator_commission_ledger',partner.id),db.from('profiles').select('role').eq('id',user.id).maybeSingle()]);
  if (profileResult.error) throw new Error('Profile unavailable');
  const totals=commissionTotals(ledger as LedgerSummaryRow[]);
  return <main><div className="mb-6 flex items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Your Growth Partner dashboard</h1><a className="gp-link" href="/logout">Sign out</a></div>
    {partner.status !== 'active' && <section className="gp-card" role="status"><h2>Your referral link is suspended</h2><p>You can still review your referrals and commissions. Contact Nettmark for help.</p></section>}
    <section className="gp-card"><h2>Start with your referral link</h2><p>Share it with new businesses. Registrations and subscription payments will appear here.</p><DashboardActions referralUrl={partner.status==='active' ? partner.referral_url : null} profileRole={profileResult.data?.role || null} /></section>
    <section className="gp-grid gp-section">{[['Businesses registered',referrals.length],['Trials started',referrals.filter(row=>row.first_trial_started_at).length],['Paying businesses',referrals.filter(row=>row.first_paid_at).length]].map(([label,count])=><div className="gp-metric" key={label}><strong>{count}</strong><span>{label}</span></div>)}</section>
    <section className="gp-card"><h2>Your commissions</h2><p className="mb-4">Pending payments have a 14-day hold and require review. Earned commissions are approved; payouts are recorded manually.</p>{!Object.keys(totals).length && <p>No commissions yet.</p>}{Object.entries(totals).map(([currency,total])=><div key={currency} className="mb-4"><h3>{currency.toUpperCase()}</h3><div className="gp-grid">{[['pending','Pending'],['approved','Earned (approved)'],['paid','Paid']].map(([key,label])=><div key={key} className="gp-metric"><strong>{new Intl.NumberFormat('en-AU',{style:'currency',currency}).format(total[key]/100)}</strong><span>{label} · net of clawbacks</span></div>)}</div></div>)}</section>
    <section className="gp-card"><h2>Recent referrals</h2><ul className="gp-list">{referrals.sort((a,b)=>String(b.attributed_at).localeCompare(String(a.attributed_at))).slice(0,20).map(row=><li key={String(row.id)}><strong>Business {String(row.id).slice(0,6).toUpperCase()}</strong><p className="text-sm">Registered {new Date(String(row.attributed_at)).toLocaleDateString('en-AU')} · {row.first_paid_at ? 'Paying' : row.first_trial_started_at ? 'Trial started' : 'Registered'}</p></li>)}</ul>{!referrals.length && <p>Your first referred business will appear here.</p>}</section>
  </main>;
}
