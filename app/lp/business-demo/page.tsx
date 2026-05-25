import type { Metadata } from "next";
import StorylaneLandingPage from "@/components/marketing/StorylaneLandingPage";

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
      bullets={[
        "See the exact flow for publishing offers, reviewing partners, and keeping approvals tight.",
        "Understand how billing, wallet-funded spend, and automated payouts fit together without a long sales call.",
        "Use this page as a focused ad landing experience — product first, clutter removed.",
      ]}
      footerTitle="Ready to turn paid traffic into a controlled partner channel?"
      footerCopy="Create your brand account, connect billing and payouts, and launch your first offer without sending traffic back through a generic homepage funnel."
    />
  );
}
