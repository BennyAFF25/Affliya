"use client";

import React, { useEffect, useState } from "react";

type SubscriptionIntent = {
  businessId?: string | null;
  submissionId?: string | null;
  intendedAction?: string | null;
  returnTo?: string | null;
  campaignId?: string | null;
  attribution?: Record<string, unknown> | null;
};

export async function trackBusinessSubscriptionClientEvent(
  eventType: string,
  intent: SubscriptionIntent | null,
  metadata?: Record<string, unknown>,
) {
  if (!intent) return;
  try {
    await fetch("/api/business-subscription/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        businessId: intent.businessId || null,
        campaignId: intent.campaignId || intent.submissionId || null,
        submissionId: intent.submissionId || null,
        intendedAction: intent.intendedAction || null,
        returnTo: intent.returnTo || (typeof window !== "undefined" ? window.location.pathname : null),
        attribution: intent.attribution || {},
        metadata: metadata || {},
      }),
    });
  } catch {
    // Analytics must never block checkout or review flow.
  }
}

export function BusinessSubscriptionActivationModal({
  open,
  intent,
  onClose,
}: {
  open: boolean;
  intent: SubscriptionIntent | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && intent) void trackBusinessSubscriptionClientEvent("subscription_gate_viewed", intent);
  }, [open, intent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") !== "cancelled") return;

    const rawIntent = window.sessionStorage.getItem("nettmark:business-subscription-intent");
    if (!rawIntent) return;

    try {
      const savedIntent = JSON.parse(rawIntent) as SubscriptionIntent;
      void trackBusinessSubscriptionClientEvent("subscription_checkout_cancelled", savedIntent, {
        source: "checkout_return",
      });
    } catch {
      // Ignore malformed saved intent.
    }
  }, []);

  if (!open) return null;

  const activate = async () => {
    if (!intent?.businessId) {
      setError("Missing business context. Refresh and try again.");
      return;
    }

    setLoading(true);
    setError(null);
    void trackBusinessSubscriptionClientEvent("subscription_checkout_started", intent);

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "nettmark:business-subscription-intent",
          JSON.stringify({
            businessId: intent.businessId,
            submissionId: intent.submissionId || null,
            intendedAction: intent.intendedAction || null,
            returnTo: intent.returnTo || window.location.pathname,
            campaignId: intent.campaignId || intent.submissionId || null,
            attribution: intent.attribution || {},
            savedAt: new Date().toISOString(),
          }),
        );
      }

      const res = await fetch("/api/business-subscription/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: intent.businessId,
          returnTo: intent.returnTo || window.location.pathname,
          intendedAction: intent.intendedAction || null,
          submissionId: intent.submissionId || null,
          campaignId: intent.campaignId || intent.submissionId || null,
          attribution: intent.attribution || {},
        }),
      });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.url) {
        window.location.assign(json.url);
        return;
      }

      if (res.ok && (json?.status === "already_subscribed" || json?.status === "grandfathered")) {
        window.location.assign(intent.returnTo || window.location.pathname);
        return;
      }

      throw new Error(json?.message || json?.error || "Unable to start subscription checkout.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      void trackBusinessSubscriptionClientEvent("subscription_checkout_cancelled", intent, {
        message: err instanceof Error ? err.message : "Unable to start checkout.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-3 py-0 backdrop-blur-sm sm:items-center sm:px-6 sm:py-6">
      <div className="w-full max-w-lg rounded-t-[28px] border border-white/10 bg-[#101517] p-6 text-white shadow-2xl sm:rounded-[28px] sm:p-7">
        <div className="mb-4 inline-flex rounded-full border border-[#00C2CB]/25 bg-[#00C2CB]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#7ff5fb]">
          Nettmark Business
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Launch your paid affiliate ad</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          An affiliate has submitted a paid ad idea for your business. Activate Nettmark Business to approve and launch paid affiliate ads.
        </p>

        <div className="mt-5 rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/10 p-4">
          <p className="text-sm text-white/65">Nettmark Business</p>
          <p className="mt-1 text-3xl font-bold text-white">$49 AUD <span className="text-base font-medium text-white/55">/ month</span></p>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-white/75">
          <li>✓ Receive affiliate ad ideas for free</li>
          <li>✓ Approve and launch paid ads through Nettmark</li>
          <li>✓ Access marketplace campaign tools</li>
          <li>✓ Cancel through billing settings</li>
        </ul>

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              void trackBusinessSubscriptionClientEvent("subscription_gate_dismissed", intent);
              onClose();
            }}
            disabled={loading}
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/5 disabled:opacity-60"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={activate}
            disabled={loading}
            className="rounded-full bg-[#00C2CB] px-5 py-3 text-sm font-bold text-[#061113] transition hover:bg-[#2de0e8] disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? "Opening Checkout…" : "Activate Nettmark Business"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function readSubscriptionIntentFromResponse(json: unknown): SubscriptionIntent | null {
  if (!json || typeof json !== "object") return null;
  const payload = json as { checkout?: SubscriptionIntent; subscriptionRequired?: boolean };
  if (!payload.subscriptionRequired || !payload.checkout) return null;
  return payload.checkout;
}
