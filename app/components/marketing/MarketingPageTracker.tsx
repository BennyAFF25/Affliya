"use client";

import { useEffect, useRef } from "react";
import { logMarketingEvent } from "@/../utils/marketing/logEvent";
import { trackMetaCustomEvent } from "@/../utils/marketing/metaPixel";
import { getAttributionFromWindow, persistAttribution } from "@/../utils/marketing/attribution";

type Props = {
  eventType?: "page_view" | "create_account_start" | "business_demo_cta_click";
  pagePath: string;
  audience?: string | null;
  meta?: Record<string, unknown>;
};

export default function MarketingPageTracker({
  eventType = "page_view",
  pagePath,
  audience,
  meta,
}: Props) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const attribution = getAttributionFromWindow();
    if (Object.keys(attribution).length > 0) {
      persistAttribution(attribution);
    }

    const eventMeta = {
      ...attribution,
      ...(meta || {}),
    };

    void logMarketingEvent({
      eventType,
      pagePath,
      audience,
      meta: eventMeta,
    });

    if (eventType === "create_account_start") {
      trackMetaCustomEvent("CreateAccountStart", {
        page_path: pagePath,
        ...(audience ? { role: audience } : {}),
        ...eventMeta,
      });
    }
  }, [audience, eventType, meta, pagePath]);

  return null;
}
