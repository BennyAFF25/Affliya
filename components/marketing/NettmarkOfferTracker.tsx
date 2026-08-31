"use client";

import React from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

const NETTMARK_TRACKED_OFFER_ID = "525149d9-8cc6-435b-9653-9d2d3199b75f";
const NETTMARK_TRACKED_BUSINESS = "nettmark.com";

function shouldInjectTracker(pathname: string | null) {
  if (!pathname) return false;

  const blockedPrefixes = [
    "/affiliate",
    "/business",
    "/api",
    "/internal",
    "/auth",
    "/auth-redirect",
    "/meta-auth-callback",
    "/stripe-redirect",
    "/_next",
  ];

  return !blockedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export default function NettmarkOfferTracker() {
  const pathname = usePathname();

  if (!shouldInjectTracker(pathname)) return null;

  return (
    <Script
      id="nettmark-offer-tracker"
      src="https://www.nettmark.com/tracker.js"
      strategy="afterInteractive"
      data-business={NETTMARK_TRACKED_BUSINESS}
      data-offer={NETTMARK_TRACKED_OFFER_ID}
    />
  );
}
