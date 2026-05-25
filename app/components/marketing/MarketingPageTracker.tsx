"use client";

import { useEffect, useRef } from "react";
import { logMarketingEvent } from "@/../utils/marketing/logEvent";

type Props = {
  eventType?: "page_view" | "create_account_start";
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

    void logMarketingEvent({
      eventType,
      pagePath,
      audience,
      meta,
    });
  }, [audience, eventType, meta, pagePath]);

  return null;
}
