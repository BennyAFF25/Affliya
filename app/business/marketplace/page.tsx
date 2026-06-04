"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  ExternalLink,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/../utils/supabase/pages-client";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/../components/ui";

interface Offer {
  id: string;
  title: string;
  businessName: string;
  description: string;
  commission: number;
  type: string;
  website: string;
  business_email?: string | null;
  created_at?: string | null;
}

interface OfferStats {
  approvedAffiliates: number;
  pendingRequests: number;
  totalRequests: number;
  activeCampaigns: number;
}

interface RequestRow {
  offer_id: string;
  status: string;
}

interface CampaignRow {
  offer_id: string;
  status: string;
}

const formatLaunchLabel = (createdAt?: string | null) => {
  if (!createdAt) return "Recently added";

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "Recently added";

  const diffDays = Math.max(
    0,
    Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (diffDays <= 7) return "New this week";
  if (diffDays <= 30) return "New this month";
  return `${diffDays} days live`;
};

export default function BusinessMarketplace() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [statsByOffer, setStatsByOffer] = useState<Record<string, OfferStats>>(
    {},
  );
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<
    "most-affiliates" | "newest" | "highest-commission"
  >("most-affiliates");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffers = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const currentBusinessEmail = user?.email ?? null;

      let offersQuery = supabase.from("offers").select(`
          id,
          title,
          business_email,
          description,
          commission,
          type,
          website,
          created_at
        `);

      if (currentBusinessEmail) {
        offersQuery = offersQuery.neq("business_email", currentBusinessEmail);
      }

      const { data, error } = await offersQuery;

      let typedOffers = (data ?? []) as Array<{
        id: string;
        title: string;
        business_email?: string | null;
        description?: string | null;
        commission?: number | null;
        type?: string | null;
        website?: string | null;
        created_at?: string | null;
      }>;

      if (error) {
        console.error("[❌ Error fetching offers]", error.message);
        const fallbackQuery = supabase
          .from("offers")
          .select("id,title,business_email,description,commission,type,website");
        const { data: fallbackData, error: fallbackError } = currentBusinessEmail
          ? await fallbackQuery.neq("business_email", currentBusinessEmail)
          : await fallbackQuery;

        if (fallbackError) {
          console.error("[❌ Fallback offers fetch failed]", fallbackError.message);
          setOffers([]);
          setStatsByOffer({});
          setLoading(false);
          return;
        }

        typedOffers = ((fallbackData ?? []) as Array<{
          id: string;
          title: string;
          business_email?: string | null;
          description?: string | null;
          commission?: number | null;
          type?: string | null;
          website?: string | null;
        }>).map((row) => ({ ...row, created_at: null }));
      }

      const formattedOffers: Offer[] = typedOffers.map((offer) => ({
        id: offer.id,
        title: offer.title,
        businessName: offer.title,
        description: offer.description ?? "No description added yet.",
        commission: Number(offer.commission ?? 0),
        type: offer.type ?? "one-time",
        website: offer.website ?? "",
        business_email: offer.business_email ?? null,
        created_at: offer.created_at ?? null,
      }));

      setOffers(formattedOffers);

      const offerIds = formattedOffers.map((offer) => offer.id);
      if (offerIds.length === 0) {
        setStatsByOffer({});
        setLoading(false);
        return;
      }

      const [requestsResult, liveAdsResult, liveCampaignsResult] =
        await Promise.all([
          supabase
            .from("affiliate_requests")
            .select("offer_id, status")
            .in("offer_id", offerIds),
          supabase.from("live_ads").select("offer_id, status").in("offer_id", offerIds),
          supabase
            .from("live_campaigns")
            .select("offer_id, status")
            .in("offer_id", offerIds),
        ]);

      const nextStats: Record<string, OfferStats> = Object.fromEntries(
        offerIds.map((id) => [
          id,
          {
            approvedAffiliates: 0,
            pendingRequests: 0,
            totalRequests: 0,
            activeCampaigns: 0,
          },
        ]),
      );

      if (!requestsResult.error && requestsResult.data) {
        (requestsResult.data as RequestRow[]).forEach((request) => {
          if (!nextStats[request.offer_id]) return;
          nextStats[request.offer_id].totalRequests += 1;
          if (request.status === "approved") {
            nextStats[request.offer_id].approvedAffiliates += 1;
          }
          if (request.status === "pending") {
            nextStats[request.offer_id].pendingRequests += 1;
          }
        });
      }

      if (!liveAdsResult.error && liveAdsResult.data) {
        (liveAdsResult.data as CampaignRow[]).forEach((campaign) => {
          if (!nextStats[campaign.offer_id]) return;
          if (["active", "live", "running"].includes(campaign.status)) {
            nextStats[campaign.offer_id].activeCampaigns += 1;
          }
        });
      }

      if (!liveCampaignsResult.error && liveCampaignsResult.data) {
        (liveCampaignsResult.data as CampaignRow[]).forEach((campaign) => {
          if (!nextStats[campaign.offer_id]) return;
          if (["active", "live", "running", "approved"].includes(campaign.status)) {
            nextStats[campaign.offer_id].activeCampaigns += 1;
          }
        });
      }

      setStatsByOffer(nextStats);
      setLoading(false);
    };

    fetchOffers();
  }, []);

  const filteredOffers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const matchingOffers = offers.filter((offer) => {
      if (!normalizedSearch) return true;
      return (
        offer.businessName.toLowerCase().includes(normalizedSearch) ||
        offer.description.toLowerCase().includes(normalizedSearch)
      );
    });

    return matchingOffers.sort((a, b) => {
      const aStats = statsByOffer[a.id] ?? {
        approvedAffiliates: 0,
        pendingRequests: 0,
        totalRequests: 0,
        activeCampaigns: 0,
      };
      const bStats = statsByOffer[b.id] ?? {
        approvedAffiliates: 0,
        pendingRequests: 0,
        totalRequests: 0,
        activeCampaigns: 0,
      };

      if (sortOrder === "highest-commission") {
        return b.commission - a.commission;
      }

      if (sortOrder === "newest") {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      }

      if (bStats.approvedAffiliates !== aStats.approvedAffiliates) {
        return bStats.approvedAffiliates - aStats.approvedAffiliates;
      }

      return bStats.activeCampaigns - aStats.activeCampaigns;
    });
  }, [offers, search, sortOrder, statsByOffer]);

  const summary = useMemo(() => {
    const recentlyLaunched = offers.filter((offer) => {
      if (!offer.created_at) return false;
      const created = new Date(offer.created_at);
      if (Number.isNaN(created.getTime())) return false;
      return Date.now() - created.getTime() <= 1000 * 60 * 60 * 24 * 14;
    }).length;

    const avgCommission = offers.length
      ? offers.reduce((sum, offer) => sum + offer.commission, 0) / offers.length
      : 0;

    const hottestOffer = offers.reduce<Offer | null>((best, offer) => {
      if (!best) return offer;
      const bestAffiliates = statsByOffer[best.id]?.approvedAffiliates ?? 0;
      const currentAffiliates = statsByOffer[offer.id]?.approvedAffiliates ?? 0;
      return currentAffiliates > bestAffiliates ? offer : best;
    }, null);

    const totalActiveCampaigns = Object.values(statsByOffer).reduce(
      (sum, stat) => sum + stat.activeCampaigns,
      0,
    );

    return {
      recentlyLaunched,
      avgCommission,
      hottestOffer,
      totalActiveCampaigns,
    };
  }, [offers, statsByOffer]);

  return (
    <div className="business-marketplace-theme min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 lg:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Card variant="elevated" className="overflow-hidden px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <PageHeader
              eyebrow="Marketplace overview"
              title="Business Marketplace"
              description="Browse active offers across the network, see what is trending, and stay up to date with how similar businesses are positioning themselves."
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[430px]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Users className="h-3.5 w-3.5 text-[#7ff5fb]" />
                  Active offers
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {offers.length}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock3 className="h-3.5 w-3.5 text-[#7ff5fb]" />
                  New in 14 days
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {summary.recentlyLaunched}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <TrendingUp className="h-3.5 w-3.5 text-[#7ff5fb]" />
                  Live campaigns
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {summary.totalActiveCampaigns}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs text-gray-400">Average commission</p>
            <div className="mt-2 text-2xl font-semibold text-white">
              {summary.avgCommission.toFixed(1)}%
            </div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Useful for pressure-testing how aggressive your current offer is.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-gray-400">Most affiliate traction</p>
            <div className="mt-2 text-lg font-semibold text-white">
              {summary.hottestOffer?.businessName ?? "No data yet"}
            </div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {summary.hottestOffer
                ? `${statsByOffer[summary.hottestOffer.id]?.approvedAffiliates ?? 0} approved affiliates currently attached.`
                : "Once requests start rolling in, this will surface the leader."}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-gray-400">Best use of this page</p>
            <div className="mt-2 text-lg font-semibold text-white">
              Watch the market, then move faster
            </div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Track new launches, commission shifts, and affiliate momentum so
              your own listing stays sharp.
            </p>
          </Card>
        </div>

        <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search businesses or offer angles..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Sort by
            </span>
            <Select
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(
                  e.target.value as
                    | "most-affiliates"
                    | "newest"
                    | "highest-commission",
                )
              }
              className="w-full sm:w-52"
            >
              <option value="most-affiliates">Most affiliates</option>
              <option value="newest">Newest offers</option>
              <option value="highest-commission">Highest commission</option>
            </Select>
          </div>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="animate-pulse p-5">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-4 h-6 w-2/3 rounded bg-white/10" />
                <div className="mt-3 h-16 rounded bg-white/5" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="h-20 rounded-2xl bg-white/5" />
                  <div className="h-20 rounded-2xl bg-white/5" />
                  <div className="h-20 rounded-2xl bg-white/5" />
                  <div className="h-20 rounded-2xl bg-white/5" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredOffers.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredOffers.map((offer) => {
              const stats = statsByOffer[offer.id] ?? {
                approvedAffiliates: 0,
                pendingRequests: 0,
                totalRequests: 0,
                activeCampaigns: 0,
              };

              return (
                <Card
                  key={offer.id}
                  interactive
                  className="group overflow-hidden p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="primary" className="normal-case tracking-normal">
                        {formatLaunchLabel(offer.created_at)}
                      </Badge>
                      <h2 className="mt-3 text-lg font-semibold text-white">
                        {offer.businessName}
                      </h2>
                    </div>
                    <Badge variant="muted" className="normal-case tracking-normal">
                      {offer.type === "recurring" ? "Recurring" : "One-time"}
                    </Badge>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted-foreground)]">
                    {offer.description}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                        Approved
                      </p>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {stats.approvedAffiliates}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Affiliates onboarded
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                        Pending
                      </p>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {stats.pendingRequests}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Waiting for review
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                        Commission
                      </p>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {offer.commission}%
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Headline payout
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                        Live now
                      </p>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {stats.activeCampaigns}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Campaigns in market
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                        Total request volume
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {stats.totalRequests} affiliate requests logged
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-[#7ff5fb]" />
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    {offer.website ? (
                      <Button
                        href={offer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        Visit website
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="inline-flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                        Website not listed
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="No competitor offers match that search"
            description="Try a broader keyword or switch the sorting to surface different market signals."
          />
        )}
      </div>
    </div>
  );
}
