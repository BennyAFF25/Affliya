"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FileImage,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { supabase } from "utils/supabase/pages-client";

type SubmissionKind = "paid" | "organic";

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
      className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
      icon: Clock3,
    };
  }
  return viewed
    ? {
        label: "Viewed · awaiting decision",
        className: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
        icon: Eye,
      }
    : {
        label: "Pending review",
        className: "border-white/10 bg-white/[0.04] text-zinc-300",
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
    () => submissions.filter((item) => cleanStatus(item.status) === "pending").length,
    [submissions],
  );

  if (sessionLoading || (loading && !submissions.length)) {
    return (
      <main className="min-h-screen bg-[#080b0c] px-5 py-8 text-white">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-8 w-56 rounded bg-white/10" />
          <div className="h-28 rounded-3xl bg-white/[0.05]" />
          <div className="h-40 rounded-3xl bg-white/[0.05]" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080b0c] px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/affiliate/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Promotion workflow
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Submitted for review
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              See every paid ad and organic promotion you have sent to a business, including whether they have opened it.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSubmissions(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Total submitted" value={submissions.length} />
          <Stat label="Waiting on business" value={pendingCount} />
          <Stat
            label="Opened by business"
            value={submissions.filter((item) => !!item.businessViewedAt).length}
          />
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!submissions.length ? (
          <div className="rounded-3xl border border-white/10 bg-[#101416] p-10 text-center">
            <FileImage className="mx-auto h-9 w-9 text-zinc-500" />
            <h2 className="mt-4 text-lg font-semibold">Nothing waiting for review yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              When you submit a paid ad or organic promotion to a business, it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((item) => {
              const viewed = !!item.businessViewedAt;
              const meta = statusMeta(item.status, viewed);
              const StatusIcon = meta.icon;
              return (
                <article
                  key={`${item.kind}-${item.id}`}
                  className="rounded-3xl border border-white/10 bg-[#101416] p-5 shadow-xl shadow-black/10 sm:p-6"
                >
                  <div className="flex gap-4">
                    <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black sm:block">
                      {item.previewUrl ? (
                        <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <FileImage className="h-6 w-6 text-zinc-600" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span>{item.kind === "paid" ? "Paid ad" : "Organic promotion"}</span>
                            {item.platform ? <><span>•</span><span>{item.platform}</span></> : null}
                            <span>•</span>
                            <span>Submitted {formatDate(item.createdAt)}</span>
                          </div>
                          <h2 className="mt-1 truncate text-lg font-semibold text-white">
                            {item.offerTitle}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-400">
                            {item.title}
                          </p>
                        </div>

                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${meta.className}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-2 border-t border-white/8 pt-4 text-sm">
                        {viewed ? (
                          <>
                            <Eye className="h-4 w-4 text-cyan-300" />
                            <span className="text-zinc-300">
                              Business opened this {formatDate(item.businessViewedAt)}
                            </span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-4 w-4 text-zinc-500" />
                            <span className="text-zinc-500">Business hasn&apos;t viewed this yet</span>
                          </>
                        )}
                      </div>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101416] px-5 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
