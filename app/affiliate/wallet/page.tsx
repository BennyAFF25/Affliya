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
        setTotalNetAmount(totalNet);
      } else {
        setTotalNetAmount(0);
      }
    };

    fetchWallet();
  }, [user]);

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

  return (
    <div className="p-6 max-w-md mx-auto">
      <button
        onClick={handleConnectStripe}
        disabled={connectLoading}
        className="mb-6 bg-white hover:bg-[#e0fafa] text-[#00C2CB] border border-gray-300 px-4 py-2 rounded w-full"
      >
        {connectLoading ? 'Connecting...' : 'Connect to Stripe'}
      </button>
      <h1 className="text-2xl font-bold mb-4">Top Up Your Wallet</h1>
      <div className="mt-6">
        <div className="bg-gradient-to-r from-[#00C2CB] to-[#00b0b8] text-white rounded-xl p-6 shadow-lg flex items-center justify-between mb-6">
          <div>
            <p className="text-sm opacity-80">Available Balance</p>
            <p className="text-3xl font-bold">
              {currencySymbols[currency] ?? '$'}
              {totalNetAmount.toFixed(2) ?? '0.00'}
            </p>
          </div>
          {/* Heroicon: Currency Dollar */}
          <div className="text-4xl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m0 0c-3.314 0-6-1.79-6-4 0-1.657 1.343-3 3-3h6c1.657 0 3 1.343 3 3 0 2.21-2.686 4-6 4zm0-12c3.314 0 6 1.79 6 4 0 1.657-1.343 3-3 3h-6c-1.657 0-3-1.343-3-3 0-2.21 2.686-4 6-4z" />
            </svg>
          </div>
        </div>
      </div>
      {/* Wallet Deductions Balance */}
      <div className="bg-white border rounded-xl p-4 mt-6">
        <h2 className="text-lg font-semibold mb-2">Live Wallet Balance (including deductions)</h2>
        <p className="text-2xl font-bold">
          {wallet?.balance !== null && wallet?.balance !== undefined ? `$${wallet.balance.toFixed(2)}` : '$0.00'}
        </p>
      </div>
      <input
        type="text"
        value={currency}
        disabled
        className="border px-4 py-2 rounded w-full mb-4 bg-gray-100 text-gray-500 cursor-not-allowed"
        readOnly
        aria-label="Currency"
      />
      <input
        type="number"
        placeholder="Amount in dollars (e.g. 10)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="border px-4 py-2 rounded w-full mb-4"
      />
      <button
        onClick={handleTopUp}
        disabled={loading}
        className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded w-full"
      >
        {loading ? 'Processing...' : 'Top Up Wallet'}
      </button>
    </div>
  );
}