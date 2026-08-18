import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";

export const metadata: Metadata = {
  title: "Nettmark Partner Program | Bring Businesses, Earn Commission",
  description:
    "Join the Nettmark Partner Program to refer new businesses, earn commission on successful activations, and unlock the Nettmark partner offer inside the affiliate marketplace.",
  alternates: {
    canonical: "/partner-program",
  },
  openGraph: {
    title: "Nettmark Partner Program",
    description:
      "Help bring new businesses onto Nettmark, earn commission, and access the Nettmark partner offer once you join as an affiliate.",
    url: "https://www.nettmark.com/partner-program",
    type: "website",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Who is the Nettmark Partner Program for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The Nettmark Partner Program is for reps, closers, agencies, operators, and growth-minded partners who can introduce new businesses to Nettmark.",
      },
    },
    {
      "@type": "Question",
      name: "How do I join the Nettmark Partner Program?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Join by creating an affiliate account. Once approved, you can access the Nettmark partner offer in the marketplace and start promoting Nettmark to new businesses.",
      },
    },
  ],
};

export default function PartnerProgramPage() {
  return (
    <div className="marketing-home-theme min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <MarketingHeader />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Limited release
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-bold sm:text-5xl">
            Help grow Nettmark by bringing new businesses onto the platform.
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-white/75 sm:text-base">
            The Nettmark Partner Program is built for reps, agencies, closers,
            and operators who can introduce businesses to Nettmark and help them
            get activated. If you bring in the right businesses, you earn
            commission for successful growth.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-white/65 sm:text-base">
            Spots are limited while we build this out with the right partners.
            Once you sign up, you&apos;ll use a normal affiliate account and gain
            access to the Nettmark partner offer inside the marketplace, where
            you can run ads and promote Nettmark through the same performance
            rails as the rest of the platform.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/create-account?role=affiliate"
              className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-5 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]"
            >
              Become a partner
            </Link>
            <Link
              href="/login/affiliate"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5"
            >
              Affiliate login
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Bring new businesses",
              copy: "Introduce brands, operators, or founders who are a strong fit for performance-led growth on Nettmark.",
            },
            {
              title: "Earn on activation",
              copy: "Get paid when the right businesses join and activate through the partner program.",
            },
            {
              title: "Use the marketplace",
              copy: "After signup, access the Nettmark partner offer inside the affiliate marketplace like any other affiliate opportunity.",
            },
            {
              title: "Run ads when ready",
              copy: "Promote Nettmark through the existing affiliate ad flow and scale once you know what messaging converts.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/75"
            >
              <p className="font-semibold text-white">{item.title}</p>
              <p className="mt-2">{item.copy}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              How it works
            </p>
            <div className="mt-5 space-y-4">
              {[
                {
                  step: "1",
                  title: "Create your affiliate account",
                  copy: "Join through the normal affiliate signup flow. No separate partner login is needed.",
                },
                {
                  step: "2",
                  title: "Get access to the Nettmark partner offer",
                  copy: "Once inside, you&apos;ll be able to access the dedicated Nettmark partner offer in the marketplace.",
                },
                {
                  step: "3",
                  title: "Refer qualified businesses",
                  copy: "Use your own outreach, network, content, or ads to bring in businesses that are a strong fit for Nettmark.",
                },
                {
                  step: "4",
                  title: "Earn commission on successful growth",
                  copy: "When those businesses join and activate through the program, you participate in the upside.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#00C2CB]/40 bg-[#00C2CB]/10 text-sm font-semibold text-[#7ff5fb]">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-white/70">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              What we&apos;re looking for
            </p>
            <ul className="mt-5 space-y-3 text-sm text-white/75">
              {[
                "People who can open real doors with business owners",
                "Partners who understand growth, offers, or performance marketing",
                "Agencies, reps, and operators with strong business relationships",
                "Quality over volume — the right fit matters more than mass lead gen",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#00C2CB]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl border border-[#00C2CB]/20 bg-[#00C2CB]/8 p-5">
              <p className="text-sm font-semibold text-white">Important</p>
              <p className="mt-2 text-sm text-white/70">
                This program is being opened in limited spots. We want strong
                partners who can bring in aligned businesses and grow with us
                long term.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            FAQ
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              {
                q: "Do I need a special account type?",
                a: "No. You join with a normal affiliate account. The partner program lives inside the existing affiliate experience.",
              },
              {
                q: "What happens after I sign up?",
                a: "You&apos;ll be able to access the Nettmark partner offer in the marketplace and use the platform&apos;s normal promotion flows.",
              },
              {
                q: "Can I run ads for the program?",
                a: "Yes — that&apos;s part of the point. The partner offer will let you use Nettmark&apos;s normal affiliate promotion flow, including ads where appropriate.",
              },
              {
                q: "Is everyone accepted?",
                a: "No. We&apos;re keeping the program selective while spots are limited and we shape the right partner base.",
              },
            ].map((item) => (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="font-semibold text-white">{item.q}</p>
                <p className="mt-2 text-sm text-white/70">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-[#00C2CB]/20 bg-gradient-to-r from-[#00C2CB22] via-transparent to-[#7ff5fb22] p-6 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-[#7ff5fb]">
            Ready to join?
          </p>
          <h2 className="mt-3 text-2xl font-bold sm:text-4xl">
            Become a Nettmark partner and help bring the next wave of businesses onto the platform.
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-white/75 sm:text-base">
            Start with an affiliate account, unlock the Nettmark partner offer,
            and grow from there.
          </p>
          <div className="mt-6">
            <Link
              href="/create-account?role=affiliate"
              className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black hover:bg-[#00b0b8]"
            >
              Become a partner
            </Link>
          </div>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  );
}
