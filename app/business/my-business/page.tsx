"use client";

import "@/globals.css";
import AcceptTermsModal from "@/../app/components/AcceptTermsModal";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import toast from "react-hot-toast";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

// ---- Icons (inline, no extra deps) ----
const IconUsers = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 14a4 4 0 10-8 0v1a4 4 0 004 4 4 4 0 004-4v-1z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 7a3 3 0 110-6 3 3 0 010 6z"
    />
  </svg>
);
const IconPuzzle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 3h8a2 2 0 012 2v4h-3a2 2 0 100 4h3v4a2 2 0 01-2 2H8v-3a2 2 0 10-4 0V5a2 2 0 012-2h2z"
    />
  </svg>
);
const IconBolt = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 2L3 14h7l-1 8 11-12h-7l0-8z"
    />
  </svg>
);
const IconCreditCard = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M3 9h18" />
  </svg>
);
const IconBank = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 10l9-6 9 6M4 10h16v8H4zM2 18h20"
    />
  </svg>
);
const IconPlus = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
  </svg>
);
const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconSpinner = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12a9 9 0 11-6.219-8.56"
    />
  </svg>
);
const IconStorefront = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l2-4h14l2 4" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 9h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6v6H9z" />
  </svg>
);

// New icon: Simple document with folded corner
const IconPost = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <polyline
      points="15 3 15 8 20 8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M15 3l5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// New icon: Simple megaphone / speaker
const IconMegaphone = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 11v2a2 2 0 002 2h2l7 4v-16l-7 4H5a2 2 0 00-2 2z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 8.5a4 4 0 010 7"
    />
  </svg>
);

// ---- Small UI helpers ----
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_0_40px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/15 text-[var(--primary)]">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h3>
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
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  size?: "sm" | "md";
}) {
  const base =
    "w-full inline-flex items-center justify-center rounded-full font-medium transition will-change-transform hover:-translate-y-[1px]";
  const styles = secondary
    ? "border border-[var(--primary)]/30 bg-transparent text-[var(--foreground)] hover:bg-[var(--card)]"
    : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110";
  const sizeCls =
    size === "sm"
      ? "min-h-[40px] text-sm px-5 py-2 gap-2"
      : "min-h-[56px] text-base px-6 py-3 gap-3";
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
  site_host?: string | null;
  meta_page_id?: string | null;
  meta_ad_account_id?: string | null;
  meta_pixel_id?: string | null;
}

function getOfferMetaStatus(offer: Offer) {
  if (offer.meta_page_id && offer.meta_ad_account_id && offer.meta_pixel_id) {
    return {
      label: "Ads enabled",
      tone: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40",
      helper: "This offer can run organic and paid Meta campaigns, including sales.",
      needsSetup: false,
      actionLabel: "Ads enabled",
    };
  }

  if (offer.meta_page_id && offer.meta_ad_account_id) {
    return {
      label: "Ads enabled",
      tone: "bg-cyan-500/15 text-cyan-200 border border-cyan-400/40",
      helper: "Affiliates can run ads for this offer. Add a pixel if you want sales campaigns too.",
      needsSetup: true,
      actionLabel: "Add sales pixel",
    };
  }

  if (offer.meta_page_id || offer.meta_ad_account_id || offer.meta_pixel_id) {
    return {
      label: "Organic only",
      tone: "bg-amber-500/15 text-amber-200 border border-amber-400/40",
      helper: "This offer is still marketplace-visible, but affiliates should only use organic promotion until Meta setup is finished.",
      needsSetup: true,
      actionLabel: "Finish Meta setup",
    };
  }

  return {
    label: "Organic only",
    tone: "bg-white/5 text-white/70 border border-white/10",
    helper: "This offer can be listed in the marketplace, but affiliates can only promote it organically until Meta is connected.",
    needsSetup: true,
    actionLabel: "Connect Meta assets",
  };
}

// ---- Pending Notification Dot ----
const PendingDot = () => (
  <span
    className="ml-2 inline-block h-2 w-2 rounded-full bg-[var(--primary)]"
    style={{
      boxShadow: "0 0 6px color-mix(in oklab, var(--primary) 70%, transparent)",
    }}
  />
);

export default function MyBusinessPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [trackingVerifiedOfferIds, setTrackingVerifiedOfferIds] = useState<Set<string>>(new Set());
  const [trackingReadinessResolved, setTrackingReadinessResolved] = useState(false);
  const [hasAffiliateRequests, setHasAffiliateRequests] = useState(false);
  const [offersLoading, setOffersLoading] = useState<boolean>(true);
  const [loadingPaymentForm, setLoadingPaymentForm] = useState(false);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnablingPayouts, setIsEnablingPayouts] = useState(false);
  const [businessCustomerId, setBusinessCustomerId] = useState<string | null>(
    null,
  );
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(
    null,
  );
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [businessAccountId, setBusinessAccountId] = useState<string | null>(
    null,
  );
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
  const [hasCard, setHasCard] = useState<boolean>(false);

  const [hasPendingPostIdeas, setHasPendingPostIdeas] = useState(false);
  const [hasPendingAdIdeas, setHasPendingAdIdeas] = useState(false);

  const [showAcceptTerms, setShowAcceptTerms] = useState(false);
  const [showMetaOptionalWhy, setShowMetaOptionalWhy] = useState(false);
  const [showLaunchSteps, setShowLaunchSteps] = useState(false);

  const session = useSession();
  const user = session?.user;
  const supabase = createClientComponentClient();
  useEffect(() => {
    if (!user?.email || offers.length === 0) return;

    const offerIds = offers.map((o) => o.id);

    const checkPending = async () => {
      const [{ data: postIdeas }, { data: adIdeas }] = await Promise.all([
        supabase
          .from("organic_posts")
          .select("id")
          .in("offer_id", offerIds)
          .eq("status", "pending"),

        supabase
          .from("ad_ideas")
          .select("id")
          .in("offer_id", offerIds)
          .eq("status", "pending"),
      ]);

      setHasPendingPostIdeas(!!postIdeas?.length);
      setHasPendingAdIdeas(!!adIdeas?.length);
    };

    checkPending();
  }, [user?.email, offers, supabase]);

  useEffect(() => {
    if (!user?.id) return;

    const checkTerms = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("terms_accepted")
        .eq("id", user.id)
        .single();

      if (!error && !data?.terms_accepted) {
        setShowAcceptTerms(true);
      }
    };

    checkTerms();
  }, [user?.id, supabase]);

  // Helper to safely parse JSON or fallback to text for error messages
  async function parseJsonSafe(res: Response) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        return await res.json();
      } catch {
        return { error: "Invalid JSON in response" };
      }
    }
    const text = await res.text();
    return { error: text?.slice(0, 500) || "Non-JSON response" };
  }

  useEffect(() => {
    if (!session || !user?.email) return;

    const fetchOffers = async () => {
      setOffersLoading(true);
      const { data, error } = await supabase
        .from("offers")
        .select(
          "id,title,description,commission,type,site_host,meta_page_id,meta_ad_account_id,meta_pixel_id",
        )
        .eq("business_email", user.email);

      if (error) {
        console.error("[❌ Error fetching business offers]", error.message);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("offers")
          .select("id,title,description,commission,type,site_host")
          .eq("business_email", user.email);

        if (fallbackError) {
          console.error("[❌ Fallback offer fetch failed]", fallbackError.message);
          setOffers([]);
        } else {
          const normalized = (fallbackData || []).map((row: any) => ({
            ...row,
            meta_page_id: null,
            meta_ad_account_id: null,
            meta_pixel_id: null,
          }));
          setOffers(normalized as Offer[]);
        }
      } else {
        setOffers(data ? (data as Offer[]) : []);
      }
      setOffersLoading(false);
    };

    fetchOffers();
  }, [session, user, supabase]);

  useEffect(() => {
    if (!session || !user?.email) return;

    const fetchAffiliateRequests = async () => {
      const { data, error } = await supabase
        .from("affiliate_requests")
        .select("id")
        .eq("business_email", user.email)
        .limit(1);

      if (error) {
        console.error("[affiliate requests check failed]", error.message);
        setHasAffiliateRequests(false);
        return;
      }

      setHasAffiliateRequests((data?.length || 0) > 0);
    };

    fetchAffiliateRequests();
  }, [session, user, supabase]);

  useEffect(() => {
    if (!session || offers.length === 0) {
      setTrackingVerifiedOfferIds(new Set());
      setTrackingReadinessResolved(true);
      return;
    }

    const fetchTrackingReadiness = async () => {
      setTrackingReadinessResolved(false);
      try {
        const res = await fetch("/api/business/tracking-readiness", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offerIds: offers.map((o) => o.id) }),
        });
        const json = await parseJsonSafe(res);
        if (!res.ok || !Array.isArray(json?.verifiedOfferIds)) {
          setTrackingVerifiedOfferIds(new Set());
          return;
        }
        setTrackingVerifiedOfferIds(new Set(json.verifiedOfferIds));
      } catch {
        setTrackingVerifiedOfferIds(new Set());
      } finally {
        setTrackingReadinessResolved(true);
      }
    };

    fetchTrackingReadiness();
  }, [session, offers]);

  useEffect(() => {
    if (!session || !user?.email) return;
    const loadStripeCustomerId = async () => {
      const { data, error } = await supabase
        .from("business_profiles")
        .select(
          "stripe_customer_id, stripe_account_id, stripe_onboarding_complete",
        )
        .eq("business_email", user.email)
        .single();
      if (error) {
        console.log(
          "[ℹ️ No business profile yet or error loading stripe_customer_id]",
          error.message,
        );
        return;
      }
      if (data?.stripe_customer_id) {
        const customerId = data.stripe_customer_id as string;
        setBusinessCustomerId(customerId);

        try {
          const key = `nm_has_card_${customerId}`;
          const cached = key ? localStorage.getItem(key) : null;
          if (cached === "true") {
            setHasCard(true);
          } else {
            const cardRes = await fetch("/api/stripe/check-customer-card", {
              method: "POST",
            });
            const cardJson = await parseJsonSafe(cardRes);
            if (cardRes.ok && cardJson?.hasCard) {
              setHasCard(true);
              localStorage.setItem(key, "true");
            } else {
              setHasCard(false);
            }
          }
        } catch (e) {
          console.warn("[billing status check failed]", e);
        }
      }
      if (data?.stripe_account_id)
        setBusinessAccountId(data.stripe_account_id as string);
      if (typeof data?.stripe_onboarding_complete === "boolean") {
        setOnboardingComplete(!!data.stripe_onboarding_complete);
      }
    };
    loadStripeCustomerId();
  }, [session, user, supabase]);

  useEffect(() => {
    if (showPaymentForm && businessCustomerId && !setupClientSecret) {
      (async () => {
        try {
          const res = await fetch("/api/stripe/create-setup-intent", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ customerId: businessCustomerId }),
          });
          const data = await parseJsonSafe(res);
          if (res.ok && data?.clientSecret) {
            setSetupClientSecret(data.clientSecret);
          } else {
            console.error(
              "[SetupIntent error]",
              data?.error || "Unknown error",
            );
          }
        } catch (e) {
          console.error("[SetupIntent exception]", e);
        }
      })();
    }
  }, [showPaymentForm, businessCustomerId, setupClientSecret]);

  // ---- Readiness states (informational only; no onboarding gate) ----
  const payoutsReady = !!onboardingComplete;
  const billingReady = !!businessCustomerId && !!hasCard;
  const hasAnyOffer = offers.length > 0;
  const hasTrackingConnected = offers.some((offer) => {
    if (!offer.site_host) return false;
    if (!trackingReadinessResolved) return true;
    if (trackingVerifiedOfferIds.size === 0) return true;
    return trackingVerifiedOfferIds.has(offer.id);
  });
  const payoutsRequiredNow = hasAffiliateRequests;
  const hasMetaConnected = offers.some(
    (offer) =>
      Boolean(offer.meta_page_id) ||
      Boolean(offer.meta_ad_account_id) ||
      Boolean(offer.meta_pixel_id),
  );

  const launchSteps = [
    {
      key: "offer",
      label: "Create your first offer",
      desc: "Required to appear in marketplace.",
      done: hasAnyOffer,
      optional: false,
      href: "/business/my-business/create-offer",
    },
    {
      key: "tracking",
      label: "Connect tracking",
      desc: "Required to enable affiliate requests (Coming soon → Requests open).",
      done: hasTrackingConnected,
      optional: false,
      href: "/business/setup-tracking",
    },
    {
      key: "payouts",
      label: "Enable payouts",
      desc: payoutsRequiredNow
        ? "Required now because at least one affiliate request exists."
        : "Optional for now. Becomes required when your first affiliate request arrives.",
      done: payoutsReady,
      optional: !payoutsRequiredNow,
      href: "/business/payouts",
    },
    {
      key: "billing",
      label: "Connect billing",
      desc: "Optional now. Required before paid affiliate/ad workflows.",
      done: billingReady,
      optional: true,
      href: "/business/payouts",
    },
    {
      key: "meta",
      label: "Connect Meta",
      desc: "Optional. Needed for paid campaigns.",
      done: hasMetaConnected,
      optional: true,
      href: "/business/my-business/connect-meta",
    },
  ];

  const launchDoneCount = launchSteps.filter((s) => s.done).length;
  const launchProgress = Math.round((launchDoneCount / launchSteps.length) * 100);

  // Guided setup removed: keep core sections visible and allow offers anytime
  const showOnboardingChecklist = false;
  const showBillingCard = true;
  const showMetaCard = true;
  const showAffiliatesCard = true;
  const canCreateOffer = true;

  const handleDelete = async (id: string) => {
    console.log("[🗑 Attempting to delete offer]", id);
    setLoadingDeleteId(id);
    try {
      const { error: deleteError } = await supabase
        .from("offers")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;

      const updatedOffers = offers.filter((offer) => offer.id !== id);
      setOffers(updatedOffers);
      localStorage.setItem("my-offers", JSON.stringify(updatedOffers));
      localStorage.setItem("marketplace-offers", JSON.stringify(updatedOffers));
      console.log("[✅ Offer deleted and offers updated]");
    } catch (err: any) {
      console.error("[❌ Delete Error]", err.message || err);
    } finally {
      setLoadingDeleteId(null);
    }
  };

  async function handleConnectBilling() {
    try {
      setIsSubmitting(true);
      const email = user?.email;
      if (!email) throw new Error("Missing business email");
      const name = "Business";
      const res = await fetch("/api/stripe/create-customer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.customerId)
        throw new Error(data?.error || "Failed to create Stripe customer");

      const { data: updRows, error: upErr } = await supabase
        .from("business_profiles")
        .update({ stripe_customer_id: data.customerId })
        .eq("business_email", email)
        .select("id");

      if (upErr)
        throw new Error(upErr.message || "Failed to save Stripe customer ID");

      if (!updRows || updRows.length === 0) {
        const { error: insErr } = await supabase
          .from("business_profiles")
          .insert({
            business_email: email,
            stripe_customer_id: data.customerId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (insErr)
          throw new Error(
            insErr.message || "Failed to create business profile",
          );
      }

      setBusinessCustomerId(data.customerId);
      toast.success("Billing connected (Stripe Customer created)");
    } catch (e: any) {
      console.error("[Connect billing error]", e);
      toast.error(e.message || "Stripe error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEnablePayouts() {
    if (isEnablingPayouts) return;

    try {
      setIsEnablingPayouts(true);

      const email = user?.email;
      if (!email) throw new Error("Missing business email");

      const res = await fetch("/api/stripe/create-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "business",
          email,
        }),
      });

      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to start payouts onboarding");
      }

      window.location.href = data.url;
    } catch (e: any) {
      console.error("[Enable payouts error]", e);
      toast.error(e?.message || "Stripe error");
      setIsEnablingPayouts(false);
    }
  }

  async function handleRefreshPayoutStatus() {
    try {
      const res = await fetch("/api/stripe/check-account", { method: "POST" });
      const data = await parseJsonSafe(res);
      if (!res.ok)
        throw new Error(data?.error || "Failed to check payouts status");
      if (data?.onboardingComplete) {
        setOnboardingComplete(true);
        toast.success("Payouts enabled ✅");
      } else {
        toast("Still pending Stripe onboarding", { icon: "⏳" });
      }
    } catch (e: any) {
      console.error("[Refresh payouts status error]", e);
      toast.error(e?.message || "Stripe error");
    }
  }

  async function handleAddPaymentMethod() {
    try {
      if (!businessCustomerId) throw new Error("No Stripe customer connected");
      if (loadingPaymentForm) return;

      setLoadingPaymentForm(true);
      setShowPaymentForm(false);
      setSetupClientSecret("");

      const res = await fetch("/api/stripe/create-setup-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId: businessCustomerId }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.clientSecret)
        throw new Error(data?.error || "Failed to create SetupIntent");
      setSetupClientSecret(data.clientSecret);
      setShowPaymentForm(true);
      toast.success("Secure card form ready below");
    } catch (e: any) {
      console.error("[Add payment method error]", e);
      toast.error(e.message || "Stripe error");
    } finally {
      setLoadingPaymentForm(false);
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
          redirect: "if_required",
        });
        if (result.error) {
          toast.error(result.error.message || "Card setup failed");
        } else {
          toast.success("Card saved");
          try {
            const cust = businessCustomerId
              ? `nm_has_card_${businessCustomerId}`
              : null;
            if (cust) localStorage.setItem(cust, "true");
          } catch (_) {}
          setHasCard(true);
          onComplete();
        }
      } catch (err: any) {
        console.error("[confirmSetup error]", err);
        toast.error(err?.message || "Stripe error");
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="bg-[#111] border border-[#00C2CB]/20 rounded-xl p-4 mt-4"
      >
        <div className="mb-4">
          <PaymentElement
            onLoaderror={(event) => {
              console.error("[Stripe PaymentElement loaderror]", event);
              toast.error("Stripe card form failed to load. Please retry.");
            }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !stripe || !elements}
          className="w-full flex items-center justify-center gap-2 bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold px-4 py-3 rounded-md"
        >
          {submitting ? "Saving…" : "Save Card"}
        </button>
      </form>
    );
  }

  return (
    <>
      {showAcceptTerms && user?.id && (
        <AcceptTermsModal
          userId={user.id}
          onAccepted={() => setShowAcceptTerms(false)}
        />
      )}
      {console.log("MyBusinessPage mounted")}
      <div className="my-business-theme min-h-screen bg-[var(--background)] px-6 py-10 text-[var(--foreground)]">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-10 rounded-3xl border border-[var(--border)] bg-[var(--card)] px-6 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <IconBolt className="w-3.5 h-3.5" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                My Business
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted-foreground)] sm:text-base">
                Manage affiliates, Meta integration, billing, and marketplace
                offers for your Nettmark business from one control surface.
              </p>
            </div>
          </div>

          <details className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:content-none">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Full platform walkthrough
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
                  Open the complete Storylane flow for the business side of Nettmark.
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C2CB] transition group-open:rotate-45">
                +
              </span>
            </summary>

            <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
              <Script
                src="https://js.storylane.io/js/v2/storylane.js"
                strategy="afterInteractive"
                data-verify-origin=""
              />
              <div
                className="sl-embed relative w-full overflow-hidden rounded-[1.2rem] bg-black"
                style={{
                  paddingBottom: "calc(65.19% + 25px)",
                  height: 0,
                  transform: "scale(1)",
                }}
              >
                <iframe
                  title="Nettmark full business walkthrough"
                  loading="lazy"
                  className="sl-demo absolute left-0 top-0 h-full w-full"
                  src="https://app.storylane.io/demo/1yizhs85qivn?embed=inline"
                  name="sl-embed"
                  allow="fullscreen"
                  allowFullScreen
                  style={{
                    border: "1px solid rgba(63,95,172,0.35)",
                    boxShadow: "0px 0px 18px rgba(26, 19, 72, 0.15)",
                    borderRadius: "10px",
                    boxSizing: "border-box",
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            </div>
          </details>
        </div>

        {/* ===== Onboarding Checklist (stays until payouts + billing + at least one offer) ===== */}
        {showOnboardingChecklist && (
          <div className="max-w-5xl mx-auto mb-8 rounded-2xl border border-[#00C2CB]/20 bg-[#101314] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Finish setting up your account
                </h2>
                <p className="text-sm text-gray-400">
                  Work through the core setup in order: Stripe first, then Meta, then create your first offer, then install tracking against that offer.
                </p>
              </div>
              <div className="text-xs px-3 py-1 rounded-full bg-[#00C2CB]/15 text-[#7ff5fb] border border-[#00C2CB]/25">
                Guided setup
              </div>
            </div>

            <div className="space-y-3">
              {/* Payouts item */}
              <div className="flex items-center justify-between rounded-xl border border-[#1f2a2b] bg-[#0e1112] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${payoutsReady ? "bg-green-500" : "bg-[#334649]"}`}
                  />
                  <div>
                    <div className="text-white font-medium">
                      Connect payouts
                    </div>
                    <div className="text-xs text-gray-400">
                      Secure Stripe Connect so affiliates can be paid.
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!payoutsReady && (
                    <>
                      <button
                        onClick={handleEnablePayouts}
                        disabled={isEnablingPayouts}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[#00C2CB] text-black text-sm hover:bg-[#00b0b8] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isEnablingPayouts && (
                          <IconSpinner className="h-4 w-4 animate-spin" />
                        )}
                        {isEnablingPayouts ? "Opening Stripe…" : "Connect"}
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
                  {payoutsReady && (
                    <span className="text-green-400 text-sm">Enabled</span>
                  )}
                </div>
              </div>

              {/* Billing item */}
              <div className="flex items-center justify-between rounded-xl border border-[#1f2a2b] bg-[#0e1112] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${billingReady ? "bg-green-500" : "bg-[#334649]"}`}
                  />
                  <div>
                    <div className="text-white font-medium">
                      Add a payment method
                    </div>
                    <div className="text-xs text-gray-400">
                      Create a Stripe Customer and save a card for commissions
                      &amp; ad spend transfers.
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
                      disabled={loadingPaymentForm}
                      className="px-3 py-2 rounded-md border border-[#00C2CB]/40 text-white text-sm hover:bg-[#0f1415] disabled:opacity-60"
                    >
                      {loadingPaymentForm ? "Loading…" : "Add card"}
                    </button>
                  )}
                  {billingReady && (
                    <span className="text-green-400 text-sm">Ready</span>
                  )}
                </div>
              </div>

              {businessCustomerId && showPaymentForm && setupClientSecret && (
                <div className="mt-4">
                  <Elements
                    key={setupClientSecret}
                    stripe={stripePromise}
                    options={{ clientSecret: setupClientSecret }}
                  >
                    <AddCardForm
                      onComplete={() => {
                        setShowPaymentForm(false);
                      }}
                    />
                  </Elements>
                </div>
              )}

              {/* Meta step */}
              <div className="rounded-xl border border-[#1f2a2b] bg-[#0e1112] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-block w-3 h-3 rounded-full bg-[#334649]" />
                    <div>
                      <div className="text-white font-medium">
                        Connect Meta now or later <span className="text-gray-500">(optional)</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Meta is only required for paid campaigns. Organic marketplace promotion can start without it.
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/business/my-business/connect-meta?onboard=1"
                    prefetch={false}
                    className="px-3 py-2 rounded-md border border-[#00C2CB]/40 text-white text-sm hover:bg-[#0f1415]"
                  >
                    Connect Meta
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMetaOptionalWhy((prev) => !prev)}
                  className="mt-3 inline-flex items-center rounded-md border border-[#1f2a2b] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#101416]"
                >
                  {showMetaOptionalWhy ? "Hide why" : "Why connect Meta?"}
                </button>

                {showMetaOptionalWhy && (
                  <div className="mt-3 space-y-2 text-xs text-gray-400">
                    <p>Connecting Meta unlocks paid ad workflows (page, ad account, and pixel-linked launches).</p>
                    <p>You can connect later when you’re ready to run paid traffic or after your first affiliate request needs paid ads.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#1f2a2b] bg-[#0e1112] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-3 h-3 rounded-full bg-[#334649]" />
                  <div>
                    <div className="text-white font-medium">Create your first offer</div>
                    <div className="text-xs text-gray-400">
                      When you get here, you’ll choose which connected Meta page and ad account this offer should use.
                    </div>
                  </div>
                </div>
                {canCreateOffer ? (
                  <Link
                    href="/business/my-business/create-offer?onboard=1"
                    prefetch={false}
                    className="px-3 py-2 rounded-md border border-[#00C2CB]/40 text-white text-sm hover:bg-[#0f1415]"
                  >
                    Continue
                  </Link>
                ) : (
                  <button
                    disabled
                    className="px-3 py-2 rounded-md border border-[#00C2CB]/15 text-gray-500 text-sm cursor-not-allowed bg-transparent"
                  >
                    Continue
                  </button>
                )}
              </div>

              {/* Tracking step */}
              <div className="flex items-center justify-between rounded-xl border border-[#1f2a2b] bg-[#0e1112] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-3 h-3 rounded-full bg-[#334649]" />
                  <div>
                    <div className="text-white font-medium">
                      Install &amp; verify tracking
                    </div>
                    <div className="text-xs text-gray-400">
                      Tracking needs an offer to attach to, so do this right after your first offer is live.
                    </div>
                  </div>
                </div>
                {canCreateOffer ? (
                  <Link
                    href="/business/setup-tracking?onboard=1"
                    className="px-3 py-2 rounded-md border border-[#00C2CB]/40 text-white text-sm hover:bg-[#0f1415]"
                  >
                    Continue
                  </Link>
                ) : (
                  <button
                    disabled
                    className="px-3 py-2 rounded-md border border-[#00C2CB]/15 text-gray-500 text-sm cursor-not-allowed bg-transparent"
                  >
                    Continue
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto mb-8 rounded-2xl border border-[#00C2CB]/35 bg-[#0d1316] p-5 shadow-[0_0_30px_rgba(0,194,203,0.12)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Launch progress</h2>
              <p className="text-sm text-gray-400">
                {offersLoading
                  ? "Loading progress…"
                  : `${launchDoneCount} of ${launchSteps.length} complete · clear next step guidance.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLaunchSteps((prev) => !prev)}
              className="rounded-md border border-[#00C2CB]/45 bg-[#00C2CB]/10 px-3 py-2 text-xs font-semibold text-[#7ff5fb] hover:bg-[#00C2CB]/15"
            >
              {showLaunchSteps ? "Hide steps" : "Show steps"}
            </button>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-[#00C2CB]" style={{ width: `${offersLoading ? 0 : launchProgress}%` }} />
          </div>

          {showLaunchSteps && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {launchSteps.map((step) => (
                <Link
                  key={step.key}
                  href={step.href}
                  prefetch={false}
                  className="block rounded-xl border border-[#00C2CB]/25 bg-[#0e1112] p-3 text-left hover:border-[#00C2CB]/45 hover:bg-[#10181b]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] rounded-full px-2 py-0.5 border ${step.done ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : step.optional ? "border-[#00C2CB]/35 bg-[#00C2CB]/10 text-[#7ff5fb]" : "border-red-400/45 bg-red-500/10 text-red-200"}`}>
                        {step.done ? "Done" : step.optional ? "Optional" : "Required"}
                      </span>
                      <span className="text-[11px] rounded-full border border-[#00C2CB]/35 bg-[#00C2CB]/10 px-2 py-0.5 text-[#7ff5fb]">
                        Open
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{step.desc}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ===== Action sections (grouped) ===== */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* Affiliates */}
          {showAffiliatesCard && (
            <SectionCard
              title="Affiliates"
              icon={<IconUsers className="w-4 h-4" />}
            >
              <div className="space-y-4">
                <p className="text-xs text-white/70">
                  Approve partners, review post ideas, and keep an eye on what
                  affiliates are planning to run.
                </p>

                <div className="space-y-3">
                  <Link
                    href="/business/my-business/affiliate-requests"
                    prefetch={false}
                  >
                    <ActionButton size="sm">
                      <IconUsers className="w-5 h-5 shrink-0" />
                      <span>Affiliate requests</span>
                    </ActionButton>
                  </Link>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                      href="/business/my-business/post-ideas/"
                      prefetch={false}
                    >
                      <ActionButton size="sm" secondary>
                        <span className="flex items-center gap-1">
                          View post ideas
                          {hasPendingPostIdeas && <PendingDot />}
                        </span>
                      </ActionButton>
                    </Link>
                    <Link
                      href="/business/my-business/ad-ideas/"
                      prefetch={false}
                    >
                      <ActionButton size="sm" secondary>
                        <span className="flex items-center gap-1">
                          View ad ideas
                          {hasPendingAdIdeas && <PendingDot />}
                        </span>
                      </ActionButton>
                    </Link>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Meta Integration */}
          {showMetaCard && (
            <SectionCard
              title="Meta Integration"
              icon={<IconPuzzle className="w-4 h-4" />}
            >
              <div className="space-y-4">
                <p className="text-xs text-white/70">
                  Connect your Meta assets and keep tracking + creatives aligned
                  with your Nettmark offers.
                </p>

                <div className="space-y-3">
                  <Link
                    href="/business/my-business/connect-meta/"
                    prefetch={false}
                  >
                    <ActionButton size="sm">
                      <IconBolt className="w-5 h-5 shrink-0" />
                      <span>Connect Meta ads</span>
                    </ActionButton>
                  </Link>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link href="/business/setup-tracking">
                      <ActionButton size="sm" secondary>
                        Setup tracking
                      </ActionButton>
                    </Link>
                    <Link
                      href="/business/my-business/publish-creatives/"
                      prefetch={false}
                    >
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
            <SectionCard
              title="Billing"
              icon={<IconCreditCard className="w-4 h-4" />}
            >
              <div className="space-y-4">
                <p className="text-xs text-white/70">
                  Billing and payouts are handled via Stripe. Once connected,
                  affiliates are paid automatically.
                </p>

                <div className="flex flex-col gap-3">
                  {!businessCustomerId && (
                    <button
                      onClick={handleConnectBilling}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#00C2CB] text-black font-semibold px-6 py-3 text-sm hover:bg-[#00b0b8] transition-all shadow-[0_0_25px_rgba(0,194,203,0.45)]"
                    >
                      <IconCreditCard className="w-4 h-4" />
                      Connect Billing
                    </button>
                  )}

                  {businessCustomerId && !hasCard && (
                    <button
                      onClick={handleAddPaymentMethod}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#00C2CB]/40 text-white font-semibold px-6 py-3 text-sm hover:bg-[#0f1415] transition-all"
                    >
                      <IconCreditCard className="w-4 h-4" />
                      Add Card
                    </button>
                  )}

                  <button
                    onClick={handleEnablePayouts}
                    disabled={isEnablingPayouts}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#00C2CB] text-black font-semibold px-6 py-3 text-sm hover:bg-[#00b0b8] transition-all shadow-[0_0_25px_rgba(0,194,203,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isEnablingPayouts ? (
                      <IconSpinner className="w-4 h-4 animate-spin" />
                    ) : (
                      <IconBank className="w-4 h-4" />
                    )}
                    {isEnablingPayouts ? "Opening Stripe…" : "Enable Payouts"}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-3 mt-4">
                  <div className="w-full max-w-xs">
                    <div
                      className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium border ${
                        billingReady
                          ? "border-emerald-400/60 text-emerald-300 bg-emerald-500/10"
                          : "border-white/10 text-white/70 bg-white/5"
                      }`}
                    >
                      <IconCreditCard className="w-4 h-4" />
                      <span>
                        {billingReady
                          ? "Billing connected"
                          : "Billing not connected"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full max-w-xs">
                    <div
                      className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium border ${
                        payoutsReady
                          ? "border-emerald-400/60 text-emerald-300 bg-emerald-500/10"
                          : "border-white/10 text-white/70 bg-white/5"
                      }`}
                    >
                      <IconBank className="w-4 h-4" />
                      <span>
                        {payoutsReady
                          ? "Payouts enabled"
                          : "Payouts not enabled"}
                      </span>
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
            <Link href="/business/my-business/create-offer/" prefetch={false}>
              <ActionButton size="sm">
                <IconPlus className="w-4 h-4" />
                <span>New offer</span>
              </ActionButton>
            </Link>
          </div>

          {offersLoading ? (
            <p className="text-gray-400 text-center text-sm">
              Loading your offers…
            </p>
          ) : offers.length === 0 ? (
            <p className="text-gray-400 text-center">
              You haven't uploaded any offers yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.7)] transition hover:border-[#00C2CB]/60 hover:shadow-[0_22px_60px_rgba(0,0,0,0.95)]"
                >
                  {(() => {
                    const metaStatus = getOfferMetaStatus(offer);
                    const trackingReady = Boolean(offer.site_host) && (!trackingReadinessResolved || trackingVerifiedOfferIds.size === 0 || trackingVerifiedOfferIds.has(offer.id));
                    return (
                      <>
                  {/* Soft glow accent */}
                  <div
                    className="pointer-events-none absolute inset-x-0 -top-16 h-24 opacity-40 blur-3xl"
                    style={{
                      background:
                        "radial-gradient(40% 80% at 10% 0%, rgba(0,194,203,0.35), transparent 60%), radial-gradient(40% 80% at 90% 0%, rgba(127,245,251,0.18), transparent 60%)",
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
                        <h2 className="text-xl font-semibold tracking-tight text-[#7ff5fb]">
                          {offer.title}
                        </h2>
                        <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-white/40">
                          {offer.type === "recurring"
                            ? "Recurring offer"
                            : "One-time offer"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                        Commission
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-semibold text-white">
                          {offer.commission}
                        </span>
                        <span className="text-sm font-medium text-white/60">
                          %
                        </span>
                      </div>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                          offer.type === "recurring"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
                            : "bg-amber-500/15 text-amber-200 border border-amber-400/40"
                        }`}
                      >
                        {offer.type === "recurring" ? "Recurring" : "One-Time"}
                      </span>
                    </div>
                  </div>

                  <p className="relative mt-4 text-sm text-white/70">
                    {offer.description}
                  </p>

                  <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
                        Offer status
                      </span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${trackingReady ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40" : "bg-amber-500/15 text-amber-200 border border-amber-400/40"}`}>
                        {trackingReady ? "Requests open" : "Coming soon"}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${metaStatus.tone}`}>
                        {metaStatus.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white">
                      {trackingReady
                        ? "Tracking is connected, so affiliates can request this offer from the marketplace."
                        : "To push your offer to marketplace, setup tracking. Until then it appears as Coming soon and affiliates cannot request to promote."}
                    </p>
                    <p className="mt-2 text-sm text-white">{metaStatus.helper}</p>
                  </div>

                  <div className="relative mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Link
                      href={`/business/my-business/edit-offer/${offer.id}/`}
                      prefetch={false}
                      className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_25px_rgba(0,194,203,0.45)] hover:bg-[#00b0b8]"
                    >
                      Edit offer
                    </Link>

                    {!trackingReady ? (
                      <Link
                        href="/business/setup-tracking"
                        prefetch={false}
                        className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/15"
                      >
                        Connect tracking
                      </Link>
                    ) : metaStatus.needsSetup ? (
                      <Link
                        href={`/business/my-business/edit-offer/${offer.id}/#meta-setup`}
                        prefetch={false}
                        className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-4 py-2.5 text-sm font-semibold text-[#7ff5fb] hover:bg-[#00C2CB]/15"
                      >
                        {metaStatus.actionLabel}
                      </Link>
                    ) : (
                      <Link
                        href="/business/my-business/affiliate-requests"
                        prefetch={false}
                        className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                      >
                        View affiliate requests
                      </Link>
                    )}

                    {metaStatus.needsSetup && !trackingReady && (
                      <Link
                        href={`/business/my-business/edit-offer/${offer.id}/#meta-setup`}
                        prefetch={false}
                        className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-4 py-2.5 text-sm font-semibold text-[#7ff5fb] hover:bg-[#00C2CB]/15"
                      >
                        {metaStatus.actionLabel}
                      </Link>
                    )}

                    <button
                      onClick={() => handleDelete(offer.id)}
                      disabled={loadingDeleteId === offer.id}
                      className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingDeleteId === offer.id ? "Deleting…" : "Delete offer"}
                    </button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
