"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";
import {
  ActionBar,
  Badge,
  Button,
  ReviewCard,
  ReviewMetaItem,
  ReviewQueue,
  StatCard,
  StatusBadge,
} from "@/../components/ui";
import { createInboxMessage } from "@/../utils/inboxMessages";

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

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmptyState({ title, body }: { title: string; body: string }) {
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
  const [launchInviteStatus, setLaunchInviteStatus] = useState<
    Record<string, "sent" | "sending" | "error">
  >({});

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

      const progressBillingReady =
        !progressError && progressRows
          ? progressRows.some((r: { billing_connected?: boolean | null }) =>
              Boolean(r.billing_connected),
            )
          : false;
      const progressPayoutsReady =
        !progressError && progressRows
          ? progressRows.some((r: { payouts_enabled?: boolean | null }) =>
              Boolean(r.payouts_enabled),
            )
          : false;

      if (progressError) {
        console.error(
          "[affiliate-requests] Error fetching approval readiness:",
          progressError.message,
        );
      }

      let derivedBillingReady = false;
      let derivedPayoutsReady = false;

      const { data: businessProfile, error: businessProfileError } =
        await supabase
          .from("business_profiles")
          .select(
            "stripe_customer_id, stripe_account_id, stripe_onboarding_complete",
          )
          .eq("business_email", userEmail)
          .single();

      if (businessProfileError) {
        console.warn(
          "[affiliate-requests] Business billing profile lookup failed:",
          businessProfileError.message,
        );
      } else {
        const profile = businessProfile as {
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarding_complete?: boolean | null;
        } | null;

        derivedPayoutsReady = Boolean(profile?.stripe_onboarding_complete);

        if (profile?.stripe_customer_id) {
          try {
            const cardRes = await fetch("/api/stripe/check-customer-card", {
              method: "POST",
            });
            const cardJson = await parseJsonSafe(cardRes);
            derivedBillingReady = cardRes.ok && Boolean(cardJson?.hasCard);
          } catch (billingErr) {
            console.warn(
              "[affiliate-requests] Customer card check failed:",
              billingErr,
            );
          }
        }

        if (profile?.stripe_account_id && !derivedPayoutsReady) {
          try {
            const accountRes = await fetch("/api/stripe/check-account", {
              method: "POST",
            });
            const accountJson = await parseJsonSafe(accountRes);
            derivedPayoutsReady =
              accountRes.ok && Boolean(accountJson?.onboardingComplete);
          } catch (accountErr) {
            console.warn(
              "[affiliate-requests] Stripe account check failed:",
              accountErr,
            );
          }
        }
      }

      setApprovalReadiness({
        billing_connected: progressBillingReady || derivedBillingReady,
        payouts_enabled: progressPayoutsReady || derivedPayoutsReady,
      });

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
      console.warn(
        "[affiliate-requests] approve blocked: billing/payouts missing",
      );
      return;
    }
    const current = requests.find((r) => r.id === requestId);
    const currentAffiliateEmail = current?.affiliate_email;
    const currentOfferId = current?.offer?.id;
    const currentOfferTitle = current?.offer?.title || "Your offer";
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

  const handleInviteToLaunch = async (request: AffiliateRequest) => {
    const businessEmail = session?.user?.email;
    const offerId = request.offer?.id;
    if (!businessEmail || !request.affiliate_email || !offerId) return;

    setLaunchInviteStatus((prev) => ({ ...prev, [request.id]: "sending" }));

    try {
      await createInboxMessage({
        sender_email: businessEmail,
        sender_role: "business",
        recipient_email: request.affiliate_email,
        recipient_role: "affiliate",
        message_type: "launch_invite",
        title: `You're invited to launch ${request.offer?.title || "this offer"}`,
        body: "Your promotion request was approved. Open the offer to create a paid ad or organic campaign and start promoting.",
        preview: `Launch your first campaign for ${request.offer?.title || "this approved offer"}.`,
        offer_id: offerId,
        affiliate_request_id: request.id,
        cta_label: "Launch Campaign",
        cta_url: `/affiliate/dashboard/promote/${offerId}`,
        metadata: { source: "affiliate_requests" },
        suppressEmail: true,
      });

      const emailRes = await fetch("/api/emails/affiliate-launch-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: request.affiliate_email,
          affiliateEmail: request.affiliate_email,
          businessEmail,
          offerId,
          offerTitle: request.offer?.title || "this offer",
          requestId: request.id,
        }),
      });

      if (!emailRes.ok) {
        const text = await emailRes.text().catch(() => "");
        throw new Error(`Launch invite email failed: ${emailRes.status} ${text}`);
      }

      setLaunchInviteStatus((prev) => ({ ...prev, [request.id]: "sent" }));
    } catch (err) {
      console.error("[affiliate-requests] launch inbox invite failed", err);
      setLaunchInviteStatus((prev) => ({ ...prev, [request.id]: "error" }));
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
  const approved = requests.filter((r) => r.status === "approved");
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
                Review affiliates who want to promote your offer and decide who
                gets storefront access. Everything waiting on you is grouped
                here.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Offer requests"
                value={pending.length}
                tone="warning"
              />
              <StatCard
                label="Storefront requests"
                value={shopPending.length}
                tone="warning"
              />
              <StatCard
                label="Rejected logged"
                value={rejected.length}
                tone="danger"
              />
            </div>
          </div>
        </div>

        <ReviewQueue
          title="Promotion requests"
          description="Affiliates waiting for approval to promote one of your offers."
          actions={
            <StatusBadge status="pending" label={`${pending.length} pending`} />
          }
          className="mb-10"
        >
          {!canApproveAffiliates && pending.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Connect billing and enable payouts to approve affiliate requests.
              <div className="mt-2">
                <Button
                  href="/business/payouts"
                  variant="outline"
                  size="sm"
                  className="border-red-300/40 bg-red-500/15 text-red-100 hover:bg-red-500/20"
                >
                  Go to billing & payouts
                </Button>
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
                <li key={req.id}>
                  <ReviewCard
                    header={
                      <>
                        <StatusBadge status={req.status} />
                        <Badge variant="muted">
                          {req.offer?.type === "recurring"
                            ? "Recurring"
                            : "One-time"}
                        </Badge>
                        <Badge variant="primary">
                          {req.offer?.commission}% commission
                        </Badge>
                      </>
                    }
                    title={req.offer?.title}
                    description={req.offer?.description}
                    meta={
                      <>
                        <ReviewMetaItem label="Affiliate">
                          {req.affiliate_email}
                        </ReviewMetaItem>
                        <ReviewMetaItem label="Requested">
                          {formatWhen(req.created_at)}
                        </ReviewMetaItem>
                        <ReviewMetaItem label="Review status">
                          Waiting on your decision
                        </ReviewMetaItem>
                        {req.notes && (
                          <ReviewMetaItem
                            label="Affiliate note"
                            className="sm:col-span-2 xl:col-span-3"
                          >
                            <span className="italic text-[var(--muted-foreground)]">
                              “{req.notes}”
                            </span>
                          </ReviewMetaItem>
                        )}
                      </>
                    }
                    actions={
                      <ActionBar className="lg:flex-col">
                        <Button
                          type="button"
                          onClick={() => handleUpdateStatus(req.id, "rejected")}
                          variant="secondary"
                          className="w-full"
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleUpdateStatus(req.id, "approved")}
                          disabled={!canApproveAffiliates}
                          className="w-full disabled:cursor-not-allowed"
                        >
                          {canApproveAffiliates
                            ? "Approve"
                            : "Approve (blocked)"}
                        </Button>
                      </ActionBar>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </ReviewQueue>

        {approved.length > 0 && (
          <ReviewQueue
            title="Approved affiliates"
            description="Invite approved partners to launch their first paid or organic campaign from their affiliate inbox."
            actions={
              <StatusBadge
                status="approved"
                label={`${approved.length} approved`}
              />
            }
            className="mb-10"
          >
            <ul className="space-y-4">
              {approved.map((req) => {
                const inviteStatus = launchInviteStatus[req.id];
                return (
                  <li key={req.id}>
                    <ReviewCard
                      header={
                        <>
                          <StatusBadge status={req.status} />
                          <Badge variant="muted">Launch ready</Badge>
                          <Badge variant="primary">
                            {req.offer?.commission}% commission
                          </Badge>
                        </>
                      }
                      title={req.offer?.title}
                      description={req.offer?.description}
                      meta={
                        <>
                          <ReviewMetaItem label="Affiliate">
                            {req.affiliate_email}
                          </ReviewMetaItem>
                          <ReviewMetaItem label="Approved request">
                            {formatWhen(req.created_at)}
                          </ReviewMetaItem>
                          <ReviewMetaItem label="Next step">
                            Invite partner to launch
                          </ReviewMetaItem>
                        </>
                      }
                      actions={
                        <ActionBar className="lg:flex-col">
                          <Button
                            type="button"
                            onClick={() => handleInviteToLaunch(req)}
                            disabled={
                              inviteStatus === "sending" ||
                              inviteStatus === "sent"
                            }
                            className="w-full disabled:cursor-not-allowed"
                          >
                            {inviteStatus === "sending"
                              ? "Sending…"
                              : inviteStatus === "sent"
                                ? "Invite sent"
                                : "Invite to Launch"}
                          </Button>
                          {inviteStatus === "error" && (
                            <p className="text-xs text-red-300">
                              Couldn’t create inbox invite. Try again.
                            </p>
                          )}
                        </ActionBar>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </ReviewQueue>
        )}

        <ReviewQueue
          title="NettmarkShop access requests"
          description="Affiliates requesting storefront access for organic campaigns and link-in-bio style promotion."
          actions={
            <StatusBadge
              status="pending"
              label={`${shopPending.length} pending`}
            />
          }
        >
          {shopPending.length === 0 ? (
            <EmptyState
              title="No storefront requests waiting"
              body="Storefront access requests will appear here when an affiliate wants to feature your offer inside their NettmarkShop page."
            />
          ) : (
            <ul className="space-y-4">
              {shopPending.map((req) => (
                <li key={req.id}>
                  <ReviewCard
                    header={
                      <>
                        <StatusBadge status={req.status} />
                        <Badge variant="muted">Storefront access</Badge>
                      </>
                    }
                    title="Storefront access request"
                    meta={
                      <>
                        <ReviewMetaItem label="Affiliate">
                          {req.affiliate_email}
                        </ReviewMetaItem>
                        <ReviewMetaItem label="Requested">
                          {formatWhen(req.created_at)}
                        </ReviewMetaItem>
                        <ReviewMetaItem
                          label="Request note"
                          className="sm:col-span-2 xl:col-span-3"
                        >
                          {req.message ||
                            "This affiliate is requesting a shop link that can display your offer alongside other partner offers on a storefront used for organic campaigns and social media links."}
                        </ReviewMetaItem>
                      </>
                    }
                    actions={
                      <ActionBar className="lg:flex-col">
                        <Button
                          type="button"
                          onClick={() =>
                            handleShopRequestDecision(req.id, "rejected")
                          }
                          variant="secondary"
                          className="w-full"
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          onClick={() =>
                            handleShopRequestDecision(req.id, "approved")
                          }
                          className="w-full"
                        >
                          Approve storefront
                        </Button>
                      </ActionBar>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </ReviewQueue>

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
                    <StatusBadge status={req.status} />
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
