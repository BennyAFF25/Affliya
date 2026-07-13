"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, TrendingUp } from "lucide-react";

const desktopPaths = [
  "M110 168 C205 126 272 128 360 224",
  "M110 300 C202 318 278 306 360 262",
  "M110 430 C216 442 282 378 360 300",
  "M610 166 C520 126 452 128 360 224",
  "M610 304 C518 318 442 304 360 262",
  "M610 430 C504 442 438 378 360 300",
];

const mobilePaths = [
  "M90 92 C125 128 154 155 180 198",
  "M270 92 C235 128 206 155 180 198",
  "M88 420 C126 382 154 346 180 290",
  "M272 420 C234 382 206 346 180 290",
];

const statusCycle = ["Matched", "Approved", "Campaign live", "Sale", "Growth"];

function StatusStack({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      {statusCycle.map((label, index) => (
        <motion.div
          key={label}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[11px] font-medium text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
          animate={{
            opacity: [0.38, 1, 0.52],
            x: compact ? [0, 0, 0] : [0, 4, 0],
            borderColor: [
              "rgba(255,255,255,0.10)",
              "rgba(0,194,203,0.42)",
              "rgba(255,255,255,0.10)",
            ],
          }}
          transition={{
            duration: 7.5,
            repeat: Infinity,
            delay: index * 0.72,
            ease: "easeInOut",
          }}
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#00C2CB]/15 text-[#7ff5fb]">
            <Check className="h-2.5 w-2.5" />
          </span>
          {label}
        </motion.div>
      ))}
    </div>
  );
}

function NodeCard({
  title,
  label,
  align = "left",
  delay = 0,
}: {
  title: string;
  label: string;
  align?: "left" | "right" | "center";
  delay?: number;
}) {
  return (
    <motion.div
      className={`rounded-2xl border border-white/10 bg-white/[0.055] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-2xl ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : ""
      }`}
      animate={{ y: [0, -7, 0], opacity: [0.78, 1, 0.82] }}
      transition={{ duration: 8, repeat: Infinity, delay, ease: "easeInOut" }}
    >
      <div
        className={`mb-3 flex items-center gap-2 ${
          align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""
        }`}
      >
        <span className="h-2 w-2 rounded-full bg-[#7ff5fb] shadow-[0_0_14px_rgba(127,245,251,0.9)]" />
        <span className="text-[10px] uppercase tracking-[0.24em] text-white/38">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#00C2CB] to-[#7ff5fb]"
          animate={{ width: ["26%", "78%", "42%"] }}
          transition={{ duration: 6.5, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

function AnimatedNetwork({ mobile = false }: { mobile?: boolean }) {
  const paths = mobile ? mobilePaths : desktopPaths;
  const viewBox = mobile ? "0 0 360 520" : "0 0 720 560";

  return (
    <svg
      className="absolute inset-0 h-full w-full overflow-visible"
      viewBox={viewBox}
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={mobile ? "mobileLine" : "desktopLine"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00C2CB" stopOpacity="0.05" />
          <stop offset="46%" stopColor="#7FF5FB" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00C2CB" stopOpacity="0.08" />
        </linearGradient>
        <filter id={mobile ? "mobileGlow" : "desktopGlow"} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0 0 0 0 0 0.76 0 0 0 0 0.80 0 0 0 .48 0" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paths.map((d, index) => (
        <g key={d}>
          <path d={d} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <motion.path
            d={d}
            stroke={`url(#${mobile ? "mobileLine" : "desktopLine"})`}
            strokeWidth={mobile ? "1.4" : "1.6"}
            strokeLinecap="round"
            filter={`url(#${mobile ? "mobileGlow" : "desktopGlow"})`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1, 1], opacity: [0, 0.95, 0.28] }}
            transition={{
              duration: 6.8,
              repeat: Infinity,
              delay: index * 0.48,
              ease: "easeInOut",
            }}
          />
          <circle r={mobile ? "3.3" : "3.7"} fill="#7FF5FB" opacity="0.9">
            <animateMotion dur={`${5.8 + index * 0.18}s`} repeatCount="indefinite" begin={`${index * 0.42}s`} path={d} />
            <animate attributeName="opacity" values="0;1;0" dur={`${5.8 + index * 0.18}s`} repeatCount="indefinite" begin={`${index * 0.42}s`} />
          </circle>
        </g>
      ))}
    </svg>
  );
}

function CenterEngine({ compact = false }: { compact?: boolean }) {
  return (
    <motion.div
      className={`relative z-10 mx-auto flex ${compact ? "h-28 w-28" : "h-40 w-40"} items-center justify-center rounded-full border border-[#7ff5fb]/20 bg-[radial-gradient(circle_at_50%_36%,rgba(127,245,251,0.22),rgba(0,194,203,0.08)_38%,rgba(5,16,18,0.92)_74%)] shadow-[0_0_70px_rgba(0,194,203,0.32),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-2xl`}
      animate={{ scale: [1, 1.035, 1], boxShadow: ["0 0 54px rgba(0,194,203,0.22)", "0 0 86px rgba(0,194,203,0.42)", "0 0 54px rgba(0,194,203,0.22)"] }}
      transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {[0, 1, 2].map((ring) => (
        <motion.span
          key={ring}
          className="absolute inset-0 rounded-full border border-[#7ff5fb]/20"
          animate={{ scale: [1, 1.55], opacity: [0.36, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, delay: ring * 1.25, ease: "easeOut" }}
        />
      ))}
      <div className="relative text-center">
        <p className={`${compact ? "text-xl" : "text-2xl"} font-extrabold tracking-tight text-white`}>Nettmark</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-[#7ff5fb]/75">Engine</p>
      </div>
    </motion.div>
  );
}

export default function ConnectionEngineHero() {
  return (
    <div className="relative w-full max-w-full min-w-0">
      <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(55%_55%_at_50%_50%,rgba(0,194,203,0.26),transparent_72%)] blur-3xl" />

      <div className="relative hidden min-h-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025)_45%,rgba(0,194,203,0.055))] shadow-[0_28px_90px_-26px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(127,245,251,0.12),transparent_24%),radial-gradient(circle_at_82%_72%,rgba(0,194,203,0.13),transparent_26%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:100%_100%,100%_100%,48px_48px,48px_48px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7ff5fb]/60 to-transparent" />
        <AnimatedNetwork />

        <div className="absolute left-9 top-[92px] w-44"><NodeCard title="Retail brands" label="Businesses" delay={0.2} /></div>
        <div className="absolute left-8 top-[268px] w-40"><NodeCard title="SaaS teams" label="Campaigns" delay={1.1} /></div>
        <div className="absolute left-11 top-[410px] w-44"><NodeCard title="Product offers" label="Opportunity" delay={1.8} /></div>

        <div className="absolute right-8 top-[94px] w-44"><NodeCard title="Media buyers" label="Affiliates" align="right" delay={0.7} /></div>
        <div className="absolute right-10 top-[272px] w-40"><NodeCard title="Creators" label="Channels" align="right" delay={1.45} /></div>
        <div className="absolute right-9 top-[410px] w-44"><NodeCard title="Partners" label="Growth" align="right" delay={2.1} /></div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <CenterEngine />
        </div>

        <div className="absolute bottom-8 left-1/2 w-64 -translate-x-1/2 rounded-3xl border border-white/10 bg-black/30 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-[0.26em] text-white/42">Trust sequence</span>
            <TrendingUp className="h-3.5 w-3.5 text-[#7ff5fb]" />
          </div>
          <StatusStack />
        </div>
      </div>

      <div className="relative max-w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(155deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025)_48%,rgba(0,194,203,0.065))] p-4 shadow-[0_24px_72px_-24px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl lg:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(127,245,251,0.16),transparent_32%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:100%_100%,38px_38px,38px_38px]" />
        <div className="relative mx-auto h-[520px] w-full max-w-[360px]">
          <AnimatedNetwork mobile />
          <div className="absolute left-0 top-5 w-[138px]"><NodeCard title="Brands" label="Businesses" delay={0.2} /></div>
          <div className="absolute right-0 top-5 w-[138px]"><NodeCard title="Partners" label="Affiliates" align="right" delay={0.8} /></div>
          <div className="absolute left-1/2 top-[198px] -translate-x-1/2"><CenterEngine compact /></div>
          <div className="absolute bottom-4 left-0 w-[142px]"><NodeCard title="Offers" label="Supply" delay={1.2} /></div>
          <div className="absolute bottom-4 right-0 w-[142px]"><NodeCard title="Growth" label="Demand" align="right" delay={1.65} /></div>
          <div className="absolute left-1/2 top-[330px] w-52 -translate-x-1/2 rounded-3xl border border-white/10 bg-black/30 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
            <StatusStack compact />
          </div>
        </div>
      </div>
    </div>
  );
}
