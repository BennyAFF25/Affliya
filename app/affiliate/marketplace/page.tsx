"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import AcceptTermsModal from "@/../app/components/AcceptTermsModal";
import { supabase } from "../../../utils/supabase/pages-client";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

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
  starterCreditAmount?: number;
  readyCreativeCount?: number;
  readyOrganicCreativeCount?: number;
  readyPaidCreativeCount?: number;
  participationMode?: "open" | "approval_required" | "private";
}

type RequestStatus = "approved" | "pending" | "rejected";
type MarketplaceStatus = "all" | "ads" | "organic" | "pending";

const PAGE_SIZE = 8;

function formatMoney(amount: number, currency?: string) {
  const normalizedCurrency = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${normalizedCurrency} ${amount.toFixed(2)}`;
  }
}

function MarketplaceRow({
  offer,
  alreadyRequested,
  currentStatus,
}: {
  offer: Offer;
  alreadyRequested: boolean;
  currentStatus: RequestStatus | null;
}) {
  const session = useSession();
  const router = useRouter();
  const [requested, setRequested] = useState(alreadyRequested);
  const [starting, setStarting] = useState(false);

  const adsEnabled = !!offer.meta_page_id && !!offer.meta_ad_account_id;
  const trackingReady = !!offer.meta_pixel_id;
  const isPending = currentStatus === "pending";
  const isApproved = currentStatus === "approved";
  const needsApproval = offer.participationMode === "approval_required";
  const estimatedPayout =
    offer.commissionValue ??
    (offer.price ? (offer.price * offer.commission) / 100 : null);
  const logoFallback = offer.title.slice(0, 1).toUpperCase();
  const typeLabel = offer.type === "recurring" ? "Recurring" : "One-time";
  const primaryLabel = starting
    ? "Opening…"
    : isPending
      ? "Pending Approval"
      : requested || isApproved
        ? "Continue Promoting"
        : needsApproval
          ? "Request Approval"
          : "Start Promoting";

  const startPromoting = async () => {
    if (!session?.user?.email || isPending) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/affiliate/offers/${offer.id}/start`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        alert(json?.message || json?.error || "Failed to start promoting this offer.");
        return;
      }
      setRequested(true);
      if (json.promotePath) {
        router.push(json.promotePath || `/affiliate/dashboard/promote/${offer.id}`);
      }
    } catch (error) {
      console.warn("[offer-start] failed", error);
      alert("Failed to start promoting this offer.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="group border-t border-[var(--border)] first:border-t-0 transition-colors hover:bg-[var(--secondary)]">
      <div className="hidden min-h-[94px] grid-cols-[minmax(280px,2.4fr)_minmax(170px,1.35fr)_minmax(105px,.8fr)_minmax(185px,1.35fr)_minmax(170px,1.15fr)_minmax(235px,1.45fr)] items-center gap-4 px-5 py-3 lg:grid">
        <div className="flex min-w-0 items-center gap-3">
          {offer.logoUrl ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--secondary)]">
              <img src={offer.logoUrl} alt={`${offer.title} logo`} className="h-full w-full object-contain p-1.5" />
            </div>
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--secondary)] text-sm font-semibold text-[#00c2cb]">
              {logoFallback}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{offer.title}</p>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-emerald-400 text-[var(--card)]" />
              {offer.isTopCommission ? (
                <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                  <TrendingUp className="h-2.5 w-2.5" /> Top payout
                </span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 max-w-[330px] text-xs leading-4 text-[var(--muted-foreground)]">
              {offer.description || (adsEnabled ? "Organic + paid ads available" : "Organic promotion available")}
            </p>
          </div>
          {offer.currency ? (
            <span className="ml-auto shrink-0 rounded-full border border-[#00c2cb]/30 bg-[#00c2cb]/10 px-2 py-1 text-[10px] font-medium text-[#63e6ec]">
              {offer.currency.toUpperCase()}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full border px-2 py-1 text-[10px] ${adsEnabled ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>
            {adsEnabled ? "Ads enabled" : "Organic only"}
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-[10px] text-[var(--muted-foreground)]">{typeLabel}</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-[10px] text-[var(--muted-foreground)]">
            {adsEnabled ? "Paid + organic" : "Organic only"}
          </span>
        </div>

        <div>
          <p className="text-xl font-semibold tracking-tight text-[#00c2cb]">{offer.commission > 0 ? `${offer.commission}%` : "Custom"}</p>
          <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Commission</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {estimatedPayout != null ? formatMoney(estimatedPayout, offer.currency) : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Typical payout</p>
          {offer.price ? (
            <p className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">Based on order value of {formatMoney(offer.price, offer.currency)}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          {isPending ? (
            <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.45)]" /> Pending approval
            </div>
          ) : (
            <div className={`inline-flex items-center gap-2 text-xs font-medium ${adsEnabled ? "text-emerald-300" : "text-[var(--muted-foreground)]"}`}>
              <span className={`h-2 w-2 rounded-full ${adsEnabled ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.4)]" : "bg-zinc-500"}`} />
              {adsEnabled ? "Ads enabled" : "Organic only"}
            </div>
          )}
          {trackingReady ? (
            <div className="w-fit rounded-full border border-[#00c2cb]/30 bg-[#00c2cb]/10 px-2 py-1 text-[10px] text-[#63e6ec]">Tracking ready</div>
          ) : needsApproval && !isPending ? (
            <div className="w-fit rounded-full border border-amber-400/25 bg-amber-400/[0.06] px-2 py-1 text-[10px] text-amber-300">Approval required</div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/affiliate/marketplace/${offer.id}`}
            className="inline-flex h-10 min-w-[94px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium text-[var(--foreground)] transition hover:border-[#00c2cb]/50"
          >
            View Offer
          </Link>
          <button
            onClick={startPromoting}
            disabled={starting || isPending}
            className={`inline-flex h-10 min-w-[128px] items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold transition ${starting || isPending ? "cursor-not-allowed bg-[var(--secondary)] text-[var(--muted-foreground)]" : "bg-[#00c2cb] text-[#0f0f0f] hover:bg-[#28d1d8]"}`}
          >
            <span className="max-w-[100px] text-center leading-4">{primaryLabel}</span>
            {!starting && !isPending ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : null}
          </button>
        </div>
      </div>

      <div className="p-4 lg:hidden">
        <div className="flex items-start gap-3">
          {offer.logoUrl ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--secondary)]">
              <img src={offer.logoUrl} alt={`${offer.title} logo`} className="h-full w-full object-contain p-1.5" />
            </div>
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--secondary)] text-sm font-semibold text-[#00c2cb]">{logoFallback}</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{offer.title}</p>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-emerald-400 text-[var(--card)]" />
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-4 text-[var(--muted-foreground)]">{offer.description}</p>
          </div>
          <p className="text-lg font-semibold text-[#00c2cb]">{offer.commission}%</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`rounded-full border px-2 py-1 text-[10px] ${adsEnabled ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>{adsEnabled ? "Ads enabled" : "Organic only"}</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-[10px] text-[var(--muted-foreground)]">{typeLabel}</span>
          {trackingReady ? <span className="rounded-full border border-[#00c2cb]/30 bg-[#00c2cb]/10 px-2 py-1 text-[10px] text-[#63e6ec]">Tracking ready</span> : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={`/affiliate/marketplace/${offer.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--foreground)]">View Offer</Link>
          <button onClick={startPromoting} disabled={starting || isPending} className={`inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold ${starting || isPending ? "bg-[var(--secondary)] text-[var(--muted-foreground)]" : "bg-[#00c2cb] text-[#0f0f0f]"}`}>{primaryLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function AffiliateMarketplace() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [participatingIds, setParticipatingIds] = useState<string[]>([]);
  const [requestStatusByOfferId, setRequestStatusByOfferId] = useState<Record<string, RequestStatus>>({});
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [statusFilter, setStatusFilter] = useState<MarketplaceStatus>("all");
  const [sortOrder, setSortOrder] = useState("Featured");
  const [page, setPage] = useState(1);
  const [showAcceptTerms, setShowAcceptTerms] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkTerms = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("terms_accepted")
        .eq("id", user.id)
        .single();
      if (!error && data?.terms_accepted !== true) setShowAcceptTerms(true);
    };
    checkTerms();
  }, []);

  useEffect(() => {
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
      participation_mode?: "open" | "approval_required" | "private" | null;
    };

    const fetchOffers = async () => {
      const offerColumnsWithParticipationMode = `id,title,business_email,description,commission,type,currency,price,commission_value,logo_url,website,meta_page_id,meta_ad_account_id,meta_pixel_id,participation_mode`;
      const offerColumnsFallback = `id,title,business_email,description,commission,type,currency,price,commission_value,logo_url,website,meta_page_id,meta_ad_account_id,meta_pixel_id`;

      const offerPromise = (async () => {
        let result = await supabase.from("offers").select(offerColumnsWithParticipationMode);
        if (result.error?.message?.toLowerCase().includes("participation_mode")) {
          result = await supabase.from("offers").select(offerColumnsFallback);
        }
        return result;
      })();

      const [{ data, error }, { data: subsidyRows, error: subsidyErr }] = await Promise.all([
        offerPromise,
        supabase.from("business_activation_subsidies").select("offer_id, subsidy_amount, consumed_amount").eq("status", "available"),
      ]);

      if (error) {
        console.error("[❌ Error fetching offers]", error.message);
        return;
      }
      if (!data) {
        setOffers([]);
        return;
      }
      if (subsidyErr) console.error("[❌ Error fetching starter spend rows]", subsidyErr.message);

      const subsidyMap = new Map<string, number>();
      for (const row of (subsidyRows || []) as any[]) {
        const offerId = typeof row.offer_id === "string" ? row.offer_id : null;
        if (!offerId) continue;
        const remaining = Math.max(0, Number(row.subsidy_amount || 0) - Number(row.consumed_amount || 0));
        if (remaining > 0) subsidyMap.set(offerId, remaining);
      }

      const typedData = (data as SupabaseOffer[]).filter((offer) => String(offer.participation_mode || "open").toLowerCase() !== "private");
      const commissions = typedData.map((offer) => offer.commission ?? 0);
      const threshold = commissions.length ? Math.max(...commissions) * 0.9 : 0;

      const formatted: Offer[] = typedData.map((offer) => ({
        id: offer.id,
        title: offer.title,
        businessName: offer.title,
        description: offer.description ?? "",
        commission: offer.commission ?? 0,
        type: offer.type,
        currency: offer.currency ?? undefined,
        price: offer.price ?? undefined,
        commissionValue: offer.commission_value ?? undefined,
        isTopCommission: (offer.commission ?? 0) >= threshold,
        business_email: offer.business_email ?? undefined,
        logoUrl: offer.logo_url ?? undefined,
        website: offer.website ?? undefined,
        meta_page_id: offer.meta_page_id ?? null,
        meta_ad_account_id: offer.meta_ad_account_id ?? null,
        meta_pixel_id: offer.meta_pixel_id ?? null,
        starterCreditAmount: subsidyMap.get(offer.id) ?? undefined,
        participationMode: (offer.participation_mode as Offer["participationMode"]) || "open",
      }));

      const readinessRes = await fetch(`/api/offers/content-readiness?offerIds=${formatted.map((offer) => offer.id).join(",")}`, { cache: "no-store" }).catch(() => null);
      const readinessJson = readinessRes ? await readinessRes.json().catch(() => null) : null;
      const readinessMap = readinessJson?.ok ? readinessJson.readiness || {} : {};
      formatted.forEach((offer) => {
        const readiness = readinessMap[offer.id];
        if (!readiness) return;
        offer.readyCreativeCount = Number(readiness.total || 0);
        offer.readyOrganicCreativeCount = Number(readiness.organic || 0);
        offer.readyPaidCreativeCount = Number(readiness.paid || 0);
      });
      setOffers(formatted);
    };

    fetchOffers();
  }, []);

  useEffect(() => {
    const fetchRequests = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data, error } = await supabase.from("affiliate_requests").select("offer_id, status").eq("affiliate_email", user.email);
      if (error) {
        console.error("[❌ Error fetching affiliate requests]", error.message);
        return;
      }
      const typedReqs = (data || []) as { offer_id: string; status: string }[];
      const active = typedReqs.filter((row) => ["pending", "approved"].includes(String(row.status || "").toLowerCase()));
      setParticipatingIds(Array.from(new Set(active.map((row) => row.offer_id))));

      const nextStatusByOfferId: Record<string, RequestStatus> = {};
      for (const row of typedReqs) {
        const status = String(row.status || "").toLowerCase();
        if (!row.offer_id || !["approved", "pending", "rejected"].includes(status)) continue;
        if (!nextStatusByOfferId[row.offer_id] || status === "approved" || (status === "pending" && nextStatusByOfferId[row.offer_id] !== "approved")) {
          nextStatusByOfferId[row.offer_id] = status as RequestStatus;
        }
      }
      setRequestStatusByOfferId(nextStatusByOfferId);
    };
    fetchRequests();
  }, []);

  const counts = useMemo(() => {
    return {
      all: offers.length,
      ads: offers.filter((offer) => !!offer.meta_page_id && !!offer.meta_ad_account_id).length,
      organic: offers.filter((offer) => !offer.meta_page_id || !offer.meta_ad_account_id).length,
      pending: offers.filter((offer) => requestStatusByOfferId[offer.id] === "pending").length,
    };
  }, [offers, requestStatusByOfferId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return offers.filter((offer) => {
      const matchesSearch = !query || offer.title.toLowerCase().includes(query) || offer.description.toLowerCase().includes(query);
      const matchesType = filterType === "All" || offer.type === filterType.toLowerCase();
      const adsEnabled = !!offer.meta_page_id && !!offer.meta_ad_account_id;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "ads" && adsEnabled) ||
        (statusFilter === "organic" && !adsEnabled) ||
        (statusFilter === "pending" && requestStatusByOfferId[offer.id] === "pending");
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [offers, search, filterType, statusFilter, requestStatusByOfferId]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    if (sortOrder === "Highest Commission") next.sort((a, b) => b.commission - a.commission);
    if (sortOrder === "Business Name") next.sort((a, b) => a.title.localeCompare(b.title));
    if (sortOrder === "Featured") next.sort((a, b) => Number(b.isTopCommission) - Number(a.isTopCommission) || b.commission - a.commission);
    return next;
  }, [filtered, sortOrder]);

  useEffect(() => setPage(1), [search, filterType, statusFilter, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleOffers = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const tabs: { key: MarketplaceStatus; label: string; count: number }[] = [
    { key: "all", label: "All Offers", count: counts.all },
    { key: "ads", label: "Ads Enabled", count: counts.ads },
    { key: "organic", label: "Organic Only", count: counts.organic },
    { key: "pending", label: "Pending Approval", count: counts.pending },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {showAcceptTerms && userId ? <AcceptTermsModal userId={userId} onAccepted={() => setShowAcceptTerms(false)} /> : null}

      <div className="mx-auto w-full max-w-[1540px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px]">Find the best brands to promote</h1>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">Partner with verified brands and earn commissions. New offers added regularly.</p>
          </div>
          <div className="flex min-w-[300px] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#00c2cb]/10 text-[#00c2cb]"><ShieldCheck className="h-4.5 w-4.5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--foreground)]">Trusted brands. Real earnings.</p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Offers are reviewed before appearing here.</p>
            </div>
            <Sparkles className="h-4 w-4 text-[#00c2cb]" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search brands, products, or offers..."
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] pl-10 pr-4 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[#00c2cb]/50"
              />
            </div>
            <select value={filterType} onChange={(event) => setFilterType(event.target.value)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs text-[var(--foreground)] outline-none focus:border-[#00c2cb]/50 xl:min-w-[150px]">
              <option value="All">All Offer Types</option>
              <option value="Recurring">Recurring</option>
              <option value="One-Time">One-Time</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MarketplaceStatus)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs text-[var(--foreground)] outline-none focus:border-[#00c2cb]/50 xl:min-w-[150px]">
              <option value="all">All Statuses</option>
              <option value="ads">Ads Enabled</option>
              <option value="organic">Organic Only</option>
              <option value="pending">Pending Approval</option>
            </select>
            <div className="flex items-center gap-2 xl:ml-3">
              <span className="whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">Sort by</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs text-[var(--foreground)] outline-none focus:border-[#00c2cb]/50 xl:min-w-[140px]">
                <option value="Featured">Featured</option>
                <option value="Highest Commission">Highest Commission</option>
                <option value="Business Name">Business Name</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button key={tab.key} onClick={() => setStatusFilter(tab.key)} className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-medium transition ${active ? "border-[#00c2cb] bg-[#00c2cb]/10 text-[#63e6ec]" : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[#00c2cb]/30 hover:text-[var(--foreground)]"}`}>
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-[#00c2cb] text-[#0f0f0f]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_16px_50px_rgba(0,0,0,.16)]">
          <div className="hidden grid-cols-[minmax(280px,2.4fr)_minmax(170px,1.35fr)_minmax(105px,.8fr)_minmax(185px,1.35fr)_minmax(170px,1.15fr)_minmax(235px,1.45fr)] gap-4 border-b border-[var(--border)] bg-[var(--secondary)] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)] lg:grid">
            <span>Brand / Offer</span><span>Offer Type</span><span>Earnings</span><span>Order Details</span><span>Status</span><span className="text-right">Actions</span>
          </div>

          {visibleOffers.length ? visibleOffers.map((offer) => (
            <MarketplaceRow key={offer.id} offer={offer} alreadyRequested={participatingIds.includes(offer.id)} currentStatus={requestStatusByOfferId[offer.id] || null} />
          )) : (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">No matching offers</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 text-xs text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {visibleOffers.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length} offers</span>
          {pageCount > 1 ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), Math.max(5, safePage + 2)).map((pageNumber) => (
                <button key={pageNumber} onClick={() => setPage(pageNumber)} className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-medium ${safePage === pageNumber ? "border-[#00c2cb] bg-[#00c2cb] text-[#0f0f0f]" : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]"}`}>{pageNumber}</button>
              ))}
              <button onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}