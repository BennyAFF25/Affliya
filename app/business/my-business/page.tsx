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

// ---- Small UI helpers ----
function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#00C2CB]/20 bg-[#1F1F1F] shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#00C2CB]/15">
        <div className="text-[#00C2CB]">{icon}</div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
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
    'w-full flex items-center justify-center gap-2 rounded-full px-4 py-3 font-medium transition will-change-transform hover:-translate-y-[1px]';
  const styles = secondary
    ? 'bg-transparent border border-[#00C2CB]/30 text-white hover:bg-[#0f1415]'
    : 'bg-[#00C2CB] text-black hover:bg-[#00b0b8]';
  const sizeCls = size === 'sm' ? 'min-h-[44px] text-sm' : 'min-h-[56px] text-base';
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
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessCustomerId, setBusinessCustomerId] = useState<string | null>(null);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [businessAccountId, setBusinessAccountId] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
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
    // Fallback: read text (likely an HTML error page) so we can surface it
    const text = await res.text();
    return { error: text?.slice(0, 500) || 'Non-JSON response' };
  }

  useEffect(() => {
    if (!user?.email) return;

    const fetchOffers = async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('id,title,description,commission,type')
        .eq('business_email', user.email);

      if (error) {
        console.error('[❌ Error fetching business offers]', error.message);
      } else {
        setOffers(data ? (data as Offer[]) : []);
      }
    };

    fetchOffers();
  }, [user]);

  useEffect(() => {
    if (!user?.email) return;
    const loadStripeCustomerId = async () => {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('stripe_customer_id, stripe_account_id, stripe_onboarding_complete')
        .eq('business_email', user.email)
        .single();
      if (error) {
        // It's okay if not found; just means not connected yet
        console.log('[ℹ️ No business profile yet or error loading stripe_customer_id]', error.message);
        return;
      }
      if (data?.stripe_customer_id) {
        setBusinessCustomerId(data.stripe_customer_id as string);
      }
      if (data?.stripe_account_id) setBusinessAccountId(data.stripe_account_id as string);
      if (typeof data?.stripe_onboarding_complete === 'boolean') setOnboardingComplete(!!data.stripe_onboarding_complete);
    };
    loadStripeCustomerId();
  }, [user]);

  const handleDelete = async (id: string) => {
    console.log('[🗑 Attempting to delete offer]', id);
    setLoadingDeleteId(id);
    try {
      const { error: deleteError } = await supabase.from('offers').delete().eq('id', id);
      if (deleteError) throw deleteError;

      // Optimistically remove from UI and update localStorage
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
      // 2) Try to update existing business row; if none, insert a new one
      const { data: updRows, error: upErr } = await supabase
        .from('business_profiles')
        .update({ stripe_customer_id: data.customerId })
        .eq('business_email', email)
        .select('id'); // returns updated rows

      if (upErr) throw new Error(upErr.message || 'Failed to save Stripe customer ID');

      if (!updRows || updRows.length === 0) {
        // No existing row -> create one now
        const { error: insErr } = await supabase
          .from('business_profiles')
          .insert({
            business_email: email,
            stripe_customer_id: data.customerId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
      window.location.href = data.url; // redirect to Stripe onboarding
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
            // Optionally collect billing details here
            return_url: window.location.href, // not used in modal-less flow but required by type
          },
          redirect: 'if_required',
        });
        if (result.error) {
          toast.error(result.error.message || 'Card setup failed');
        } else {
          toast.success('Card saved');
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
    <div className="bg-[#0a0a0a] text-white px-6 py-10 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mb-4" />
        <div className="flex items-center justify-center gap-2 text-gray-500 mb-6">
          <svg
            className="w-5 h-5 text-[#00C2CB]"
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
          <span className="text-sm sm:text-base text-center">
            Manage your offers, creatives, and Meta integration — all in one place.
          </span>
        </div>
      </div>

      {/* ===== Action sections (grouped) ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Affiliates */}
        <SectionCard title="Affiliates" icon={<IconUsers className="w-5 h-5" />}>
          <div className="space-y-3">
            <Link href="/business/my-business/affiliate-requests">
              <ActionButton secondary>
                <IconCheck className="w-4 h-4 text-[#00C2CB]" />
                <span>Affiliate Requests</span>
              </ActionButton>
            </Link>
            <Link href="/business/my-business/post-ideas">
              <ActionButton secondary>
                <span className="text-[#00C2CB]">•</span>
                <span>View Post Ideas</span>
              </ActionButton>
            </Link>
            <Link href="/business/my-business/ad-ideas">
              <ActionButton secondary>
                <span className="text-[#00C2CB]">≡</span>
                <span>View Ad Ideas</span>
              </ActionButton>
            </Link>
          </div>
        </SectionCard>

        {/* Meta Integration */}
        <SectionCard title="Meta Integration" icon={<IconPuzzle className="w-5 h-5" />}>
          <div className="space-y-3">
            <Link href="/business/my-business/connect-meta">
              <ActionButton secondary>
                <span className="rotate-180 text-[#00C2CB]">↪</span>
                <span>Connect Meta Ads</span>
              </ActionButton>
            </Link>
            <Link href="/business/setup-tracking">
              <ActionButton secondary>
                <IconBolt className="w-4 h-4 text-[#00C2CB]" />
                <span>Setup Tracking</span>
              </ActionButton>
            </Link>
            <Link href="/business/my-business/publish-creatives">
              <ActionButton secondary>
                <span className="text-[#00C2CB]">⭳</span>
                <span>Publish Creatives</span>
              </ActionButton>
            </Link>
          </div>
        </SectionCard>

        {/* Billing */}
        <SectionCard title="Billing" icon={<IconCreditCard className="w-5 h-5" />}>
          <div className="space-y-3">
            {user?.email && (
              <ActionButton onClick={handleConnectBilling} disabled={isSubmitting} secondary={!(!businessCustomerId)}>
                <IconCreditCard className="w-4 h-4" />
                <span>{businessCustomerId ? 'Billing connected' : (isSubmitting ? 'Connecting…' : 'Connect billing')}</span>
              </ActionButton>
            )}
            {businessCustomerId && (
              <ActionButton onClick={handleAddPaymentMethod} secondary>
                <IconCreditCard className="w-4 h-4" />
                <span>Add Payment Method</span>
              </ActionButton>
            )}
            {showPaymentForm && setupClientSecret && (
              <div className="mt-2">
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret: setupClientSecret, appearance: { theme: 'night' } }}
                >
                  <AddCardForm onComplete={() => { setShowPaymentForm(false); setSetupClientSecret(null); }} />
                </Elements>
              </div>
            )}
            {/* Payouts controls (moved from Payouts card) */}
            <div className="border-t border-[#00C2CB]/10 pt-4 mt-4 space-y-3">
              {!businessAccountId && (
                <ActionButton onClick={handleEnablePayouts} secondary>
                  <IconBank className="w-4 h-4" />
                  <span>Enable payouts</span>
                </ActionButton>
              )}
              {businessAccountId && !onboardingComplete && (
                <>
                  <ActionButton onClick={handleEnablePayouts} secondary>
                    <IconBank className="w-4 h-4" />
                    <span>Resume payouts onboarding</span>
                  </ActionButton>
                  <ActionButton onClick={handleRefreshPayoutStatus} secondary>
                    <IconCheck className="w-4 h-4 text-[#00C2CB]" />
                    <span>Refresh payouts status</span>
                  </ActionButton>
                </>
              )}
              {businessAccountId && onboardingComplete && (
                <div className="w-full flex items-center justify-center gap-2 rounded-full px-4 py-3 border border-green-500/60 text-green-400">
                  <IconCheck className="w-4 h-4" />
                  <span>Payouts enabled</span>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

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
          <Link href="/business/my-business/create-offer">
            <ActionButton size="sm">
              <IconPlus className="w-4 h-4" />
              <span>New offer</span>
            </ActionButton>
          </Link>
        </div>

        {offers.length === 0 ? (
          <p className="text-gray-400 text-center">You haven't uploaded any offers yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="bg-[#1F1F1F] border border-[#00C2CB]/20 hover:border-[#00C2CB]/40 shadow-sm hover:shadow-lg transition rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-[#00C2CB] bg-[#e0fafa] p-2 rounded-full">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 7v13h18V7M5 10h14M10 21V3h4v18"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-[#00C2CB]">{offer.title}</h2>
                </div>
                <p className="text-gray-300 mb-2">{offer.description}</p>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-gray-400">Commission:</span>
                  <span className="text-sm font-semibold text-white">{offer.commission}%</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      offer.type === 'recurring'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-yellow-100 text-yellow-600'
                    }`}
                  >
                    {offer.type === 'recurring' ? 'Recurring' : 'One-Time'}
                  </span>
                </div>

                <div className="flex gap-3">
                  <Link href={`/business/my-business/edit-offer/${offer.id}`}>
                    <button className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold py-2 px-4 rounded shadow">
                      Edit Offer
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(offer.id)}
                    disabled={loadingDeleteId === offer.id}
                    className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded shadow"
                  >
                    {loadingDeleteId === offer.id ? 'Deleting...' : 'Delete Offer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}