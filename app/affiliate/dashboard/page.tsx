"use client";

import { useSessionContext } from "@supabase/auth-helpers-react";
import { RocketLaunchIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "utils/supabase/pages-client";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  Wallet,
  CheckCircle,
  Sparkles,
  ArrowRight,
  CreditCard,
  Store,
  CheckCircle2,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Circle,
  MessageCircle,
} from "lucide-react";
import DashboardCard from "@/components/DashboardCard";
import { Button, SectionHeader, StatCard } from "@/../components/ui";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

// Currency formatter helper
const formatCurrency = (value: number) => {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

interface Profile {
  id: string;
  role: string | null;
  onboarding_completed: boolean | null;
  username?: string | null;
}

interface ApprovedRequest {
  offer_id: string;
}

interface Offer {
  id: string;
  title: string;
  description: string;
  commission: number;
  type: string;
  payoutType: string;
  ideaId?: string; // optional idea ID for active campaign tracking
}

interface LiveAdRow {
  id: string;
  spend: number | null;
  status: string | null;
  created_at: string | null;
}

interface TrackingEventRow {
  id: string;
  created_at: string | null;
  event_type?: string | null;
  affiliate_id?: string | null;
}

// (Not used on the dashboard right now, but keeping for future ad preview use)
const renderMedia = (idea: any) => {
  const file = idea.file_url;

  if (!file) {
    return <div className="text-gray-500 italic">No media file</div>;
  }

  const isVideo =
    file.toLowerCase().endsWith(".mp4") || file.toLowerCase().includes(".mp4");
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);

  if (isVideo) {
    return (
      <video
        controls
        className="rounded-lg border border-gray-300 max-h-48 w-full object-cover"
      >
        <source src={file} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  }

  if (isImage) {
    return (
      <img
        src={file}
        alt="Ad Preview"
        className="rounded-lg border border-gray-300 max-h-48 w-full object-cover"
        onError={(e) => {
          e.currentTarget.src = "/placeholder.png"; // fallback if image fails to load
        }}
      />
    );
  }

  return <div className="text-gray-500 italic">Unsupported media type</div>;
};

function AffiliateDashboardContent() {
  const { session, isLoading } = useSessionContext();
  const router = useRouter();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [adIdeas, setAdIdeas] = useState<any[]>([]);
  const [liveCampaigns, setLiveCampaigns] = useState<any[]>([]);

  // loading/profile
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // live ads + payouts
  const [liveAds, setLiveAds] = useState<any[]>([]);
  const [walletPayouts, setWalletPayouts] = useState<any[]>([]);

  // chart series
  const [spendSeries, setSpendSeries] = useState<
    { name: string; value: number }[]
  >([]);
  const [conversionSeries, setConversionSeries] = useState<
    { name: string; value: number }[]
  >([]);

  // timeframe selection for Ad Spend chart
  const [spendTimeframe, setSpendTimeframe] = useState<
    "7d" | "30d" | "365d" | "custom"
  >("30d");
  const [spendRange, setSpendRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  // timeframe selection for Conversions chart
  const [convTimeframe, setConvTimeframe] = useState<
    "7d" | "30d" | "365d" | "custom"
  >("30d");
  const [convRange, setConvRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  useEffect(() => {
    if (isLoading) return; // wait for session resolution
    if (session === null) {
      const next = encodeURIComponent("/affiliate/dashboard");
      router.replace(`/login/affiliate?next=${next}`);
      return;
    }
  }, [session, isLoading, router]);

  // Profile check (redirects currently disabled to avoid loop)
  useEffect(() => {
    const checkProfile = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, onboarding_completed, terms_accepted, username")
        .eq("id", session.user.id)
        .maybeSingle<any>();

      // Redirect logic commented out for now:
      /*
      if (error || !data) {
        router.replace('/create-account?role=affiliate');
        return;
      }

      if (!data.role) {
        router.replace('/create-account?role=affiliate');
        return;
      }

      if (data.role !== 'affiliate') {
        router.replace('/business/dashboard');
        return;
      }
      */

      setProfile(data);
      setLoading(false);
    };

    if (session?.user) {
      setLoading(true);
      void checkProfile();
    }
  }, [session, router]);

  useEffect(() => {
    if (!session || !session.user) return;

    const loadInitialData = async () => {
      // derive date windows for each chart
      const now = new Date();

      // Ad Spend window
      let spendFromIso: string | null = null;
      let spendToIso: string | null = now.toISOString();

      if (spendTimeframe === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        spendFromIso = d.toISOString();
      } else if (spendTimeframe === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        spendFromIso = d.toISOString();
      } else if (spendTimeframe === "365d") {
        const d = new Date();
        d.setDate(d.getDate() - 365);
        spendFromIso = d.toISOString();
      } else if (spendTimeframe === "custom") {
        if (spendRange.from && spendRange.to) {
          const from = new Date(spendRange.from);
          const to = new Date(spendRange.to);
          spendFromIso = from.toISOString();
          spendToIso = to.toISOString();
        } else {
          spendFromIso = null;
          spendToIso = null;
        }
      }

      // Conversions window
      let convFromIso: string | null = null;
      let convToIso: string | null = now.toISOString();

      if (convTimeframe === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        convFromIso = d.toISOString();
      } else if (convTimeframe === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        convFromIso = d.toISOString();
      } else if (convTimeframe === "365d") {
        const d = new Date();
        d.setDate(d.getDate() - 365);
        convFromIso = d.toISOString();
      } else if (convTimeframe === "custom") {
        if (convRange.from && convRange.to) {
          const from = new Date(convRange.from);
          const to = new Date(convRange.to);
          convFromIso = from.toISOString();
          convToIso = to.toISOString();
        } else {
          convFromIso = null;
          convToIso = null;
        }
      }

      // Fetch offers
      const { data: liveOffers, error: offerError } = await supabase
        .from("offers")
        .select("*");

      if (offerError) {
        console.error("[❌ Failed to fetch offers]", offerError);
        setOffers([]);
      } else {
        setOffers(liveOffers || []);
      }

      // Approved requests for this affiliate
      const { data: approved, error: approvedError } = (await supabase
        .from("affiliate_requests")
        .select("offer_id")
        .eq("affiliate_email", session.user?.email || "")
        .eq("status", "approved")) as {
        data: ApprovedRequest[] | null;
        error: any;
      };

      if (approvedError) {
        console.error("[❌ Failed to fetch approved requests]", approvedError);
      } else {
        const ids = Array.from(
          new Set((approved || []).map((r: ApprovedRequest) => r.offer_id)),
        );
        setApprovedIds(ids);
        setApprovedRequestCount((approved || []).length);
        console.log("[✅ Approved IDs]", ids);
      }

      const { data: allRequests, error: allRequestsError } = await (supabase as any)
        .from("affiliate_requests")
        .select("id")
        .eq("affiliate_email", session.user?.email || "");

      if (allRequestsError) {
        console.error("[❌ Failed to fetch all affiliate requests]", allRequestsError);
      } else {
        setRequestCount((allRequests || []).length);
      }

      // Approved ad ideas for this affiliate
      const { data: ideas, error: ideasError } = await supabase
        .from("ad_ideas")
        .select(
          `
          id,
          offer_id,
          affiliate_email,
          file_url,
          status,
          caption
        `,
        )
        .eq("affiliate_email", session.user?.email || "")
        .eq("status", "approved");

      if (ideasError) {
        console.error("[❌ Failed to fetch ad ideas]", ideasError);
        setAdIdeas([]);
      } else {
        setAdIdeas(ideas || []);
      }

      // Live organic campaigns for this affiliate
      const { data: live, error: liveErr } = await supabase
        .from("live_campaigns")
        .select(
          "id, offer_id, media_url, caption, platform, status, created_at",
        )
        .eq("affiliate_email", session.user?.email || "");

      if (liveErr) {
        console.error("[❌ Failed to fetch live_campaigns]", liveErr);
        setLiveCampaigns([]);
      } else {
        setLiveCampaigns(live || []);
      }

      // Live ads (Meta paid) for this affiliate within Ad Spend window
      let adsQuery = supabase
        .from("live_ads")
        .select("id, spend, status, created_at")
        .eq("affiliate_email", session.user?.email || "");

      if (spendFromIso) {
        adsQuery = adsQuery.gte("created_at", spendFromIso);
      }
      if (spendToIso) {
        adsQuery = adsQuery.lte("created_at", spendToIso);
      }

      const { data: ads, error: adsErr } = await adsQuery;

      if (adsErr) {
        console.error("[❌ Failed to fetch live_ads]", adsErr);
        setLiveAds([]);
      } else {
        const adsSafe = (ads || []) as LiveAdRow[];
        setLiveAds(adsSafe);

        // Build spend series by day
        const spendByDate: Record<string, number> = {};
        for (const ad of adsSafe) {
          if (!ad.created_at) continue;
          const dateKey = new Date(ad.created_at).toISOString().slice(0, 10); // YYYY-MM-DD
          const val = Number(ad.spend ?? 0);
          if (isNaN(val)) continue;
          spendByDate[dateKey] = (spendByDate[dateKey] || 0) + val;
        }

        const sortedSpend = Object.entries(spendByDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({
            name: new Date(date).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
            }),
            value,
          }));

        setSpendSeries(sortedSpend);
      }

      // Conversions from tracking events — only true conversion-type events for this affiliate
      let convQuery = supabase
        .from("campaign_tracking_events")
        .select("id, created_at, event_type, affiliate_id")
        .eq("affiliate_id", session.user?.email || "")
        .in("event_type", ["conversion", "purchase", "order", "checkout_completed"]);

      if (convFromIso) {
        convQuery = convQuery.gte("created_at", convFromIso);
      }
      if (convToIso) {
        convQuery = convQuery.lte("created_at", convToIso);
      }

      const { data: conversions, error: convErr } = await convQuery;

      if (convErr) {
        console.error("[❌ Failed to fetch campaign_tracking_events]", convErr);
        setConversionSeries([]);
      } else {
        const convSafe = (conversions || []) as TrackingEventRow[];
        console.log(
          "[✅ Conversions loaded for affiliate conversions chart]",
          convSafe.length,
        );

        const convByDate: Record<string, number> = {};
        for (const ev of convSafe) {
          if (!ev.created_at) continue;
          const dateKey = new Date(ev.created_at).toISOString().slice(0, 10);
          convByDate[dateKey] = (convByDate[dateKey] || 0) + 1;
        }

        const sortedConv = Object.entries(convByDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({
            name: new Date(date).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
            }),
            value,
          }));

        setConversionSeries(sortedConv);
      }

      const { data: clickEvents, error: clickErr } = await (supabase as any)
        .from("campaign_tracking_events")
        .select("id")
        .eq("affiliate_id", session.user?.email || "")
        .in("event_type", ["click", "landing_view", "page_view"]);

      if (clickErr) {
        console.error("[❌ Failed to fetch click events]", clickErr);
      } else {
        setClickCount((clickEvents || []).length);
      }

      // Wallet payouts for this affiliate
      const { data: payouts, error: payoutsErr } = await supabase
        .from("wallet_payouts")
        .select("id, amount, status")
        .eq("affiliate_email", session.user?.email || "");

      if (payoutsErr) {
        console.error("[❌ Failed to fetch wallet_payouts]", payoutsErr);
        setWalletPayouts([]);
      } else {
        setWalletPayouts(payouts || []);
      }
    };

    void loadInitialData();
  }, [
    session,
    spendTimeframe,
    spendRange.from,
    spendRange.to,
    convTimeframe,
    convRange.from,
    convRange.to,
  ]);

  useEffect(() => {
    if (session?.user && approvedIds.length === 0) {
      console.warn("[⚠️ No approved offers — user still stays on dashboard]");
    }
  }, [session, approvedIds]);

  const user = session?.user;
  const firstName = (user?.email || "Partner").split("@")[0];
  const [checklistState, setChecklistState] = useState({
    payouts: false,
    marketplace: false,
  });
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [checklistCompletionSent, setChecklistCompletionSent] = useState(false);
  const [showChecklistDetails, setShowChecklistDetails] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [approvedRequestCount, setApprovedRequestCount] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const checklistStorageKey = user ? `affiliate-checklist-${user.id}` : null;
  const checklistDismissedStorageKey = user
    ? `affiliate-checklist-dismissed-${user.id}`
    : null;
  const approvedOffers = offers.filter((offer) =>
    approvedIds.includes(offer.id),
  );
  const activeCampaigns = (liveCampaigns || [])
    .map((camp: any) => {
      const matchedOffer = offers.find((offer) => offer.id === camp.offer_id);
      return matchedOffer ? { ...matchedOffer, ideaId: camp.id } : null; // reusing ideaId for campaignId
    })
    .filter(Boolean) as Offer[];

  // Derived metrics for stat cards
  const activeCampaignCount =
    (activeCampaigns?.length || 0) + (liveAds?.length || 0);

  const totalSpent = (liveAds || []).reduce((sum: number, ad: any) => {
    const val = Number(ad.spend || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const pendingPayoutTotal = (walletPayouts || [])
    .filter((p: any) => p.status === "pending")
    .reduce((sum: number, p: any) => {
      const val = Number(p.amount || 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  const checklistAllDone = checklistState.payouts && checklistState.marketplace;

  useEffect(() => {
    if (!checklistStorageKey || typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(checklistStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          typeof parsed?.payouts === "boolean" &&
          typeof parsed?.marketplace === "boolean"
        ) {
          setChecklistState(parsed);
        }
      }
    } catch (err) {
      console.warn("[Checklist] Failed to read state", err);
    }
  }, [checklistStorageKey]);

  useEffect(() => {
    if (!checklistDismissedStorageKey || typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(checklistDismissedStorageKey);
      if (stored === "1") {
        setChecklistDismissed(true);
      }
    } catch (err) {
      console.warn("[Checklist] Failed to read dismissed state", err);
    }
  }, [checklistDismissedStorageKey]);

  useEffect(() => {
    if (!checklistStorageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        checklistStorageKey,
        JSON.stringify(checklistState),
      );
    } catch (err) {
      console.warn("[Checklist] Failed to persist state", err);
    }
  }, [checklistStorageKey, checklistState]);

  useEffect(() => {
    if (!checklistDismissedStorageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        checklistDismissedStorageKey,
        checklistDismissed ? "1" : "0",
      );
    } catch (err) {
      console.warn("[Checklist] Failed to persist dismissed state", err);
    }
  }, [checklistDismissedStorageKey, checklistDismissed]);

  useEffect(() => {
    if (profile?.onboarding_completed) {
      setChecklistState({ payouts: true, marketplace: true });
      setChecklistDismissed(true);
    }
  }, [profile?.onboarding_completed]);

  const markChecklistComplete = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/onboarding-complete", {
        method: "POST",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        console.warn(
          "[Checklist] onboarding-complete failed",
          payload?.error || res.status,
        );
      }
    } catch (err) {
      console.warn("[Checklist] onboarding-complete failed", err);
    } finally {
      setChecklistCompletionSent(true);
      setChecklistDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (
      !profile?.onboarding_completed &&
      checklistAllDone &&
      !checklistCompletionSent
    ) {
      void markChecklistComplete();
    }
  }, [
    checklistAllDone,
    checklistCompletionSent,
    markChecklistComplete,
    profile?.onboarding_completed,
  ]);

  type ChecklistKey = "payouts" | "marketplace";

  const handleChecklistAction = (task: ChecklistKey, href: string) => {
    router.push(href);
    setChecklistState((prev) => ({ ...prev, [task]: true }));
  };

  // State for toggling show all/less for campaigns and offers
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);

  const visibleCampaigns = showAllCampaigns
    ? activeCampaigns
    : activeCampaigns.slice(0, 1);
  const visibleOffers = showAllOffers
    ? approvedOffers
    : approvedOffers.slice(0, 1);

  if (loading) {
    return (
      <div className="affiliate-dashboard-theme min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="p-4">Loading...</div>
      </div>
    );
  }
  if (!user) {
    return null; // redirect handled above
  }

  const chartConfigs = [
    { id: "spend", title: "Ad Spend", data: spendSeries },
    { id: "conv", title: "Conversions", data: conversionSeries },
  ];

  const quickActions = [
    { label: "Promote offer", href: "/affiliate/marketplace" },
    {
      label: "Manage campaigns",
      href: "/affiliate/dashboard/manage-campaigns",
    },
    { label: "Open wallet", href: "/affiliate/wallet" },
    { label: "Support", href: "/affiliate/support" },
  ];

  const checklistTasks: {
    key: ChecklistKey;
    title: string;
    description: string;
    href: string;
    cta: string;
    icon: typeof CreditCard;
  }[] = [
    {
      key: "payouts",
      title: "Connect payouts (Stripe)",
      description:
        "Hook up Stripe Express so we can pay commissions automatically.",
      href: "/affiliate/settings#withdrawals",
      cta: "Connect payouts",
      icon: CreditCard,
    },
    {
      key: "marketplace",
      title: "Browse the marketplace",
      description:
        "Pick an offer to promote so your dashboard data can populate.",
      href: "/affiliate/marketplace",
      cta: "Open marketplace",
      icon: Store,
    },
  ];

  const activationItems = [
    {
      label: "Browse offers",
      description: "Choose an offer from the marketplace.",
      done: requestCount > 0,
      href: "/affiliate/marketplace",
    },
    {
      label: "Request approval",
      description: "Ask the business to approve you before promoting.",
      done: requestCount > 0,
      href: "/affiliate/marketplace",
    },
    {
      label: "Get approved",
      description: "Approved offers unlock paid ads and organic promotion.",
      done: approvedRequestCount > 0,
      href: "/affiliate/inbox",
    },
    {
      label: "Promote the offer",
      description: "Submit paid ads or organic content for review.",
      done: activeCampaignCount > 0,
      href: "/affiliate/dashboard",
    },
    {
      label: "Track results",
      description: "Watch clicks, conversions, and commissions.",
      done: clickCount > 0 || pendingPayoutTotal > 0,
      href: "/affiliate/dashboard/manage-campaigns",
    },
  ];
  const activationDoneCount = activationItems.filter((item) => item.done).length;
  const activationProgress = Math.round((activationDoneCount / activationItems.length) * 100);

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

  return (
    <div className="affiliate-dashboard-theme min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8">
        <section
          className="relative mb-8 overflow-hidden rounded-3xl border border-[var(--border)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.16)] md:p-8"
          style={{
            background:
              "radial-gradient(circle at top right, rgba(0,194,203,0.16), transparent 34%), linear-gradient(135deg, var(--card) 0%, color-mix(in srgb, var(--card) 82%, var(--primary) 18%) 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-40 dark:via-white/20" />
          <div className="pointer-events-none absolute -top-16 right-0 h-44 w-44 rounded-full bg-[#00C2CB]/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-40 w-40 rounded-full bg-[#00C2CB]/6 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Affiliate Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/82 sm:text-base">
                Welcome back, {firstName}. Track campaign performance, monitor
                spend, and launch approved offers faster.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button href="/affiliate/marketplace" variant="secondary">
                Browse Offers <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/affiliate/wallet" variant="secondary">
                Open Wallet
              </Button>
            </div>
          </div>
        </section>

        <section className="mb-7 rounded-2xl border border-white/12 bg-[#111317] p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-xl border border-white/12 bg-[#15191c] p-2">
                <ListChecks className="h-4 w-4 text-white/85" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Affiliate launch path</p>
                <p className="text-xs text-white/60">
                  Choose an offer, request approval, then promote it through paid ads or organic content.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenAssistant}
                className="inline-flex items-center gap-2 rounded-lg border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-2 text-xs font-semibold text-[#7ff5fb] transition hover:bg-[#00C2CB]/15"
              >
                <MessageCircle className="h-4 w-4" />
                Stuck? Talk to the Nettmark bot
              </button>
              <button
                onClick={() => setShowChecklistDetails((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-[#15191c]"
              >
                {showChecklistDetails ? "Hide steps" : "Show steps"}
                {showChecklistDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#1b2026]">
            <div
              className="h-full rounded-full bg-[#00C2CB] transition-all"
              style={{ width: `${activationProgress}%` }}
            />
          </div>

          {showChecklistDetails && (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {activationItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#15191c] px-3 py-3"
                >
                  <span>
                    <span className="block text-sm font-medium text-white/90">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/55">
                      {item.description}
                    </span>
                  </span>
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7ff5fb]" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {approvedOffers.length > 0 && (
          <section className="mb-7 rounded-2xl border border-[#00C2CB]/25 bg-[#0f161b] p-4 md:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7ff5fb]">
              Approved to promote
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {approvedOffers[0]?.title || "Offer approved"}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/affiliate/dashboard/promote/${approvedOffers[0].id}?mode=ad`}
                className="rounded-lg bg-[#00C2CB] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#28d3da]"
              >
                Launch Campaign
              </Link>
              <Link
                href={`/affiliate/dashboard/promote/${approvedOffers[0].id}?mode=organic`}
                className="rounded-lg border border-white/12 bg-[#15191c] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-[#1a2026]"
              >
                Promote Organically
              </Link>
            </div>
          </section>
        )}

        <section className="mb-7">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
            Quick actions
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="shrink-0 rounded-full border border-white/10 bg-[#111317] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-[#15191c]"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        <SectionHeader eyebrow="Snapshot" title="Dashboard snapshot" className="mb-4" />
        <div className="mb-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active campaigns" value={activeCampaignCount} icon={<TrendingUp className="h-4 w-4" />} tone="primary" />
          <StatCard label="Total spent" value={formatCurrency(totalSpent)} icon={<DollarSign className="h-4 w-4" />} tone="primary" />
          <StatCard label="Pending payout" value={formatCurrency(pendingPayoutTotal)} icon={<Wallet className="h-4 w-4" />} tone="muted" />
          <StatCard label="Approved offers" value={approvedOffers.length} icon={<CheckCircle className="h-4 w-4" />} tone="success" />
        </div>

        <SectionHeader eyebrow="Performance" title="Performance trends" className="mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {chartConfigs.map((chart) => {
            const isSpendChart = chart.id === "spend";
            const tf = isSpendChart ? spendTimeframe : convTimeframe;
            const setTf = isSpendChart ? setSpendTimeframe : setConvTimeframe;
            const range = isSpendChart ? spendRange : convRange;
            const setRange = isSpendChart ? setSpendRange : setConvRange;

            return (
              <div
                key={chart.title}
                className="affiliate-chart-panel relative overflow-hidden rounded-3xl bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-3xl opacity-80"
                  style={{
                    background:
                      "radial-gradient(circle at top left, rgba(0,194,203,0.12), transparent 55%)",
                  }}
                />
                <div className="relative z-10">
                  {(() => {
                    const totalValue = chart.data.reduce(
                      (sum, point) => sum + Number(point.value || 0),
                      0,
                    );
                    const latestValue = chart.data.length
                      ? Number(chart.data[chart.data.length - 1].value || 0)
                      : 0;
                    const accent = chart.id === "spend" ? "#00C2CB" : "#7ff5fb";
                    const gradientId = `${chart.id}-gradient`;
                    const avgGradientId = `${chart.id}-avg-gradient`;
                    const timeframeCopy =
                      tf === "7d"
                        ? "Last 7 days"
                        : tf === "30d"
                          ? "Last 30 days"
                          : tf === "365d"
                            ? "Last 12 months"
                            : "Custom range";

                    const windowSize = Math.min(
                      5,
                      Math.max(3, Math.floor(chart.data.length / 6) || 3),
                    );
                    const trendData = chart.data.map((point, idx, arr) => {
                      const numericVal = Number(point.value || 0);
                      const startSlice = Math.max(0, idx - (windowSize - 1));
                      const slice = arr.slice(startSlice, idx + 1);
                      const avg =
                        slice.reduce(
                          (sum, item) => sum + Number(item.value || 0),
                          0,
                        ) / slice.length || 0;
                      return {
                        ...point,
                        value: numericVal,
                        average: avg,
                      };
                    });

                    const cadenceStep = (() => {
                      if (tf === "365d")
                        return Math.max(1, Math.floor(trendData.length / 6));
                      if (tf === "30d") return 7;
                      if (tf === "7d") return 1;
                      return Math.max(1, Math.floor(trendData.length / 4));
                    })();

                    const formatValue = (val: number) =>
                      chart.id === "spend"
                        ? formatCurrency(val)
                        : val.toLocaleString();

                    return (
                      <>
                        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
                              {chart.title}
                            </p>
                            <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                              {formatValue(totalValue)}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {timeframeCopy}
                            </p>
                          </div>
                          <div className="flex flex-col items-start gap-2 md:items-end">
                            <div className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                              Latest day
                            </div>
                            <p className="text-lg font-semibold text-[var(--foreground)]">
                              {formatValue(latestValue)}
                            </p>
                            <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1 py-0.5">
                              {[
                                { label: "7D", value: "7d" as const },
                                { label: "30D", value: "30d" as const },
                                { label: "1Y", value: "365d" as const },
                                { label: "Custom", value: "custom" as const },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => setTf(option.value)}
                                  className={`px-2 py-0.5 text-[10px] rounded-full transition ${
                                    tf === option.value
                                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold"
                                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {tf === "custom" && (
                          <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
                            <label className="flex items-center gap-2">
                              <span>From</span>
                              <input
                                type="date"
                                className="rounded-md border border-[var(--border)] bg-[var(--input-background)] px-2 py-1 text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                                value={range.from}
                                onChange={(e) =>
                                  setRange((prev) => ({
                                    ...prev,
                                    from: e.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label className="flex items-center gap-2">
                              <span>To</span>
                              <input
                                type="date"
                                className="rounded-md border border-[var(--border)] bg-[var(--input-background)] px-2 py-1 text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                                value={range.to}
                                onChange={(e) =>
                                  setRange((prev) => ({
                                    ...prev,
                                    to: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                        )}

                        {trendData.length === 0 ? (
                          <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--secondary)] px-4 py-6">
                            <h3 className="mb-1 text-sm font-semibold text-[var(--primary)]">
                              {chart.title.includes("Ad Spend")
                                ? "No ad spend recorded yet"
                                : "No conversions recorded yet"}
                            </h3>
                            <p className="mb-4 text-xs text-[var(--muted-foreground)]">
                              {chart.title.includes("Ad Spend")
                                ? "Once you start running campaigns, your daily spend will appear here."
                                : "As soon as tracking fires, daily conversions will show up here."}
                            </p>
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-5">
                              <div className="relative h-16 w-full">
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    background:
                                      "linear-gradient(135deg, rgba(0,194,203,0.15), transparent 60%)",
                                  }}
                                />
                                <svg
                                  viewBox="0 0 200 60"
                                  className="relative z-10 h-full w-full opacity-40"
                                >
                                  <path
                                    d="M0 50 Q40 40 70 45 T130 15 T200 5"
                                    stroke="#00C2CB"
                                    strokeWidth="3"
                                    fill="none"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={230}>
                            <AreaChart
                              data={trendData}
                              margin={{ left: 4, right: 8, top: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient
                                  id={gradientId}
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="0%"
                                    stopColor={accent}
                                    stopOpacity={0.4}
                                  />
                                  <stop
                                    offset="80%"
                                    stopColor={accent}
                                    stopOpacity={0.05}
                                  />
                                </linearGradient>
                                <linearGradient
                                  id={avgGradientId}
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="0%"
                                    stopColor="#9ca3af"
                                    stopOpacity={0.35}
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor="#9ca3af"
                                    stopOpacity={0.05}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                stroke="rgba(148,163,184,0.12)"
                                strokeDasharray="2 6"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="name"
                                padding={{ left: 10, right: 10 }}
                                tick={{ fill: "#9ca3af", fontSize: 11 }}
                                tickMargin={8}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                domain={[0, "auto"]}
                                tick={{ fill: "#9ca3af", fontSize: 11 }}
                                tickMargin={8}
                                axisLine={false}
                                tickLine={false}
                              />
                              {[...trendData.entries()].map(([idx, point]) =>
                                idx % cadenceStep === 0 ? (
                                  <ReferenceLine
                                    key={`${chart.id}-ref-${idx}`}
                                    x={point.name}
                                    stroke="rgba(148,163,184,0.22)"
                                    strokeDasharray="3 3"
                                  />
                                ) : null,
                              )}
                              <Tooltip
                                cursor={{
                                  stroke: "rgba(148,163,184,0.2)",
                                  strokeWidth: 1.5,
                                }}
                                contentStyle={{
                                  backgroundColor: "var(--card)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                }}
                                labelStyle={{
                                  fontSize: 11,
                                  color: "var(--foreground)",
                                  marginBottom: 4,
                                }}
                                itemStyle={{
                                  fontSize: 12,
                                  color: "var(--foreground)",
                                  fontWeight: 600,
                                }}
                                formatter={(value: number, name: string) => {
                                  const label =
                                    name === "average"
                                      ? "Rolling avg"
                                      : "Daily";
                                  return [formatValue(value), label];
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke={accent}
                                strokeWidth={2.5}
                                fill={`url(#${gradientId})`}
                                activeDot={{ r: 4, fill: accent }}
                                dot={{ r: 0 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="average"
                                stroke="rgba(148,163,184,0.6)"
                                strokeWidth={1.5}
                                strokeDasharray="4 6"
                                dot={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        <section className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">
            Action queue
          </p>
        </section>
        <div className="flex flex-col md:flex-row justify-between gap-6 mt-2">
          {/* Active Campaigns */}
          <div className="w-full md:w-1/2">
            <DashboardCard interactive={false} className="h-full">
              <h2 className="text-lg font-semibold text-[#00C2CB] mb-4">
                Active Campaigns
              </h2>
              {activeCampaigns.length === 0 ? (
                <div className="rounded-xl border border-white/12 bg-[#15191c] p-6 text-center text-white/70">
                  <p className="font-medium text-white/85">
                    No active campaigns yet.
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    Start by promoting an approved offer and launch your first
                    campaign.
                  </p>
                  <Link
                    href="/affiliate/marketplace"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#111317] px-3.5 py-2 text-sm font-semibold text-white/80 transition hover:bg-[#15191c]"
                  >
                    Start first campaign <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <>
                  {visibleCampaigns.map((offer) => (
                    <div
                      key={`${offer.id}-${offer.ideaId}`}
                      className="flex items-center justify-between bg-[#15191c] border border-white/12 rounded-xl px-4 py-3 hover:bg-[#1b1f23] transition mb-3"
                    >
                      <div className="flex flex-col">
                        <p className="text-white font-semibold">
                          {offer.title}
                        </p>
                        <div className="flex items-center">
                          <RocketLaunchIcon className="w-5 h-5 text-[#00C2CB] mr-2" />
                          <span className="truncate text-sm text-white/70">
                            Campaign: {offer.ideaId?.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/affiliate/dashboard/manage-campaigns/${offer.ideaId}`}
                        className="text-sm px-3 py-1 rounded-lg border border-white/10 bg-[#111317] text-white/80 transition hover:bg-[#15191c]"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                  {activeCampaigns.length > 1 && (
                    <button
                      onClick={() => setShowAllCampaigns((prev) => !prev)}
                      className="w-full text-center text-sm text-[#00C2CB] hover:text-[#00b0b8] mt-2"
                    >
                      {showAllCampaigns
                        ? "Show Less"
                        : `View All (${activeCampaigns.length})`}
                    </button>
                  )}
                </>
              )}
            </DashboardCard>
          </div>

          {/* Approved Offers */}
          <div className="w-full md:w-1/2">
            <DashboardCard interactive={false} className="h-full">
              <h2 className="text-lg font-semibold text-[#00C2CB] mb-4">
                Approved Offers
              </h2>
              {approvedOffers.length === 0 ? (
                <div className="rounded-xl border border-white/12 bg-[#15191c] p-6 text-center text-white/70">
                  <p className="font-medium text-white/85">
                    No approved offers yet.
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    Browse the marketplace and request offers to unlock your
                    promotion queue.
                  </p>
                  <Link
                    href="/affiliate/marketplace"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#111317] px-3.5 py-2 text-sm font-semibold text-white/80 transition hover:bg-[#15191c]"
                  >
                    Browse marketplace <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <>
                  {visibleOffers.map((offer) => (
                    <div
                      key={`${offer.id}-${offer.title}`}
                      className="flex items-center justify-between bg-[#15191c] border border-white/12 rounded-xl px-4 py-3 hover:bg-[#1b1f23] transition mb-3"
                    >
                      <div className="flex flex-col">
                        <p className="text-white font-semibold">
                          {offer.title}
                        </p>
                        <div className="flex items-center">
                          <RocketLaunchIcon className="w-5 h-5 text-[#00C2CB] mr-2" />
                          <span className="truncate text-sm text-white/70">
                            Commission: {offer.commission}% | Type:{" "}
                            {offer.payoutType}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/affiliate/dashboard/promote/${offer.id}`}
                        className="text-sm px-3 py-1 rounded-lg border border-white/10 bg-[#111317] text-white/80 transition hover:bg-[#15191c]"
                      >
                        Promote
                      </Link>
                    </div>
                  ))}
                  {approvedOffers.length > 1 && (
                    <button
                      onClick={() => setShowAllOffers((prev) => !prev)}
                      className="w-full text-center text-sm text-[#00C2CB] hover:text-[#00b0b8] mt-2"
                    >
                      {showAllOffers
                        ? "Show Less"
                        : `View All (${approvedOffers.length})`}
                    </button>
                  )}
                </>
              )}
            </DashboardCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AffiliateDashboardContent;
