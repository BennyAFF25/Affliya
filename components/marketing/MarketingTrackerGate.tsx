"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { isGrowthPartnerPath } from "../../utils/marketing/trackingScope";

/** `enabled` is computed on the server from VERCEL_ENV so Preview/staging never loads production trackers. */
export default function MarketingTrackerGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  if (!enabled || !pathname || isGrowthPartnerPath(pathname)) return null;
  return <>{children}</>;
}
