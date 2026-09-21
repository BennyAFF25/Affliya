"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FileImage,
  Megaphone,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

type SubmissionKind = "paid" | "organic";
type ReviewFilter = "all" | "paid" | "organic";
type SortOrder = "recent" | "oldest";

type Submission = {
  id: string;
  kind: SubmissionKind;
  offerId: string;
  offerTitle: string;
  status: string;
  createdAt: string | null;
  businessViewedAt: string | null;
  title: string;
  previewUrl: string | null;
  platform?: string | null;
};

function cleanStatus(value: unknown) {
  return String(value || "pending").trim().toLowerCase();
}

function statusMeta(status: string, viewed: boolean) {
  const normalized = cleanStatus(status);

  if (["approved", "active", "accepted", "live"].includes(normalized)) {
    return {
      label: "Approved",
      className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      icon: CheckCircle2,
    };
  }

  if (["rejected", "declined", "denied"].includes(normalized)) {
    return {
      label: "Rejected",
      className: "border-red-400/20 bg-red-400/10 text-red-300",
      icon: XCircle,
    };
  }

  if (["changes_requested", "needs_changes", "revision_requested"].includes(normalized)) {
    return {
      label: "Changes requested",
      className: "border-red-400/20 bg-red-400/10 text-red-300",
      icon: XCircle,
    };
  }

  return viewed
    ? {
        label: "Viewed by business",
        className: "border-sky-400/20 bg-sky-400/10 text-sky-300",
        icon: Eye,
      }
    : {
        label: "Pending review",
        className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
        icon: Clock3,
      };
}

function formatDate(value: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AffiliateReviewsPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      const next = encodeURIComponent("/affiliate/dashboard/reviews");
      router.replace(`/login?role=affiliate&next=${next}`);
    }
  }, [session, sessionLoading, router]);

  const loadSubmissions = useCallback(async (quiet = false) => {
    const email = session?.user?.email;
    if (!email) return;

    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [adsResult, organicResult] = await Promise.all([
        (supabase as any)
          .from("ad_ideas")
          .select("id,offer_id,status,created_at,business_viewed_at,headline,caption,file_url")
          .eq("affiliate_email", email)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("organic_posts")
          .select("id,offer_id,status,created_at,business_viewed_at,caption,platform,image_url,video_url")
          .eq("affiliate_email", email)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (adsResult.error) throw adsResult.error;
      if (organicResult.error) throw organicResult.error;

      const ads = adsResult.data || [];
      const organic = organicResult.data || [];
      const offerIds = Array.from(
        new Set(
          [...ads, ...organic]
            .map((row: any) => String(row.offer_id || ""))
            .filter(Boolean),
        ),
      );

      const offerTitleById = new Map<string, string>();
      if (offerIds.length) {
        const { data: offers, error: offersError } = await (supabase as any)
          .from("offers")
          .select("id,title")
          .in("id", offerIds);

        if (offersError) throw offersError;

        for (const offer of offers || []) {
          offerTitleById.set(String(offer.id), String(offer.title || "Offer"));
        }
      }

      const normalized: Submission[] = [
        ...ads.map((row: any) => ({
          id: String(row.id),
          kind: "paid" as const,
          offerId: String(row.offer_id || ""),
          offerTitle: offerTitleById.get(String(row.offer_id || "")) || "Offer",
          status: cleanStatus(row.status),
          createdAt: row.created_at || null,
          businessViewedAt: row.business_viewed_at || null,
          title: String(row.headline || row.caption || "Paid ad submission"),
          previewUrl: row.file_url || null,
        })),
        ...organic.map((row: any) => ({
          id: String(row.id),
          kind: "organic" as const,
          offerId: String(row.offer_id || ""),
          offerTitle: offerTitleById.get(String(row.offer_id || "")) || "Offer",
          status: cleanStatus(row.status),
          createdAt: row.created_at || null,
          businessViewedAt: row.business_viewed_at || null,
          title: String(row.caption || "Organic promotion submission"),
          previewUrl: row.image_url || row.video_url || null,
          platform: row.platform || null,
        })),
      ].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      setSubmissions(normalized);
    } catch (err: any) {
      console.error("[affiliate reviews]", err);
      setError(err?.message || "Could not load your submissions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (!session?.user?.email) return;
    void loadSubmissions();
    const timer = window.setInterval(() => void loadSubmissions(true), 30000);
    return () => window.clearInterval(timer);
  }, [session?.user?.email, loadSubmissions]);

  const pendingCount = useMemo(
    () => submissions.filter((item) => cleanStatus(item.status) === "pending" && !item.businessViewedAt).length,
    [submissions],
  );

  const openedCount = useMemo(
    () => submissions.filter((item) => !!item.businessViewedAt).length,
    [submissions],
  );

  const paidCount = useMemo(
    () => submissions.filter((item) => item.kind === "paid").length,
    [submissions],
  );

  const organicCount = submissions.length - paidCount;

  const visibleSubmissions = useMemo(() => {
    const filtered = submissions.filter((item) => filter === "all" || item.kind === filter);

    return [...filtered].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === "recent" ? bTime - aTime : aTime - bTime;
    });
  }, [submissions, filter, sortOrder]);

  if (sessionLoading || (loading && !submissions.length)) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--foreground)]">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-8 w-56 rounded bg-[var(--secondary)]" />
          <div className="h-28 rounded-3xl bg-[var(--card)]" />
          <div className="h-40 rounded-3xl bg-[var(--card)]" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/affiliate/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Promotion workflow
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Submitted for review
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              See every paid ad and organic promotion you have sent to a business, including whether they have opened it.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSubmissions(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/30 hover:bg-[var(--secondary)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              All ({submissions.length})
            </FilterButton>
            <FilterButton active={filter === "paid"} onClick={() => setFilter("paid")}>
              Ad ideas ({paidCount})
            </FilterButton>
            <FilterButton active={filter === "organic"} onClick={() => setFilter("organic")}>
              Organic posts ({organicCount})
            </FilterButton>
          </div>

          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]/40"
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Total submitted" value={submissions.length} hint="All time" icon={Send} tone="cyan" />
          <Stat label="Waiting on business" value={pendingCount} hint="Needs review" icon={Clock3} tone="amber" />
          <Stat label="Opened by business" value={openedCount} hint="Viewed submissions" icon={Eye} tone="emerald" />
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!submissions.length ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-10 text-center">
            <FileImage className="mx-auto h-9 w-9 text-[var(--muted-foreground)]" />
            <h2 className="mt-4 text-lg font-semibold">Nothing waiting for review yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted-foreground)]">
              When you submit a paid ad or organic promotion to a business, it will appear here automatically.
            </p>
          </div>
        ) : !visibleSubmissions.length ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            No submissions match this filter.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleSubmissions.map((item) => {
              const viewed = !!item.businessViewedAt;
              const meta = statusMeta(item.status, viewed);
              const StatusIcon = meta.icon;
              const typeLabel = item.kind === "paid" ? "Ad idea" : "Organic promotion";

              return (
                <article
                  key={`${item.kind}-${item.id}`}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-white/[0.16] sm:p-5"
                >
                  <div className="grid gap-4 lg:grid-cols-[128px_minmax(0,1fr)_235px_130px] lg:items-center">
                    <div className="h-28 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--secondary)] sm:h-32 lg:h-[96px] lg:w-32">
                      {item.previewUrl ? (
                        <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <FileImage className="h-6 w-6 text-[var(--muted-foreground)]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          item.kind === "paid"
                            ? "border-violet-400/20 bg-violet-400/10 text-violet-300"
                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        }`}
                      >
                        {item.kind === "paid" ? <Megaphone className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                        {typeLabel}
                      </span>

                      <h2 className="mt-2 truncate text-base font-semibold text-[var(--foreground)] sm:text-lg">
                        {item.offerTitle}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--muted-foreground)]">
                        {item.title}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 lg:border-0 lg:bg-transparent lg:p-0">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>

                      <div className="mt-3 space-y-2 text-xs text-[var(--muted-foreground)]">
                        <div className="flex items-start gap-2">
                          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                          <span>Submitted {formatDate(item.createdAt)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          {viewed ? (
                            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                          ) : (
                            <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                          )}
                          <span className={viewed ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
                            {viewed
                              ? `Viewed ${formatDate(item.businessViewedAt)}`
                              : "Business hasn’t viewed this yet"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex lg:justify-end">
                      <Link
                        href={`/affiliate/dashboard/promote/${item.offerId}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/[0.06] lg:w-auto"
                      >
                        View details
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_0_22px_rgba(0,194,203,0.12)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/25 hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Send;
  tone: "cyan" | "amber" | "emerald";
}) {
  const toneClasses = {
    cyan: "border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-300",
    amber: "border-amber-400/15 bg-amber-400/[0.07] text-amber-300",
    emerald: "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4">
      <div className="flex items-center gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none text-[var(--foreground)]">{value}</p>
          <p className="mt-1.5 text-sm font-medium text-[var(--foreground)]">{label}</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{hint}</p>
        </div>
      </div>
    </div>
  );
}
