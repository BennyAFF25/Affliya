"use client";

import React, { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { supabase } from "@/../utils/supabase/pages-client";
import {
  identifyTikTokUser,
  trackTikTokEvent,
} from "@/../utils/marketing/tiktokPixel";

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
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === "/lp/business-demo") {
      trackTikTokEvent("ViewContent", {
        contents: [
          {
            content_id: "business-demo",
            content_type: "product_group",
            content_name: "Nettmark for Brands Demo",
          },
        ],
      });
    }

    if (
      previousPath.current === "/create-account" &&
      pathname === "/onboarding/for-business"
    ) {
      void (async () => {
        try {
          const { data } = await supabase.auth.getUser();
          const user = data?.user;

          if (user) {
            await identifyTikTokUser({
              email: user.email,
              externalId: user.id,
            });
          }
        } catch {
          // Best-effort matching only.
        }

        trackTikTokEvent("Lead", {
          contents: [
            {
              content_id: "business-signup",
              content_type: "product_group",
              content_name: "Nettmark Business Signup",
            },
          ],
        });
      })();
    }

    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/lp/business-demo") return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/create-account") || !href.includes("role=business")) {
        return;
      }

      trackTikTokEvent("ClickButton", {
        contents: [
          {
            content_id: "business-demo-start",
            content_type: "product_group",
            content_name: "Start as a business",
          },
        ],
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

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
