import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Globe2,
  LockKeyhole,
  Rocket,
  Tag,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";
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
      name: "Do I need a special account type?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. You join with a normal affiliate account. The partner program lives inside the existing affiliate experience.",
      },
    },
    {
      "@type": "Question",
      name: "Can I run ads to promote Nettmark?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Once you have access to the Nettmark partner offer, you can use Nettmark's normal affiliate promotion flows, including ads where appropriate.",
      },
    },
    {
      "@type": "Question",
      name: "What happens after I sign up?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "After signup, you can access the Nettmark partner offer in the marketplace and start using the platform's partner promotion flow.",
      },
    },
    {
      "@type": "Question",
      name: "Is everyone accepted?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The program is selective and limited while Nettmark brings in its first group of aligned partners.",
      },
    },
  ],
};

const faqItems = [
  {
    q: "Do I need a special account type?",
    a: "No. You join with a normal affiliate account. The partner program lives inside the existing affiliate experience.",
  },
  {
    q: "Can I run ads to promote Nettmark?",
    a: "Yes. Once you have the Nettmark partner offer, you can use the platform's normal affiliate promotion flow, including ads where appropriate.",
  },
  {
    q: "What happens after I sign up?",
    a: "You'll be able to access the Nettmark partner offer in the marketplace and use the platform's normal promotion flow from there.",
  },
  {
    q: "When do I earn commission?",
    a: "You earn when qualifying businesses join Nettmark, activate, and pay through the partner program flow.",
  },
  {
    q: "Can I participate from anywhere?",
    a: "Yes. The program is designed for reps, agencies, closers, and operators who can bring in the right businesses from anywhere.",
  },
  {
    q: "Is everyone accepted?",
    a: "No. We're keeping the first intake selective while partner spots are limited.",
  },
];

export default function PartnerProgramPage() {
  return (
    <div className="marketing-home-theme min-h-screen bg-[#05090c] text-white">
      <MarketingHeader />

      <main className="mx-auto max-w-[1320px] px-5 pb-16 pt-6 sm:px-6 lg:px-8">
        <Hero />
        <HowItWorks />
        <LowerGrid />
        <FooterTrust />
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  );
}

function Hero() {
  return (
    <section className="grid gap-8 py-8 lg:py-10 xl:grid-cols-[minmax(0,1.05fr)_360px] xl:items-center xl:gap-10">
      <div>
        <div className="mb-5 text-xs font-semibold uppercase tracking-[0.26em] text-cyan-400">
          Partner Program
        </div>

        <h1 className="max-w-[760px] text-5xl font-bold leading-[1.04] tracking-[-0.04em] sm:text-6xl">
          Earn by bringing
          <br />
          businesses to <span className="text-cyan-400">Nettmark.</span>
        </h1>

        <p className="mt-5 max-w-[740px] text-base leading-7 text-slate-300 sm:text-lg">
          Join Nettmark&apos;s first group of partners and earn commission when
          you bring in qualifying businesses that activate and pay. You&apos;ll sign
          up as an affiliate, unlock the Nettmark partner offer in the
          marketplace, and use Nettmark&apos;s own promotion rails to help grow the
          platform.
        </p>

        <div className="mt-7 grid max-w-[760px] gap-4 sm:grid-cols-3">
          <MiniBenefit
            icon={<CircleDollarSign size={21} />}
            title="Earn on activation"
            subtitle="Get paid when the right businesses join and activate"
          />
          <MiniBenefit
            icon={<Globe2 size={21} />}
            title="Work from anywhere"
            subtitle="No quotas, fixed hours, or minimums"
          />
          <MiniBenefit
            icon={<TrendingUp size={21} />}
            title="Built-in promotion tools"
            subtitle="Use Nettmark's offer flow, marketplace, and ad rails"
          />
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3.5">
          <Link
            href="/create-account?role=affiliate"
            className="flex items-center gap-2 rounded-xl bg-cyan-400 px-7 py-4 text-sm font-bold text-black shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300"
          >
            Become a partner
            <ArrowRight size={17} />
          </Link>

          <a
            href="#how-it-works"
            className="rounded-xl border border-white/15 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            How it works
          </a>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-cyan-400 text-[10px] font-black text-black">
            !
          </span>
          Limited partner spots. First intake open now.
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-center">
        <OrbitGraphic />

        <div className="rounded-[24px] border border-cyan-400/30 bg-[#0c1115] p-6 xl:p-7 shadow-2xl shadow-cyan-500/5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">
            Your impact. Your upside.
          </div>

          <div className="mt-4 text-5xl font-bold tracking-tight text-white">
            New business growth
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            Bring the right businesses onto Nettmark and participate in the
            growth that follows when they successfully activate.
          </p>

          <div className="my-5 border-t border-white/10" />

          <div className="space-y-3 text-sm text-slate-300">
            <CheckRow text="Join using a normal affiliate account" />
            <CheckRow text="Unlock the Nettmark partner offer" />
            <CheckRow text="Promote with content, outreach, or ads" />
            <CheckRow text="Built for reps, agencies, and operators" />
            <CheckRow text="Selective first intake" />
          </div>

          <div className="my-5 border-t border-white/10" />

          <p className="text-sm text-slate-300">
            Helping businesses grow.
            <br />
            <span className="text-cyan-400">Helping you earn.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function MiniBenefit({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.015] p-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cyan-400/40 text-cyan-400">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</div>
      </div>
    </div>
  );
}

function OrbitGraphic() {
  return (
    <div className="relative hidden min-h-[320px] items-center justify-center xl:flex">
      <div className="absolute h-[330px] w-[330px] rounded-full border border-cyan-400/10" />
      <div className="absolute h-[250px] w-[250px] rounded-full border border-cyan-400/20" />
      <div className="absolute h-[170px] w-[170px] rounded-full border border-cyan-400/25" />
      <div className="absolute h-[88px] w-[88px] rounded-full border border-cyan-400/35" />

      <span className="absolute left-[28%] top-[22%] h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,.9)]" />
      <span className="absolute bottom-[18%] right-[20%] h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,.9)]" />

      <div className="grid h-16 w-16 place-items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-3xl font-black text-cyan-400">
        N
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: <UserRound size={24} />,
      title: "Join",
      text: "Create your account through the affiliate signup flow. No separate partner login is needed.",
    },
    {
      icon: <Tag size={24} />,
      title: "Get the Nettmark offer",
      text: "Access the dedicated Nettmark partner offer inside the marketplace after you join.",
    },
    {
      icon: <Rocket size={24} />,
      title: "Bring businesses",
      text: "Use your network, outreach, content, or ads to introduce qualified businesses to Nettmark.",
    },
    {
      icon: <CircleDollarSign size={24} />,
      title: "Earn commission",
      text: "When those businesses activate and pay, you participate in the upside through the partner offer.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="mt-8 rounded-[24px] border border-white/10 bg-[#0b1014] p-6 lg:mt-10 lg:p-8"
    >
      <div className="mb-7 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
        How it works
      </div>

      <div className="grid gap-6 xl:grid-cols-[repeat(4,minmax(0,1fr))_240px] xl:gap-7">
        {steps.map((step, index) => (
          <div key={step.title} className="relative rounded-2xl border border-white/6 bg-white/[0.015] p-4 xl:border-0 xl:bg-transparent xl:p-0">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-cyan-400/40 text-cyan-400">
                {step.icon}
              </div>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-400 text-[10px] font-black text-black">
                {index + 1}
              </span>
            </div>

            <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>

            {index < steps.length - 1 && (
              <ArrowRight
                size={20}
                className="absolute -right-4 top-4 hidden text-slate-500 xl:block"
              />
            )}
          </div>
        ))}

        <div className="border-t border-white/10 pt-6 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
          <h3 className="text-lg font-semibold">Ready to start?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Join the first group of partners helping businesses discover
            Nettmark.
          </p>
          <Link
            href="/create-account?role=affiliate"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-cyan-300"
          >
            Become a partner
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function LowerGrid() {
  return (
    <section className="mt-8 grid gap-6 xl:mt-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.88fr)_minmax(300px,0.88fr)] xl:items-start">
      <div>
        <div className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
          More than just a referral link
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
          <FeatureCard
            icon={<UsersRound size={23} />}
            title="Built for operators"
            text="Made for reps, agencies, closers, and connectors who can open real doors with businesses."
          />
          <FeatureCard
            icon={<Rocket size={23} />}
            title="Tools to distribute"
            text="Access marketplace infrastructure, promotion rails, and the Nettmark partner offer inside the platform."
          />
          <FeatureCard
            icon={<TrendingUp size={23} />}
            title="Clear growth angle"
            text="You are helping bring new businesses onto Nettmark, not just dropping a generic referral link."
          />
          <FeatureCard
            icon={<LockKeyhole size={23} />}
            title="Limited first intake"
            text="We're opening this to a small first cohort while we shape the right partner base."
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-cyan-400/20 bg-[linear-gradient(135deg,#09272b_0%,#0c1115_55%,#0c1115_100%)] p-6 xl:p-7">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
          Ready to make an impact?
        </div>

        <h3 className="mt-4 text-2xl font-bold">
          Become a Nettmark partner today.
        </h3>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          Help more businesses grow, get access to the Nettmark partner offer,
          and use the same marketplace and ad infrastructure Nettmark is built
          on.
        </p>

        <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-[#08191b] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="text-sm font-semibold text-cyan-300">Important</p>
          <p className="mt-2 text-sm leading-6 text-white/85">
            This program is selective. We want strong partners who can bring in
            aligned businesses and grow with us long term.
          </p>
        </div>

        <Link
          href="/create-account?role=affiliate"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-bold text-black transition hover:bg-cyan-300"
        >
          Become a partner
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-[#0b1014] p-6 xl:p-7">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
          FAQ
        </div>
        <div className="mt-5 space-y-4">
          {faqItems.map((item) => (
            <div key={item.q} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">{item.q}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="h-full rounded-[22px] border border-white/10 bg-[#0b1014] p-5 xl:p-6">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-cyan-400/35 text-cyan-400">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

function FooterTrust() {
  return (
    <section className="mt-8 rounded-[24px] border border-white/10 bg-[#0b1014] px-6 py-5 xl:mt-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
            Nettmark partner program
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Join as an affiliate, access the Nettmark partner offer in the
            marketplace, and help bring the next wave of businesses onto the
            platform.
          </p>
        </div>
        <Link
          href="/create-account?role=affiliate"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
        >
          Become a partner
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-cyan-400 text-black">
        <Check size={12} strokeWidth={3} />
      </div>
      <span>{text}</span>
    </div>
  );
}
