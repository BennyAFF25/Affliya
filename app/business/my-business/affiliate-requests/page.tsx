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

export default function AffiliateRequestsPage() {
  const session = useSession();
  const [requests, setRequests] = useState<AffiliateRequest[]>([]);
  const [shopRequests, setShopRequests] = useState<ShopRequest[]>([]);

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
    const current = requests.find((r) => r.id === requestId);
    const currentAffiliateEmail = current?.affiliate_email;
    const currentOfferId = (current as any)?.offer?.id;
    const currentOfferTitle = (current as any)?.offer?.title || "Your offer";
    const currentBusinessEmail = session?.user?.email;

    const { error } = await supabase
      .from("affiliate_requests")
      .update({ status: newStatus })
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
      .update({ status: newStatus })
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
  const rejected = requests.filter((r) => r.status === "rejected");
  const shopPending = shopRequests.filter((r) => r.status === "pending");

  return (
    <div className="w-full min-h-screen bg-[var(--background)] px-6 py-10">
      <h1 className="text-3xl font-bold mb-6 text-[var(--primary)]">
        Affiliate Promotion Requests
      </h1>

      {pending.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">
          No pending promotion requests.
        </p>
      ) : (
        <ul className="space-y-6 mb-10">
          {pending.map((req) => (
            <li
              key={req.id}
              className="rounded-xl bg-[var(--card)] text-[var(--foreground)] shadow-md border border-[var(--border)] px-6 py-5"
            >
              <div className="flex justify-between items-start gap-6">
                <div>
                  <h2 className="text-lg font-semibold">{req.offer?.title}</h2>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {req.offer?.description}
                  </p>
                  <div className="mt-4 text-sm text-[var(--muted-foreground)] space-y-1">
                    <p>
                      <span className="text-[var(--foreground)] font-medium">
                        Commission:
                      </span>{" "}
                      <span className="text-[var(--primary)]">
                        {req.offer?.commission}%
                      </span>{" "}
                      <span className="ml-2 px-2 py-1 text-xs bg-[#00C2CB]/10 text-[var(--primary)] rounded">
                        {req.offer?.type === "recurring"
                          ? "Recurring"
                          : "One-time"}
                      </span>
                    </p>
                    <p>
                      <span className="text-[var(--foreground)] font-medium">
                        Affiliate:
                      </span>{" "}
                      {req.affiliate_email}
                    </p>
                    {req.notes && (
                      <p className="italic text-[var(--muted-foreground)]">
                        “{req.notes}”
                      </p>
                    )}
                    <p>
                      Requested: {new Date(req.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => handleUpdateStatus(req.id, "rejected")}
                    className="bg-[var(--secondary)] hover:brightness-110 text-[var(--muted-foreground)] px-4 py-2 rounded-lg text-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(req.id, "approved")}
                    className="bg-[var(--primary)] hover:brightness-110 text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-2xl font-bold mb-4 text-[var(--foreground)]">
        NettmarkShop Access Requests
      </h2>
      {shopPending.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">
          No pending storefront requests.
        </p>
      ) : (
        <ul className="space-y-6">
          {shopPending.map((req) => (
            <li
              key={req.id}
              className="rounded-xl bg-[var(--card)] text-[var(--foreground)] shadow-md border border-[var(--border)] px-6 py-5"
            >
              <div className="flex justify-between items-start gap-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    Storefront access request
                  </h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Affiliate: {req.affiliate_email}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {req.message ||
                      "This affiliate is requesting to have a shop link which will display your offer and any others they work with on a storefront used for organic campaigns and social media links."}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Requested: {new Date(req.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() =>
                      handleShopRequestDecision(req.id, "rejected")
                    }
                    className="bg-[var(--secondary)] hover:brightness-110 text-[var(--muted-foreground)] px-4 py-2 rounded-lg text-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      handleShopRequestDecision(req.id, "approved")
                    }
                    className="bg-[var(--primary)] hover:brightness-110 text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    Approve storefront
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rejected.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-12 mb-4 text-red-500">
            Rejected Requests
          </h2>
          <ul className="space-y-6">
            {rejected.map((req) => (
              <li
                key={req.id}
                className="rounded-lg border border-red-300/50 bg-[var(--card)] p-6 shadow-md"
              >
                <h2 className="text-xl font-semibold text-red-600 mb-1">
                  {req.offer?.title}
                </h2>
                <p className="text-sm text-[var(--foreground)]">
                  {req.offer?.description}
                </p>
                <div className="text-sm mt-2 text-[var(--foreground)]/80">
                  <p>Commission: {req.offer?.commission}%</p>
                  <p>Type: {req.offer?.type}</p>
                  <p>Affiliate: {req.affiliate_email}</p>
                  {req.notes && <p className="italic">“{req.notes}”</p>}
                  <p>
                    Status:{" "}
                    <span className="font-semibold text-red-500">
                      {req.status}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
