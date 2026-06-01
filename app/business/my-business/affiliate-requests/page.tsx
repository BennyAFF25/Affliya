"use client";

import { useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";

interface AffiliateRequest {
  id: string;
  affiliate_email: string;
  status: string;
  notes?: string;
  created_at: string;
  offer: {
    id: string;
    title: string;
    description: string;
    commission: number;
    type: string;
    logo_url?: string;
  };
}

interface ShopRequest {
  id: string;
  affiliate_email: string;
  business_email: string;
  status: string;
  message?: string | null;
  created_at: string;
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

function statusBadge(status: string) {
  const key = status.toLowerCase();
  if (key === "approved") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (key === "rejected") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-300";
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/70 px-6 py-10 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.18)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10 text-lg text-[var(--primary)]">
        ✦
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{body}</p>
    </div>
  );
}

export default function AffiliateRequestsPage() {
  const session = useSession();
  const [requests, setRequests] = useState<AffiliateRequest[]>([]);
  const [shopRequests, setShopRequests] = useState<ShopRequest[]>([]);
  const [approvalReadiness, setApprovalReadiness] = useState({
    billing_connected: false,
    payouts_enabled: false,
  });

  useEffect(() => {
    if (!session) return;

    const fetchRequests = async () => {
      const userEmail = session.user?.email;
      if (!userEmail) return;

      const { data, error } = await supabase
        .from("affiliate_requests")
        .select(
          `
          id,
          affiliate_email,
          status,
          notes,
          created_at,
          offer:offer_id (
            id,
            title,
            description,
            commission,
            type,
            logo_url
          )
        `,
        )
        .eq("business_email", userEmail)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "[affiliate-requests] Error fetching requests:",
          error.message,
        );
      } else {
        setRequests(data as AffiliateRequest[]);
      }

      const { data: progressRows, error: progressError } = await supabase
        .from("business_onboarding_progress")
        .select("billing_connected,payouts_enabled")
        .eq("business_email", userEmail);

      if (!progressError && progressRows) {
        setApprovalReadiness({
          billing_connected: progressRows.some((r: any) => Boolean(r.billing_connected)),
          payouts_enabled: progressRows.some((r: any) => Boolean(r.payouts_enabled)),
        });
      }

      const { data: shopData, error: shopError } = await supabase
        .from("affiliate_shop_requests")
        .select(
          "id, affiliate_email, business_email, status, message, created_at",
        )
        .eq("business_email", userEmail)
        .order("created_at", { ascending: false });

      if (shopError) {
        console.error(
          "[affiliate-requests] Error fetching shop requests:",
          shopError.message,
        );
      } else {
        setShopRequests((shopData || []) as ShopRequest[]);
      }
    };

    fetchRequests();
  }, [session]);

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    if (newStatus === "approved" && !canApproveAffiliates) {
      console.warn("[affiliate-requests] approve blocked: billing/payouts missing");
      return;
    }
    const current = requests.find((r) => r.id === requestId);
    const currentAffiliateEmail = current?.affiliate_email;
    const currentOfferId = (current as any)?.offer?.id;
    const currentOfferTitle = (current as any)?.offer?.title || "Your offer";
    const currentBusinessEmail = session?.user?.email;

    const { error } = await supabase
      .from("affiliate_requests")
      .update({ status: newStatus } as never)
      .eq("id", requestId);

    if (error) {
      console.error(
        "[affiliate-requests] Error updating status:",
        error.message,
      );
      return;
    }

    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r)),
    );

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        window.location.origin;

      const decisionEndpoint =
        newStatus === "approved"
          ? "/api/emails/affiliate-request-decision"
          : newStatus === "rejected"
            ? "/api/emails/affiliate-request-decision"
            : null;

      if (decisionEndpoint && currentAffiliateEmail && currentBusinessEmail) {
        fetch(`${baseUrl}${decisionEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: currentAffiliateEmail,
            affiliateEmail: currentAffiliateEmail,
            businessEmail: currentBusinessEmail,
            offerId: currentOfferId,
            offerTitle: currentOfferTitle,
            requestId,
            decision: newStatus,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const txt = await res.text().catch(() => "");
              console.error(
                "[affiliate-requests] decision email failed",
                res.status,
                txt,
              );
            }
          })
          .catch((err) => {
            console.error("[affiliate-requests] decision email error", err);
          });
      }
    } catch (e) {
      console.error("[affiliate-requests] Email notify failed", e);
    }
  };

  const handleShopRequestDecision = async (
    requestId: string,
    newStatus: "approved" | "rejected",
  ) => {
    const businessEmail = session?.user?.email;
    if (!businessEmail) return;

    const { error } = await supabase
      .from("affiliate_shop_requests")
      .update({ status: newStatus } as never)
      .eq("id", requestId)
      .eq("business_email", businessEmail);

    if (error) {
      console.error(
        "[affiliate-requests] Error updating shop request:",
        error.message,
      );
      return;
    }

    setShopRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r)),
    );
  };

  const pending = requests.filter((r) => r.status === "pending");
  const canApproveAffiliates =
    approvalReadiness.billing_connected && approvalReadiness.payouts_enabled;
  const rejected = requests.filter((r) => r.status === "rejected");
  const shopPending = shopRequests.filter((r) => r.status === "pending");

  return (
    <div className="min-h-screen w-full bg-[var(--background)] px-5 py-6 text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl">
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_8px_30px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Business inbox
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--primary)]">
                Pending requests
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
                Review affiliates who want to promote your offer and decide who gets storefront access. Everything waiting on you is grouped here.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Offer requests
                </div>
                <div className="mt-2 text-2xl font-semibold">{pending.length}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Storefront requests
                </div>
                <div className="mt-2 text-2xl font-semibold">{shopPending.length}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Rejected logged
                </div>
                <div className="mt-2 text-2xl font-semibold">{rejected.length}</div>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Promotion requests
              </h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Affiliates waiting for approval to promote one of your offers.
              </p>
            </div>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              {pending.length} pending
            </span>
          </div>

      {!canApproveAffiliates && pending.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Connect billing and enable payouts to approve affiliate requests.
          <div className="mt-2">
            <a href="/business/payouts" className="inline-flex rounded-lg border border-red-300/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100">
              Go to billing & payouts
            </a>
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <EmptyState
          title="No promotion requests waiting"
          body="When affiliates apply to promote your offers, they’ll show up here with offer details, notes, and quick approve/reject actions."
        />
      ) : (
        <ul className="space-y-4">
          {pending.map((req) => (
            <li
              key={req.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-5 text-[var(--foreground)] shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_10px_28px_rgba(0,0,0,0.18)]"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(req.status)}`}>
                      {req.status}
                    </span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)]/60 px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                      {req.offer?.type === "recurring" ? "Recurring" : "One-time"}
                    </span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)]/60 px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                      {req.offer?.commission}% commission
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    {req.offer?.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {req.offer?.description}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        Affiliate
                      </div>
                      <div className="mt-2 break-all text-sm font-medium text-[var(--foreground)]">
                        {req.affiliate_email}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        Requested
                      </div>
                      <div className="mt-2 text-sm font-medium text-[var(--foreground)]">
                        {formatWhen(req.created_at)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3 sm:col-span-2 xl:col-span-1">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        Review status
                      </div>
                      <div className="mt-2 text-sm font-medium text-[var(--foreground)]">
                        Waiting on your decision
                      </div>
                    </div>
                    {req.notes && (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3 sm:col-span-2 xl:col-span-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                          Affiliate note
                        </div>
                        <p className="mt-2 text-sm italic text-[var(--muted-foreground)]">
                          “{req.notes}”
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[180px]">
                  <button
                    onClick={() => handleUpdateStatus(req.id, "rejected")}
                    className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition hover:brightness-110"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(req.id, "approved")}
                    disabled={!canApproveAffiliates}
                    className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {canApproveAffiliates ? "Approve" : "Approve (blocked)"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                NettmarkShop access requests
              </h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Affiliates requesting storefront access for organic campaigns and link-in-bio style promotion.
              </p>
            </div>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              {shopPending.length} pending
            </span>
          </div>

      {shopPending.length === 0 ? (
        <EmptyState
          title="No storefront requests waiting"
          body="Storefront access requests will appear here when an affiliate wants to feature your offer inside their NettmarkShop page."
        />
      ) : (
        <ul className="space-y-4">
          {shopPending.map((req) => (
            <li
              key={req.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-5 text-[var(--foreground)] shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_10px_28px_rgba(0,0,0,0.18)]"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(req.status)}`}>
                      {req.status}
                    </span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)]/60 px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                      Storefront access
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    Storefront access request
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        Affiliate
                      </div>
                      <div className="mt-2 break-all text-sm font-medium text-[var(--foreground)]">
                        {req.affiliate_email}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        Requested
                      </div>
                      <div className="mt-2 text-sm font-medium text-[var(--foreground)]">
                        {formatWhen(req.created_at)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-4 py-3 sm:col-span-2">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        Request note
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                        {req.message ||
                          "This affiliate is requesting a shop link that can display your offer alongside other partner offers on a storefront used for organic campaigns and social media links."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[200px]">
                  <button
                    onClick={() =>
                      handleShopRequestDecision(req.id, "rejected")
                    }
                    className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition hover:brightness-110"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      handleShopRequestDecision(req.id, "approved")
                    }
                    className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
                  >
                    Approve storefront
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

        </section>

      {rejected.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold text-rose-400">
            Rejected Requests
          </h2>
          <ul className="space-y-4">
            {rejected.map((req) => (
              <li
                key={req.id}
                className="rounded-2xl border border-rose-500/20 bg-[var(--card)] p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(req.status)}`}>
                    {req.status}
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)]/60 px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                    {req.offer?.commission}% commission
                  </span>
                </div>
                <h3 className="mb-1 text-lg font-semibold text-rose-300">
                  {req.offer?.title}
                </h3>
                <p className="text-sm text-[var(--foreground)]">
                  {req.offer?.description}
                </p>
                <div className="mt-3 grid gap-3 text-sm text-[var(--foreground)]/80 sm:grid-cols-3">
                  <p>Type: {req.offer?.type}</p>
                  <p>Affiliate: {req.affiliate_email}</p>
                  <p>Requested: {formatWhen(req.created_at)}</p>
                  {req.notes && <p className="italic">“{req.notes}”</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}
