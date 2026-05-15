"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type HarnessRow = Record<string, unknown>;

type HarnessState = {
  harness?: {
    enabled?: boolean;
    businessEmail?: string;
    affiliateEmail?: string;
    source?: string;
  };
  offer?: { id?: string; title?: string; commission?: number; price?: number; type?: string };
  walletSnapshot?: {
    totalTopupsCredited?: number;
    totalTopupsNetAvailable?: number;
    totalTopupRefunded?: number;
    totalDeductions?: number;
    totalRefundLedger?: number;
    availableBalance?: number;
  };
  refundLock?: {
    locked?: boolean;
    reasonCode?: string | null;
    message?: string | null;
    totalUnpaidSpend?: number;
    activeAdCount?: number;
  };
  walletRow?: {
    balance?: number;
    last_transaction_id?: string | null;
    last_transaction_status?: string | null;
  } | null;
  topups?: HarnessRow[];
  payouts?: HarnessRow[];
  deductions?: HarnessRow[];
  liveAds?: HarnessRow[];
  audit?: HarnessRow[];
  approvals?: HarnessRow[];
};

export default function MoneyFlowHarnessPage() {
  const [state, setState] = useState<HarnessState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const [topupAmount, setTopupAmount] = useState("25");
  const [spendAmount, setSpendAmount] = useState("5");
  const [conversionAmount, setConversionAmount] = useState("100");
  const [refundAmount, setRefundAmount] = useState("5");
  const [selectedLiveAdId, setSelectedLiveAdId] = useState("");
  const [selectedPayoutId, setSelectedPayoutId] = useState("");

  const liveAds = state?.liveAds || [];
  const payouts = state?.payouts || [];
  const topups = state?.topups || [];

  async function call(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/internal/money-flow-harness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || json?.result?.json?.error || `Request failed (${res.status})`);
      }
      setResult(json);
      if (json.state) setState(json.state);
      return json;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    call("state").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedLiveAdId && liveAds[0]?.id) setSelectedLiveAdId(liveAds[0].id);
  }, [liveAds, selectedLiveAdId]);

  useEffect(() => {
    const pending = payouts.find((row) => row.status === "pending");
    if (!selectedPayoutId && pending?.id) setSelectedPayoutId(pending.id);
  }, [payouts, selectedPayoutId]);

  const headline = useMemo(() => {
    const available = state?.walletSnapshot?.availableBalance ?? 0;
    const deductions = state?.walletSnapshot?.totalDeductions ?? 0;
    const cached = state?.walletRow?.balance ?? 0;
    return { available, deductions, cached };
  }, [state]);

  return (
    <div className="min-h-screen bg-[var(--background)] px-5 py-6 text-[var(--foreground)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--primary)]">Money Flow Harness</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
                Internal test harness for the canonical pair <strong>biz@testuser.com</strong> and <strong>affiliate@testuser.com</strong>.
                It uses Stripe test mode and the real backend routes so you can test top-up, spend, settlement, conversion, payout, and refund without Meta or live money.
              </p>
            </div>
            <button
              onClick={() => call("state")}
              disabled={!!busy}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {busy === "state" ? "Refreshing…" : "Refresh state"}
            </button>
          </div>
          {error ? <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Canonical available" value={`$${headline.available.toFixed(2)}`} />
          <StatCard label="Total deductions" value={`$${headline.deductions.toFixed(2)}`} />
          <StatCard label="Cached wallet row" value={`$${headline.cached.toFixed(2)}`} />
          <StatCard
            label="Refund lock"
            value={state?.refundLock?.locked ? String(state?.refundLock?.reasonCode || "locked") : "unlocked"}
            sub={state?.refundLock?.message || undefined}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="1) Wallet top-up / refund">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="text-sm">
                <span className="mb-1 block text-[var(--muted-foreground)]">Top-up amount (AUD)</span>
                <input value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
              </label>
              <button onClick={() => call("simulate_topup", { amount: Number(topupAmount) })} disabled={!!busy} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
                {busy === "simulate_topup" ? "Running…" : "Simulate top-up"}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end mt-4">
              <label className="text-sm">
                <span className="mb-1 block text-[var(--muted-foreground)]">Refund amount (AUD)</span>
                <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
              </label>
              <button onClick={() => call("run_refund", { amount: Number(refundAmount) })} disabled={!!busy} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy === "run_refund" ? "Running…" : "Run refund"}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">Top-up uses a real Stripe test-mode PaymentIntent internally, then credits the wallet through the canonical RPC. Refund uses the real refund route.</p>
          </Panel>

          <Panel title="2) Offer approval / ad spend">
            <div className="flex flex-wrap gap-3">
              <button onClick={() => call("ensure_affiliate_approval")} disabled={!!busy} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy === "ensure_affiliate_approval" ? "Running…" : "Ensure affiliate approved"}
              </button>
              <button onClick={() => call("create_live_ad", { spend: 0 })} disabled={!!busy} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy === "create_live_ad" ? "Running…" : "Create live ad"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-sm sm:col-span-1">
                <span className="mb-1 block text-[var(--muted-foreground)]">Selected live ad</span>
                <select value={selectedLiveAdId} onChange={(e) => setSelectedLiveAdId(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2">
                  <option value="">Choose live ad…</option>
                  {liveAds.map((ad) => (
                    <option key={ad.id} value={ad.id}>{ad.id} — spend {ad.spend} / transferred {ad.spend_transferred}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-[var(--muted-foreground)]">Spend to add (AUD)</span>
                <input value={spendAmount} onChange={(e) => setSpendAmount(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
              </label>
              <button onClick={() => call("add_live_ad_spend", { liveAdId: selectedLiveAdId, amount: Number(spendAmount) })} disabled={!!busy || !selectedLiveAdId} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy === "add_live_ad_spend" ? "Running…" : "Add spend"}
              </button>
            </div>
            <button onClick={() => call("settle_ad_spend", { liveAdId: selectedLiveAdId })} disabled={!!busy || !selectedLiveAdId} className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
              {busy === "settle_ad_spend" ? "Running…" : "Settle ad spend"}
            </button>
          </Panel>

          <Panel title="3) Conversion → payout">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="text-sm">
                <span className="mb-1 block text-[var(--muted-foreground)]">Conversion amount (AUD)</span>
                <input value={conversionAmount} onChange={(e) => setConversionAmount(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
              </label>
              <button onClick={() => call("trigger_conversion", { liveAdId: selectedLiveAdId, amount: Number(conversionAmount) })} disabled={!!busy || !selectedLiveAdId} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
                {busy === "trigger_conversion" ? "Running…" : "Trigger conversion"}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">This inserts a real conversion event for the selected live ad, ensures the affiliate request is approved, and runs the canonical process-conversion route.</p>
          </Panel>

          <Panel title="4) Payout execution">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="text-sm">
                <span className="mb-1 block text-[var(--muted-foreground)]">Selected payout</span>
                <select value={selectedPayoutId} onChange={(e) => setSelectedPayoutId(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2">
                  <option value="">Choose payout…</option>
                  {payouts.map((payout) => (
                    <option key={payout.id} value={payout.id}>{payout.id} — {payout.status} — ${payout.amount}</option>
                  ))}
                </select>
              </label>
              <button onClick={() => call("run_payout", { payoutId: selectedPayoutId })} disabled={!!busy || !selectedPayoutId} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy === "run_payout" ? "Running…" : "Run payout"}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">This uses the real payout route. In Stripe test mode it may still fail on outbound transfer if the platform test balance has no available funds.</p>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Latest state">
            <JsonBlock value={{
              harness: state?.harness,
              offer: state?.offer,
              walletSnapshot: state?.walletSnapshot,
              walletRow: state?.walletRow,
              refundLock: state?.refundLock,
              latestTopup: topups[0] || null,
              latestPayout: payouts[0] || null,
              latestDeduction: state?.deductions?.[0] || null,
              latestLiveAd: liveAds[0] || null,
            }} />
          </Panel>
          <Panel title="Last action result">
            <JsonBlock value={result} />
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Top-ups"><JsonBlock value={topups} /></Panel>
          <Panel title="Payouts"><JsonBlock value={payouts} /></Panel>
          <Panel title="Live ads / audit"><JsonBlock value={{ liveAds: state?.liveAds, audit: state?.audit }} /></Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      {sub ? <div className="mt-2 text-xs text-[var(--muted-foreground)]">{sub}</div> : null}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[28rem] overflow-auto rounded-xl border border-[var(--border)] bg-black/20 p-3 text-xs leading-5 text-[var(--foreground)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
