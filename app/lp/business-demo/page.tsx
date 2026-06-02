import React from "react";
import type { Metadata } from "next";
import StorylaneLandingPage from "@/components/marketing/StorylaneLandingPage";

const businessMobileDemoHref =
  process.env.NEXT_PUBLIC_STORYLANE_BUSINESS_MOBILE_DEMO_URL ||
  "https://app.storylane.io/demo/8bo7mlvtch9m?embed=inline";
const businessMobileDemoPadding =
  process.env.NEXT_PUBLIC_STORYLANE_BUSINESS_MOBILE_DEMO_PADDING ||
  "calc(217.27% + 25px)";

export const metadata: Metadata = {
  title: "Nettmark for Brands Demo",
  description: "Interactive Nettmark demo for businesses evaluating the platform.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BusinessDemoLandingPage() {
  return (
    <StorylaneLandingPage
      pagePath="/lp/business-demo"
      audience="business"
      audienceLabel="For brands"
      badge="Private demo page"
      title="See how Nettmark works for your business before you sign up"
      subtitle="This is a short interactive walkthrough built for paid traffic — jump straight into the product, see the operator flow, and decide fast whether it fits your brand."
      primaryCta={{
        label: "Start as a brand",
        href: "/for-businesses",
      }}
      secondaryCta={{
        label: "View pricing",
        href: "/pricing",
      }}
      demoHref="https://app.storylane.io/demo/qdg9lyyhmgmv?embed=inline"
      demoPadding="calc(65.19% + 25px)"
      demoTitle="Nettmark business short demo"
      mobileDemoHref={businessMobileDemoHref}
      mobileDemoPadding={businessMobileDemoPadding}
      mobileDemoTitle="Nettmark business mobile demo"
      bullets={[
        "Launch partner offers without giving up approval control.",
        "Keep paid campaign requests, tracking, billing, and payouts in one workflow.",
        "Only move forward after seeing the exact brand-side flow.",
      ]}
      demoIntroTitle="A 3-minute brand-side walkthrough"
      demoIntroCopy="See how a business publishes an offer, reviews partner activity, and keeps campaign approvals tight before spend goes live."
      demoSteps={[
        "Create the offer",
        "Review partners",
        "Track sales and payouts",
      ]}
      objectionTitle="Built for brands that want growth without losing control"
      objectionCards={[
        {
          title: "Approve before paid spend",
          copy: "Partners can request paid campaigns, but the business stays in control before anything launches through Meta.",
        },
        {
          title: "Commission-first economics",
          copy: "Use tracked sales and automated payout flows so partner growth is tied back to measurable outcomes.",
        },
        {
          title: "No generic agency funnel",
          copy: "The demo shows the actual product flow, not a vague pitch deck or long discovery-call promise.",
        },
      ]}
      footerTitle="Ready to turn paid traffic into a controlled partner channel?"
      footerCopy="Create your brand account, connect billing and payouts, and launch your first offer without sending traffic back through a generic homepage funnel."
    />
  );
}
