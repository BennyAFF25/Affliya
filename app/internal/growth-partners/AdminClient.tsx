'use client';
import React, { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Label, StatCard, StatusBadge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui';

type Row = { id: string; [key: string]: unknown };
type Report = { rows?: Row[]; count?: number; partner?: Row; referrals?: Row[]; ledger?: Row[]; events?: Row[]; payouts?: Row[]; flags?: string[]; totals?: unknown };
const text = (value: unknown) => value == null ? '—' : String(value);
const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('en-AU') : '—';
const money = (amount: unknown, currency: unknown) => `${text(currency).toUpperCase()} ${(Number(amount || 0) / 100).toFixed(2)}`;
const card = 'rounded-3xl border-white/10 bg-[#151718] p-5 text-white';
function Totals({ value }: { value: unknown }) {
  return <>{Object.entries((value || {}) as Record<string, Record<string, number>>).map(([currency, total]) => (
    <p key={currency} className="text-sm">{currency.toUpperCase()} · Pending {money(total.pending, currency)} · Approved {money(total.approved, currency)} · Paid {money(total.paid, currency)} · Outstanding clawbacks {money(total.clawback, currency)}</p>
  ))}</>;
}
function Headings({ labels }: { labels: string[] }) {
  return <TableHeader><TableRow>{labels.map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>;
}
export default function AdminClient() {
  const [tab, setTab] = useState('applications');
  const [page, setPage] = useState(0);
  const [partner, setPartner] = useState('');
  const [data, setData] = useState<Report>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setSelected([]);
    fetch(`/api/internal/growth-partners?tab=${tab}&page=${page}${partner ? `&partner=${encodeURIComponent(partner)}` : ''}`, { cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); if (active) setData(result); })
      .catch(cause => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, page, partner, version]);
  async function action(action: string, id: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/internal/growth-partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setVersion(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed'); }
    finally { setBusy(false); }
  }
  const ledger = data.ledger || data.rows || [];
  const eligible = (row: Row) => row.entry_type === 'commission' && row.status === 'pending' && !!row.approvable_at && Date.parse(String(row.approvable_at)) <= Date.now();
  const selectable = (row: Row) => partner ? (row.status === 'approved' && row.entry_type === 'commission' || row.status === 'pending' && row.entry_type === 'clawback') : eligible(row);
  const ledgerTable = (
    <Table className="min-w-[1100px]">
      <Headings labels={['Select', 'Invoice / entry', 'Partner / business', 'Period', 'Status / hold', 'Eligible base', 'Commission', 'Refunded', 'Action']} />
      <TableBody>{ledger.map(row => <TableRow key={row.id}>
        <TableCell><input aria-label={`Select ledger ${row.id}`} type="checkbox" disabled={!selectable(row) || busy} checked={selected.includes(row.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} /></TableCell>
        <TableCell>{text(row.stripe_invoice_id)}<br />{text(row.entry_type)}</TableCell>
        <TableCell><button className="gp-link" onClick={() => setPartner(String(row.creator_partner_id))}>{text((row.creator_partners as { display_name?: string })?.display_name || row.creator_partner_id)}</button><br />{text(row.business_id)}</TableCell>
        <TableCell>{text(row.commission_month_number)}</TableCell>
        <TableCell><StatusBadge status={text(row.status)} /><br />{row.approvable_at ? `Approvable from ${date(row.approvable_at)}` : '—'}</TableCell>
        <TableCell>{money(row.gross_eligible_subscription_amount, row.currency)}</TableCell>
        <TableCell>{money(row.commission_amount, row.currency)}</TableCell>
        <TableCell>{money(row.refunded_amount, row.currency)}</TableCell>
        <TableCell>{row.status === 'pending' && row.entry_type === 'commission' && <div className="flex gap-2"><Button size="sm" disabled={busy || !eligible(row)} onClick={() => action('approve_commission', row.id)}>Approve</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => { const reason = prompt('Rejection reason'); if (reason !== null) void action('reject_commission', row.id, { reason }); }}>Reject</Button></div>}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
  );
  return <div>
    <nav className="mb-6 inline-flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-[#151718] p-1" aria-label="Growth Partner administration">
      {['applications', 'partners', 'commissions'].map(item => <button key={item} disabled={busy} aria-current={tab === item && !partner ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm capitalize ${tab === item && !partner ? 'bg-[#00C2CB] text-black' : 'text-slate-300 hover:bg-white/10'}`} onClick={() => { setTab(item); setPage(0); setPartner(''); }}>{item}{tab === item && !partner && data.count != null ? ` (${data.count})` : ''}</button>)}
    </nav>
    {error && <p className="gp-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading…</p> : partner && data.partner ? <div className="space-y-6">
      <Card className={card}>
        <button className="gp-link mb-4" onClick={() => setPartner('')}>← Back to list</button>
        <h2>{text(data.partner.display_name)} <StatusBadge status={text(data.partner.status)} /></h2>
        <p>{text(data.partner.referral_code)} · {text(data.partner.partner_email)}</p><p className="break-all">{text(data.partner.referral_url)}</p>
        {Boolean(data.flags?.length) && <ul className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200">{data.flags?.map(flag => <li key={flag}>⚑ {flag}</li>)}</ul>}
        <div className="mt-4 flex gap-3"><Button variant="secondary" disabled={busy || data.partner.status !== 'active'} onClick={() => { const reason = prompt('Suspension reason'); if (reason?.trim()) void action('suspend', partner, { reason }); }}>Suspend</Button><Button variant="secondary" disabled={busy || data.partner.status !== 'suspended'} onClick={() => action('reactivate', partner)}>Reactivate</Button></div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Referrals" value={data.referrals?.length || 0} /><StatCard label="Ledger entries" value={data.ledger?.length || 0} /><StatCard label="Payouts" value={data.payouts?.length || 0} /></div>
      <Card className={card}><h2>Business referrals</h2><Table className="min-w-[950px]"><Headings labels={['Business', 'Attributed', 'Customer', 'Subscription', 'Trial', 'First paid', 'Cancelled']} /><TableBody>{data.referrals?.map(row => <TableRow key={row.id}>{[row.business_name, date(row.attributed_at), row.stripe_customer_id, row.first_subscription_id, date(row.first_trial_started_at), date(row.first_paid_at), date(row.cancelled_at)].map((value, index) => <TableCell key={index}>{text(value)}</TableCell>)}</TableRow>)}</TableBody></Table></Card>
      <Card className={card}><h2>Commission ledger</h2><Totals value={data.totals} />{ledgerTable}
        <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); void action('record_payout', partner, { ...fields, ledger_ids: selected }); }}>
          <div><h3>Record a completed manual payout</h3><p>This records an external payment. Nettmark will not transfer money. Select approved commissions and pending clawbacks for one currency.</p></div>
          <div className="grid gap-4 sm:grid-cols-3"><Field><Label htmlFor="method">Method</Label><Input id="method" name="method" defaultValue="manual_bank_transfer" required maxLength={100} /></Field><Field><Label htmlFor="reference">Payment reference</Label><Input id="reference" name="reference" required maxLength={500} /></Field><Field><Label htmlFor="notes">Notes</Label><Input id="notes" name="notes" maxLength={2000} /></Field></div>
          <Button disabled={busy || !selected.length}>Record payout ({selected.length} rows)</Button>
        </form>
      </Card>
      <Card className={card}><h2>Recorded payouts</h2><Table className="min-w-[500px]"><Headings labels={['Amount', 'Reference', 'Paid']} /><TableBody>{data.payouts?.map(row => <TableRow key={row.id}><TableCell>{money(row.total_amount, row.currency)}</TableCell><TableCell>{text(row.reference)}</TableCell><TableCell>{date(row.paid_at)}</TableCell></TableRow>)}</TableBody></Table></Card>
      <Card className={card}><h2>Audit history</h2><Table className="min-w-[650px]"><Headings labels={['Event', 'Date', 'Details']} /><TableBody>{data.events?.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(row => <TableRow key={row.id}><TableCell>{text(row.event_type)}</TableCell><TableCell>{date(row.created_at)}</TableCell><TableCell className="break-all">{JSON.stringify(row.metadata)} · {text(row.source_key)}</TableCell></TableRow>)}</TableBody></Table></Card>
    </div> : <>
      {tab === 'applications' && <Table className="min-w-[1000px]"><Headings labels={['Applicant', 'Category / audience', 'Profile', 'Applied / lead', 'Status', 'Actions']} /><TableBody>{data.rows?.map(row => <TableRow key={row.id}><TableCell><strong>{text(row.full_name)}</strong><br />{text(row.email)}</TableCell><TableCell>{text(row.category)}<br />{text(row.audience_estimate)}</TableCell><TableCell><a className="gp-link break-all" href={text(row.profile_url)} target="_blank" rel="noopener noreferrer">{text(row.profile_url)}</a></TableCell><TableCell>{date(row.created_at)}<br />{text(row.meta_capi_status)}</TableCell><TableCell><StatusBadge status={text(row.status)} />{row.rejection_reason ? <p>{text(row.rejection_reason)}</p> : null}</TableCell><TableCell>{row.status === 'pending' && <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => action('approve_application', row.id)}>Approve</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => { const reason = prompt('Rejection reason (optional)'); if (reason !== null) void action('reject_application', row.id, { reason }); }}>Reject</Button></div>}</TableCell></TableRow>)}</TableBody></Table>}
      {tab === 'partners' && <Table className="min-w-[1000px]"><Headings labels={['Partner', 'Code', 'Clicks', 'Registrations', 'Trials', 'Paying', 'Totals / flags']} /><TableBody>{data.rows?.map(row => <TableRow key={row.id}><TableCell><button className="gp-link" onClick={() => setPartner(row.id)}>{text(row.display_name)}</button><br /><StatusBadge status={text(row.status)} /></TableCell><TableCell>{text(row.referral_code)}</TableCell><TableCell>{text(row.clicks)}</TableCell><TableCell>{text(row.registrations)}</TableCell><TableCell>{text(row.trials)}</TableCell><TableCell>{text(row.paying)}</TableCell><TableCell><Totals value={row.totals} />{(row.flags as string[] || []).map(flag => <p key={flag}>⚑ {flag}</p>)}</TableCell></TableRow>)}</TableBody></Table>}
      {tab === 'commissions' && <Card className={card}><h2>Review commissions</h2>{ledgerTable}<div className="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#151718] p-4 shadow-xl"><span>{selected.length} selected</span><Button disabled={busy || !selected.length} onClick={async () => { for (const id of selected) await action('approve_commission', id); }}>Approve selected ({selected.length})</Button></div></Card>}
      {!data.rows?.length && <p className="mt-4">No records yet.</p>}
      <div className="mt-6 flex items-center gap-6"><button className="gp-link" disabled={page === 0 || busy} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} · {data.count || 0} records</span><button className="gp-link" disabled={busy || (page + 1) * (tab === 'partners' ? 25 : tab === 'commissions' ? 100 : 50) >= (data.count || 0)} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </>}
  </div>;
}
