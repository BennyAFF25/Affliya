'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '@/../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';
import { useUserSettings } from '@/../utils/hooks/useUserSettings';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  AUD: 'A$',
};

export default function AffiliateWalletPage() {
  const session = useSession();
  const user = session?.user;
  const { settings, isLoading: settingsLoading } = useUserSettings();

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [totalNetAmount, setTotalNetAmount] = useState(0);
  const [wallet, setWallet] = useState<any>(null);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [walletDeductions, setWalletDeductions] = useState<any[]>([]);
  // New state for refundable topups and selected topup
  const [refundableTopups, setRefundableTopups] = useState<any[]>([]);
  const [selectedTopupId, setSelectedTopupId] = useState<string | null>(null);

  // Fetch live wallet balance (wallets table)
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!user?.email) return;
      const { data, error, status } = await supabase
        .from('wallets')
        .select('*')
        .eq('email', user.email)
        .limit(1)
        .single();

      if (error && status !== 406) {
        console.error('[❌ Wallet Balance Fetch Error]', error.message);
        return;
      }

      setWallet(data || null);
    };
    fetchWalletBalance();
  }, [user]);

  // Fetch refund history
  useEffect(() => {
    const fetchRefunds = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from('wallet_refunds')
        .select('amount, status, stripe_refund_id, created_at')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[❌ Refunds Fetch Error]', error.message);
        return;
      }
      setRefunds(data || []);
    };
    fetchRefunds();
  }, [user]);

  // Fetch wallet deductions
  useEffect(() => {
    const fetchWalletDeductions = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from('wallet_deductions')
        .select('amount')
        .eq('affiliate_email', user.email);
      if (error) {
        console.error('[❌ Wallet Deductions Fetch Error]', error.message);
        return;
      }
      setWalletDeductions(data || []);
    };
    fetchWalletDeductions();
  }, [user]);

  // Insert Stripe transaction if pending session exists (moved above early returns)
  useEffect(() => {
    const insertTransaction = async () => {
      const sessionId = localStorage.getItem('pending_stripe_session');
      if (!sessionId || !user?.email) return;

      try {
        const stripeRes = await fetch('/api/stripe-session?session_id=' + sessionId);
        const stripeSession = await stripeRes.json();
        console.log('[📦 Stripe Session Data]', stripeSession);

        if (stripeSession.payment_status !== 'paid') {
          console.warn('[⚠️ Skipping insert: payment not confirmed]');
          return;
        }

        const email = user.email;
        const grossAmount = (stripeSession.amount_total ?? 0) / 100;
        const netAmount = (stripeSession.amount_received ?? grossAmount * 0.97);
        const feeAmount = grossAmount - netAmount;

        const { error } = await supabase.from('wallet_topups').insert({
          affiliate_email: email,
          amount_gross: grossAmount,
          amount_net: netAmount,
          stripe_fees: feeAmount,
          stripe_id: stripeSession.id,
          status: 'succeeded',
          created_at: new Date().toISOString(),
        });

        if (!error) {
          console.log('[✅ Wallet Top-up Recorded]');
          localStorage.removeItem('pending_stripe_session');
          // Refresh wallet data after insert
          const { data, error: fetchError } = await supabase
            .from('wallet_topups')
            .select('amount_gross, amount_net, stripe_fees, stripe_id, status, created_at')
            .eq('affiliate_email', user.email)
            .order('created_at', { ascending: false })
            .limit(1);
          if (!fetchError) {
            setWalletData(data);
          }
        } else {
          console.error('[❌ Supabase Insert Error]', error);
        }
      } catch (err) {
        console.error('[❌ Stripe Session Fetch Error]', err);
      }
    };

    insertTransaction();
  }, [user]);

  // Fetch wallet topups and set total net amount and refundable topups
  useEffect(() => {
    const fetchWallet = async () => {
      if (!user || !user.email) return;

      const { data, error } = await supabase
        .from('wallet_topups')
        .select('amount_gross, amount_net, stripe_fees, stripe_id, status, created_at, amount_refunded')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false });
      console.log('[💳 Wallet Fetch Result]', data);

      if (error) {
        console.error('[❌ Wallet Fetch Error]', error.message);
        return;
      }

      setWalletData(data);

      // Derive refundable topups, sorted by created_at desc, filtered by amount_refunded < amount_net
      if (data && data.length > 0) {
        const refundable = data
          .filter(t => (t.amount_refunded ?? 0) < (t.amount_net ?? 0))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRefundableTopups(refundable);
        // Set default selected topup if not already set
        if (!selectedTopupId && refundable.length > 0) {
          setSelectedTopupId(refundable[0].stripe_id);
        }

        const totalNet = data.reduce((sum, item) => sum + (item.amount_net ?? 0), 0);
        const totalRefunded = refunds.reduce((sum, r) => sum + (r.amount ?? 0), 0);
        const totalDeductions = walletDeductions.reduce((sum, d) => sum + (d.amount ?? 0), 0);
        const availableBalance = totalNet - totalRefunded - totalDeductions;
        setTotalNetAmount(availableBalance >= 0 ? availableBalance : 0);
      } else {
        setTotalNetAmount(0);
        setRefundableTopups([]);
      }
    };

    fetchWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refunds, walletDeductions]);

  // Early return for session: fallback UI instead of redirect to avoid loops
  if (session === undefined) {
    // Still loading
    return <div className="w-full flex items-center justify-center py-12">Loading...</div>;
  }

  if (session === null) {
    return (
      <div className="w-full flex items-center justify-center py-12 text-center">
        <p>You are not logged in. <a href="/" className="text-blue-500 underline">Go to home</a></p>
      </div>
    );
  }

  const handleConnectStripe = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch('/api/stripe/create-account', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to create Stripe account.');
      }
    } catch (err) {
      console.error('[❌ Stripe Connect Error]', err);
      alert('Stripe connection failed.');
    } finally {
      setConnectLoading(false);
    }
  };



  const handleTopUp = async () => {
    const amountInDollars = parseFloat(amount);

    console.log("[🚀 Creating Top-Up Session] Payload:", {
      email: session?.user.email,
      amount: amountInDollars,
      role: "affiliate",
      currency,
    });
    if (isNaN(amountInDollars) || amountInDollars <= 0) {
      alert('Please enter a valid amount greater than $0.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/stripe/create-topup-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session?.user.email,
          amount: amountInDollars,
          role: 'affiliate',
          currency,
        }),
      });

      const data = await response.json();
      console.log('[🚀 Stripe Checkout Response]', data);

      if (data?.url) {
        console.log('[✅ Stripe URL & Session ID Found]', { url: data.url, sessionId: data.sessionId });
        if (data.sessionId) {
          localStorage.setItem('pending_stripe_session', data.sessionId);
        }
        window.location.href = data.url;
      } else {
        console.error('[❌ Stripe Redirect Error] Missing url:', data);
        alert('Stripe session creation failed: missing URL.');
      }
    } catch (error) {
      console.error('[❌ Stripe Top-up Error]', error);
      alert('Failed to initiate top-up.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawAll = () => {
    setRefundAmount(totalNetAmount.toFixed(2));
  };

  const handleRequestRefund = async () => {
    const refundAmt = parseFloat(refundAmount);
    if (isNaN(refundAmt) || refundAmt <= 0) {
      alert('Please enter a valid refund amount greater than $0.');
      return;
    }
    if (refundAmt > totalNetAmount) {
      alert('Refund amount cannot exceed available balance.');
      return;
    }
    if (!user?.email) {
      alert('User not authenticated.');
      return;
    }
    // Find the selected topup
    const selectedTopup = refundableTopups.find(t => t.stripe_id === selectedTopupId);
    if (!selectedTopup) {
      alert('Please select a top-up to refund from.');
      return;
    }

    setRefundLoading(true);
    try {
      // Log payload before sending
      console.log('[🧪 Refund Payload]', {
        email: user.email,
        refundAmount: refundAmt,
        stripe_charge_id: selectedTopup.stripe_id,
      });

      // Check for missing/null/undefined values before sending
      if (!refundAmt || !selectedTopup?.stripe_id || !user.email) {
        alert('Missing required refund parameters.');
        setRefundLoading(false);
        return;
      }

      const response = await fetch('/api/stripe/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          refundAmount: refundAmt,
          stripe_charge_id: selectedTopup.stripe_id,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert('Refund request submitted successfully.');
        setRefundAmount('');
        // Optionally refresh refund history and wallet data
        const { data: refundsData, error } = await supabase
          .from('wallet_refunds')
          .select('amount, status, stripe_refund_id, created_at')
          .eq('affiliate_email', user.email)
          .order('created_at', { ascending: false });
        if (!error) {
          setRefunds(refundsData || []);
        }
        // Refresh wallet data as well
        const { data: walletTopupsData, error: walletError } = await supabase
          .from('wallet_topups')
          .select('amount_gross, amount_net, stripe_fees, stripe_id, status, created_at, amount_refunded')
          .eq('affiliate_email', user.email)
          .order('created_at', { ascending: false });
        if (!walletError) {
          setWalletData(walletTopupsData);
          // Also update refundableTopups and selectedTopupId after refund
          const refundable = walletTopupsData
            .filter((t: any) => (t.amount_refunded ?? 0) < (t.amount_net ?? 0))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setRefundableTopups(refundable);
          if (refundable.length > 0) {
            setSelectedTopupId(refundable[0].stripe_id);
          } else {
            setSelectedTopupId(null);
          }
          if (walletTopupsData && walletTopupsData.length > 0) {
            const totalNet = walletTopupsData.reduce((sum: number, item: any) => sum + (item.amount_net ?? 0), 0);
            setTotalNetAmount(totalNet);
          } else {
            setTotalNetAmount(0);
          }
        }
      } else {
        alert(data.error || 'Failed to submit refund request.');
      }
    } catch (error) {
      console.error('[❌ Refund Request Error]', error);
      alert('Failed to submit refund request.');
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_#0b1f21_0,#050608_45%,#000_80%)] text-white overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Wallet hero */}
        <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-r from-[#00C2CB] via-[#00b0b8] to-[#00B1E7] px-6 sm:px-8 py-6 sm:py-8 shadow-[0_0_60px_rgba(0,194,203,0.35)]">
          {/* subtle glow */}
          <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light">
            <div className="absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute right-0 bottom-0 h-40 w-40 rounded-full bg-black/20 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Nettmark wallet
              </div>

              <div>
                <p className="text-sm font-medium text-white/80">Available balance</p>
                <p className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-tight">
                  {currencySymbols[currency] ?? '$'}
                  {totalNetAmount.toFixed(2)}
                </p>
              </div>

              <p className="max-w-xl text-sm sm:text-base text-white/85">
                Fund campaigns, receive payouts, and manage refunds from a single balance. Nettmark keeps a clear history of every top‑up and refund for audit trails.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-end w-full sm:w-auto">
              <button
                onClick={handleRequestRefund}
                disabled={refundLoading}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/75 bg-white/95 px-4 py-2.5 text-sm font-semibold text-[#00C2CB] shadow-sm backdrop-blur transition hover:bg-white ${
                  refundLoading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 17v-2a4 4 0 0 1 4-4h12"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 13 4 17l4 4"
                  />
                </svg>
                {refundLoading ? 'Processing...' : 'Transfer out'}
              </button>

              <button
                onClick={handleConnectStripe}
                disabled={connectLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/60 bg-black/15 px-4 py-2.5 text-sm font-semibold text-white shadow-sm backdrop-blur transition hover:bg-black/25"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="16"
                    rx="2"
                    className="stroke-current"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 9h10M7 13h6M7 17h3"
                  />
                </svg>
                {connectLoading ? 'Opening history…' : 'View history'}
              </button>
            </div>
          </div>
        </section>

        {/* Main row */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,360px),minmax(0,1fr)] items-start">
          {/* Left column: refund + top up */}
          <div className="flex flex-col gap-6">
            {/* Refund card */}
            <div className="w-full rounded-2xl border border-white/5 bg-[#05090a] px-5 py-5 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB]/10 text-[#00C2CB]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 17v-2a4 4 0 0 1 4-4h12"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 13 4 17l4 4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold tracking-wide text-white/90">
                      Request refund
                    </h2>
                    <p className="text-xs text-white/50">
                      Send money back to your card or bank.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">
                  Available:{' '}
                  <span className="font-semibold text-white">
                    {currencySymbols[currency] ?? '$'}
                    {totalNetAmount.toFixed(2)}
                  </span>
                </span>
              </div>

              {refundableTopups.length > 0 && (
                <select
                  value={selectedTopupId ?? ''}
                  onChange={(e) => setSelectedTopupId(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 outline-none focus:border-[#00C2CB] focus:ring-1 focus:ring-[#00C2CB]"
                >
                  {refundableTopups.map((topup) => {
                    const remaining =
                      (topup.amount_net ?? 0) - (topup.amount_refunded ?? 0);
                    return (
                      <option key={topup.stripe_id} value={topup.stripe_id}>
                        {currencySymbols[currency] ?? '$'}
                        {remaining.toFixed(2)} available from{' '}
                        {new Date(topup.created_at).toLocaleDateString()}
                      </option>
                    );
                  })}
                </select>
              )}

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-[#00C2CB] focus:ring-1 focus:ring-[#00C2CB]"
                aria-label="Refund amount"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleWithdrawAll}
                  className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
                >
                  Withdraw all
                </button>
                <button
                  type="button"
                  onClick={handleRequestRefund}
                  disabled={refundLoading}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition ${
                    refundLoading
                      ? 'bg-[#1f2933] text-white/60 cursor-not-allowed'
                      : 'bg-[#00C2CB] text-black hover:bg-[#00b0b8]'
                  }`}
                >
                  {refundLoading ? 'Processing…' : 'Submit refund'}
                </button>
              </div>
            </div>

            {/* Top up card */}
            <div className="w-full rounded-2xl border border-white/5 bg-[#05090a] px-5 py-5 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2CB]/10 text-[#00C2CB]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-white/90">
                    Top up wallet
                  </h2>
                  <p className="text-xs text-white/50">
                    Secure Stripe checkout. Funds are ready to use instantly.
                  </p>
                </div>
              </div>

              <input
                type="number"
                placeholder="Amount (e.g. 10)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-[#00C2CB] focus:ring-1 focus:ring-[#00C2CB]"
              />

              <input
                type="text"
                value={currency}
                disabled
                readOnly
                aria-label="Currency"
                className="mb-3 w-full cursor-not-allowed rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm text-white/40"
              />

              <button
                onClick={handleTopUp}
                disabled={loading}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                  loading
                    ? 'bg-[#1f2933] text-white/60 cursor-not-allowed'
                    : 'bg-[#00C2CB] text-black hover:bg-[#00b0b8]'
                }`}
              >
                {loading ? 'Redirecting…' : 'Top up via Stripe'}
              </button>
            </div>
          </div>

          {/* Right column: activity */}
          <div className="min-w-0 rounded-2xl border border-white/5 bg-[#05090a] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-white/90">
                  Wallet activity
                </h2>
                <p className="text-xs text-white/50">
                  Top-ups and refunds synced from Stripe in real time.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                Live
              </span>
            </div>

            <div className="w-full overflow-x-auto rounded-xl border border-white/5 bg-black/20">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Date</th>
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Amount</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 font-semibold">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {walletData && walletData.length > 0 ? (
                    walletData.map((item: any) => (
                      <tr
                        key={item.stripe_id}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-white/70">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-white/80">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#00C2CB]/10 px-2 py-0.5 text-[11px] text-[#7ff5fb]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                            Top-up
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-semibold text-emerald-300">
                          +{currencySymbols[currency] ?? '$'}
                          {(item.amount_net ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              item.status === 'succeeded'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-white/10 text-white/70'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-white/40">
                          {item.stripe_id}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-4 text-center text-xs text-white/40"
                      >
                        No top-up activity found.
                      </td>
                    </tr>
                  )}

                  {refunds && refunds.length > 0 ? (
                    refunds.map((refund: any) => (
                      <tr
                        key={refund.stripe_refund_id}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-white/70">
                          {new Date(refund.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-white/80">
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 17v-2a4 4 0 0 1 4-4h12"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 13 4 17l4 4"
                              />
                            </svg>
                            Refund
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-semibold text-red-300">
                          -{currencySymbols[currency] ?? '$'}
                          {(refund.amount ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              refund.status === 'succeeded'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-white/10 text-white/70'
                            }`}
                          >
                            {refund.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-white/40">
                          {refund.stripe_refund_id}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-4 text-center text-xs text-white/40"
                      >
                        No refund activity found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}