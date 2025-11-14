// Updated implementation with brand styling, skeletons, filtering, and a sleeker table
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/../utils/supabase/pages-client';
import { useRouter } from 'next/navigation';

// Types
type WPayout = {
  id: string;
  business_email: string;
  affiliate_email: string;
  offer_id: string | null;
  amount: number;
  stripe_transfer_id: string | null;
  status: 'pending' | 'paid' | 'failed' | string;
  created_at: string;
  available_at?: string | null;
  cycle_number?: number | null;
  is_recurring?: boolean | null;
};

type OfferRow = { id: string; title: string | null };

export default function BusinessPayoutsPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<WPayout[]>([]);
  const [offersById, setOffersById] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');

  // --- Helpers
  const currencyFmt = useMemo(
    () => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }),
    []
  );

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  // --- Load session & payouts
  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      const userEmail = user?.email ?? null;
      setEmail(userEmail);
      if (!userEmail) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('wallet_payouts')
        .select('*')
        .eq('business_email', userEmail)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[payouts.load] error', error);
        setLoading(false);
        return;
      }

      const rows = (data || []) as unknown as WPayout[];
      setPayouts(rows);

      const offerIds = Array.from(new Set(rows.map((r) => r.offer_id).filter(Boolean))) as string[];
      if (offerIds.length) {
        const { data: offers, error: offersErr } = await supabase
          .from('offers')
          .select('id,title')
          .in('id', offerIds);
        if (!offersErr && offers) {
          const map: Record<string, string> = {};
          (offers as OfferRow[]).forEach((o) => {
            if (o && o.id) map[o.id] = o.title || '—';
          });
          setOffersById(map);
        }
      }

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const pending = useMemo(() => {
    const now = new Date();
    return payouts.filter((p) => {
      if (p.status !== 'pending') return false;
      if (!p.available_at) return true;
      const available = new Date(p.available_at);
      return available <= now;
    });
  }, [payouts]);

  const history = useMemo(() => {
    const now = new Date();
    return payouts.filter((p) => {
      if (p.status !== 'pending') return true;
      if (!p.available_at) return false;
      const available = new Date(p.available_at);
      return available > now;
    });
  }, [payouts]);

  // Filter by query + status on whichever tab is active
  const filteredRows = useMemo(() => {
    const list = tab === 'pending' ? pending : history;
    const q = query.trim().toLowerCase();
    const byStatus = statusFilter === 'all' ? list : list.filter((r) => r.status === statusFilter);
    if (!q) return byStatus;
    return byStatus.filter((r) => {
      const offerTitle = r.offer_id ? (offersById[r.offer_id] || r.offer_id) : '';
      return (
        r.affiliate_email.toLowerCase().includes(q) || String(offerTitle).toLowerCase().includes(q)
      );
    });
  }, [tab, pending, history, query, statusFilter, offersById]);

  const pendingTotal = useMemo(
    () => pending.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [pending]
  );

  // --- Actions
  async function runSelectedPayouts() {
    setRunning(true);
    setBanner(null);
    try {
      for (const id of selectedIds) {
        const res = await fetch('/api/run-payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payout_id: id }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({} as any));
          console.error('[run-payout] failed', id, j);
          setBanner('Some payouts failed — check history for details.');
        }
      }
      const { data } = await supabase
        .from('wallet_payouts')
        .select('*')
        .eq('business_email', email!)
        .order('created_at', { ascending: false });
      setPayouts((data || []) as any);
      setSelected({});
      if (!banner) setBanner('Payouts processed.');
    } catch (e) {
      console.error(e);
      setBanner('Unexpected error while running payouts.');
    } finally {
      setRunning(false);
    }
  }

  function toggleAll(v: boolean) {
    const map: Record<string, boolean> = {};
    filteredRows.forEach((p) => (map[p.id] = v));
    setSelected(map);
  }

  // --- Render
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0b0b0b] to-[#0e0e0e] text-white px-5 py-6">
      <div className="mx-auto max-w-7xl p-6 text-gray-200">
      {/* Hero / Header */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-[#122027] bg-gradient-to-br from-[#0b1114] via-[#0a1216] to-[#0a0f12] p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_8px_30px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[#00C2CB]/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#00C2CB]/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#00C2CB]">Payouts</h1>
            <p className="mt-1 text-sm text-gray-400">
              Review pending affiliate payouts, settle with Stripe, and view your payment history.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-[#0e161a] px-4 py-2 text-sm text-gray-300 shadow-inner">
              Pending Total:{' '}
              <span className="font-semibold text-white">{currencyFmt.format(pendingTotal)}</span>
            </div>
            <button
              className="rounded-md bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black ring-1 ring-black/10 transition hover:brightness-95 disabled:opacity-40"
              disabled={running || selectedIds.length === 0}
              onClick={runSelectedPayouts}
            >
              {running ? 'Processing…' : `Settle ${selectedIds.length || ''}`}
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-[#0d1519] p-1 ring-1 ring-[#122027]">
            <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
              Pending ({pending.length})
            </TabButton>
            <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
              History ({history.length})
            </TabButton>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search affiliate or offer…"
              className="w-64 rounded-md border border-[#17232a] bg-[#0c1317] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:border-[#00C2CB]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-md border border-[#17232a] bg-[#0c1317] px-3 py-2 text-sm text-gray-200 outline-none focus:border-[#00C2CB]"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {banner && (
        <div className="mb-6 rounded-md border border-[#00C2CB]/40 bg-[#0b1114] px-4 py-3 text-sm text-gray-200">
          {banner}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#132027] bg-[#0b0f12] shadow-[0_0_0_1px_rgba(0,0,0,0.35)]">
        {loading ? (
          <SkeletonTable />
        ) : (
          <Table
            rows={filteredRows}
            offersById={offersById}
            currencyFmt={currencyFmt}
            selectable={tab === 'pending'}
            selected={selected}
            onToggle={(id, v) => setSelected((s) => ({ ...s, [id]: v }))}
            onToggleAll={toggleAll}
          />
        )}
      </div>
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm transition ${
        active ? 'bg-[#00C2CB] text-black' : 'bg-transparent text-gray-300 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonTable() {
  return (
    <div className="divide-y divide-[#121a20]">
      <div className="sticky top-0 z-10 grid grid-cols-7 bg-[#0f1418] px-4 py-3 text-left text-sm text-gray-300">
        <div></div>
        <div>Affiliate</div>
        <div>Offer</div>
        <div>Amount</div>
        <div>Status</div>
        <div>Created</div>
        <div>Stripe</div>
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="grid grid-cols-7 items-center px-4 py-4">
          {[...Array(7)].map((__, j) => (
            <div key={j} className="h-4 animate-pulse rounded bg-[#10161a]" />
          ))}
        </div>
      ))}
    </div>
  );
}

function Table({
  rows,
  offersById,
  currencyFmt,
  selectable = false,
  selected,
  onToggle,
  onToggleAll,
}: {
  rows: WPayout[];
  offersById: Record<string, string>;
  currencyFmt: Intl.NumberFormat;
  selectable?: boolean;
  selected?: Record<string, boolean>;
  onToggle?: (id: string, v: boolean) => void;
  onToggleAll?: (v: boolean) => void;
}) {
  const header = (
    <thead className="sticky top-0 z-10 border-b border-[#1f2a33] bg-[#0f1418] text-gray-300">
      <tr>
        <th className="px-4 py-3">
          {selectable && (
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#00C2CB]"
              onChange={(e) => onToggleAll && onToggleAll(e.currentTarget.checked)}
            />
          )}
        </th>
        <th className="px-4 py-3">Affiliate</th>
        <th className="px-4 py-3">Offer</th>
        <th className="px-4 py-3">Amount</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Created</th>
        <th className="px-4 py-3">Stripe</th>
      </tr>
    </thead>
  );

  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <div className="mx-auto mb-3 h-16 w-16 rounded-full border border-[#173039] bg-[#0f161a] p-4">
          <div className="h-full w-full rounded-full bg-[#00C2CB]/20" />
        </div>
        <p className="text-sm text-gray-400">No items.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        {header}
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[#121a20] transition hover:bg-[#0f1418]">
              <td className="px-4 py-3">
                {selectable && (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#00C2CB]"
                    checked={Boolean(selected?.[r.id])}
                    onChange={(e) => onToggle && onToggle(r.id, e.currentTarget.checked)}
                  />
                )}
              </td>
              <td className="px-4 py-3 text-gray-200">{r.affiliate_email}</td>
              <td className="px-4 py-3">{r.offer_id ? offersById[r.offer_id] || r.offer_id : '—'}</td>
              <td className="px-4 py-3 font-semibold text-white">{currencyFmt.format(Number(r.amount || 0))}</td>
              <td className="px-4 py-3">
                <StatusPill status={r.status} availableAt={r.available_at} />
              </td>
              <td className="px-4 py-3 text-gray-300">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-4 py-3 text-gray-400">
                {r.stripe_transfer_id ? (
                  <span title={r.stripe_transfer_id}>{r.stripe_transfer_id.slice(0, 10)}…</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status, availableAt }: { status: string; availableAt?: string | null }) {
  let label = status;
  let className: string;

  if (status === 'pending') {
    if (availableAt) {
      const now = new Date();
      const available = new Date(availableAt);
      if (available > now) {
        label = 'scheduled';
      }
    }
    className = 'bg-yellow-500/10 text-yellow-300';
  } else if (status === 'paid') {
    className = 'bg-emerald-500/10 text-emerald-300';
  } else {
    className = 'bg-rose-500/10 text-rose-300';
  }

  return <span className={`rounded-full px-2 py-1 text-xs capitalize ${className}`}>{label}</span>;
}