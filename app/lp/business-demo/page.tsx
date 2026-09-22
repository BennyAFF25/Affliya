import React, { Suspense } from "react";
import type { Metadata } from "next";
import BusinessDemoLandingPage from "@/components/marketing/BusinessDemoLandingPage";

const businessMobileDemoHref =
  process.env.NEXT_PUBLIC_STORYLANE_BUSINESS_MOBILE_DEMO_URL ||
  "https://app.storylane.io/demo/8bo7mlvtch9m?embed=inline";
const businessMobileDemoPadding =
  process.env.NEXT_PUBLIC_STORYLANE_BUSINESS_MOBILE_DEMO_PADDING ||
  "calc(217.27% + 25px)";

export const metadata: Metadata = {
  title: "Let Affiliates Fund Your Advertising | Nettmark",
  description:
    "Affiliates fund their own campaigns. You choose who promotes your business, review campaigns before launch, and pay commission on verified sales.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BusinessDemoPage() {
  return (
    <div id="business-demo-page">
      <style>{`
        #business-demo-page main > nav {
          display: none;
        }
      `}</style>
      <Suspense fallback={null}>
        <BusinessDemoLandingPage
          pagePath="/lp/business-demo"
          demoHref="https://app.storylane.io/demo/qdg9lyyhmgmv?embed=inline"
          demoPadding="calc(65.19% + 25px)"
          demoTitle="Nettmark business demo"
          mobileDemoHref={businessMobileDemoHref}
          mobileDemoPadding={businessMobileDemoPadding}
          mobileDemoTitle="Nettmark business mobile demo"
        />
      </Suspense>
    </div>
  );
}
