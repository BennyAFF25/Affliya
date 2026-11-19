import React from 'react';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { redirect } from 'next/navigation';
import { Card, EmptyState, StatCard, StatusBadge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { createServerSupabaseClient } from '../../../utils/businessSubscriptions';
import { getGrowthPartnerForUser } from '../../../utils/growthPartners/accounts';
import { allPartnerRows, commissionTotals, type LedgerSummaryRow } from '../../../utils/growthPartners/reporting';
import { growthReferralUrl } from '../../../utils/growthPartners/email';
import DashboardActions, { ReferralLink } from './DashboardActions';

export const dynamic = 'force-dynamic';
export default async function DashboardPage() {
  const { data: { user } } = await createServerComponentClient({ cookies }).auth.getUser();
  if (!user) redirect('/growth-partners/login');
  const db = createServerSupabaseClient();
  const partner = await getGrowthPartnerForUser(db, user.id);
  if (!partner) redirect('/growth-partners/login');
  const [referrals, ledger, profileResult] = await Promise.all([
    allPartnerRows(db, 'business_creator_attributions', partner.id),
    allPartnerRows(db, 'creator_commission_ledger', partner.id),
    db.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ]);
  if (profileResult.error) throw new Error('Profile unavailable');
  const totals = commissionTotals(ledger as LedgerSummaryRow[]);
  const amounts = (key: string) => {
    const entries = Object.entries(totals);
    return entries.length ? entries.map(([currency, total]) => (
      <div key={currency}>{new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(total[key] / 100)}</div>
    )) : '—';
  };
  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Welcome{partner.display_name ? `, ${partner.display_name}` : ''}</h1>
        <a className="gp-link" href="/growth-partners/logout">Sign out</a>
      </div>
      {partner.status !== 'active' && <div role="status" className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-200"><strong>Your referral link is suspended</strong><p>You can still review your referrals and commissions. Contact Nettmark for help.</p></div>}
      <Card className="rounded-3xl border-white/10 bg-[#151718] p-6 text-white">
        <h2>Share your referral link</h2>
        <p>Share it with new businesses. Registrations and subscription payments will appear here.</p>
        <ReferralLink referralUrl={partner.status === 'active' ? growthReferralUrl(partner) : null} />
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard className="bg-[#151718] text-white" label="Referrals" value={referrals.length} helper="Businesses registered" />
        <StatCard className="bg-[#151718] text-white" label="Pending" value={amounts('pending')} helper="Net of clawbacks" />
        <StatCard className="bg-[#151718] text-white" label="Approved (earned)" value={amounts('approved')} helper="Net of clawbacks" />
        <StatCard className="bg-[#151718] text-white" label="Paid" value={amounts('paid')} helper="Net of clawbacks" />
      </div>
      <p className="text-sm">Trials started: {referrals.filter(row => row.first_trial_started_at).length} · Paying businesses: {referrals.filter(row => row.first_paid_at).length}</p>
      <section className="gp-card">
        <h2>Commission activity</h2>
        {ledger.length ? <Table className="min-w-[650px]"><TableHeader><TableRow>{['Month', 'Date', 'Entry', 'Amount', 'Status'].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
          {[...ledger].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(row => <TableRow key={String(row.id)}>
            <TableCell>{String(row.commission_month_number ?? '—')}</TableCell>
            <TableCell>{row.created_at ? new Date(String(row.created_at)).toLocaleDateString('en-AU') : '—'}</TableCell>
            <TableCell className="capitalize">{String(row.entry_type)}</TableCell>
            <TableCell>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: String(row.currency) }).format(Number(row.commission_amount) / 100)}</TableCell>
            <TableCell><StatusBadge status={String(row.status)} /></TableCell>
          </TableRow>)}
        </TableBody></Table> : <EmptyState title="No commissions yet" description="Share your referral link to get started." />}
      </section>
      <section className="gp-card">
        <h2>Recent referrals</h2>
        {referrals.length ? <ul className="gp-list">{[...referrals].sort((a, b) => String(b.attributed_at).localeCompare(String(a.attributed_at))).slice(0, 20).map(row => <li key={String(row.id)} className="flex flex-wrap items-center justify-between gap-3">
          <div><strong>Business {String(row.id).slice(0, 6).toUpperCase()}</strong><p className="text-sm">Registered {new Date(String(row.attributed_at)).toLocaleDateString('en-AU')}</p></div>
          <StatusBadge status={row.first_paid_at ? 'active' : 'pending'} label={row.first_paid_at ? 'Paying' : row.first_trial_started_at ? 'Trial started' : 'Registered'} />
        </li>)}</ul> : <EmptyState title="No referrals yet" description="Share your referral link with business owners to get started." />}
      </section>
      <p className="text-sm">Earn 50% of eligible subscription revenue excluding GST for the first 3 paid months. Commissions have a 14-day hold and payouts are reviewed and approved by Nettmark.</p>
      <Card className="rounded-3xl border-white/10 bg-[#151718] p-6 text-white"><DashboardActions profileRole={profileResult.data?.role || null} /></Card>
    </main>
  );
}
