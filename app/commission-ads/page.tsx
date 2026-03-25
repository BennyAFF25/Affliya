import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";

export const metadata: Metadata = {
  title: "Commission Ads Platform | Nettmark",
  description:
    "Run commission ads with guardrails, tracked conversions, wallet-funded spend, and automated Stripe payouts on Nettmark.",
  alternates: {
    canonical: "/commission-ads",
  },
  openGraph: {
    title: "Commission Ads Platform | Nettmark",
    description:
      "Nettmark helps brands and partners run commission ads with transparent tracking and automated payouts.",
    url: "https://www.nettmark.com/commission-ads",
    type: "website",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What are commission ads?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Commission ads are campaigns where payout is tied to verified outcomes, not fixed media retainers.",
      },
    },
    {
      "@type": "Question",
      name: "How does Nettmark handle commission ad payouts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Nettmark tracks performance events, reconciles wallet flows, and automates payouts through Stripe once conversions clear.",
      },
    },
  ],
};

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Nettmark",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://www.nettmark.com/commission-ads",
  description:
    "Commission ads platform for brands and partners with policy guardrails, tracking, and automated payouts.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function CommissionAdsPage() {
  return (
    <div className="marketing-home-theme min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <MarketingHeader />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Category
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            Commission Ads
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-white/75 sm:text-base">
            Nettmark is built for commission ads: brands set guardrails and
            offers, partners drive traffic, and payouts are triggered from
            verified outcomes. No spreadsheet reconciliation. No payout
            guesswork.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
              <p className="font-semibold text-white">Policy-first approvals</p>
              <p className="mt-1">
                Review creatives and campaigns before anything goes live.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
              <p className="font-semibold text-white">Unified tracking</p>
              <p className="mt-1">
                Clicks, carts, and conversions tied to one performance ledger.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
              <p className="font-semibold text-white">Automated payouts</p>
              <p className="mt-1">
                Wallet-funded spend and Stripe-backed settlement rails.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/for-businesses"
              className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]"
            >
              Start as a brand
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5"
            >
              View pricing
            </Link>
          </div>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
    </div>
  );
}
