'use client';

import { WalletBillingNotice } from "./WalletBillingNotice";

import { MIN_WALLET_TOPUP_AUD, WALLET_TOPUP_MINIMUM_MESSAGE } from "@/../utils/wallet/topupValidation";
import { loadWalletSection } from '../../../utils/wallet/loadSection';
import React from "react";
import { campaignStatusDetail } from "../../../utils/wallet/campaignStatus";
import { type PauseNotice } from "../../../utils/wallet/pauseNotice";
import { calculateSpendableBalance, isFundingPaused } from '../../../utils/wallet/spendableBalance';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, CircleHelp, Clock3, CreditCard, Wallet } from 'lucide-react';
import { formatAUD, formatMoney } from "../../../utils/currency";
import { supabase } from '@/../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';
import { useUserSettings } from '@/../utils/hooks/useUserSettings';
import { calculateWalletBalance } from '@/../utils/wallet/balance';
import { calculateRefundLockState, type RefundLockState } from '@/../utils/wallet/refundLock';
import { describeAffiliatePayout, formatRecurringTermDetail } from '@/../utils/recurringTerms';

type WalletLiveAd = {
  id: string;
  status?: string | null;
  billing_state?: string | null;
  terminated_by_business_at?: string | null;
  spend?: number | null;
  spend_transferred?: number | null;
};

type ActivityFilter = 'all' | 'topups' | 'spend' | 'refunds';

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
  cycle_number?: number | null;
  is_recurring?: boolean | null;
  recurring_term_months?: number | null;
  recurring_payout_mode?: string | null;
  recurring_payout_interval?: string | null;
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

const NETTMARK_TRANSACTION_FEE_BPS = 220;
const STRIPE_TOPUP_FEE_BPS = 175;
const STRIPE_TOPUP_FIXED_FEE = 0.3;

function toMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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
  return describeAffiliatePayout(item);
}

export default function AffiliateWalletPage() {
  const session = useSession();
  const user = session?.user;
  const { settings, isLoading: settingsLoading } = useUserSettings();

  const [readState, setReadState] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});
  const [initialReadsSettled, setInitialReadsSettled] = useState(false);
  const readGeneration = React.useRef(0);
  const [amount, setAmount] = useState('');
  const [topupMinimumError, setTopupMinimumError] = useState(false);
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
  const [topupQueryState, setTopupQueryState] = useState<'success' | 'cancel' | null>(null);
  const [recentCompletedTopupId, setRecentCompletedTopupId] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<AffiliateBillingStatus | null>(null);
  const [billingRetry, setBillingRetry] = useState(0);
  const [billingError, setBillingError] = useState(false);
  const [billingStatusLoading, setBillingStatusLoading] = useState(true);
  const [pauseNotices, setPauseNotices] = useState<Record<string, PauseNotice>>({});
  const [liveAdRows, setLiveAdRows] = useState<WalletLiveAd[]>([]);
  useEffect(() => {
    if (!session?.user?.email || !liveAdRows.length) {
      setPauseNotices({});
      return;
    }
    const controller = new AbortController();
    void fetch("/api/affiliate/campaign-pause-notices", { signal: controller.signal, cache: "no-store" })
      .then(r => r.ok ? r.json() : null).then(payload => { if (!controller.signal.aborted) setPauseNotices(payload?.notices || {}); }).catch(() => {});
    return () => controller.abort();
  }, [session?.user?.email, liveAdRows]);
  const [walletAction, setWalletAction] = useState<'topup' | 'withdraw' | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');

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
      if (walletAction !== 'topup') return;
      if (!user?.id && !user?.email) {
        setBillingStatus(null);
        setBillingStatusLoading(false);
        return;
      }

      try {
        setBillingStatusLoading(true);
        setBillingError(false);
        const qs = user?.id
          ? `?user_id=${encodeURIComponent(user.id)}`
          : `?email=${encodeURIComponent(user!.email!)}`;
        const res = await fetch(`/api/stripe/affiliates/check-account${qs}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        const json = (await res.json()) as AffiliateBillingStatus;
        if (!res.ok) throw new Error(json.error || `Billing status check failed (${res.status})`);
        setBillingStatus(json);
      } catch (err) {
        setBillingError(true);
        console.error('[❌ Affiliate billing status error]', err);
        setBillingStatus(null);
      } finally {
        setBillingStatusLoading(false);
      }
    };

    void loadBillingStatus();
  }, [user?.id, user?.email, billingRetry, walletAction]);

  const refreshWalletState = useCallback(async () => {
    if (!user?.email) return;

    const generation = ++readGeneration.current;
    await Promise.all([
      loadWalletSection(supabase
        .from('wallet_refunds')
        .select('amount, status, stripe_refund_id, created_at, source_topup_id')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false }), (result) => {
        if (generation !== readGeneration.current) return;
        const refundsResult = result;
        setRefunds((refundsResult.data as WalletRefund[]) || []);
      }, (state) => { if (generation === readGeneration.current) setReadState(previous => ({ ...previous, refunds: state })); }),
      loadWalletSection(supabase
        .from('wallet_deductions')
        .select('amount, created_at, description, ad_id, settlement_before, settlement_after, settlement_key')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false }), (result) => {
        if (generation !== readGeneration.current) return;
        const deductionsResult = result;
        setWalletDeductions((deductionsResult.data as WalletDeduction[]) || []);
      }, (state) => { if (generation === readGeneration.current) setReadState(previous => ({ ...previous, deductions: state })); }),
      loadWalletSection(supabase
        .from('live_ads')
        .select('*')
        .eq('affiliate_email', user.email), (result) => {
        if (generation !== readGeneration.current) return;
        const lockStateResult = result;
        setRefundLockState(calculateRefundLockState(lockStateResult.data || []));
        // Presentation-only view of the existing live_ads read; no additional query.
        setLiveAdRows((lockStateResult.data || []) as WalletLiveAd[]);
      }, (state) => { if (generation === readGeneration.current) setReadState(previous => ({ ...previous, lockState: state })); }),
      loadWalletSection(supabase
        .from('wallet_topups')
        .select('amount_gross, amount_net, credited_amount, stripe_fees, nettmark_fee_amount, stripe_id, status, created_at, amount_refunded')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false }), (result) => {
        if (generation !== readGeneration.current) return;
        const topupsResult = result;
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
      }, (state) => { if (generation === readGeneration.current) setReadState(previous => ({ ...previous, topups: state })); }),
      loadWalletSection(supabase
        .from('wallet_payouts')
        .select('id, amount, status, created_at, available_at, source_event_id, stripe_transfer_id, cycle_number, is_recurring, recurring_term_months, recurring_payout_mode, recurring_payout_interval')
        .eq('affiliate_email', user.email)
        .order('created_at', { ascending: false }), (result) => {
        if (generation !== readGeneration.current) return;
        const payoutsResult = result;
        setWalletPayouts((payoutsResult.data as WalletPayout[]) || []);
      }, (state) => { if (generation === readGeneration.current) setReadState(previous => ({ ...previous, payouts: state })); }),
    ]);
    if (generation === readGeneration.current) setInitialReadsSettled(true);
  }, [user?.email]);

  useEffect(() => {
    void refreshWalletState();
    return () => { readGeneration.current += 1; };
  }, [refreshWalletState]);

  useEffect(() => {
    const confirmPendingSession = async () => {
      const sessionId = localStorage.getItem('pending_stripe_session');
      if (!sessionId || !user?.email || !initialReadsSettled) return;

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
  }, [refreshWalletState, initialReadsSettled]);

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
  // Display only: Meta has already reported this spend, even though the wallet
  // deduction has not yet been entered. Once settlement is recorded it moves
  // into wallet_deductions and disappears from totalUnpaidSpend, preventing
  // the displayed amount from being deducted twice.
  const displayedSpendableBalance = calculateSpendableBalance(availableBalance, refundLockState.totalUnpaidSpend);
  const refundableBalance = walletSnapshot.refundableBalance;
  const availableToRefund = refundLockState.locked ? 0 : refundableBalance;
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
      note: [
        item.is_recurring ? formatRecurringTermDetail(null, item) : null,
        item.available_at ? `Available at ${new Date(item.available_at).toLocaleString()}` : null,
      ].filter(Boolean).join(' · ') || undefined,
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

    if (!Number.isFinite(amountInDollars) || amountInDollars < MIN_WALLET_TOPUP_AUD) {
      setTopupMinimumError(true);
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


  // All figures below are presentation-only and derive from the existing
  // reads/ledger. The wallet is pooled, not reserved per campaign.
  const walletMoney = (value: number | string | null | undefined) => {
    if (currency === 'AUD') {
      return formatAUD(value);
    }
    return formatMoney(value, currency);
  };
  const fundedCampaigns = liveAdRows.filter((ad) => {
    const status = String(ad.status || '').toLowerCase();
    const billing = String(ad.billing_state || '').toLowerCase();
    return Boolean(pauseNotices[ad.id]) || isFundingPaused(ad) || ['active', 'live'].includes(status) ||
      ['active', 'live'].includes(billing) ||
      Number(ad.spend || 0) > Number(ad.spend_transferred || 0);
  });
  const walletActivity = activity
    .filter((item) => !item.id.startsWith('payout-'))
    .filter((item) => {
      if (activityFilter === 'topups') return item.id.startsWith('topup-');
      if (activityFilter === 'spend') return item.id.startsWith('deduction-');
      if (activityFilter === 'refunds') return item.id.startsWith('refund-');
      return true;
    });
  const balanceReady = ['topups', 'refunds', 'deductions', 'lockState'].every(key => readState[key] === 'ready');
  const activityReady = ['topups', 'refunds', 'deductions'].every(key => readState[key] === 'ready');
  const sectionPlaceholder = (keys: string[]) => keys.some(key => readState[key] === 'error') ? (
    <div role="alert" className="p-4 text-xs text-amber-200">Could not load wallet data. <button type="button" className="underline" onClick={() => void refreshWalletState()}>Try again</button></div>
  ) : <div role="status" aria-label="Loading wallet data" className="my-3 h-16 animate-pulse rounded-xl bg-white/10"><span className="sr-only">Loading wallet data…</span></div>;
  const withdrawDisabled = refundLockState.locked || availableToRefund <= 0 || refundableTopups.length === 0;
  const refundReasonDisplay = currency === 'AUD'
    ? refundBlockReason.replace(/AUD\s/g, 'A$')
    : refundBlockReason;
  const withdrawDisabledReason = refundLockState.locked
    ? refundReasonDisplay
    : availableToRefund <= 0 || refundableTopups.length === 0
      ? 'No refundable top-up principal is available.'
      : null;

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[var(--background)] text-white">
      {liveAdRows.some(isFundingPaused) && <div role="status" className="mx-4 mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">A campaign is paused. If available funding ran low, it needs a top-up before you can resume it. Add funds, then review and resume it in Manage Campaigns. Adding funds does not resume it automatically.</div>}

      <div className="mx-auto max-w-[1080px] space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#63e8ee]">Affiliate finances</p>
            <h1 className="mt-1 text-[27px] font-semibold tracking-tight sm:text-[33px]">Ad wallet</h1>
            <p className="mt-1 text-xs text-slate-400">Your advertising funds, campaigns and transactions.</p>
          </div>
          <Link href="/affiliate/dashboard" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-300 transition hover:text-[#63e8ee]">
            Dashboard <ArrowUpRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="rounded-[24px] border border-white/[0.09] bg-[#151718] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.2)] sm:p-6" aria-labelledby="wallet-balance-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#00C2CB]/10 text-[#19d4dd]"><Wallet className="h-4 w-4" /></span>
                <h2 id="wallet-balance-heading" className="font-semibold">Available to spend</h2>
              </div>
              {balanceReady ? (<>
              <p className="mt-3 break-words text-[37px] font-semibold leading-none tracking-tight text-white sm:text-[45px]">{walletMoney(displayedSpendableBalance)}</p>
              <p className="mt-3 text-[11px] leading-5 text-slate-400">
                {walletMoney(refundLockState.totalUnpaidSpend)} pending Meta spend already deducted
                <span className="mx-2 text-slate-600">·</span>
                {walletMoney(availableToRefund)} refundable now
              </p>
              </>) : sectionPlaceholder(['topups', 'refunds', 'deductions', 'lockState'])}
              <p className="mt-1 max-w-lg text-[10px] leading-4 text-slate-500">Estimated from the latest stored Meta spend. Your actual wallet ledger is updated when that spend settles; the pending amount is not deducted twice.</p>
            </div>
            <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-auto sm:min-w-[255px]">
              <button type="button" onClick={() => {
                if (walletAction !== 'topup') { setBillingStatusLoading(true); setBillingStatus(null); }
                setWalletAction(walletAction === 'topup' ? null : 'topup');
              }}
                aria-expanded={walletAction === 'topup'} aria-controls="topup-wallet"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 text-xs font-bold text-[#0f0f0f] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB]">
                <ArrowDownLeft className="h-4 w-4" /> Add funds
              </button>
              <button type="button" onClick={() => setWalletAction(walletAction === 'withdraw' ? null : 'withdraw')}
                disabled={!balanceReady || withdrawDisabled} title={!balanceReady ? 'Waiting for wallet data' : withdrawDisabledReason || 'Refund credited principal to your original payment method'}
                aria-expanded={walletAction === 'withdraw'} aria-controls="refund-wallet"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB] disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowUpRight className="h-4 w-4" /> Withdraw
              </button>
            </div>
          </div>
          {balanceReady && withdrawDisabledReason ? (
            <p className="mt-4 flex items-start gap-2 border-t border-white/[0.07] pt-3 text-[11px] leading-5 text-amber-200">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {withdrawDisabledReason}
            </p>
          ) : null}
        </section>

        {topupQueryState === 'success' ? (
          <section role="status" className="rounded-[19px] border border-[#00C2CB]/20 bg-[#101415] p-4">
            <p className="text-xs font-semibold text-[#63e8ee]">{recentTopupActuals ? 'Top-up completed' : 'Top-up received — finalising fee details'}</p>
            {recentTopupActuals ? (
              <p className="mt-2 text-xs leading-6 text-slate-300">
                Credited {walletMoney(getCreditedTopupAmount(recentTopupActuals))}
                <span className="mx-2 text-slate-600">·</span>
                Nettmark fee {walletMoney(recentTopupActuals.nettmark_fee_amount)}
                <span className="mx-2 text-slate-600">·</span>
                Stripe fee {walletMoney(recentTopupActuals.stripe_fees)}
                <span className="mx-2 text-slate-600">·</span>
                Charged {walletMoney(getTopupChargedAmount(recentTopupActuals))}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Your payment is being reconciled. Actual fees will appear once Stripe has settled the charge.</p>
            )}
          </section>
        ) : topupQueryState === 'cancel' ? (
          <p className="rounded-[17px] border border-white/[0.09] bg-[#151718] p-3 text-xs text-slate-300">Top-up cancelled. Your wallet has not been credited from that checkout.</p>
        ) : null}

        {walletAction === 'topup' ? (
          <section id="topup-wallet" className="scroll-mt-8 rounded-[22px] border border-white/[0.09] bg-[#151718] p-4 sm:p-5" aria-labelledby="topup-heading">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="topup-heading" className="text-[15px] font-semibold">Add funds</h2>
                <p className="mt-1 text-xs text-slate-400">Choose the wallet credit you want to add.</p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-slate-300">{currency}</span>
            </div>
            <WalletBillingNotice loading={billingStatusLoading} error={billingError} ready={billingReady}
              onRetry={() => setBillingRetry(value => value + 1)} />
            <label htmlFor="wallet-topup-amount" className="mt-4 block text-[11px] font-semibold text-slate-300">Amount to credit ({currency})</label>
            <p id="wallet-topup-minimum" role={topupMinimumError ? "alert" : undefined}
              className={topupMinimumError ? "mt-1 text-xs text-amber-300" : "mt-1 text-xs text-slate-400"}>{WALLET_TOPUP_MINIMUM_MESSAGE}</p>
            <input id="wallet-topup-amount" type="number" min={MIN_WALLET_TOPUP_AUD} step="0.01"
              aria-describedby="wallet-topup-minimum" aria-invalid={topupMinimumError}
              placeholder="e.g. 25.00" value={amount} onChange={(event) => {
                const value = event.target.value;
                setAmount(value);
                setTopupMinimumError(!Number.isFinite(parseFloat(value)) || parseFloat(value) < MIN_WALLET_TOPUP_AUD);
              }}
              className="mt-2 w-full rounded-xl border border-white/[0.14] bg-[#101415] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#00C2CB]" />
            <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#101415] p-3 text-xs leading-5 text-slate-300">
              <p className="font-semibold">Fee preview</p>
              <p className="mt-1 text-slate-400">Nettmark {(NETTMARK_TRANSACTION_FEE_BPS / 100).toFixed(1)}% plus Stripe processing fees, charged on top of your wallet credit.</p>
              {topupPreview.principalAmount > 0 ? (
                <div className="mt-3 space-y-1">
                  <p>Wallet credit: {walletMoney(topupPreview.principalAmount)}</p>
                  <p>Nettmark fee: {walletMoney(topupPreview.feeAmount)}</p>
                  <p>Estimated Stripe fee: {walletMoney(topupPreview.stripeFeeAmount)}</p>
                  <p className="font-semibold text-white">Estimated total charged: {walletMoney(topupPreview.grossAmount)}</p>
                </div>
              ) : null}
              <p className="mt-1 text-[10px] text-slate-500">Final fees may differ slightly; the settled Stripe record is authoritative. Refunds apply only to credited principal.</p>
            </div>
            <button type="button" onClick={handleTopUp} disabled={loading || billingStatusLoading || !billingReady}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 text-sm font-bold text-[#0f0f0f] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              <CreditCard className="h-4 w-4" />
              {loading ? 'Redirecting…' : billingStatusLoading ? 'Checking billing…' : billingReady ? 'Continue to Stripe' : 'Connect billing in Settings first'}
            </button>
          </section>
        ) : null}

        {walletAction === 'withdraw' && balanceReady ? (
          <section id="refund-wallet" className="scroll-mt-8 rounded-[22px] border border-white/[0.09] bg-[#151718] p-4 sm:p-5" aria-labelledby="refund-heading">
            <h2 id="refund-heading" className="text-[15px] font-semibold">Withdraw unused funds</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">This is a refund to the original payment method, not a commission payout. Select a completed top-up and refund its remaining principal.</p>
            <p className="mt-3 rounded-xl border border-white/[0.08] bg-[#101415] p-3 text-xs text-slate-300">{refundReasonDisplay}</p>
            {refundableTopups.length > 0 ? (
              <div className="mt-4">
                <label htmlFor="wallet-refund-source" className="block text-[11px] font-semibold text-slate-300">Original top-up</label>
                <select id="wallet-refund-source" value={selectedTopupId ?? ''} onChange={(event) => setSelectedTopupId(event.target.value)}
                  disabled={refundLockState.locked}
                  className="mt-2 w-full rounded-xl border border-white/[0.14] bg-[#101415] px-3 py-3 text-xs text-slate-200 focus:border-[#00C2CB] disabled:opacity-50">
                  {refundableTopups.map((topup) => (
                    <option key={topup.stripe_id} value={topup.stripe_id}>
                      {walletMoney(getCreditedTopupAmount(topup) - toMoney(topup.amount_refunded))} · {new Date(topup.created_at).toLocaleDateString('en-AU')}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">No refundable top-ups are currently available.</p>
            )}
            <label htmlFor="wallet-refund-amount" className="mt-4 block text-[11px] font-semibold text-slate-300">Refund amount ({currency})</label>
            <input id="wallet-refund-amount" type="number" min="0" step="0.01" placeholder="0.00"
              value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)}
              disabled={refundLockState.locked}
              className="mt-2 w-full rounded-xl border border-white/[0.14] bg-[#101415] px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-[#00C2CB] disabled:opacity-50" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={handleWithdrawAll} disabled={refundLockState.locked}
                className="min-h-11 rounded-full border border-white/[0.14] bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 disabled:opacity-50">Withdraw all</button>
              <button type="button" onClick={handleRequestRefund} disabled={refundLoading || refundLockState.locked || refundableTopups.length === 0}
                className="min-h-11 rounded-full bg-[#00C2CB] px-3 text-xs font-bold text-[#0f0f0f] disabled:cursor-not-allowed disabled:opacity-50">
                {refundLoading ? 'Processing…' : 'Submit refund'}
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-[22px] border border-white/[0.09] bg-[#151718] p-4 sm:p-5" aria-labelledby="campaign-money-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="campaign-money-heading" className="text-[15px] font-semibold">Money in campaigns</h2>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">Meta-reported spend and spend waiting for wallet settlement.</p>
            </div>
            <Link href="/affiliate/dashboard/manage-campaigns" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#63e8ee]">
              All campaigns <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {readState.lockState !== 'ready' ? sectionPlaceholder(['lockState']) : fundedCampaigns.length ? (
            <div className="mt-4 divide-y divide-white/[0.07] overflow-hidden rounded-[17px] border border-white/[0.08] bg-[#101415]">
              {fundedCampaigns.map((ad) => {
                const unsettled = Math.max(0, toMoney(ad.spend) - toMoney(ad.spend_transferred));
                const isRunning = ['active', 'live'].includes(String(ad.status || '').toLowerCase());
                return (
                  <div key={ad.id} className="p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 w-full sm:w-auto sm:flex-1">
                        <p className="flex items-center gap-2 text-xs font-semibold text-white">
                          <span className={'h-2 w-2 shrink-0 rounded-full ' + (isRunning ? 'bg-emerald-400' : 'bg-amber-300')} />
                          Meta campaign · {ad.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 break-words text-[10px] leading-5 text-slate-400">{campaignStatusDetail(ad, pauseNotices[ad.id], unsettled, walletMoney)}</p>
                      </div>
                      <Link href={'/affiliate/dashboard/manage-campaigns/' + encodeURIComponent(ad.id)}
                        className="inline-flex min-h-8 items-center gap-1.5 text-[11px] font-semibold text-[#63e8ee]">
                        Open campaign <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/[0.06] bg-[#151718] px-3 py-2.5">
                        <p className="text-[10px] text-slate-400">Reported Meta spend</p>
                        <p className="mt-1 text-[13px] font-semibold text-white">{walletMoney(ad.spend)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#151718] px-3 py-2.5">
                        <p className="text-[10px] text-slate-400">Awaiting settlement</p>
                        <p className="mt-1 text-[13px] font-semibold text-white">{walletMoney(unsettled)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-[17px] border border-dashed border-white/[0.10] bg-[#101415] p-4 text-xs text-slate-400">No live campaigns. Your wallet funds aren't reserved for an active ad.</p>
          )}
          <p className="mt-3 text-[10px] leading-5 text-slate-500">
            Nettmark uses one shared wallet. Per-campaign funded balances, remaining days and Meta sync times aren't available in this wallet view, so they're not estimated here.
          </p>
        </section>

        <section className="rounded-[22px] border border-white/[0.09] bg-[#151718] p-4 sm:p-5" aria-labelledby="wallet-activity-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="wallet-activity-heading" className="text-[15px] font-semibold">Activity</h2>
              <p className="mt-1 text-[11px] text-slate-400">Credits, ad spend settlements and refunds.</p>
            </div>
            <span className="text-[11px] tabular-nums text-slate-500">{activityReady ? `${walletActivity.length} items` : '—'}</span>
          </div>
          <div role="group" aria-label="Filter wallet activity" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {([
              ['all', 'All'], ['topups', 'Top-ups'], ['spend', 'Ad spend'], ['refunds', 'Refunds / withdrawals'],
            ] as [ActivityFilter, string][]).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setActivityFilter(value)} aria-pressed={activityFilter === value}
                className={'min-h-9 shrink-0 rounded-full border px-3 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2CB] ' +
                  (activityFilter === value ? 'border-[#00C2CB]/60 bg-[#00C2CB] text-[#0f0f0f]' : 'border-white/[0.10] bg-[#101415] text-slate-300 hover:text-white')}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 divide-y divide-white/[0.07] overflow-hidden rounded-[17px] border border-white/[0.08] bg-[#101415]">
            {!activityReady ? sectionPlaceholder(['topups', 'refunds', 'deductions']) : walletActivity.length ? walletActivity.map((item) => {
              const credited = item.id.startsWith('topup-') &&
                ['succeeded', 'refunded'].includes(String(item.status).toLowerCase());
              const kind = item.id.startsWith('topup-') ? (credited ? 'Top-up' : 'Top-up processing')
                : item.id.startsWith('refund-') ? 'Refund to payment method'
                  : 'Ad spend settled';
              return (
                <details key={item.id} className="group p-3.5 open:bg-white/[0.02] sm:p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className={'grid h-9 w-9 shrink-0 place-items-center rounded-full ' + (credited ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.06] text-[#63e8ee]')}>
                      {item.positive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-100">{kind}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} · {item.status}</span>
                    </span>
                    <span className={'shrink-0 text-xs font-semibold tabular-nums ' + (credited ? 'text-emerald-300' : 'text-slate-200')}>
                      {item.positive ? (credited ? '+' : '') : '−'}{walletMoney(item.amount)}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 border-t border-white/[0.07] pt-3 text-[11px] leading-5 text-slate-400">
                    {item.note ? <p>{currency === 'AUD' ? item.note.replace(/AUD\s/g, 'A$') : item.note}</p> : null}
                    <p className="mt-1 break-all text-[10px] text-slate-500">Reference: {item.ref}</p>
                  </div>
                </details>
              );
            }) : (
              <p className="p-5 text-center text-xs text-slate-400">No transactions in this category yet.</p>
            )}
          </div>
          <p className="mt-3 text-[10px] text-slate-500">Commission earnings and payout receipts belong to your affiliate dashboard, not this ad wallet. Running balances aren't shown because wallet refunds and settlement records have different accounting timestamps.</p>
        </section>

        <details className="group rounded-[22px] border border-white/[0.09] bg-[#151718] p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-slate-200">
            <span className="inline-flex items-center gap-2"><CircleHelp className="h-4 w-4 text-[#19d4dd]" /> How the wallet works</span>
            <ChevronDown className="h-4 w-4 text-[#19d4dd] transition group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
            <p><strong className="text-slate-200">Top-ups:</strong> Wallet credit is the amount you choose. Nettmark adds a transaction fee and passes through Stripe processing charges; exact amounts are shown before checkout.</p>
            <p><strong className="text-slate-200">Ad spend:</strong> Meta charges the business ad account; Nettmark periodically records the reported spend, deducts it from your wallet, then transfers reimbursement to the business. Syncing and settlement aren't instant.</p>
            <p><strong className="text-slate-200">Unused funds:</strong> Pausing or ending an ad stops new delivery, but refunds are available only when no active Meta ads or unsettled spend remain. Eligible principal is returned to the original payment method.</p>
          </div>
        </details>
      </div>
    </main>
  );
}
