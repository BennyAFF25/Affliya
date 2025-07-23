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

  // Fetch live wallet balance (wallets table)
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!user?.email) return;
      const { data } = await supabase
        .from('wallets')
        .select('*')
        .eq('email', user?.email)
        .single();
      setWallet(data);
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

  useEffect(() => {
    const fetchWallet = async () => {
      if (!user || !user.email) return;

      const { data, error } = await supabase
        .from('wallet_topups')
        .select('amount_gross, amount_net, stripe_fees, stripe_id, status, created_at')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false });
      console.log('[💳 Wallet Fetch Result]', data);

      if (error) {
        console.error('[❌ Wallet Fetch Error]', error.message);
        return;
      }

      setWalletData(data);

      if (data && data.length > 0) {
        const totalNet = data.reduce((sum, item) => sum + (item.amount_net ?? 0), 0);
        const totalRefunded = refunds.reduce((sum, r) => sum + (r.amount ?? 0), 0);
        const totalDeductions = walletDeductions.reduce((sum, d) => sum + (d.amount ?? 0), 0);
        const availableBalance = totalNet - totalRefunded - totalDeductions;
        setTotalNetAmount(availableBalance >= 0 ? availableBalance : 0);
      } else {
        setTotalNetAmount(0);
      }
    };

    fetchWallet();
  }, [user, refunds, walletDeductions]);

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

    setRefundLoading(true);
    try {
      const response = await fetch('/api/stripe/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          amount: refundAmt,
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
          .select('amount_gross, amount_net, stripe_fees, stripe_id, status, created_at')
          .eq('affiliate_email', user.email)
          .order('created_at', { ascending: false });
        if (!walletError) {
          setWalletData(walletTopupsData);
          if (walletTopupsData && walletTopupsData.length > 0) {
            const totalNet = walletTopupsData.reduce((sum, item) => sum + (item.amount_net ?? 0), 0);
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
    <div className="min-h-screen w-full bg-[#111111]">
      <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-8 px-4 sm:px-8 py-12">
        {/* Balance Card */}
        <div className="w-full md:col-span-3 rounded-2xl bg-gradient-to-tr from-[#00C2CB] to-[#00B1E7] shadow-xl px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex flex-col gap-2">
            <span className="text-white/80 font-medium text-lg tracking-wide">Wallet Balance</span>
            <span className="text-white font-bold text-5xl tracking-tight">{currencySymbols[currency] ?? '$'}{totalNetAmount.toFixed(2)}</span>
            <span className="text-white/70 text-sm mt-2">All your earnings and top-ups in one place.</span>
          </div>
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full md:w-auto mt-4 md:mt-0">
            <button
              onClick={handleRequestRefund}
              disabled={refundLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-gray-200 bg-white text-[#00C2CB] hover:bg-[#f1f5f9] transition ${
                refundLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {/* External link icon (Transfer) */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {refundLoading ? 'Processing...' : 'Transfer'}
            </button>
            <button
              onClick={handleConnectStripe}
              disabled={connectLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-gray-200 bg-white text-[#00C2CB] hover:bg-[#f1f5f9] transition"
            >
              {/* Receipt/money icon (History) */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="16" rx="2" className="stroke-current"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8h.01M8 8h.01M7 16h10M7 12h10" />
              </svg>
              {connectLoading ? 'Connecting...' : 'History'}
            </button>
          </div>
        </div>

        {/* Main Row: Refund, Top Up, and Activity */}
        <div className="col-span-3 grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-8">
          {/* Left: Refund & Top Up */}
          <div className="flex flex-col gap-8 col-span-1 min-w-0">
            {/* Refund Card */}
            <div className="w-full md:w-[360px] bg-[#1f1f1f] rounded-2xl shadow-lg p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                {/* Refund icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v-2a4 4 0 014-4h12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 13l-4 4 4 4" />
                </svg>
                <h2 className="text-lg font-semibold text-[#00C2CB]">Request Refund</h2>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                Available: <span className="font-bold text-gray-900">{currencySymbols[currency] ?? '$'}{totalNetAmount.toFixed(2)}</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="border border-gray-200 px-4 py-2 rounded-lg w-full focus:ring-2 focus:ring-[#00C2CB] outline-none text-base mb-1"
                aria-label="Refund amount"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleWithdrawAll}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg flex-1 font-medium shadow-sm transition"
                >
                  Withdraw All
                </button>
                <button
                  type="button"
                  onClick={handleRequestRefund}
                  disabled={refundLoading}
                  className={`px-6 py-3 rounded-lg flex-1 font-semibold text-white shadow-sm transition ${
                    refundLoading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#00C2CB] hover:bg-[#00b0b8]'
                  }`}
                >
                  {refundLoading ? 'Processing...' : 'Refund'}
                </button>
              </div>
            </div>
            {/* Top Up Card */}
            <div className="w-full md:w-[360px] bg-[#1f1f1f] rounded-2xl shadow-lg p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                {/* Top-up icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <h2 className="text-lg font-semibold text-[#00C2CB]">Top Up Wallet</h2>
              </div>
              <input
                type="number"
                placeholder="Amount (e.g. 10)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border border-gray-200 px-4 py-2 rounded-lg w-full focus:ring-2 focus:ring-[#00C2CB] outline-none text-base mb-1"
              />
              <input
                type="text"
                value={currency}
                disabled
                readOnly
                aria-label="Currency"
                className="border border-gray-100 px-4 py-2 rounded-lg w-full bg-gray-100 text-gray-400 cursor-not-allowed text-base mb-2"
              />
              <button
                onClick={handleTopUp}
                disabled={loading}
                className={`w-full px-6 py-3 rounded-lg font-semibold shadow-sm text-white transition ${
                  loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#00C2CB] hover:bg-[#00b0b8]'
                }`}
              >
                {loading ? 'Processing...' : 'Top Up'}
              </button>
            </div>
          </div>
          {/* Right: Wallet Activity Table */}
          <div className="w-full col-span-1 md:col-span-1 self-stretch flex flex-col">
            <div className="flex-1 w-full bg-[#1f1f1f] rounded-2xl shadow-lg p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[#00C2CB]">Wallet Activity</h2>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {walletData && walletData.length > 0 ? walletData.map((item: any) => (
                      <tr key={item.stripe_id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(item.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm flex items-center gap-2">
                          {/* Top-up icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="font-medium text-gray-800">Top-up</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-[#00C2CB]">
                          +{currencySymbols[currency] ?? '$'}{(item.amount_net ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm capitalize">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            item.status === 'succeeded'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>{item.status}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">{item.stripe_id}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-center text-sm text-gray-400">No top-up activity found.</td>
                      </tr>
                    )}
                    {refunds && refunds.length > 0 ? refunds.map((refund: any) => (
                      <tr key={refund.stripe_refund_id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(refund.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm flex items-center gap-2">
                          {/* Refund icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v-2a4 4 0 014-4h12" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 13l-4 4 4 4" />
                          </svg>
                          <span className="font-medium text-red-600">Refund</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-red-500">
                          -{currencySymbols[currency] ?? '$'}{(refund.amount ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm capitalize">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            refund.status === 'succeeded'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>{refund.status}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">{refund.stripe_refund_id}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-center text-sm text-gray-400">No refund activity found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}