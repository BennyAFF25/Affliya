import type { Metadata } from "next";
import StorylaneLandingPage from "@/components/marketing/StorylaneLandingPage";

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
      bullets={[
        "Walk through finding offers, launching campaigns, and understanding how approvals work before you commit.",
        "See the actual affiliate-side product instead of reading generic feature copy.",
        "Perfect for paid campaigns where you want cold traffic to hit the demo immediately.",
      ]}
      footerTitle="Want to start promoting offers with real tracking and automated payouts?"
      footerCopy="Join as a partner, browse live offers, and move from interest to action without digging through the main website first."
    />
  );
}
