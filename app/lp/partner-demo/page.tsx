import React from "react";
import type { Metadata } from "next";
import StorylaneLandingPage from "@/components/marketing/StorylaneLandingPage";

const partnerMobileDemoHref =
  process.env.NEXT_PUBLIC_STORYLANE_PARTNER_MOBILE_DEMO_URL ||
  "https://app.storylane.io/demo/vql4sszz4w7m?embed=inline";
const partnerMobileDemoPadding =
  process.env.NEXT_PUBLIC_STORYLANE_PARTNER_MOBILE_DEMO_PADDING ||
  "calc(217.27% + 25px)";

export const metadata: Metadata = {
  title: "Nettmark for Partners Demo",
  description: "Interactive Nettmark demo for affiliates and partners evaluating the platform.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PartnerDemoLandingPage() {
  return (
    <StorylaneLandingPage
      pagePath="/lp/partner-demo"
      audience="affiliate"
      audienceLabel="For partners"
      badge="Private demo page"
      title="Try the partner-side Nettmark flow before you ever create an account"
      subtitle="If you’re coming in from an ad, this is the fastest way to understand the platform — explore the short interactive demo, see how offers and campaigns work, then join if it makes sense."
      primaryCta={{
        label: "Start as a partner",
        href: "/for-partners",
      }}
      secondaryCta={{
        label: "View pricing",
        href: "/pricing",
      }}
      demoHref="https://app.storylane.io/demo/p83vbgruopoj?embed=inline"
      demoPadding="calc(65.41% + 25px)"
      demoTitle="Nettmark partner short demo"
      mobileDemoHref={partnerMobileDemoHref}
      mobileDemoPadding={partnerMobileDemoPadding}
      mobileDemoTitle="Nettmark partner mobile demo"
      bullets={[
        "Browse offers and understand the approval flow before you commit.",
        "See how organic posts and paid campaign requests fit into one partner workspace.",
        "No Stripe setup needed until you’re ready to withdraw earnings.",
      ]}
      demoIntroTitle="A 3-minute partner-side walkthrough"
      demoIntroCopy="See how partners find offers, prepare promotion requests, and understand what happens before a business approves paid activity."
      demoSteps={[
        "Find an offer",
        "Build a campaign",
        "Track approval and payouts",
      ]}
      objectionTitle="Made for partners who want clarity before they promote"
      objectionCards={[
        {
          title: "Know the rules upfront",
          copy: "Offer details, commission terms, and approval steps are visible before you spend time building campaigns.",
        },
        {
          title: "Organic or paid paths",
          copy: "Submit organic promotion proof or request paid campaigns when the business has Meta launch setup ready.",
        },
        {
          title: "Payouts when it matters",
          copy: "You can explore first and connect Stripe later when there are real earnings to withdraw.",
        },
      ]}
      footerTitle="Want to start promoting offers with real tracking and automated payouts?"
      footerCopy="Join as a partner, browse live offers, and move from interest to action without digging through the main website first."
    />
  );
}
