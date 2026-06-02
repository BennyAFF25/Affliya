import React from "react";
import type { Metadata } from "next";
import StorylaneLandingPage from "@/components/marketing/StorylaneLandingPage";

const partnerMobileDemoHref = process.env.NEXT_PUBLIC_STORYLANE_PARTNER_MOBILE_DEMO_URL;
const partnerMobileDemoPadding = process.env.NEXT_PUBLIC_STORYLANE_PARTNER_MOBILE_DEMO_PADDING;

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
        "Walk through finding offers, launching campaigns, and understanding how approvals work before you commit.",
        "See the actual affiliate-side product instead of reading generic feature copy.",
        "No need to connect Stripe until your first sale — connect when you're ready to withdraw.",
        "Perfect for paid campaigns where you want cold traffic to hit the demo immediately.",
      ]}
      footerTitle="Want to start promoting offers with real tracking and automated payouts?"
      footerCopy="Join as a partner, browse live offers, and move from interest to action without digging through the main website first."
    />
  );
}
