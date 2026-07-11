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
  description: "A short demo that shows businesses how Nettmark works.",
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
      title="See how your business can work with affiliates on Nettmark"
      subtitle="This short demo shows how to create an offer, approve the right people, review their ads or content, and track the sales they bring in."
      primaryCta={{
        label: "Start as a business",
        href: "/for-businesses",
      }}
      secondaryCta={{
        label: "View pricing",
        href: "/pricing",
      }}
      demoHref="https://app.storylane.io/demo/qdg9lyyhmgmv?embed=inline"
      demoPadding="calc(65.19% + 25px)"
      demoTitle="Nettmark business demo"
      mobileDemoHref={businessMobileDemoHref}
      mobileDemoPadding={businessMobileDemoPadding}
      mobileDemoTitle="Nettmark business mobile demo"
      bullets={[
        "Create an offer for the product or service you want promoted.",
        "Approve affiliates before they run campaigns for your business.",
        "Affiliates fund the ad spend, and you review campaigns before they go live.",
      ]}
      demoIntroTitle="A 3-minute business walkthrough"
      demoIntroCopy="See how a business sets up an offer, reviews affiliate requests, and checks ads before they run through the business's connected Facebook account."
      demoSteps={[
        "Set up your offer",
        "Review funded campaigns",
        "Track sales and commissions",
      ]}
      objectionTitle="Made for businesses that want control before anything goes live"
      objectionCards={[
        {
          title: "You approve who promotes you",
          copy: "Affiliates can ask to work with your business. You choose who gets approved.",
        },
        {
          title: "You choose the commission",
          copy: "Set the offer and commission yourself. Affiliates earn from sales Nettmark tracks.",
        },
        {
          title: "Affiliates take the ad risk",
          copy: "Affiliates create and fund campaigns. Approved ads can run on your connected Facebook account, and ad spend is settled back to your business.",
        },
      ]}
      footerTitle="Ready to create your first offer?"
      footerCopy="Start a business account, add your offer, and choose who can promote it. Nettmark handles tracking, commissions, and ad spend settlement from there."
    />
  );
}
