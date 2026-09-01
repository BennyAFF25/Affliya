"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import "@/globals.css";
import AcceptTermsModal from "@/../app/components/AcceptTermsModal";
import Link from "next/link";
import React, { useEffect, useState } from "react";
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
const IconChat = (props: React.SVGProps<SVGSVGElement>) => (
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
      d="M5 18.5A7.5 7.5 0 117.5 21L4 22l1-3.5z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5" />
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

interface OnboardingProgressRow {
  business_email: string;
  offer_id: string;
  first_offer_created: boolean;
  tracking_connected: boolean;
  payouts_enabled: boolean;
  billing_connected: boolean;
  meta_connected: boolean;
  first_affiliate_request_seen: boolean;
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

interface ApprovedAffiliateRequest {
  id: string;
  offer_id: string;
  affiliate_email: string;
  created_at: string;
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
    tone: "bg-white/5 text-white border border-white/10",
    helper: "This offer can be listed in the marketplace, but affiliates can only promote it organically until Meta is connected.",
    needsSetup: true,
    actionLabel: "Connect Meta assets",
  };
}

export default function MyBusinessPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [trackingVerifiedOfferIds, setTrackingVerifiedOfferIds] = useState<Set<string>>(new Set());
  const [trackingReadinessResolved, setTrackingReadinessResolved] = useState(false);
  const [onboardingProgressRows, setOnboardingProgressRows] = useState<OnboardingProgressRow[]>([]);
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
  const [billingRequiredPrompt, setBillingRequiredPrompt] = useState(false);
  const [billingPromptHandled, setBillingPromptHandled] = useState(false);
  const [businessAccountId, setBusinessAccountId] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
  const [hasCard, setHasCard] = useState<boolean>(false);

  const [pendingPostIdeaCount, setPendingPostIdeaCount] = useState(0);
  const [pendingAdIdeaCount, setPendingAdIdeaCount] = useState(0);
  const [affiliateRequestCount, setAffiliateRequestCount] = useState(0);
  const [approvedAffiliateRequestsByOffer, setApprovedAffiliateRequestsByOffer] = useState<Record<string, ApprovedAffiliateRequest[]>>({});
  const [expandedInviteOfferId, setExpandedInviteOfferId] = useState<string | null>(null);
  const [launchInviteTypeByOfferId, setLaunchInviteTypeByOfferId] = useState<Record<string, "paid" | "organic">>({});
  const [launchInviteStatusByRequestId, setLaunchInviteStatusByRequestId] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});

  const [showAcceptTerms, setShowAcceptTerms] = useState(false);
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

      setPendingPostIdeaCount(postIdeas?.length || 0);
      setPendingAdIdeaCount(adIdeas?.length || 0);
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
    const fetchOffers = async () => {
      setOffersLoading(true);
      const authUser = user?.email
        ? { email: user.email }
        : (await supabase.auth.getUser()).data.user;
      const businessEmail = authUser?.email;

      if (!businessEmail) {
        setOffers([]);
        setOffersLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("offers")
        .select(
          "id,title,description,commission,type,site_host,meta_page_id,meta_ad_account_id,meta_pixel_id",
        )
        .eq("business_email", businessEmail);

      if (error) {
        console.error("[❌ Error fetching business offers]", error.message);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("offers")
          .select("id,title,description,commission,type,site_host")
          .eq("business_email", businessEmail);

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
  }, [user?.email, supabase]);
  useEffect(() => {
    const fetchAffiliateRequests = async () => {
      const authUser = user?.email
        ? { email: user.email }
        : (await supabase.auth.getUser()).data.user;
      const businessEmail = authUser?.email;

      if (!businessEmail) {
        setHasAffiliateRequests(false);
        setApprovedAffiliateRequestsByOffer({});
        return;
      }

      const { data, error } = await supabase
        .from("affiliate_requests")
        .select("id,status,offer_id,affiliate_email,created_at")
        .eq("business_email", businessEmail);

      if (error) {
        console.error("[affiliate requests check failed]", error.message);
        setHasAffiliateRequests(false);
        setAffiliateRequestCount(0);
        setApprovedAffiliateRequestsByOffer({});
        return;
      }

      const rows = (data || []) as Array<{
        id: string;
        status?: string | null;
        offer_id?: string | null;
        affiliate_email?: string | null;
        created_at?: string | null;
      }>;

      const pendingRequests = rows.filter((row) => row.status === "pending").length;
      const approvedByOffer = rows.reduce<Record<string, ApprovedAffiliateRequest[]>>((acc, row) => {
        if (
          row.status === "approved" &&
          typeof row.offer_id === "string" &&
          row.offer_id.length > 0 &&
          typeof row.affiliate_email === "string" &&
          row.affiliate_email.length > 0
        ) {
          const item: ApprovedAffiliateRequest = {
            id: row.id,
            offer_id: row.offer_id,
            affiliate_email: row.affiliate_email,
            created_at: row.created_at || new Date().toISOString(),
          };
          acc[row.offer_id] = acc[row.offer_id] || [];
          acc[row.offer_id].push(item);
        }
        return acc;
      }, {});

      Object.values(approvedByOffer).forEach((group) => {
        group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });

      setAffiliateRequestCount(pendingRequests);
      setHasAffiliateRequests(rows.length > 0);
      setApprovedAffiliateRequestsByOffer(approvedByOffer);
    };

    fetchAffiliateRequests();
  }, [user?.email, supabase]);

  useEffect(() => {
    if (!user?.email) return;

    const loadOnboardingProgress = async () => {
      const { data, error } = await supabase
        .from("business_onboarding_progress")
        .select(
          "business_email,offer_id,first_offer_created,tracking_connected,payouts_enabled,billing_connected,meta_connected,first_affiliate_request_seen",
        )
        .eq("business_email", user.email);

      if (error) {
        console.error("[onboarding progress load failed]", error.message);
        setOnboardingProgressRows([]);
        return;
      }

      setOnboardingProgressRows((data || []) as OnboardingProgressRow[]);
    };

    loadOnboardingProgress();
  }, [user?.email, supabase]);

  useEffect(() => {
    if (offers.length === 0) {
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
  }, [offers]);

  useEffect(() => {
    if (!session || !user?.email) return;
    const loadStripeCustomerId = async () => {
      const res = await fetch("/api/stripe/business-billing-profile", {
        method: "GET",
        cache: "no-store",
      });
      const json = await parseJsonSafe(res);
      const data = json?.profile;

      if (!res.ok || !json?.success) {
        console.log(
          "[ℹ️ No business profile yet or error loading stripe_customer_id]",
          json?.message || json?.error || res.status,
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
  }, [session, user]);

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

  // ---- Readiness states from onboarding progress (fallbacks kept for resilience) ----
  const payoutsReadyDerived = !!onboardingComplete;
  const billingReadyDerived = !!businessCustomerId && !!hasCard;
  const hasAnyOfferDerived = offers.length > 0;
  const hasTrackingDerived = offers.some((offer) => {
    if (!offer.site_host) return false;
    if (!trackingReadinessResolved) return true;
    if (trackingVerifiedOfferIds.size === 0) return true;
    return trackingVerifiedOfferIds.has(offer.id);
  });
  const hasMetaDerived = offers.some(
    (offer) =>
      Boolean(offer.meta_page_id) ||
      Boolean(offer.meta_ad_account_id) ||
      Boolean(offer.meta_pixel_id),
  );

  const hasAnyOffer = onboardingProgressRows.some((r) => r.first_offer_created) || hasAnyOfferDerived;
  const hasTrackingConnected = onboardingProgressRows.some((r) => r.tracking_connected) || hasTrackingDerived;
  const payoutsReady = onboardingProgressRows.some((r) => r.payouts_enabled) || payoutsReadyDerived;
  const billingReady = onboardingProgressRows.some((r) => r.billing_connected) || billingReadyDerived;
  const hasMetaConnected = onboardingProgressRows.some((r) => r.meta_connected) || hasMetaDerived;
  const payoutsRequiredNow =
    onboardingProgressRows.some((r) => r.first_affiliate_request_seen) || hasAffiliateRequests;

  useEffect(() => {
    if (!user?.email || offers.length === 0) return;

    const syncOnboardingProgress = async () => {
      const payload = offers.map((offer) => ({
        business_email: user.email,
        offer_id: offer.id,
        first_offer_created: true,
        tracking_connected:
          onboardingProgressRows.find((r) => r.offer_id === offer.id)?.tracking_connected ||
          (Boolean(offer.site_host) && (!trackingReadinessResolved || trackingVerifiedOfferIds.size === 0 || trackingVerifiedOfferIds.has(offer.id))),
        payouts_enabled: payoutsReady,
        billing_connected: billingReady,
        meta_connected: hasMetaConnected,
        first_affiliate_request_seen: payoutsRequiredNow,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("business_onboarding_progress")
        .upsert(payload, { onConflict: "business_email,offer_id" });

      if (error) {
        console.error("[onboarding progress sync failed]", error.message);
      }
    };

    syncOnboardingProgress();
  }, [
    user?.email,
    offers,
    payoutsReady,
    billingReady,
    hasMetaConnected,
    payoutsRequiredNow,
    trackingReadinessResolved,
    trackingVerifiedOfferIds,
    onboardingProgressRows,
    supabase,
  ]);

  function handleOpenAssistant() {
    if (typeof window === "undefined") return;

    const chatbase = (
      window as Window & {
        chatbase?: ((command: string, ...args: unknown[]) => unknown) & {
          open?: () => unknown;
        };
      }
    ).chatbase;

    if (typeof chatbase?.open === "function") {
      chatbase.open();
      return;
    }

    if (typeof chatbase === "function") {
      chatbase("open");
    }
  }

  // Guided setup UI removed: core financial/integration handlers stay available for contextual approval flows.

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
      const res = await fetch("/api/stripe/business-billing-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.customerId)
        throw new Error(data?.message || data?.error || "Failed to create Stripe customer");

      setBusinessCustomerId(data.customerId);
      if (data?.profile?.stripe_account_id) setBusinessAccountId(data.profile.stripe_account_id as string);
      if (typeof data?.profile?.stripe_onboarding_complete === "boolean") {
        setOnboardingComplete(Boolean(data.profile.stripe_onboarding_complete));
      }
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

  async function handleSendLaunchInvite(
    offer: Offer,
    request: ApprovedAffiliateRequest,
    campaignType: "paid" | "organic",
  ) {
    if (!user?.email) {
      toast.error("Sign in again before sending invites.");
      return;
    }

    setLaunchInviteStatusByRequestId((prev) => ({
      ...prev,
      [request.id]: "sending",
    }));

    try {
      const res = await fetch("/api/emails/affiliate-launch-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          affiliateEmail: request.affiliate_email,
          businessEmail: user.email,
          offerId: offer.id,
          offerTitle: offer.title,
          requestId: request.id,
          campaignType,
        }),
      });

      const json = await parseJsonSafe(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to send launch invite");
      }

      setLaunchInviteStatusByRequestId((prev) => ({
        ...prev,
        [request.id]: "sent",
      }));
      toast.success(
        campaignType === "paid"
          ? `Paid launch invite sent to ${request.affiliate_email}`
          : `Organic launch invite sent to ${request.affiliate_email}`,
      );
    } catch (error: any) {
      console.error("[launch invite failed]", error);
      setLaunchInviteStatusByRequestId((prev) => ({
        ...prev,
        [request.id]: "error",
      }));
      toast.error(error?.message || "Could not send launch invite");
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

  useEffect(() => {
    if (typeof window === "undefined" || billingPromptHandled) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") !== "required") return;

    setBillingRequiredPrompt(true);
    toast("Add a payment method to approve this campaign. You are only charged when tracked commission/ad spend is due.", { icon: "💳" });

    if (businessCustomerId && !hasCard) {
      setBillingPromptHandled(true);
      void handleAddPaymentMethod();
    } else if (!businessCustomerId && !isSubmitting) {
      setBillingPromptHandled(true);
      void handleConnectBilling();
    } else if (hasCard) {
      setBillingPromptHandled(true);
    }
  }, [businessCustomerId, hasCard, billingPromptHandled, isSubmitting]);

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
          } catch (storageErr) {
            console.warn("[billing] could not cache card status", storageErr);
          }
          setHasCard(true);
          onComplete();
        }
      } catch (err) {
        console.error("[confirmSetup error]", err);
        toast.error(err instanceof Error ? err.message : "Stripe error");
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
            onLoadError={(event) => {
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

  const pendingSubmissionCount = pendingPostIdeaCount + pendingAdIdeaCount + affiliateRequestCount;
  const activeOfferCount = offers.length;
  const profileComplete = Boolean(user?.email);
  const brandAssetsAvailable = hasTrackingConnected || hasMetaConnected || offers.some((offer) => Boolean(offer.meta_page_id) || Boolean(offer.site_host));
  const liveOfferLabel = offersLoading ? "Loading…" : `${activeOfferCount}`;

  const setupReadyCount = [hasAnyOffer, hasTrackingConnected, billingReady, payoutsReady, hasMetaConnected].filter(Boolean).length;

  const readinessState = billingRequiredPrompt && !billingReady
    ? {
        title: "Setup required for this approval",
        desc: "A saved business payment method is needed for the campaign approval you just opened. Complete it here, then return to the approval flow.",
        tone: "border-amber-400/35 bg-amber-400/10 text-amber-100",
      }
    : pendingSubmissionCount > 0
      ? {
          title: "Review pending submissions first",
          desc: "No general setup is required from this dashboard. If an approval needs billing, Meta, tracking, or payout setup, Nettmark will prompt you at that point.",
          tone: "border-[#00C2CB]/35 bg-[#00C2CB]/10 text-[#7ff5fb]",
        }
      : {
          title: "Nothing required right now",
          desc: "Create offers and review incoming content. Billing and integrations stay contextual and appear only when a launch needs them.",
          tone: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
        };

  const recentActivity = [
    ...(affiliateRequestCount > 0
      ? [{ title: "Affiliate requests waiting", details: `${affiliateRequestCount} partner request${affiliateRequestCount === 1 ? "" : "s"} ready to review.`, href: "/business/my-business/affiliate-requests" }]
      : []),
    ...(pendingAdIdeaCount > 0
      ? [{ title: "Paid ad ideas submitted", details: `${pendingAdIdeaCount} paid ad idea${pendingAdIdeaCount === 1 ? "" : "s"} pending approval.`, href: "/business/my-business/ad-ideas" }]
      : []),
    ...(pendingPostIdeaCount > 0
      ? [{ title: "Organic post ideas submitted", details: `${pendingPostIdeaCount} organic post idea${pendingPostIdeaCount === 1 ? "" : "s"} pending approval.`, href: "/business/my-business/post-ideas" }]
      : []),
    ...(offers.length > 0
      ? [{ title: "Offers available", details: `${offers.length} marketplace offer${offers.length === 1 ? "" : "s"} available for affiliates.`, href: "/business/my-business" }]
      : []),
  ].slice(0, 4);

  return (
    <>
      {showAcceptTerms && user?.id && (
        <AcceptTermsModal
          userId={user.id}
          onAccepted={() => setShowAcceptTerms(false)}
        />
      )}

      <div className="my-business-theme min-h-screen bg-[#090b0c] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto grid w-full max-w-[1500px] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#17191a] p-5 shadow-2xl shadow-black/20 sm:p-7">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#00C2CB] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-black">
                <IconBolt className="h-3.5 w-3.5" />
                Business Overview
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl xl:text-5xl">
                    My Business
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                    Grow your brand with affiliates. Review and approve content, and complete required setup only when a campaign is ready to go live.
                  </p>

                  <div className="mt-7 grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)]">
                    <Link
                      href={pendingSubmissionCount > 0 ? "/business/my-business/ad-ideas" : "/business/my-business/affiliate-requests"}
                      prefetch={false}
                      className="group rounded-2xl border border-white/[0.08] bg-black/10 p-5 text-left transition hover:border-[#00C2CB]/35"
                    >
                      <div className="text-sm font-semibold text-white">New affiliate submissions</div>
                      <div className="mt-2 text-4xl font-light text-[#00C2CB]">{pendingSubmissionCount}</div>
                      <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.08] px-4 py-3 text-sm font-bold text-white transition group-hover:border-[#00C2CB]/35 group-hover:text-[#7ff5fb]">
                        Review submissions
                        <span aria-hidden="true">→</span>
                      </div>
                    </Link>

                    <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-5">
                      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                        <IconPuzzle className="h-4 w-4 text-[#00C2CB]" />
                        How Nettmark works
                      </div>
                      <div className="space-y-3">
                        {[
                          "Create offers that affiliates can promote.",
                          "Affiliates submit paid ad or organic post ideas.",
                          "You approve the best content and complete setup only when needed.",
                        ].map((step, index) => (
                          <div key={step} className="flex gap-3 text-sm text-slate-300">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#00C2CB] text-xs font-black text-black">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-xs text-slate-500">
                        Billing, payout, Meta, and tracking prompts appear contextually at approval or launch time.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hidden items-center justify-center xl:flex">
                  <div className="relative flex h-[220px] w-full items-center justify-center rounded-3xl border border-[#00C2CB]/25 bg-black/20">
                    <div className="absolute inset-x-8 top-10 rounded-xl border border-[#00C2CB]/40 bg-[#101415] p-5">
                      <div className="flex items-center gap-4">
                        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#00C2CB]/30 bg-[#00C2CB]/10 text-[#7ff5fb]">
                          <IconStorefront className="h-6 w-6" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="h-2 rounded-full bg-white/20" />
                          <div className="h-2 w-4/5 rounded-full bg-white/10" />
                          <div className="h-2 w-3/5 rounded-full bg-white/10" />
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-6 flex gap-8">
                      {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="grid h-9 w-9 place-items-center rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/10 text-[#7ff5fb]">
                          <IconUsers className="h-4 w-4" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <div className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#00C2CB]/10 text-[#7ff5fb]"><IconStorefront className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-lg font-bold">Offers</h2>
                    <p className="text-xs text-slate-500">Create and manage marketplace offers.</p>
                  </div>
                </div>
                <p className="min-h-[44px] text-sm leading-6 text-slate-400">Create offers for affiliates to promote, then manage commission, tracking, and Meta assets per offer.</p>
                <div className="mt-5 space-y-3">
                  <Link href="/business/my-business/create-offer" prefetch={false} className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 text-sm font-black text-black shadow-[0_12px_28px_rgba(0,194,203,0.2)] hover:bg-[#14d5de]">
                    <IconPlus className="h-4 w-4" /> Create new offer
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/business/my-business" prefetch={false} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs font-semibold text-slate-200 hover:border-[#00C2CB]/35">View offers</Link>
                    <Link href="/business/manage-campaigns" prefetch={false} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs font-semibold text-slate-200 hover:border-[#00C2CB]/35">Performance</Link>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-sm">
                  <span className="text-slate-500">Active offers</span>
                  <span className="font-bold text-white">{liveOfferLabel} →</span>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20 xl:col-span-1">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#00C2CB]/10 text-[#7ff5fb]"><IconPost className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-lg font-bold">Submissions</h2>
                    <p className="text-xs text-slate-500">Review partner requests and content ideas.</p>
                  </div>
                </div>
                <p className="min-h-[44px] text-sm leading-6 text-slate-400">Surface pending paid ad ideas, organic post ideas, and affiliate requests without creating a duplicate submission system.</p>
                <div className="mt-5 space-y-3">
                  <Link href={pendingAdIdeaCount > 0 ? "/business/my-business/ad-ideas" : pendingPostIdeaCount > 0 ? "/business/my-business/post-ideas" : "/business/my-business/affiliate-requests"} prefetch={false} className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 text-sm font-black text-black shadow-[0_12px_28px_rgba(0,194,203,0.2)] hover:bg-[#14d5de]">
                    Review submissions
                    {pendingSubmissionCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-[10px] text-[#7ff5fb]">{pendingSubmissionCount}</span>}
                  </Link>
                  <div className="grid grid-cols-3 gap-2">
                    <Link href="/business/my-business/affiliate-requests" prefetch={false} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-2 text-center text-[11px] font-semibold text-slate-200 hover:border-[#00C2CB]/35">Requests {affiliateRequestCount}</Link>
                    <Link href="/business/my-business/ad-ideas" prefetch={false} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-2 text-center text-[11px] font-semibold text-slate-200 hover:border-[#00C2CB]/35">Ads {pendingAdIdeaCount}</Link>
                    <Link href="/business/my-business/post-ideas" prefetch={false} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-2 text-center text-[11px] font-semibold text-slate-200 hover:border-[#00C2CB]/35">Organic {pendingPostIdeaCount}</Link>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-sm">
                  <span className="text-slate-500">Pending review</span>
                  <span className="font-bold text-white">{pendingSubmissionCount} →</span>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#00C2CB]/10 text-[#7ff5fb]"><IconBolt className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-lg font-bold">Launch readiness</h2>
                    <p className="text-xs text-slate-500">Contextual setup only.</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-400">This is not an onboarding checklist. Nettmark only asks for billing, payouts, Meta, or tracking when an approved launch actually needs it.</p>
                <div className={`mt-5 rounded-2xl border p-4 ${readinessState.tone}`}>
                  <div className="font-semibold">{readinessState.title}</div>
                  <p className="mt-1 text-xs leading-5 opacity-90">{readinessState.desc}</p>
                </div>
                {billingRequiredPrompt && !billingReady && (
                  <div className="mt-4 space-y-3">
                    {!businessCustomerId && (
                      <button onClick={handleConnectBilling} disabled={isSubmitting} className="inline-flex min-h-[40px] w-full items-center justify-center rounded-full bg-[#00C2CB] px-4 text-sm font-bold text-black disabled:opacity-60">
                        {isSubmitting ? "Connecting…" : "Connect billing for this approval"}
                      </button>
                    )}
                    {businessCustomerId && !hasCard && (
                      <button onClick={handleAddPaymentMethod} disabled={loadingPaymentForm} className="inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-[#00C2CB]/40 px-4 text-sm font-bold text-white disabled:opacity-60">
                        {loadingPaymentForm ? "Loading…" : "Add card for this approval"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#7ff5fb]">
                    Setup access
                  </div>
                  <h2 className="text-xl font-bold text-white">Readiness checklist</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                    These tools are available whenever you want them. They are not blockers for creating offers or reviewing submissions — Nettmark will still prompt for the right setup at approval or launch time.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-bold text-white">
                  {setupReadyCount}/5 ready
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${hasAnyOffer ? "bg-[#00C2CB] text-black" : "border border-white/15 text-slate-500"}`}>
                        {hasAnyOffer ? <IconCheck className="h-4 w-4" /> : "1"}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white">Offers</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Create and manage offers affiliates can promote.</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${hasAnyOffer ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-slate-400"}`}>
                      {hasAnyOffer ? "Ready" : "Available"}
                    </span>
                  </div>
                  <Link href="/business/my-business/create-offer" prefetch={false} className="mt-4 inline-flex min-h-[38px] w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-slate-200 hover:border-[#00C2CB]/35">
                    Open offers
                  </Link>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${hasTrackingConnected ? "bg-[#00C2CB] text-black" : "border border-white/15 text-slate-500"}`}>
                        {hasTrackingConnected ? <IconCheck className="h-4 w-4" /> : "2"}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white">Tracking</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Install or verify tracking for launch attribution when campaigns need it.</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${hasTrackingConnected ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : "border-[#00C2CB]/25 bg-[#00C2CB]/10 text-[#7ff5fb]"}`}>
                      {hasTrackingConnected ? "Ready" : "Optional now"}
                    </span>
                  </div>
                  <Link href="/business/setup-tracking" prefetch={false} className="mt-4 inline-flex min-h-[38px] w-full items-center justify-center rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-4 text-xs font-bold text-[#7ff5fb] hover:bg-[#00C2CB]/15">
                    Open tracking setup
                  </Link>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${hasMetaConnected ? "bg-[#00C2CB] text-black" : "border border-white/15 text-slate-500"}`}>
                        {hasMetaConnected ? <IconCheck className="h-4 w-4" /> : "3"}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white">Meta connection</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Connect pages, ad accounts, and pixels for paid campaign launches.</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${hasMetaConnected ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : "border-[#00C2CB]/25 bg-[#00C2CB]/10 text-[#7ff5fb]"}`}>
                      {hasMetaConnected ? "Connected" : "Optional now"}
                    </span>
                  </div>
                  <Link href="/business/my-business/connect-meta" prefetch={false} className="mt-4 inline-flex min-h-[38px] w-full items-center justify-center rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-4 text-xs font-bold text-[#7ff5fb] hover:bg-[#00C2CB]/15">
                    Open Meta setup
                  </Link>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${billingReady ? "bg-[#00C2CB] text-black" : "border border-white/15 text-slate-500"}`}>
                        {billingReady ? <IconCheck className="h-4 w-4" /> : "4"}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white">Billing</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Save a payment method for campaign approvals that require billing readiness.</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${billingReady ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : "border-[#00C2CB]/25 bg-[#00C2CB]/10 text-[#7ff5fb]"}`}>
                      {billingReady ? "Ready" : "Available"}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {!businessCustomerId ? (
                      <button onClick={handleConnectBilling} disabled={isSubmitting} className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[#00C2CB] px-4 text-xs font-black text-black hover:bg-[#14d5de] disabled:opacity-60">
                        {isSubmitting ? "Connecting…" : "Connect billing"}
                      </button>
                    ) : !hasCard ? (
                      <button onClick={handleAddPaymentMethod} disabled={loadingPaymentForm} className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[#00C2CB] px-4 text-xs font-black text-black hover:bg-[#14d5de] disabled:opacity-60">
                        {loadingPaymentForm ? "Loading…" : "Add card"}
                      </button>
                    ) : (
                      <Link href="/business/payouts" prefetch={false} className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 text-xs font-bold text-emerald-200">
                        Billing ready
                      </Link>
                    )}
                    <Link href="/business/payouts" prefetch={false} className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-slate-200 hover:border-[#00C2CB]/35">
                      Payment settings
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4 xl:col-span-2">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${payoutsReady ? "bg-[#00C2CB] text-black" : "border border-white/15 text-slate-500"}`}>
                        {payoutsReady ? <IconCheck className="h-4 w-4" /> : "5"}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-white">Payouts</h3>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${payoutsReady ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" : payoutsRequiredNow ? "border-amber-400/35 bg-amber-400/10 text-amber-100" : "border-[#00C2CB]/25 bg-[#00C2CB]/10 text-[#7ff5fb]"}`}>
                            {payoutsReady ? "Enabled" : payoutsRequiredNow ? "May be needed soon" : "Available"}
                          </span>
                        </div>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                          Stripe payout access remains available here, but affiliates and businesses can still work through offers and reviews before this is required.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 xl:min-w-[220px] sm:grid-cols-1">
                      {!payoutsReady && (
                        <button onClick={handleEnablePayouts} disabled={isEnablingPayouts} className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[#00C2CB] px-4 text-xs font-black text-black hover:bg-[#14d5de] disabled:opacity-60">
                          {isEnablingPayouts ? "Opening Stripe…" : businessAccountId ? "Continue Stripe setup" : "Enable payouts"}
                        </button>
                      )}
                      {businessAccountId && !payoutsReady && (
                        <button onClick={handleRefreshPayoutStatus} className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-slate-200 hover:border-[#00C2CB]/35">
                          Refresh payout status
                        </button>
                      )}
                      <Link href="/business/payouts" prefetch={false} className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-slate-200 hover:border-[#00C2CB]/35">
                        Open payouts page
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {businessCustomerId && showPaymentForm && setupClientSecret && (
              <div className="rounded-[22px] border border-[#00C2CB]/25 bg-[#111314] p-5">
                <h2 className="text-lg font-semibold text-white">Secure payment method</h2>
                <p className="mt-1 text-sm text-slate-400">This appears because the current approval flow requires billing readiness.</p>
                <Elements key={setupClientSecret} stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                  <AddCardForm onComplete={() => setShowPaymentForm(false)} />
                </Elements>
              </div>
            )}

            <section className="rounded-[22px] border border-[#00C2CB]/18 bg-[#111314] p-5 shadow-2xl shadow-black/20 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7ff5fb]">
                    <IconBolt className="h-3.5 w-3.5" />
                    Creative Library
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-white">Upload approved ads and brand content for affiliates</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    This stays available even before Meta or billing are fully set up. Add reusable images, videos, and copy once, then attach each creative to all offers or one specific offer.
                  </p>
                </div>
                <div className="grid gap-2 xl:min-w-[230px]">
                  <Link href="/business/my-business/publish-creatives" prefetch={false} className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-[#00C2CB] px-4 text-xs font-black text-black hover:bg-[#14d5de]">
                    Open content library
                  </Link>
                  <Link href="/business/my-business/publish-creatives?open=1&scope=offer" prefetch={false} className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-slate-200 hover:border-[#00C2CB]/35">
                    Attach creative to offer
                  </Link>
                </div>
              </div>
              {!hasAnyOffer && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                  Create your first offer, then use <strong>Attach creative to offer</strong> to keep uploaded media scoped to that offer only.
                </div>
              )}
            </section>

            <section className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Recent activity</h2>
                  <p className="text-sm text-slate-500">Stay up to date with what is happening.</p>
                </div>
                <Link href="/business/manage-campaigns" prefetch={false} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold text-slate-200 hover:border-[#00C2CB]/35">
                  View campaigns →
                </Link>
              </div>

              {recentActivity.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">
                  No recent submission activity yet. Create an offer and new affiliate activity will appear here when it arrives.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                  {recentActivity.map((item, index) => (
                    <Link key={`${item.title}-${index}`} href={item.href} prefetch={false} className="grid gap-2 border-b border-white/[0.07] bg-black/10 p-4 text-sm transition last:border-b-0 hover:bg-white/[0.03] xl:grid-cols-[210px_minmax(0,1fr)_30px] xl:items-center">
                      <div className="flex items-center gap-3 font-semibold text-white">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#00C2CB] shadow-[0_0_14px_rgba(0,194,203,0.65)]" />
                        {item.title}
                      </div>
                      <div className="text-slate-400">{item.details}</div>
                      <div className="text-right text-[#7ff5fb]">→</div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Marketplace offers</h2>
                  <p className="text-sm text-slate-500">Real offers from your Nettmark business account.</p>
                </div>
                <Link href="/business/my-business/create-offer" prefetch={false} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 py-2 text-sm font-black text-black hover:bg-[#14d5de]">
                  <IconPlus className="h-4 w-4" /> New offer
                </Link>
              </div>

              {offersLoading ? (
                <p className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">Loading your offers…</p>
              ) : offers.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">
                  You haven&apos;t uploaded any offers yet. Create your first offer so affiliates have something to promote.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {offers.map((offer) => {
                    const metaStatus = getOfferMetaStatus(offer);
                    const onboardingTrackingReady = onboardingProgressRows.some((row) => row.offer_id === offer.id && row.tracking_connected);
                    const derivedTrackingReady = Boolean(offer.site_host) && (!trackingReadinessResolved || trackingVerifiedOfferIds.size === 0 || trackingVerifiedOfferIds.has(offer.id));
                    const trackingReady = onboardingTrackingReady || derivedTrackingReady;

                    return (
                      <div key={offer.id} className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.55)] transition hover:border-[#00C2CB]/50">
                        <div className="pointer-events-none absolute inset-x-0 -top-16 h-24 opacity-40 blur-3xl" style={{ background: "radial-gradient(40% 80% at 10% 0%, rgba(0,194,203,0.32), transparent 60%), radial-gradient(40% 80% at 90% 0%, rgba(127,245,251,0.14), transparent 60%)" }} />
                        <div className="relative flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#00C2CB]/10 text-[#7ff5fb]"><IconStorefront className="h-5 w-5" /></div>
                            <div>
                              <h3 className="text-lg font-semibold tracking-tight text-white">{offer.title}</h3>
                              <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-slate-500">{offer.type === "recurring" ? "Recurring offer" : "One-time offer"}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Commission</p>
                            <p className="text-2xl font-semibold text-[#7ff5fb]">{offer.commission}<span className="text-sm">%</span></p>
                          </div>
                        </div>

                        <p className="relative mt-4 line-clamp-3 text-sm leading-6 text-slate-400">{offer.description}</p>

                        <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${trackingReady ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border border-amber-400/40 bg-amber-500/15 text-amber-200"}`}>
                              {trackingReady ? "Tracking ready" : "Marketplace live"}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${metaStatus.tone}`}>{metaStatus.label}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            {trackingReady ? "Tracking is connected for approved launches." : "Affiliates can request approval now. Tracking is handled contextually before launch when required."}
                          </p>
                        </div>

                        <div className="relative mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Link href={`/business/my-business/edit-offer/${offer.id}/`} prefetch={false} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#00C2CB] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#14d5de]">Edit offer</Link>
                          <Link href="/business/my-business/affiliate-requests" prefetch={false} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">View requests</Link>
                          <button
                            type="button"
                            onClick={() => {
                              const approvedCount = approvedAffiliateRequestsByOffer[offer.id]?.length || 0;
                              if (approvedCount === 0) return;
                              setExpandedInviteOfferId((current) =>
                                current === offer.id ? null : offer.id,
                              );
                              setLaunchInviteTypeByOfferId((prev) => ({
                                ...prev,
                                [offer.id]: prev[offer.id] || (metaStatus.label === "Ads enabled" ? "paid" : "organic"),
                              }));
                            }}
                            disabled={(approvedAffiliateRequestsByOffer[offer.id]?.length || 0) === 0}
                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-4 py-2.5 text-sm font-semibold text-[#7ff5fb] hover:bg-[#00C2CB]/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/40"
                          >
                            {(approvedAffiliateRequestsByOffer[offer.id]?.length || 0) > 0
                              ? `Invite affiliates (${approvedAffiliateRequestsByOffer[offer.id].length})`
                              : "No approved affiliates yet"}
                          </button>
                          <button onClick={() => handleDelete(offer.id)} disabled={loadingDeleteId === offer.id} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50">
                            {loadingDeleteId === offer.id ? "Deleting…" : "Delete offer"}
                          </button>
                          {metaStatus.needsSetup && trackingReady && (
                            <Link href={`/business/my-business/edit-offer/${offer.id}/#meta-setup`} prefetch={false} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-4 py-2.5 text-sm font-semibold text-[#7ff5fb] hover:bg-[#00C2CB]/15 sm:col-span-2">{metaStatus.actionLabel}</Link>
                          )}
                        </div>

                        {expandedInviteOfferId === offer.id && (approvedAffiliateRequestsByOffer[offer.id]?.length || 0) > 0 && (
                          <div className="relative mt-4 rounded-2xl border border-[#00C2CB]/20 bg-[#071113] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-white">Invite approved affiliates to launch</p>
                                <p className="mt-1 text-xs leading-5 text-slate-400">
                                  Send a direct Nettmark inbox + email invite for this offer. Choose whether you want them launching paid ads or an organic campaign.
                                </p>
                              </div>
                              <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1 text-xs font-semibold">
                                <button
                                  type="button"
                                  onClick={() => setLaunchInviteTypeByOfferId((prev) => ({ ...prev, [offer.id]: "organic" }))}
                                  className={`rounded-full px-3 py-1.5 transition ${
                                    (launchInviteTypeByOfferId[offer.id] || (metaStatus.label === "Ads enabled" ? "paid" : "organic")) === "organic"
                                      ? "bg-white text-black"
                                      : "text-white/70 hover:text-white"
                                  }`}
                                >
                                  Organic
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (metaStatus.label !== "Ads enabled") return;
                                    setLaunchInviteTypeByOfferId((prev) => ({ ...prev, [offer.id]: "paid" }));
                                  }}
                                  disabled={metaStatus.label !== "Ads enabled"}
                                  className={`rounded-full px-3 py-1.5 transition ${
                                    (launchInviteTypeByOfferId[offer.id] || (metaStatus.label === "Ads enabled" ? "paid" : "organic")) === "paid"
                                      ? "bg-[#00C2CB] text-black"
                                      : "text-white/70 hover:text-white"
                                  } disabled:cursor-not-allowed disabled:opacity-40`}
                                >
                                  Paid ads
                                </button>
                              </div>
                            </div>

                            {metaStatus.label !== "Ads enabled" && (
                              <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                                This offer is currently organic-only. Finish Meta setup first if you want to invite affiliates into paid launches.
                              </p>
                            )}

                            <div className="mt-4 space-y-3">
                              {approvedAffiliateRequestsByOffer[offer.id].map((request) => {
                                const inviteType = launchInviteTypeByOfferId[offer.id] || (metaStatus.label === "Ads enabled" ? "paid" : "organic");
                                const inviteStatus = launchInviteStatusByRequestId[request.id] || "idle";
                                return (
                                  <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-white">{request.affiliate_email}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        Approved {new Date(request.created_at).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                                      <button
                                        type="button"
                                        onClick={() => handleSendLaunchInvite(offer, request, inviteType)}
                                        disabled={inviteStatus === "sending" || inviteStatus === "sent"}
                                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black hover:bg-[#14d5de] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {inviteStatus === "sending"
                                          ? "Sending…"
                                          : inviteStatus === "sent"
                                            ? "Invite sent"
                                            : inviteType === "paid"
                                              ? "Send paid invite"
                                              : "Send organic invite"}
                                      </button>
                                      {inviteStatus === "error" && (
                                        <p className="text-xs text-rose-300">Couldn&apos;t send the invite. Try again.</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20">
              <h2 className="text-lg font-bold text-white">Business status</h2>
              <p className="mt-1 text-sm text-slate-500">
                {hasAnyOffer ? "Your business is ready to receive affiliate activity." : "Create an offer to start receiving affiliate activity."}
              </p>
              <div className="my-5 h-px bg-white/[0.07]" />
              <div className="space-y-3">
                {[
                  { label: "Business profile available", done: profileComplete },
                  { label: "Brand or tracking assets available", done: brandAssetsAvailable },
                  { label: "One or more offers created", done: activeOfferCount > 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${item.done ? "bg-[#00C2CB] text-black" : "border border-white/15 text-slate-500"}`}>
                      {item.done ? <IconCheck className="h-3.5 w-3.5" /> : ""}
                    </span>
                    <span className={item.done ? "text-slate-200" : "text-slate-500"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/[0.08] bg-[#151718] p-5 shadow-2xl shadow-black/20">
              <h2 className="text-lg font-bold text-white">Need help?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Our team is here to help you grow with affiliates.</p>
              <div className="mt-5 space-y-3">
                <button type="button" onClick={handleOpenAssistant} className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full bg-[#00C2CB] px-4 text-sm font-black text-black hover:bg-[#14d5de]">
                  <IconChat className="h-4 w-4" /> Chat with support
                </button>
                <Link href="/business/support" prefetch={false} className="inline-flex min-h-[42px] w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm font-bold text-slate-200 hover:border-[#00C2CB]/35">
                  View help center
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
