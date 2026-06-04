"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import AcceptTermsModal from "@/../app/components/AcceptTermsModal";
import OfferCard from "@/components/OfferCard";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/../components/ui";
import { supabase } from "../../../utils/supabase/pages-client";
import { RefreshCw, Search, Sparkles } from "lucide-react";

type SupabaseOffer = {
  id: string;
  title: string;
  business_email?: string | null;
  description?: string | null;
  commission: number | null;
  type: string;
  currency?: string | null;
  price?: number | null;
  commission_value?: number | null;
  logo_url?: string | null;
  website?: string | null;
  meta_page_id?: string | null;
  meta_ad_account_id?: string | null;
  meta_pixel_id?: string | null;
  site_host?: string | null;
};

type OnboardingProgressRow = {
  business_email?: string | null;
  offer_id?: string | null;
  tracking_connected?: boolean | null;
};

interface Offer {
  id: string;
  title: string;
  businessName: string;
  description: string;
  commission: number;
  type: string;
  currency?: string;
  price?: number;
  commissionValue?: number;
  isTopCommission?: boolean;
  business_email?: string;
  logoUrl?: string;
  website?: string;
  meta_page_id?: string | null;
  meta_ad_account_id?: string | null;
  meta_pixel_id?: string | null;
  site_host?: string | null;
  tracking_connected?: boolean;
}

export default function AffiliateMarketplace() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [sortOrder, setSortOrder] = useState("None");

  const [showAcceptTerms, setShowAcceptTerms] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshingOffers, setRefreshingOffers] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const pullTriggeredRef = useRef(false);
  useEffect(() => {
    const checkTerms = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("terms_accepted")
        .eq("id", user.id)
        .single();

      if (!error && data?.terms_accepted !== true) {
        setShowAcceptTerms(true);
      }
    };

    checkTerms();
  }, []);

  const fetchOffers = useCallback(async () => {
      const { data, error } = await supabase.from("offers").select(`
          id,
          title,
          business_email,
          description,
          commission,
          type,
          currency,
          price,
          commission_value,
          logo_url,
          website,
          meta_page_id,
          meta_ad_account_id,
          meta_pixel_id,
          site_host
        `);

      let typedData: SupabaseOffer[] = [];

      if (error) {
        console.error("[❌ Error fetching offers]", error.message);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("offers")
          .select("id,title,business_email,description,commission,type,logo_url,website");

        if (fallbackError) {
          console.error("[❌ Fallback offers fetch failed]", fallbackError.message);
          setOffers([]);
          return;
        }

        typedData = ((fallbackData || []) as SupabaseOffer[]).map((o) => ({
          ...o,
          currency: null,
          price: null,
          commission_value: null,
          meta_page_id: null,
          meta_ad_account_id: null,
          meta_pixel_id: null,
          site_host: null,
        }));
      } else if (data) {
        typedData = data as SupabaseOffer[];
      }

      if (!typedData.length) {
        setOffers([]);
        return;
      }

      const offerIds = typedData.map((o) => o.id);
      const businessEmails = Array.from(
        new Set(
          typedData
            .map((o) => o.business_email)
            .filter((email): email is string => Boolean(email)),
        ),
      );

      const { data: offerOnboardingRows, error: offerOnboardingError } = await supabase
        .from("business_onboarding_progress")
        .select("business_email,offer_id,tracking_connected")
        .in("offer_id", offerIds);

      if (offerOnboardingError) {
        console.error(
          "[❌ Error fetching offer tracking status]",
          offerOnboardingError.message,
        );
      }

      const { data: businessOnboardingRows, error: businessOnboardingError } = businessEmails.length
        ? await supabase
            .from("business_onboarding_progress")
            .select("business_email,offer_id,tracking_connected")
            .in("business_email", businessEmails)
            .is("offer_id", null)
        : { data: [], error: null };

      if (businessOnboardingError) {
        console.error(
          "[❌ Error fetching business tracking status]",
          businessOnboardingError.message,
        );
      }

      const trackingMap = new Map<string, boolean>();
      const businessTrackingMap = new Map<string, boolean>();
      ([...(offerOnboardingRows || []), ...(businessOnboardingRows || [])] as OnboardingProgressRow[]).forEach((row) => {
        if (!row?.tracking_connected) return;
        if (row.offer_id) trackingMap.set(row.offer_id, true);
        if (!row.offer_id && row.business_email) businessTrackingMap.set(row.business_email, true);
      });

      let verifiedTrackingIds = new Set<string>();
      try {
        const readinessRes = await fetch("/api/business/tracking-readiness", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offerIds }),
        });
        const readinessJson = await readinessRes.json().catch(() => null);
        if (readinessRes.ok && Array.isArray(readinessJson?.verifiedOfferIds)) {
          verifiedTrackingIds = new Set(readinessJson.verifiedOfferIds as string[]);
        } else if (!readinessRes.ok) {
          console.error("[❌ Error fetching verified tracking readiness]", readinessJson);
        }
      } catch (readinessError) {
        console.error("[❌ Tracking readiness request failed]", readinessError);
      }

      const commissions = typedData.map((o) => o.commission ?? 0);
      const threshold = commissions.length ? Math.max(...commissions) * 0.9 : 0;

      const formatted: Offer[] = typedData.map((o) => ({
        id: o.id,
        title: o.title,
        businessName: o.title,
        description: o.description ?? "",
        commission: o.commission ?? 0,
        type: o.type,
        currency: o.currency ?? undefined,
        price: o.price ?? undefined,
        commissionValue: o.commission_value ?? undefined,
        isTopCommission: (o.commission ?? 0) >= threshold,
        business_email: o.business_email ?? undefined,
        logoUrl: o.logo_url ?? undefined,
        website: o.website ?? undefined,
        meta_page_id: o.meta_page_id ?? null,
        meta_ad_account_id: o.meta_ad_account_id ?? null,
        meta_pixel_id: o.meta_pixel_id ?? null,
        site_host: o.site_host ?? null,
        tracking_connected:
          trackingMap.get(o.id) ||
          verifiedTrackingIds.has(o.id) ||
          (o.business_email ? businessTrackingMap.get(o.business_email) : false) ||
          false,
      }));

      setOffers(formatted);
    }, []);

  const refreshOffers = useCallback(async () => {
    setRefreshingOffers(true);
    try {
      await fetchOffers();
      setLastRefreshedAt(new Date());
    } finally {
      setRefreshingOffers(false);
    }
  }, [fetchOffers]);

  useEffect(() => {
    void refreshOffers();
  }, [refreshOffers]);

  useEffect(() => {
    const refetchOffers = () => {
      void refreshOffers();
    };

    const refetchWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refetchOffers();
      }
    };

    window.addEventListener("focus", refetchOffers);
    window.addEventListener("pageshow", refetchOffers);
    document.addEventListener("visibilitychange", refetchWhenVisible);

    return () => {
      window.removeEventListener("focus", refetchOffers);
      window.removeEventListener("pageshow", refetchOffers);
      document.removeEventListener("visibilitychange", refetchWhenVisible);
    };
  }, [refreshOffers]);

  useEffect(() => {
    type AffiliateRequestRow = {
      offer_id: string;
      status: string;
    };

    const fetchRequests = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !user.email) {
        console.warn("[❌ No email found in session]");
        return;
      }

      console.log("[📩 Fetching affiliate requests for]", user.email);
      const { data, error: reqError } = await supabase
        .from("affiliate_requests")
        .select("offer_id, status")
        .eq("affiliate_email", user.email);

      if (reqError) {
        console.error(
          "[❌ Error fetching affiliate requests]",
          reqError.message,
        );
        return;
      }

      if (!data) {
        setRequestedIds([]);
        return;
      }

      const typedReqs = data as AffiliateRequestRow[];
      const pending = typedReqs.filter((r) => r.status === "pending");
      const ids = Array.from(new Set(pending.map((r) => r.offer_id)));
      setRequestedIds(ids);
    };

    fetchRequests();
  }, []);

  const filtered = offers.filter((offer) => {
    const matchesSearch = offer.title
      ?.toLowerCase()
      .includes(search.toLowerCase());
    const matchesType =
      filterType === "All" || offer.type === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (window.scrollY > 0 || refreshingOffers) return;

    pullStartYRef.current = event.touches[0]?.clientY ?? null;
    pullTriggeredRef.current = false;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const startY = pullStartYRef.current;
    const currentY = event.touches[0]?.clientY;

    if (startY === null || currentY === undefined || pullTriggeredRef.current) return;
    if (window.scrollY > 0) return;

    if (currentY - startY > 90) {
      pullTriggeredRef.current = true;
      void refreshOffers();
    }
  };

  const handleTouchEnd = () => {
    pullStartYRef.current = null;
    pullTriggeredRef.current = false;
  };

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === "Highest Commission") return b.commission - a.commission;
    if (sortOrder === "Business Name")
      return a.title?.localeCompare(b.title || "") || 0;
    return 0;
  });

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex min-h-screen justify-center bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 lg:py-8"
    >
      {showAcceptTerms && userId && (
        <AcceptTermsModal
          userId={userId}
          onAccepted={() => setShowAcceptTerms(false)}
        />
      )}
      <div className="w-full max-w-7xl space-y-6">
        <Card variant="elevated" className="px-5 py-6 sm:px-6">
          <PageHeader
            eyebrow="Workspace overview"
            title="Affiliate Marketplace"
            description="Choose offers aligned with your strengths and audience, and keep your next promotion lined up in one place."
            actions={(
              <Button
              type="button"
              onClick={() => void refreshOffers()}
              disabled={refreshingOffers}
                variant="outline"
                size="md"
            >
              <RefreshCw className={`h-4 w-4 ${refreshingOffers ? "animate-spin" : ""}`} />
              {refreshingOffers ? "Refreshing…" : "Refresh offers"}
              </Button>
            )}
          />
          <p className="mt-3 text-xs text-[var(--muted-foreground)] sm:hidden">
            Pull down from the top or tap refresh to update offer status.
          </p>
          {lastRefreshedAt && (
            <p className="mt-4 text-xs text-[var(--muted-foreground)]">
              Last refreshed {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </Card>

        <Card className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              type="text"
              placeholder="Search by business name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="All">All</option>
            <option value="Recurring">Recurring</option>
            <option value="One-Time">One-Time</option>
          </Select>

          <Select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full sm:w-56"
          >
            <option value="None">None</option>
            <option value="Highest Commission">Highest Commission</option>
            <option value="Business Name">Business Name</option>
          </Select>
        </Card>

        {sorted.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                role="affiliate"
                alreadyRequested={requestedIds.includes(offer.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="No matching offers"
            description="Try adjusting your filters or search to surface more opportunities."
          />
        )}
      </div>
    </div>
  );
}
