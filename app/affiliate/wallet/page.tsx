'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';
import { useUserSettings } from '@/../utils/hooks/useUserSettings';
import { calculateWalletBalance } from '@/../utils/wallet/balance';
import { calculateRefundLockState, type RefundLockState } from '@/../utils/wallet/refundLock';

type WalletTopup = {
  amount_gross?: number | null;
  amount_net?: number | null;
  credited_amount?: number | null;
  stripe_fees?: number | null;
  nettmark_fee_amount?: number | null;
  stripe_id: string;
  status?: string | null;
  created_at: string;
  amount_refunded?: number | null;
};

type WalletRefund = {
  amount?: number | null;
  status?: string | null;
  stripe_refund_id: string;
  created_at: string;
  source_topup_id?: string | null;
};

type WalletDeduction = {
  amount?: number | null;
  created_at?: string;
  description?: string | null;
  ad_id?: string | null;
  settlement_before?: number | null;
  settlement_after?: number | null;
  settlement_key?: string | null;
};

type WalletPayout = {
  id: string;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  available_at?: string | null;
  source_event_id?: string | null;
  stripe_transfer_id?: string | null;
};

type LedgerItem = {
  id: string;
  date: string;
  type: string;
  amount: number;
  positive: boolean;
  status: string;
  ref: string;
  note?: string;
};

type AffiliateBillingStatus = {
  hasAccount: boolean;
  stripeAccountId?: string | null;
  onboardingComplete: boolean;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
  error?: string;
};

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  AUD: 'A$',
};

const CARD_SHELL = 'rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_25px_70px_rgba(0,0,0,0.08)]';
const PANEL_CARD = 'rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_20px_55px_rgba(0,0,0,0.08)]';
const INPUT_CLASS = 'w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';
const BADGE_SOFT = 'inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--accent)]/40 px-3 py-1 text-xs font-semibold text-[var(--foreground)]/70';
const NETTMARK_TRANSACTION_FEE_BPS = 220;
const STRIPE_TOPUP_FEE_BPS = 175;
const STRIPE_TOPUP_FIXED_FEE = 0.3;

function toMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function formatMoney(amount: number, currency: string) {
  return `${currencySymbols[currency] ?? '$'}${toMoney(amount).toFixed(2)}`;
}

function calculateChargeOnTopPreview(principalAmount: number) {
  const safePrincipal = toMoney(Math.max(0, principalAmount));
  const feeAmount = toMoney((safePrincipal * NETTMARK_TRANSACTION_FEE_BPS) / 10000);
  const passthroughBaseAmount = toMoney(safePrincipal + feeAmount);
  const stripeRate = STRIPE_TOPUP_FEE_BPS / 10000;
  const totalChargeAmount = toMoney((passthroughBaseAmount + STRIPE_TOPUP_FIXED_FEE) / (1 - stripeRate));
  return {
    principalAmount: safePrincipal,
    feeAmount,
    passthroughBaseAmount,
    stripeFeeAmount: toMoney(totalChargeAmount - passthroughBaseAmount),
    grossAmount: totalChargeAmount,
  };
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getCreditedTopupAmount(topup: WalletTopup) {
  const credited = toMoney(topup.credited_amount);
  if (credited > 0) return credited;
  return toMoney(topup.amount_net);
}

function getTopupChargedAmount(topup: WalletTopup) {
  return toMoney(topup.amount_gross);
}

function isRefundableTopup(topup: WalletTopup) {
  const status = String(topup.status || '').toLowerCase();
  const countable = !status || status === 'succeeded' || status === 'refunded';
  return countable && toMoney(topup.amount_refunded) < getCreditedTopupAmount(topup);
}

function getRefundBlockReason(lockState: RefundLockState, currency: string) {
  if (!lockState.locked) {
    return 'Refunds are available right now. If you want to pull funds out, choose a top-up and submit a refund request.';
  }

  if (lockState.reasonCode === 'ACTIVE_META_AD_LOCK') {
    return `Refunds are locked because ${pluralize(lockState.activeAdCount, 'Meta ad')} ${lockState.activeAdCount === 1 ? 'is' : 'are'} still active. Pause or archive them first, then any remaining unsettled spend can finish clearing.`;
  }

  return `Refunds are locked until ${formatMoney(lockState.totalUnpaidSpend, currency)} of unsettled ad spend is fully settled across ${pluralize(lockState.unpaidAdCount, 'ad')}.`;
}

function describeDeduction(item: WalletDeduction) {
  if (item.description) return item.description;
  if (item.ad_id) return 'Meta ad spend settlement';
  return 'Wallet deduction';
}

function describePayout(item: WalletPayout) {
  const status = String(item.status || 'pending').toLowerCase();
  if (status === 'completed') return 'Affiliate payout received';
  if (status === 'pending') return 'Affiliate payout scheduled';
  return `Affiliate payout ${status}`;
}

function badgeTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'completed' || normalized === 'succeeded' || normalized === 'applied') {
    return 'bg-emerald-500/10 text-emerald-300';
  }
  if (normalized === 'pending') {
    return 'bg-amber-500/10 text-amber-200';
  }
  if (normalized === 'failed' || normalized === 'canceled') {
    return 'bg-red-500/10 text-red-300';
  }
  return 'bg-white/10 text-white/70';
}

export default function AffiliateWalletPage() {
  const session = useSession();
  const user = session?.user;
  const { settings, isLoading: settingsLoading } = useUserSettings();

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [loading, setLoading] = useState(false);
  const [walletData, setWalletData] = useState<WalletTopup[]>([]);
  const [refunds, setRefunds] = useState<WalletRefund[]>([]);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [walletDeductions, setWalletDeductions] = useState<WalletDeduction[]>([]);
  const [walletPayouts, setWalletPayouts] = useState<WalletPayout[]>([]);
  const [refundLockState, setRefundLockState] = useState<RefundLockState>({
    hasActiveMetaAds: false,
    hasUnpaidAdSpend: false,
    activeAdCount: 0,
    unpaidAdCount: 0,
    totalUnpaidSpend: 0,
    locked: false,
    reasonCode: null,
    message: null,
  });
  const [refundableTopups, setRefundableTopups] = useState<WalletTopup[]>([]);
  const [selectedTopupId, setSelectedTopupId] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [topupQueryState, setTopupQueryState] = useState<'success' | 'cancel' | null>(null);
  const [recentCompletedTopupId, setRecentCompletedTopupId] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<AffiliateBillingStatus | null>(null);
  const [billingStatusLoading, setBillingStatusLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const topupState = params.get('topup');

    if (topupState === 'success' || topupState === 'cancel') {
      setTopupQueryState(topupState);
    } else {
      setTopupQueryState(null);
    }

    if (topupState === 'success') {
      const rememberedSessionId =
        sessionStorage.getItem('recent_completed_topup_session') ||
        localStorage.getItem('pending_stripe_session');

      if (rememberedSessionId) {
        setRecentCompletedTopupId(rememberedSessionId);
      }
    } else {
      sessionStorage.removeItem('recent_completed_topup_session');
      setRecentCompletedTopupId(null);
    }
  }, []);

  useEffect(() => {
    if (settingsLoading) return;
    const preferred = String(settings?.currency || settings?.preferred_currency || 'AUD').toUpperCase();
    setCurrency(preferred);
  }, [settings, settingsLoading]);

  useEffect(() => {
    const loadBillingStatus = async () => {
      if (!user?.id && !user?.email) {
        setBillingStatus(null);
        setBillingStatusLoading(false);
        return;
      }

      try {
        setBillingStatusLoading(true);
        const qs = user?.id
          ? `?user_id=${encodeURIComponent(user.id)}`
          : `?email=${encodeURIComponent(user!.email!)}`;
        const res = await fetch(`/api/stripe/affiliates/check-account${qs}`, { cache: 'no-store' });
        const json = (await res.json()) as AffiliateBillingStatus;
        if (!res.ok) throw new Error(json.error || `Billing status check failed (${res.status})`);
        setBillingStatus(json);
      } catch (err) {
        console.error('[❌ Affiliate billing status error]', err);
        setBillingStatus(null);
      } finally {
        setBillingStatusLoading(false);
      }
    };

    void loadBillingStatus();
  }, [user?.id, user?.email]);

  const refreshWalletState = useCallback(async () => {
    if (!user?.email) return;

    const [
      refundsResult,
      deductionsResult,
      lockStateResult,
      topupsResult,
      payoutsResult,
    ] = await Promise.all([
      supabase
        .from('wallet_refunds')
        .select('amount, status, stripe_refund_id, created_at, source_topup_id')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false }),
      supabase
        .from('wallet_deductions')
        .select('amount, created_at, description, ad_id, settlement_before, settlement_after, settlement_key')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false }),
      supabase
        .from('live_ads')
        .select('id, status, billing_state, spend, spend_transferred')
        .eq('affiliate_email', user.email),
      supabase
        .from('wallet_topups')
        .select('amount_gross, amount_net, credited_amount, stripe_fees, nettmark_fee_amount, stripe_id, status, created_at, amount_refunded')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false }),
      supabase
        .from('wallet_payouts')
        .select('id, amount, status, created_at, available_at, source_event_id, stripe_transfer_id')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false }),
    ]);

    if (refundsResult.error) {
      console.error('[❌ Refunds Fetch Error]', refundsResult.error.message);
    } else {
      setRefunds((refundsResult.data as WalletRefund[]) || []);
    }

    if (deductionsResult.error) {
      console.error('[❌ Wallet Deductions Fetch Error]', deductionsResult.error.message);
    } else {
      setWalletDeductions((deductionsResult.data as WalletDeduction[]) || []);
    }

    if (lockStateResult.error) {
      console.error('[❌ Refund lock state fetch error]', lockStateResult.error.message);
    } else {
      setRefundLockState(calculateRefundLockState(lockStateResult.data || []));
    }

    if (topupsResult.error) {
      console.error('[❌ Wallet Fetch Error]', topupsResult.error.message);
    } else {
      const topups = (topupsResult.data as WalletTopup[]) || [];
      setWalletData(topups);
      const refundable = topups
        .filter(isRefundableTopup)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRefundableTopups(refundable);
      setSelectedTopupId((current) => {
        if (current && refundable.some((item) => item.stripe_id === current)) {
          return current;
        }
        return refundable[0]?.stripe_id ?? null;
      });
    }

    if (payoutsResult.error) {
      console.error('[❌ Wallet Payouts Fetch Error]', payoutsResult.error.message);
    } else {
      setWalletPayouts((payoutsResult.data as WalletPayout[]) || []);
    }
  }, [user?.email]);

  useEffect(() => {
    void refreshWalletState();
  }, [refreshWalletState]);

  useEffect(() => {
    const confirmPendingSession = async () => {
      const sessionId = localStorage.getItem('pending_stripe_session');
      if (!sessionId || !user?.email) return;

      try {
        const stripeRes = await fetch('/api/stripe-session?session_id=' + sessionId);
        const stripeSession = await stripeRes.json();
        console.log('[📦 Stripe Session Data]', stripeSession);

        if (stripeSession.payment_status !== 'paid') {
          console.warn('[⚠️ Pending session not paid yet]');
          return;
        }

        console.log('[✅ Paid session confirmed; awaiting webhook credit]', {
          sessionId: stripeSession.id,
        });

        const reconcileRes = await fetch('/api/stripe/reconcile-topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!reconcileRes.ok) {
          const reconcileBody = await reconcileRes.json().catch(() => null);
          console.error('[❌ Top-up reconcile failed]', reconcileBody || reconcileRes.statusText);
        } else {
          const reconcileBody = await reconcileRes.json().catch(() => null);
          console.log('[✅ Top-up reconcile result]', reconcileBody);
        }

        setRecentCompletedTopupId(sessionId);
        sessionStorage.setItem('recent_completed_topup_session', sessionId);
        localStorage.removeItem('pending_stripe_session');
        await refreshWalletState();
      } catch (err) {
        console.error('[❌ Stripe Session Fetch Error]', err);
      }
    };

    void confirmPendingSession();
  }, [refreshWalletState]);

  if (session === undefined) {
    return <div className="w-full flex items-center justify-center py-12">Loading...</div>;
  }

  if (session === null) {
    return (
      <div className="w-full flex items-center justify-center py-12 text-center">
        <p>You are not logged in. <a href="/" className="text-blue-500 underline">Go to home</a></p>
      </div>
    );
  }

  const walletSnapshot = calculateWalletBalance({
    topups: walletData,
    deductions: walletDeductions,
    refunds,
  });
  const topupPreview = calculateChargeOnTopPreview(parseFloat(amount || '0'));
  const availableBalance = walletSnapshot.availableBalance;
  const refundableBalance = walletSnapshot.refundableBalance;
  const lockedRefundBalance = refundLockState.locked ? refundableBalance : 0;
  const availableToRefund = refundLockState.locked ? 0 : refundableBalance;
  const totalTopups = walletSnapshot.totalTopupsCredited;
  const totalDeductions = walletSnapshot.totalDeductions;
  const pendingPayoutTotal = walletPayouts
    .filter((item) => String(item.status || '').toLowerCase() === 'pending')
    .reduce((sum, item) => sum + toMoney(item.amount), 0);
  const refundBlockReason = getRefundBlockReason(refundLockState, currency);
  const completedTopupRecord = recentCompletedTopupId
    ? walletData.find((item) => item.stripe_id === recentCompletedTopupId)
    : null;
  const recentTopupActuals = topupQueryState === 'success' ? completedTopupRecord : null;
  const billingReady = !!billingStatus?.hasAccount && !!billingStatus?.onboardingComplete;
  const topupBlockedReason = billingStatusLoading
    ? 'Checking billing connection…'
    : billingReady
      ? null
      : 'Connect billing in Affiliate Settings before adding wallet funds or running ads.';

  const activity: LedgerItem[] = (() => {
    const topupItems = walletData.map((item) => ({
      id: `topup-${item.stripe_id}`,
      date: item.created_at,
      type: 'Top-up',
      amount: getCreditedTopupAmount(item),
      positive: true,
      status: item.status || 'succeeded',
      ref: item.stripe_id,
      note: [
        getTopupChargedAmount(item) > 0 ? `Charged ${formatMoney(getTopupChargedAmount(item), currency)}` : null,
        item.nettmark_fee_amount ? `Nettmark fee: ${formatMoney(toMoney(item.nettmark_fee_amount), currency)}` : null,
        item.stripe_fees ? `Stripe fee: ${formatMoney(toMoney(item.stripe_fees), currency)}` : null,
      ].filter(Boolean).join(' · ') || undefined,
    }));

    const refundItems = refunds.map((item) => ({
      id: `refund-${item.stripe_refund_id}`,
      date: item.created_at,
      type: 'Refund',
      amount: toMoney(item.amount),
      positive: false,
      status: item.status || 'succeeded',
      ref: item.stripe_refund_id,
      note: item.source_topup_id ? `Source top-up: ${item.source_topup_id}` : undefined,
    }));

    const deductionItems = walletDeductions.map((item, index) => ({
      id: `deduction-${item.settlement_key || item.ad_id || index}`,
      date: item.created_at || new Date(0).toISOString(),
      type: describeDeduction(item),
      amount: toMoney(item.amount),
      positive: false,
      status: 'applied',
      ref: item.settlement_key || item.ad_id || 'wallet_deduction',
      note:
        item.settlement_before !== undefined && item.settlement_after !== undefined
          ? `Settled from ${formatMoney(toMoney(item.settlement_before), currency)} to ${formatMoney(toMoney(item.settlement_after), currency)}`
          : undefined,
    }));

    const payoutItems = walletPayouts.map((item) => ({
      id: `payout-${item.id}`,
      date: item.created_at || item.available_at || new Date(0).toISOString(),
      type: describePayout(item),
      amount: toMoney(item.amount),
      positive: true,
      status: item.status || 'pending',
      ref: item.stripe_transfer_id || item.source_event_id || item.id,
      note: item.available_at ? `Available at ${new Date(item.available_at).toLocaleString()}` : undefined,
    }));

    return [...topupItems, ...refundItems, ...deductionItems, ...payoutItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  })();

  const handleTopUp = async () => {
    const amountInDollars = parseFloat(amount);

    console.log('[🚀 Creating Top-Up Session] Payload:', {
      email: session?.user.email,
      amount: amountInDollars,
      role: 'affiliate',
      currency,
    });

    if (isNaN(amountInDollars) || amountInDollars <= 0) {
      alert('Please enter a valid amount greater than $0.');
      return;
    }
    if (!billingReady) {
      alert(topupBlockedReason || 'Connect billing in Affiliate Settings before topping up your wallet.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/stripe/create-topup-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (refundLockState.locked) return;
    setRefundAmount(availableToRefund.toFixed(2));
  };

  const handleRequestRefund = async () => {
    const refundAmt = parseFloat(refundAmount);
    if (isNaN(refundAmt) || refundAmt <= 0) {
      alert('Please enter a valid refund amount greater than $0.');
      return;
    }
    if (refundLockState.locked) {
      alert(refundLockState.message || 'Refunds are currently locked.');
      return;
    }
    if (refundAmt > availableToRefund) {
      alert('Refund amount cannot exceed available to refund balance.');
      return;
    }
    if (!user?.email) {
      alert('User not authenticated.');
      return;
    }

    const selectedTopup = refundableTopups.find((t) => t.stripe_id === selectedTopupId);
    if (!selectedTopup) {
      alert('Please select a top-up to refund from.');
      return;
    }

    setRefundLoading(true);
    try {
      const response = await fetch('/api/stripe/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        await refreshWalletState();
      } else {
        alert(data.message || data.error || 'Failed to submit refund request.');
      }
    } catch (error) {
      console.error('[❌ Refund Request Error]', error);
      alert('Failed to submit refund request.');
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)] overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <section
          className={`${CARD_SHELL} relative overflow-hidden border-0 px-6 sm:px-8 py-6 sm:py-8 text-white shadow-[0_0_60px_rgba(0,194,203,0.35)]`}
          style={{ background: 'linear-gradient(135deg, #00C2CB, #00b0b8 60%, #00B1E7)' }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light">
            <div className="absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute right-0 bottom-0 h-40 w-40 rounded-full bg-black/20 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white/80">
                <span className={`h-1.5 w-1.5 rounded-full ${refundLockState.locked ? 'bg-amber-300' : 'bg-emerald-300'}`} />
                Workspace overview
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Affiliate Wallet
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
                  See what is spendable now, what is locked by live campaign activity,
                  and what can actually be refunded.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-white/80">Available balance</p>
                <p className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-tight">
                  {formatMoney(availableBalance, currency)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-white/85">
                  {pluralize(refundLockState.activeAdCount, 'active Meta ad')}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-white/85">
                  Unsettled spend {formatMoney(refundLockState.totalUnpaidSpend, currency)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-white/85">
                  Refundable now {formatMoney(availableToRefund, currency)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full lg:w-auto lg:min-w-[280px]">
              <div className="rounded-2xl bg-black/20 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Refund status</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {refundLockState.locked ? 'Locked until campaign obligations clear' : 'Open for refunds'}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/75">{refundBlockReason}</p>
              </div>
              <button
                onClick={handleRequestRefund}
                disabled={refundLoading || refundLockState.locked}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/75 bg-white/95 px-4 py-2.5 text-sm font-semibold text-[#00C2CB] shadow-sm backdrop-blur transition hover:bg-white ${
                  refundLoading || refundLockState.locked ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {refundLoading ? 'Processing…' : refundLockState.locked ? 'Refunds locked' : 'Transfer out'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className={`${PANEL_CARD} p-4`}>
            <p className="text-xs text-white/60">Available balance</p>
            <p className="mt-1 text-2xl font-bold text-[#7ff5fb]">{formatMoney(availableBalance, currency)}</p>
          </div>
          <div className={`${PANEL_CARD} p-4`}>
            <p className="text-xs text-white/60">Refundable now</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{formatMoney(availableToRefund, currency)}</p>
          </div>
          <div className={`${PANEL_CARD} p-4`}>
            <p className="text-xs text-white/60">Locked by ads / unsettled spend</p>
            <p className="mt-1 text-2xl font-bold text-amber-200">{formatMoney(lockedRefundBalance, currency)}</p>
          </div>
          <div className={`${PANEL_CARD} p-4`}>
            <p className="text-xs text-white/60">Active Meta ads</p>
            <p className="mt-1 text-2xl font-bold">{refundLockState.activeAdCount}</p>
          </div>
          <div className={`${PANEL_CARD} p-4`}>
            <p className="text-xs text-white/60">Unsettled ad spend</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{formatMoney(refundLockState.totalUnpaidSpend, currency)}</p>
          </div>
          <div className={`${PANEL_CARD} p-4`}>
            <p className="text-xs text-white/60">Pending payout receipts</p>
            <p className="mt-1 text-2xl font-bold">{formatMoney(pendingPayoutTotal, currency)}</p>
          </div>
        </section>

        {refundLockState.locked ? (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Why you cannot refund right now</p>
            <p className="mt-1 text-amber-100/80">{refundBlockReason}</p>
          </section>
        ) : (
          <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold">No refund lock is active.</p>
            <p className="mt-1 text-emerald-100/80">
              You can refund up to {formatMoney(availableToRefund, currency)} from completed wallet top-ups.
            </p>
          </section>
        )}

        {topupQueryState === 'success' ? (
          recentTopupActuals ? (
            <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-sm text-cyan-50">
              <p className="font-semibold text-cyan-100">Top-up completed</p>
              <p className="mt-1 text-cyan-50/85">
                Actual settled deductions are now recorded from Stripe for this wallet credit.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-50/60">Wallet credit</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {formatMoney(getCreditedTopupAmount(recentTopupActuals), currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-50/60">Nettmark fee</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {formatMoney(toMoney(recentTopupActuals.nettmark_fee_amount), currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-50/60">Stripe fee</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {formatMoney(toMoney(recentTopupActuals.stripe_fees), currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-300/10 bg-black/15 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-50/60">Total charged</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {formatMoney(getTopupChargedAmount(recentTopupActuals), currency)}
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-sm text-cyan-50">
              <p className="font-semibold text-cyan-100">Top-up received — finalising fee details</p>
              <p className="mt-1 text-cyan-50/85">
                We&apos;re waiting for the settled Stripe record so we can show the actual Stripe fee and Nettmark fee here.
              </p>
            </section>
          )
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,360px),minmax(0,1fr)] items-start">
          <div className="flex flex-col gap-6">
            <div className={`${PANEL_CARD} px-5 py-5`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-white/90">Request refund</h2>
                  <p className="text-xs text-white/50">Choose the top-up you want to refund from, then submit the amount.</p>
                </div>
                <span className={BADGE_SOFT}>Refundable {formatMoney(availableToRefund, currency)}</span>
              </div>

              <div className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75">
                {refundBlockReason}
              </div>

              {refundableTopups.length > 0 ? (
                <select
                  value={selectedTopupId ?? ''}
                  onChange={(e) => setSelectedTopupId(e.target.value)}
                  disabled={refundLockState.locked}
                  className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 outline-none focus:border-[#00C2CB] focus:ring-1 focus:ring-[#00C2CB] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refundableTopups.map((topup) => {
                    const remaining = getCreditedTopupAmount(topup) - toMoney(topup.amount_refunded);
                    return (
                      <option key={topup.stripe_id} value={topup.stripe_id}>
                        {formatMoney(remaining, currency)} available from {new Date(topup.created_at).toLocaleDateString()}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="mb-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
                  No refundable top-ups are available yet.
                </div>
              )}

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                disabled={refundLockState.locked}
                className={`${INPUT_CLASS} mb-3 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
                aria-label="Refund amount"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleWithdrawAll}
                  disabled={refundLockState.locked}
                  className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Withdraw all
                </button>
                <button
                  type="button"
                  onClick={handleRequestRefund}
                  disabled={refundLoading || refundLockState.locked || refundableTopups.length === 0}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition ${
                    refundLoading || refundLockState.locked || refundableTopups.length === 0
                      ? 'bg-[#1f2933] text-white/60 cursor-not-allowed'
                      : 'bg-[#00C2CB] text-black hover:bg-[#00b0b8]'
                  }`}
                >
                  {refundLoading ? 'Processing…' : refundLockState.locked ? 'Refunds locked' : 'Submit refund'}
                </button>
              </div>
            </div>

            <div className={`${PANEL_CARD} px-5 py-5`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-white/90">Top up wallet</h2>
                  <p className="text-xs text-white/50">Stripe checkout adds funds for campaign spend. Your wallet is credited with principal only, while fees stay visible in the breakdown.</p>
                </div>
                <span className={BADGE_SOFT}>{currency}</span>
              </div>

              {!billingReady ? (
                <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-3 text-xs text-amber-50">
                  <p className="font-semibold text-amber-100">Billing connection required</p>
                  <p className="mt-1 text-amber-50/80">
                    {topupBlockedReason || 'Connect billing in Affiliate Settings before adding wallet funds.'}
                  </p>
                  <a
                    href="/affiliate/settings"
                    className="mt-3 inline-flex items-center rounded-lg bg-white/10 px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/15"
                  >
                    Open affiliate settings
                  </a>
                </div>
              ) : null}

              <input
                type="number"
                placeholder="Amount (e.g. 10)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${INPUT_CLASS} mb-2 px-3 py-2 text-sm`}
              />

              <input
                type="text"
                value={currency}
                disabled
                readOnly
                aria-label="Currency"
                className={`${INPUT_CLASS} mb-3 cursor-not-allowed px-3 py-2 text-sm opacity-70`}
              />

              <div className="mb-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-3 text-xs text-cyan-50">
                <p className="font-semibold text-cyan-100">Fee disclosure</p>
                <p className="mt-1 text-cyan-50/80">
                  Nettmark charges {(NETTMARK_TRANSACTION_FEE_BPS / 100).toFixed(1)}% on wallet top-ups, and Stripe processing fees are also passed through on checkout. Refund eligibility is based on the credited principal, not either fee.
                </p>
                {topupPreview.principalAmount > 0 ? (
                  <p className="mt-2 text-cyan-50/90">
                    Wallet credit {formatMoney(topupPreview.principalAmount, currency)} → Nettmark fee {formatMoney(topupPreview.feeAmount, currency)} → estimated Stripe fee {formatMoney(topupPreview.stripeFeeAmount, currency)} → total charge {formatMoney(topupPreview.grossAmount, currency)}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-cyan-50/70">
                  Final Stripe fees are recorded from the settled payment and may vary slightly from the estimate.
                </p>
              </div>

              <button
                onClick={handleTopUp}
                disabled={loading || billingStatusLoading || !billingReady}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                  loading || billingStatusLoading || !billingReady
                    ? 'bg-[#1f2933] text-white/60 cursor-not-allowed'
                    : 'bg-[#00C2CB] text-black hover:bg-[#00b0b8]'
                }`}
              >
                {loading
                  ? 'Redirecting…'
                  : billingStatusLoading
                    ? 'Checking billing…'
                    : billingReady
                      ? 'Top up via Stripe'
                      : 'Connect billing in Settings first'}
              </button>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/60">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <p>Total top-ups</p>
                  <p className="mt-1 text-sm font-semibold text-white">{formatMoney(totalTopups, currency)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <p>Ad spend settled</p>
                  <p className="mt-1 text-sm font-semibold text-white">{formatMoney(totalDeductions, currency)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`${PANEL_CARD} min-w-0 p-5 space-y-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-white/90">Wallet timeline</h2>
                <p className="text-xs text-white/50">Top-ups, refunds, ad-spend settlements, and payout receipts in one ledger.</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">Live</span>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {activity.length > 0 ? (
                activity.slice(0, 10).map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-white/85 font-medium">{item.type}</p>
                        <p className="text-[11px] text-white/40">{new Date(item.date).toLocaleString()}</p>
                        {item.note ? <p className="mt-1 text-[11px] text-white/55">{item.note}</p> : null}
                      </div>
                      <p className={`text-sm font-semibold ${item.positive ? 'text-emerald-300' : 'text-red-300'}`}>
                        {item.positive ? '+' : '-'}{formatMoney(item.amount, currency)}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-[10px] text-white/45 truncate max-w-[70%]">{item.ref}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeTone(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-center text-xs text-white/40">
                  No activity yet.
                </div>
              )}
            </div>

            <button
              onClick={() => setShowLedger((v) => !v)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
            >
              {showLedger ? 'Hide detailed ledger' : 'View detailed ledger'}
            </button>

            {showLedger && (
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
                    {activity.length > 0 ? (
                      activity.map((item) => (
                        <tr key={`ledger-${item.id}`} className="hover:bg-white/5 transition-colors align-top">
                          <td className="px-4 py-3 whitespace-nowrap text-[11px] text-white/70">{new Date(item.date).toLocaleString()}</td>
                          <td className="px-4 py-3 text-[11px] text-white/80">
                            <div>{item.type}</div>
                            {item.note ? <div className="mt-1 text-white/45">{item.note}</div> : null}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-[11px] font-semibold ${item.positive ? 'text-emerald-300' : 'text-red-300'}`}>
                            {item.positive ? '+' : '-'}{formatMoney(item.amount, currency)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTone(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-white/40 break-all">{item.ref}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-xs text-white/40">No wallet ledger activity found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
