'use client';

import '@/globals.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import toast from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

// ---- Icons (inline, no extra deps) ----
const IconUsers = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 14a4 4 0 10-8 0v1a4 4 0 004 4 4 4 0 004-4v-1z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7a3 3 0 110-6 3 3 0 010 6z" />
  </svg>
);
const IconPuzzle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8a2 2 0 012 2v4h-3a2 2 0 100 4h3v4a2 2 0 01-2 2H8v-3a2 2 0 10-4 0V5a2 2 0 012-2h2z" />
  </svg>
);
const IconBolt = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 11-12h-7l0-8z" />
  </svg>
);
const IconCreditCard = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M3 9h18" />
  </svg>
);
const IconBank = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-6 9 6M4 10h16v8H4zM2 18h20" />
  </svg>
);
const IconPlus = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
  </svg>
);
const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconStorefront = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l2-4h14l2 4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6v6H9z" />
  </svg>
);

// New icon: Simple document with folded corner
const IconPost = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <polyline points="15 3 15 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 3l5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// New icon: Simple megaphone / speaker
const IconMegaphone = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 11v2a2 2 0 002 2h2l7 4v-16l-7 4H5a2 2 0 00-2 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8.5a4 4 0 010 7" />
  </svg>
);

// ---- Small UI helpers ----
function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C2CB1a] text-[#7ff5fb]">
            {icon}
          </div>
          <h3 className="font-semibold text-sm text-white">{title}</h3>
        </div>
      </div>
      <div className="p-5 pt-4">{children}</div>
    </div>
  );
}
function ActionButton({
  children,
  onClick,
  disabled,
  secondary,
  size = 'md',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  size?: 'sm' | 'md';
}) {
  const base =
    'w-full inline-flex items-center justify-center rounded-full font-medium transition will-change-transform hover:-translate-y-[1px]';
  const styles = secondary
    ? 'bg-transparent border border-[#00C2CB]/30 text-white hover:bg-[#0f1415]'
    : 'bg-[#00C2CB] text-black hover:bg-[#00b0b8]';
  const sizeCls =
    size === 'sm'
      ? 'min-h-[40px] text-sm px-5 py-2 gap-2'
      : 'min-h-[56px] text-base px-6 py-3 gap-3';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${sizeCls} disabled:opacity-50 whitespace-nowrap`}
    >
      {children}
    </button>
  );
}

interface Offer {
  id: string;
  title: string;
  description: string;
  commission: number;
  type: string;
}

export default function MyBusinessPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState<boolean>(true);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessCustomerId, setBusinessCustomerId] = useState<string | null>(null);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [businessAccountId, setBusinessAccountId] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
  const [hasCard, setHasCard] = useState<boolean>(false);
  // Meta connection status
  const [metaConnected, setMetaConnected] = useState<boolean>(false);

  const session = useSession();
  const user = session?.user;
  const supabase = createClientComponentClient();

  // Helper to safely parse JSON or fallback to text for error messages
  async function parseJsonSafe(res: Response) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        return await res.json();
      } catch {
        return { error: 'Invalid JSON in response' };
      }
    }
    const text = await res.text();
    return { error: text?.slice(0, 500) || 'Non-JSON response' };
  }

  useEffect(() => {
    if (!session || !user?.email) return;

    const fetchOffers = async () => {
      setOffersLoading(true);
      const { data, error } = await supabase
        .from('offers')
        .select('id,title,description,commission,type')
        .eq('business_email', user.email);

      if (error) {
        console.error('[❌ Error fetching business offers]', error.message);
        setOffers([]);
      } else {
        setOffers(data ? (data as Offer[]) : []);
      }
      setOffersLoading(false);
    };

    fetchOffers();
  }, [session, user, supabase]);

  useEffect(() => {
    if (!session || !user?.email) return;
    const loadStripeCustomerId = async () => {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('stripe_customer_id, stripe_account_id, stripe_onboarding_complete')
        .eq('business_email', user.email)
        .single();
      if (error) {
        console.log('[ℹ️ No business profile yet or error loading stripe_customer_id]', error.message);
        return;
      }
      if (data?.stripe_customer_id) {
        setBusinessCustomerId(data.stripe_customer_id as string);
        try {
          const key = `nm_has_card_${data?.stripe_customer_id}`;
          const cached = key ? localStorage.getItem(key) : null;
          if (cached === 'true') setHasCard(true);
        } catch (_e) {}
      }
      if (data?.stripe_account_id) setBusinessAccountId(data.stripe_account_id as string);
      if (typeof data?.stripe_onboarding_complete === 'boolean') {
        setOnboardingComplete(!!data.stripe_onboarding_complete);
      }
    };
    loadStripeCustomerId();
  }, [session, user, supabase]);

  // Meta connection status effect
  useEffect(() => {
    if (!session || !user?.email) return;

    const fetchMetaConnection = async () => {
      try {
        const { data, error } = await supabase
          .from('meta_connections')
          .select('id')
          .eq('business_email', user.email)
          .single();

        if (error) {
          // If no row exists, Supabase will throw an error; treat that as "not connected"
          // Only log unexpected errors
          const err: any = error;
          if (err?.code && err.code !== 'PGRST116') {
            console.warn('[Meta connection check error]', error.message || error);
          }
          setMetaConnected(false);
          return;
        }

        setMetaConnected(!!data);
      } catch (e: any) {
        console.error('[Meta connection check exception]', e?.message || e);
        setMetaConnected(false);
      }
    };

    fetchMetaConnection();
  }, [session, user, supabase]);

  useEffect(() => {
    if (showPaymentForm && businessCustomerId && !setupClientSecret) {
      (async () => {
        try {
          const res = await fetch('/api/stripe/create-setup-intent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ customerId: businessCustomerId }),
          });
          const data = await parseJsonSafe(res);
          if (res.ok && data?.clientSecret) {
            setSetupClientSecret(data.clientSecret);
          } else {
            console.error('[SetupIntent error]', data?.error || 'Unknown error');
          }
        } catch (e) {
          console.error('[SetupIntent exception]', e);
        }
      })();
    }
  }, [showPaymentForm, businessCustomerId, setupClientSecret]);

  // ---- Derived readiness + onboarding gates ----
  const payoutsReady = !!onboardingComplete;
  const billingReady = !!businessCustomerId && !!hasCard;
  const readyForOffer = payoutsReady && billingReady;
  const hasAnyOffer = offers.length > 0;

  // TEMP: disable onboarding gate for prod testing
  const ignoreOnboardingGate = true;

  // Show checklist until: payouts + billing + at least one offer exist
  const showOnboardingChecklist = ignoreOnboardingGate
    ? false
    : !payoutsReady || !billingReady || !hasAnyOffer;

  // Main cards (Affiliates / Meta / Billing) should always show while gate is bypassed
  const showBillingCard = ignoreOnboardingGate ? true : !showOnboardingChecklist;
  const showMetaCard = ignoreOnboardingGate ? true : !showOnboardingChecklist;
  const showAffiliatesCard = ignoreOnboardingGate ? true : !showOnboardingChecklist;

  // For now, allow creating offers even if payouts/billing aren't connected when gate is bypassed
  const canCreateOffer = ignoreOnboardingGate ? true : readyForOffer;

  const handleDelete = async (id: string) => {
    console.log('[🗑 Attempting to delete offer]', id);
    setLoadingDeleteId(id);
    try {
      const { error: deleteError } = await supabase.from('offers').delete().eq('id', id);
      if (deleteError) throw deleteError;

      const updatedOffers = offers.filter((offer) => offer.id !== id);
      setOffers(updatedOffers);
      localStorage.setItem('my-offers', JSON.stringify(updatedOffers));
      localStorage.setItem('marketplace-offers', JSON.stringify(updatedOffers));
      console.log('[✅ Offer deleted and offers updated]');
    } catch (err: any) {
      console.error('[❌ Delete Error]', err.message || err);
    } finally {
      setLoadingDeleteId(null);
    }
  };

  async function handleConnectBilling() {
    try {
      setIsSubmitting(true);
      const email = user?.email;
      if (!email) throw new Error('Missing business email');
      const name = 'Business';
      const res = await fetch('/api/stripe/create-customer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.customerId) throw new Error(data?.error || 'Failed to create Stripe customer');

      const { data: updRows, error: upErr } = await supabase
        .from('business_profiles')
        .update({ stripe_customer_id: data.customerId })
        .eq('business_email', email)
        .select('id');

      if (upErr) throw new Error(upErr.message || 'Failed to save Stripe customer ID');

      if (!updRows || updRows.length === 0) {
        const { error: insErr } = await supabase
          .from('business_profiles')
          .insert({
            business_email: email,
            stripe_customer_id: data.customerId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (insErr) throw new Error(insErr.message || 'Failed to create business profile');
      }

      setBusinessCustomerId(data.customerId);
      toast.success('Billing connected (Stripe Customer created)');
    } catch (e: any) {
      console.error('[Connect billing error]', e);
      toast.error(e.message || 'Stripe error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEnablePayouts() {
    try {
      const res = await fetch('/api/stripe/create-account', { method: 'POST' });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Failed to start payouts onboarding');
      window.location.href = data.url;
    } catch (e: any) {
      console.error('[Enable payouts error]', e);
      toast.error(e?.message || 'Stripe error');
    }
  }

  async function handleRefreshPayoutStatus() {
    try {
      const res = await fetch('/api/stripe/check-account', { method: 'POST' });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to check payouts status');
      if (data?.onboardingComplete) {
        setOnboardingComplete(true);
        toast.success('Payouts enabled ✅');
      } else {
        toast('Still pending Stripe onboarding', { icon: '⏳' });
      }
    } catch (e: any) {
      console.error('[Refresh payouts status error]', e);
      toast.error(e?.message || 'Stripe error');
    }
  }

  async function handleAddPaymentMethod() {
    try {
      if (!businessCustomerId) throw new Error('No Stripe customer connected');
      const res = await fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customerId: businessCustomerId }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.clientSecret) throw new Error(data?.error || 'Failed to create SetupIntent');
      setSetupClientSecret(data.clientSecret);
      setShowPaymentForm(true);
      toast.success('Secure card form ready below');
    } catch (e: any) {
      console.error('[Add payment method error]', e);
      toast.error(e.message || 'Stripe error');
    }
  }

  function AddCardForm({ onComplete }: { onComplete: () => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      setSubmitting(true);
      try {
        const result = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url: window.location.href,
          },
          redirect: 'if_required',
        });
        if (result.error) {
          toast.error(result.error.message || 'Card setup failed');
        } else {
          toast.success('Card saved');
          try {
            const cust = businessCustomerId ? `nm_has_card_${businessCustomerId}` : null;
            if (cust) localStorage.setItem(cust, 'true');
          } catch (_) {}
          setHasCard(true);
          onComplete();
        }
      } catch (err: any) {
        console.error('[confirmSetup error]', err);
        toast.error(err?.message || 'Stripe error');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="bg-[#111] border border-[#00C2CB]/20 rounded-xl p-4 mt-4">
        <div className="mb-4">
          <PaymentElement />
        </div>
        <button
          type="submit"
          disabled={submitting || !stripe || !elements}
          className="w-full flex items-center justify-center gap-2 bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold px-4 py-3 rounded-md"
        >
          {submitting ? 'Saving…' : 'Save Card'}
        </button>
      </form>
    );
  }

  return (
    <>
      {console.log("MyBusinessPage mounted")}
      <div className="bg-[#0a0a0a] text-white px-6 py-10 min-h-screen">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#7ff5fb] to-[#00C2CB]">
          Business control hub
        </h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
          <svg
            className="w-4 h-4 text-[#00C2CB]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8c-1.333-1.333-4-1-4 2s2.667 4 4 4 4-1.333 4-4-2.667-3.333-4-2zm0 0V6m0 10v2"
            />
          </svg>
          <span>Manage affiliates, Meta integration, and billing for your Nettmark offers — all in one place.</span>
        </p>
      </div>

      {/* ===== Onboarding Checklist (stays until payouts + billing + at least one offer) ===== */}
      {showOnboardingChecklist && (
        <div className="max-w-5xl mx-auto mb-8 rounded-2xl border border-[#00C2CB]/20 bg-[#101314] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Finish setting up your account</h2>
              <p className="text-sm text-gray-400">
                Complete payouts and billing. Tracking can be verified after your first pixel ping.
              </p>
            </div>
            <div className="text-xs px-3 py-1 rounded-full bg-[#00C2CB]/15 text-[#7ff5fb] border border-[#00C2CB]/25">
              {(payoutsReady ? 1 : 0) + (billingReady ? 1 : 0)} / 2 complete
            </div>
          </div>

          <div className="space-y-3">
            {/* Payouts item */}
            <div className="flex items-center justify-between rounded-xl border border-[#1f2a2b] bg-[#0e1112] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`inline-block w-3 h-3 rounded-full ${payoutsReady ? 'bg-green-500' : 'bg-[#334649]'}`} />
                <div>
                  <div className="text-white font-medium">Connect payouts</div>
                  <div className="text-xs text-gray-400">Secure Stripe Connect so affiliates can be paid.</div>
                </div>
              </div>
              <div className="flex gap-2">
                {!payoutsReady && (
                  <>
                    <button
                      onClick={handleEnablePayouts}
                      className="px-3 py-2 rounded-md bg-[#00C2CB] text-black text-sm hover:bg-[#00b0b8]"
                    >
                      Connect
                    </button>
                    {businessAccountId && !onboardingComplete && (
                      <button
                        onClick={handleRefreshPayoutStatus}
                        className="px-3 py-2 rounded-md border border-[#00C2CB]/40 text-white text-sm hover:bg-[#0f1415]"
                      >
                        Refresh
                      </button>
                    )}
                  </>
                )}
                {payoutsReady && <span className="text-green-400 text-sm">Enabled</span>}
              </div>
            </div>

            {/* Billing item */}
            <div className="flex items-center justify-between rounded-xl border border-[#1f2a2b] bg-[#0e1112] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`inline-block w-3 h-3 rounded-full ${billingReady ? 'bg-green-500' : 'bg-[#334649]'}`} />
                <div>
                  <div className="text-white font-medium">Add a payment method</div>
                  <div className="text-xs text-gray-400">
                    Create a Stripe Customer and save a card for commissions &amp; ad spend transfers.
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {!businessCustomerId && (
                  <button
                    onClick={handleConnectBilling}
                    className="px-3 py-2 rounded-md bg-[#00C2CB] text-black text-sm hover:bg-[#00b0b8]"
                  >
                    Connect billing
                  </button>
                )}
                {businessCustomerId && !hasCard && (
                  <button
                    onClick={handleAddPaymentMethod}
                    className="px-3 py-2 rounded-md border border-[#00C2CB]/40 text-white text-sm hover:bg-[#0f1415]"
                  >
                    Add card
                  </button>
                )}
                {billingReady && <span className="text-green-400 text-sm">Ready</span>}
              </div>
            </div>

            {businessCustomerId && showPaymentForm && setupClientSecret && (
              <div className="mt-4">
                <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                  <AddCardForm
                    onComplete={() => {
                      setShowPaymentForm(false);
                    }}
                  />
                </Elements>
              </div>
            )}

            {/* Tracking hint */}
            <div className="flex items-center justify-between rounded-xl border border-[#1f2a2b] bg-[#0e1112] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="inline-block w-3 h-3 rounded-full bg-[#334649]" />
                <div>
                  <div className="text-white font-medium">Install &amp; verify tracking</div>
                  <div className="text-xs text-gray-400">
                    Optional to create your offer. We auto-verify once the pixel fires.
                  </div>
                </div>
              </div>
              {canCreateOffer ? (
                <Link
                  href="/business/my-business/create-offer?onboard=tracking"
                  className="px-3 py-2 rounded-md border border-[#00C2CB]/40 text-white text-sm hover:bg-[#0f1415]"
                >
                  View instructions
                </Link>
              ) : (
                <button
                  disabled
                  className="px-3 py-2 rounded-md border border-[#00C2CB]/15 text-gray-500 text-sm cursor-not-allowed bg-transparent"
                >
                  View instructions
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Action sections (grouped) ===== */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {/* Affiliates */}
        {showAffiliatesCard && (
          <SectionCard title="Affiliates" icon={<IconUsers className="w-4 h-4" />}>
            <div className="space-y-4">
              <p className="text-xs text-white/70">
                Approve partners, review post ideas, and keep an eye on what affiliates are planning to run.
              </p>

              <div className="space-y-3">
                <Link href="/business/my-business/affiliate-requests" prefetch={false}>
                  <ActionButton size="sm">
                    <IconUsers className="w-5 h-5 shrink-0" />
                    <span>Affiliate requests</span>
                  </ActionButton>
                </Link>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link href="/business/my-business/post-ideas/" prefetch={false}>
                    <ActionButton size="sm" secondary>
                      View post ideas
                    </ActionButton>
                  </Link>
                  <Link href="/business/my-business/ad-ideas/" prefetch={false}>
                    <ActionButton size="sm" secondary>
                      View ad ideas
                    </ActionButton>
                  </Link>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Meta Integration */}
        {showMetaCard && (
          <SectionCard title="Meta Integration" icon={<IconPuzzle className="w-4 h-4" />}>
            <div className="space-y-4">
              <p className="text-xs text-white/70">
                Connect your Meta assets and keep tracking + creatives aligned with your Nettmark offers.
              </p>

              {/* Meta connection status */}
              <div className="flex items-center justify-between rounded-full border border-[#1f2a2b] bg-[#0e1112] px-3 py-2 text-[11px] text-white/70">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      metaConnected ? 'bg-emerald-400' : 'bg-[#f97316]'
                    }`}
                  />
                  <span>{metaConnected ? 'Meta connected' : 'Meta not connected'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Link href="/business/my-business/connect-meta/" prefetch={false}>
                  <ActionButton size="sm">
                    <IconBolt className="w-5 h-5 shrink-0" />
                    <span>{metaConnected ? 'Manage Meta connection' : 'Connect Meta ads'}</span>
                  </ActionButton>
                </Link>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link href="/business/setup-tracking">
                    <ActionButton size="sm" secondary>
                      Setup tracking
                    </ActionButton>
                  </Link>
                  <Link href="/business/my-business/publish-creatives/" prefetch={false}>
                    <ActionButton size="sm" secondary>
                      Publish creatives
                    </ActionButton>
                  </Link>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Billing */}
        {showBillingCard && (
          <SectionCard title="Billing" icon={<IconCreditCard className="w-4 h-4" />}>
            <div className="space-y-4">
              <p className="text-xs text-white/70">
                Billing and payouts are handled via Stripe. Once connected, affiliates are paid automatically.
              </p>
              <div className="flex flex-col items-center gap-3 mt-2">
                <div className="w-full max-w-xs">
                  <div
                    className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium border ${
                      billingReady
                        ? 'border-emerald-400/60 text-emerald-300 bg-emerald-500/10'
                        : 'border-white/10 text-white/70 bg-white/5'
                    }`}
                  >
                    <IconCreditCard className="w-4 h-4" />
                    <span>{billingReady ? 'Billing connected' : 'Billing not connected'}</span>
                  </div>
                </div>
                <div className="w-full max-w-xs">
                  <div
                    className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium border ${
                      payoutsReady
                        ? 'border-emerald-400/60 text-emerald-300 bg-emerald-500/10'
                        : 'border-white/10 text-white/70 bg-white/5'
                    }`}
                  >
                    <IconBank className="w-4 h-4" />
                    <span>{payoutsReady ? 'Payouts enabled' : 'Payouts not enabled'}</span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ===== Offers ===== */}
      <div className="mt-6 mb-12 max-w-6xl mx-auto">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-[#00C2CB]">
            <IconStorefront className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-medium text-[#00C2CB] text-center">
              Manage your marketplace offers
            </h2>
          </div>
          {canCreateOffer ? (
            <Link href="/business/my-business/create-offer/" prefetch={false}>
              <ActionButton size="sm">
                <IconPlus className="w-4 h-4" />
                <span>New offer</span>
              </ActionButton>
            </Link>
          ) : (
            <div className="group">
              <ActionButton size="sm" disabled>
                <IconPlus className="w-4 h-4" />
                <span>New offer</span>
              </ActionButton>
              <p className="mt-2 text-xs text-gray-400 text-center">
                Complete payouts and add a card to create an offer. Tracking can be done after.
              </p>
            </div>
          )}
        </div>

        {offersLoading ? (
          <p className="text-gray-400 text-center text-sm">Loading your offers…</p>
        ) : offers.length === 0 ? (
          <p className="text-gray-400 text-center">You haven't uploaded any offers yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.7)] transition hover:border-[#00C2CB]/60 hover:shadow-[0_22px_60px_rgba(0,0,0,0.95)]"
              >
                {/* Soft glow accent */}
                <div
                  className="pointer-events-none absolute inset-x-0 -top-16 h-24 opacity-40 blur-3xl"
                  style={{
                    background:
                      'radial-gradient(40% 80% at 10% 0%, rgba(0,194,203,0.35), transparent 60%), radial-gradient(40% 80% at 90% 0%, rgba(127,245,251,0.18), transparent 60%)',
                  }}
                />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00C2CB1a] text-[#7ff5fb]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 7v13h18V7M5 10h14M10 21V3h4v18"
                        />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-[#7ff5fb]">{offer.title}</h2>
                      <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-white/40">
                        {offer.type === 'recurring' ? 'Recurring offer' : 'One-time offer'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                      Commission
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-semibold text-white">{offer.commission}</span>
                      <span className="text-sm font-medium text-white/60">%</span>
                    </div>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                        offer.type === 'recurring'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                          : 'bg-amber-500/15 text-amber-200 border border-amber-400/40'
                      }`}
                    >
                      {offer.type === 'recurring' ? 'Recurring' : 'One-Time'}
                    </span>
                  </div>
                </div>

                <p className="relative mt-4 text-sm text-white/70">{offer.description}</p>

                <div className="relative mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href={`/business/my-business/edit-offer/${offer.id}/`} prefetch={false}>
                    <button className="inline-flex w-full items-center justify-center rounded-full bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_25px_rgba(0,194,203,0.45)] hover:bg-[#00b0b8] sm:w-auto">
                      Edit Offer
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(offer.id)}
                    disabled={loadingDeleteId === offer.id}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {loadingDeleteId === offer.id ? 'Deleting…' : 'Delete Offer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
