import { Zap, LineChart, ShieldCheck, Layers } from "lucide-react";

const features = [
  {
    title: "Instant tracking",
    description: "Visitors are routed through Nettmark /go links for airtight attribution.",
    icon: Zap,
  },
  {
    title: "Creator-first",
    description: "Pick and order offers however you like—no templates to fight with.",
    icon: Layers,
  },
  {
    title: "Conversion-ready",
    description: "Auto-optimized product tiles keep mobile + desktop parity without extra work.",
    icon: LineChart,
  },
  {
    title: "Protected payouts",
    description: "Stripe-backed wallet + instant ledger audit for every referral.",
    icon: ShieldCheck,
  },
];

export function ShopHighlights() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div
            key={feature.title}
            className="rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-4 flex gap-4"
          >
            <div className="h-12 w-12 rounded-2xl bg-[#00C2CB]/10 flex items-center justify-center text-[#00C2CB]">
              <Icon size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{feature.title}</p>
              <p className="text-xs text-white/60 mt-1">{feature.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
