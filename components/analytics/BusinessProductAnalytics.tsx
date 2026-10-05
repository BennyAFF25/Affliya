"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { logProductEvent } from "@/../utils/productEvents";

function compactLabel(element: HTMLElement) {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  return (ariaLabel || text || "").slice(0, 120);
}

function normaliseAction(label: string, destination: string | null) {
  const source = `${label} ${destination || ""}`.toLowerCase();
  if (source.includes("connect-meta") || source.includes("connect meta") || source.includes("meta ads")) return "connect_meta";
  if (source.includes("setup-tracking") || source.includes("setup tracking") || source.includes("tracking")) return "setup_tracking";
  if (source.includes("affiliate-requests") || source.includes("affiliate request") || source.includes("pending request")) return "affiliate_requests";
  if (source.includes("post-ideas") || source.includes("ad-ideas") || source.includes("review submission") || source.includes("post request") || source.includes("ad idea")) return "review_content";
  if (source.includes("create-offer") || source.includes("create offer") || source.includes("new offer")) return "create_offer";
  if (source.includes("content") || source.includes("creative")) return "content_library";
  if (source.includes("campaign")) return "campaigns";
  if (source.includes("billing") || source.includes("subscription") || source.includes("growth")) return "billing";

  return (label || destination || "unknown_action")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unknown_action";
}

function trackSpecialisedDashboardAction(action: string, meta: Record<string, unknown>) {
  if (action === "connect_meta") {
    void logProductEvent({ eventType: "meta_connect_clicked", actorRole: "business", meta });
  } else if (action === "setup_tracking") {
    void logProductEvent({ eventType: "tracking_setup_clicked", actorRole: "business", meta });
  } else if (action === "affiliate_requests") {
    void logProductEvent({ eventType: "affiliate_requests_viewed", actorRole: "business", meta });
  } else if (action === "review_content") {
    void logProductEvent({ eventType: "content_review_clicked", actorRole: "business", meta });
  }
}

export default function BusinessProductAnalytics() {
  const pathname = usePathname();
  const lastViewedPath = useRef<string | null>(null);

  const { session, isLoading } = useSessionContext();
  useEffect(() => {
    if (isLoading || !session?.user?.email || pathname !== "/business/my-business") return;
    const key = session.user.id + ":" + pathname;
    if (lastViewedPath.current === key) return;
    let cancelled = false;
    void logProductEvent({ eventType: "business_dashboard_viewed", actorRole: "business", meta: { source: "business_dashboard", pathname } })
      .then(ok => { if (ok && !cancelled) lastViewedPath.current = key; });
    return () => { cancelled = true; };
  }, [pathname, isLoading, session?.user?.id, session?.user?.email]);

  useEffect(() => {
    if (isLoading || !session?.user?.email || pathname !== "/business/my-business") return;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickable = target.closest("button, a") as HTMLElement | null;
      if (!clickable || clickable.hasAttribute("disabled")) return;

      const label = compactLabel(clickable);
      const destination = clickable instanceof HTMLAnchorElement ? clickable.getAttribute("href") : null;
      if (!label && !destination) return;

      const action = normaliseAction(label, destination);
      const meta = {
        action,
        label,
        destination,
        source: "business_dashboard",
        pathname,
      };

      void logProductEvent({
        eventType: "dashboard_action_clicked",
        actorRole: "business",
        meta,
      });
      trackSpecialisedDashboardAction(action, meta);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, isLoading, session?.user?.email]);

  return null;
}
