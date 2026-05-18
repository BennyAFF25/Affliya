// Updated implementation with brand styling, skeletons, filtering, and a sleeker table
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/../utils/supabase/pages-client";

// Types
type WPayout = {
  id: string;
  business_email: string;
  affiliate_email: string;
  offer_id: string | null;
  amount: number;
  gross_charge_amount?: number | null;
  nettmark_fee_amount?: number | null;
  stripe_fee_amount?: number | null;
  stripe_transfer_id: string | null;
  status: "pending" | "paid" | "completed" | "failed" | string;
  created_at: string;
  available_at?: string | null;
  cycle_number?: number | null;
  is_recurring?: boolean | null;
};

function isSettledStatus(status: string) {
  return status === "paid" || status === "completed";
}

function normalizePayoutStatus(status: string) {
  return isSettledStatus(status) ? "completed" : status;
}

function toMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

type OfferRow = { id: string; title: string | null };

type AdSpendSettlementSummary = {
  transferred: number;
  pending: number;
  blocked: number;
  failed: number;
};

export default function BusinessPayoutsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<WPayout[]>([]);
  const [offersById, setOffersById] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adSpendSummary, setAdSpendSummary] = useState<AdSpendSettlementSummary>({
    transferred: 0,
    pending: 0,
    blocked: 0,
    failed: 0,
  });
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "completed" | "failed"
  >("all");

  // --- Helpers
  const currencyFmt = useMemo(
    () =>
      new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }),
    [],
  );

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected],
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
        .from("wallet_payouts")
        .select("*")
        .eq("business_email", userEmail)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[payouts.load] error", error);
        setLoading(false);
        return;
      }

      const rows = (data || []) as unknown as WPayout[];
      setPayouts(rows);

      const { data: settlements, error: settlementsErr } = await supabase
        .from("ad_spend_settlements")
        .select("amount, status")
        .eq("business_email", userEmail);

      if (!settlementsErr && settlements) {
        const summary = (settlements as { amount: number | string | null; status: string | null }[]).reduce<AdSpendSettlementSummary>(
          (acc, row) => {
            const amount = Number(row.amount || 0) || 0;
            const status = String(row.status || "");

            if (status === "transfer_succeeded") acc.transferred += amount;
            else if (status === "transfer_blocked") acc.blocked += amount;
            else if (status === "transfer_failed") acc.failed += amount;
            else acc.pending += amount;

            return acc;
          },
          { transferred: 0, pending: 0, blocked: 0, failed: 0 },
        );

        setAdSpendSummary(summary);
      }

      const offerIds = Array.from(
        new Set(rows.map((r) => r.offer_id).filter(Boolean)),
      ) as string[];
      if (offerIds.length) {
        const { data: offers, error: offersErr } = await supabase
          .from("offers")
          .select("id,title")
          .in("id", offerIds);
        if (!offersErr && offers) {
          const map: Record<string, string> = {};
          (offers as OfferRow[]).forEach((o) => {
            if (o && o.id) map[o.id] = o.title || "—";
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
      if (p.status !== "pending") return false;
      if (!p.available_at) return true;
      const available = new Date(p.available_at);
      return available <= now;
    });
  }, [payouts]);

  const history = useMemo(() => {
    const now = new Date();
    return payouts.filter((p) => {
      if (p.status !== "pending") return true;
      if (!p.available_at) return false;
      const available = new Date(p.available_at);
      return available > now;
    });
  }, [payouts]);

  // Filter by query + status on whichever tab is active
  const filteredRows = useMemo(() => {
    const list = tab === "pending" ? pending : history;
    const q = query.trim().toLowerCase();
    const byStatus =
      statusFilter === "all"
        ? list
        : list.filter((r) => normalizePayoutStatus(r.status) === statusFilter);
    if (!q) return byStatus;
    return byStatus.filter((r) => {
      const offerTitle = r.offer_id ? offersById[r.offer_id] || r.offer_id : "";
      return (
        r.affiliate_email.toLowerCase().includes(q) ||
        String(offerTitle).toLowerCase().includes(q)
      );
    });
  }, [tab, pending, history, query, statusFilter, offersById]);

  const pendingTotal = useMemo(
    () => pending.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [pending],
  );

  // --- Actions
  async function runSelectedPayouts() {
    setRunning(true);
    setBanner(null);
    try {
      for (const id of selectedIds) {
        const res = await fetch("/api/run-payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payout_id: id }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({} as Record<string, unknown>));
          console.error("[run-payout] failed", id, j);
          setBanner("Some payouts failed — check history for details.");
        }
      }
      const { data } = await supabase
        .from("wallet_payouts")
        .select("*")
        .eq("business_email", email!)
        .order("created_at", { ascending: false });
      setPayouts((data || []) as WPayout[]);
      setSelected({});
      if (!banner) setBanner("Payouts processed.");
    } catch (e) {
      console.error(e);
      setBanner("Unexpected error while running payouts.");
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
    <div className="min-h-screen w-full bg-[var(--background)] px-5 py-6 text-[var(--foreground)]">
      <div className="mx-auto max-w-7xl p-6 text-[var(--foreground)]">
        {/* Hero / Header */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_8px_30px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--primary)]">
                Payouts
              </h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Review pending affiliate payouts, settle with Stripe, and view
                your payment history.
              </p>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Businesses are charged payout principal plus the Nettmark payout fee. The affiliate still receives principal only.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-[var(--secondary)] px-4 py-2 text-sm text-[var(--muted-foreground)] shadow-inner">
                Pending Total:{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {currencyFmt.format(pendingTotal)}
                </span>
              </div>
              <button
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] ring-1 ring-black/10 transition hover:brightness-95 disabled:opacity-40"
                disabled={running || selectedIds.length === 0}
                onClick={runSelectedPayouts}
              >
                {running ? "Processing…" : `Settle ${selectedIds.length || ""}`}
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SettlementCard label="Ad spend transferred" value={currencyFmt.format(adSpendSummary.transferred)} tone="good" />
            <SettlementCard label="Pending ad spend transfer" value={currencyFmt.format(adSpendSummary.pending)} tone="neutral" />
            <SettlementCard label="Blocked transfer" value={currencyFmt.format(adSpendSummary.blocked)} tone="warn" />
            <SettlementCard label="Failed transfer attempts" value={currencyFmt.format(adSpendSummary.failed)} tone="danger" />
          </div>

          {/* Toolbar */}
          <div className="relative z-10 mt-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3 text-xs text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">Fee disclosure:</span>{" "}
            payout principal = affiliate amount, Nettmark fee = platform fee charged on top, and Stripe fee is shown separately when available.
          </div>

          <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg bg-[var(--secondary)] p-1 ring-1 ring-[var(--border)]">
              <TabButton
                active={tab === "pending"}
                onClick={() => setTab("pending")}
              >
                Pending ({pending.length})
              </TabButton>
              <TabButton
                active={tab === "history"}
                onClick={() => setTab("history")}
              >
                History ({history.length})
              </TabButton>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search affiliate or offer…"
                className="w-64 rounded-md border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--ring)]"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "completed" | "failed")}
                className="rounded-md border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)]"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {banner && (
          <div className="mb-6 rounded-md border border-[var(--primary)]/40 bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)]">
            {banner}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_0_0_1px_rgba(0,0,0,0.35)]">
          {loading ? (
            <SkeletonTable />
          ) : (
            <Table
              rows={filteredRows}
              offersById={offersById}
              currencyFmt={currencyFmt}
              selectable={tab === "pending"}
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

function SettlementCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "good" | "warn" | "danger";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : tone === "warn"
        ? "border-amber-500/20 bg-amber-500/10"
        : tone === "danger"
          ? "border-rose-500/20 bg-rose-500/10"
          : "border-[var(--border)] bg-[var(--secondary)]/60";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm transition ${
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonTable() {
  return (
    <div className="divide-y divide-[var(--border)]">
      <div className="sticky top-0 z-10 grid grid-cols-7 bg-[var(--secondary)] px-4 py-3 text-left text-sm text-[var(--muted-foreground)]">
        <div></div>
        <div>Affiliate</div>
        <div>Offer</div>
        <div>Payout / charge</div>
        <div>Status</div>
        <div>Created</div>
        <div>Stripe</div>
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="grid grid-cols-7 items-center px-4 py-4">
          {[...Array(7)].map((__, j) => (
            <div
              key={j}
              className="h-4 animate-pulse rounded bg-[var(--secondary)]"
            />
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
    <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]">
      <tr>
        <th className="px-4 py-3">
          {selectable && (
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--primary)]"
              onChange={(e) =>
                onToggleAll && onToggleAll(e.currentTarget.checked)
              }
            />
          )}
        </th>
        <th className="px-4 py-3">Affiliate</th>
        <th className="px-4 py-3">Offer</th>
        <th className="px-4 py-3">Payout / charge</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Created</th>
        <th className="px-4 py-3">Stripe</th>
      </tr>
    </thead>
  );

  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <div className="mx-auto mb-3 h-16 w-16 rounded-full border border-[var(--border)] bg-[var(--secondary)] p-4">
          <div className="h-full w-full rounded-full bg-[var(--primary)]/20" />
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">No items.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        {header}
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-[var(--border)] transition hover:bg-[var(--secondary)]"
            >
              <td className="px-4 py-3">
                {selectable && (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={Boolean(selected?.[r.id])}
                    onChange={(e) =>
                      onToggle && onToggle(r.id, e.currentTarget.checked)
                    }
                  />
                )}
              </td>
              <td className="px-4 py-3 text-[var(--foreground)]">
                {r.affiliate_email}
              </td>
              <td className="px-4 py-3">
                {r.offer_id ? offersById[r.offer_id] || r.offer_id : "—"}
              </td>
              <td className="px-4 py-3 text-[var(--foreground)]">
                <div className="font-semibold">
                  {currencyFmt.format(Number(r.amount || 0))}
                </div>
                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Principal to affiliate
                </div>
                {toMoney(r.nettmark_fee_amount) > 0 || toMoney(r.gross_charge_amount) > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                    {toMoney(r.nettmark_fee_amount) > 0 ? (
                      <div>Nettmark fee: {currencyFmt.format(toMoney(r.nettmark_fee_amount))}</div>
                    ) : null}
                    {toMoney(r.gross_charge_amount) > 0 ? (
                      <div className="text-[var(--foreground)]/85">
                        Business charged: {currencyFmt.format(toMoney(r.gross_charge_amount))}
                      </div>
                    ) : null}
                    {toMoney(r.stripe_fee_amount) > 0 ? (
                      <div>Stripe fee: {currencyFmt.format(toMoney(r.stripe_fee_amount))}</div>
                    ) : null}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={r.status} availableAt={r.available_at} />
              </td>
              <td className="px-4 py-3 text-[var(--muted-foreground)]">
                {new Date(r.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-[var(--muted-foreground)]">
                {r.stripe_transfer_id ? (
                  <span title={r.stripe_transfer_id}>
                    {r.stripe_transfer_id.slice(0, 10)}…
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({
  status,
  availableAt,
}: {
  status: string;
  availableAt?: string | null;
}) {
  let label = status;
  let className: string;

  if (status === "pending") {
    if (availableAt) {
      const now = new Date();
      const available = new Date(availableAt);
      if (available > now) {
        label = "scheduled";
      }
    }
    className = "bg-yellow-500/10 text-yellow-300";
  } else if (isSettledStatus(status)) {
    label = "completed";
    className = "bg-emerald-500/10 text-emerald-300";
  } else {
    className = "bg-rose-500/10 text-rose-300";
  }

  return (
    <span className={`rounded-full px-2 py-1 text-xs capitalize ${className}`}>
      {label}
    </span>
  );
}
