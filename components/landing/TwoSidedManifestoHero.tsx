"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const manifestoFrames = [
  {
    business: "Businesses need more distribution.",
    marketer: "Marketers need better opportunities.",
  },
  {
    business: "Businesses want growth without carrying all the advertising risk.",
    marketer: "Marketers want products worth promoting.",
  },
  {
    business: "Businesses keep control.",
    marketer: "Marketers drive performance.",
  },
  {
    business: "Businesses keep control.",
    marketer: "Marketers drive performance.",
    resolved: true,
  },
];

const finalStatement = "One marketplace. Both sides grow.";

function HeroCtas() {
  return (
    <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
      <Link
        href="/for-businesses"
        className="inline-flex items-center justify-center rounded-full bg-[#00C2CB] px-6 py-3 text-sm font-semibold text-black shadow-[0_0_28px_rgba(0,194,203,0.24)] transition hover:bg-[#00b0b8]"
      >
        Start as a business
      </Link>
      <Link
        href="/for-partners"
        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
      >
        Start as a marketer
      </Link>
    </div>
  );
}

function StatementText({
  children,
  align = "left",
  resolved = false,
  side,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  resolved?: boolean;
  side?: "business" | "marketer";
}) {
  const x = resolved ? (side === "business" ? 22 : side === "marketer" ? -22 : 0) : 0;

  return (
    <motion.p
      key={String(children)}
      initial={{ opacity: 0, y: 10, x: 0 }}
      animate={{ opacity: resolved ? 0.28 : 1, y: 0, x }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className={`text-balance text-[1.9rem] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[2.25rem] md:text-4xl lg:text-[4rem] ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : ""
      }`}
    >
      {children}
    </motion.p>
  );
}

function CenterMark({ resolved }: { resolved: boolean }) {
  return (
    <div className="relative flex h-full min-h-[248px] items-center justify-center">
      <motion.div
        className="absolute h-full w-px bg-gradient-to-b from-transparent via-white/18 to-transparent"
        animate={{ scaleY: resolved ? 0.58 : [0.72, 1, 0.86], opacity: resolved ? 0.34 : 0.72 }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-px w-[12rem] bg-gradient-to-r from-transparent via-[#7ff5fb]/45 to-transparent"
        animate={{ scaleX: resolved ? 1 : 0.42, opacity: resolved ? 0.72 : 0.22 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/12 bg-black/45 shadow-[0_0_55px_rgba(0,194,203,0.22),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
        animate={{
          scale: resolved ? 1.05 : 1,
          borderColor: resolved ? "rgba(127,245,251,0.34)" : "rgba(255,255,255,0.12)",
        }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      >
        <span className="text-sm font-bold tracking-[-0.03em] text-white">N</span>
      </motion.div>
    </div>
  );
}

function DesktopManifesto({ frameIndex, reduced }: { frameIndex: number; reduced: boolean }) {
  const frame = reduced ? manifestoFrames[3] : manifestoFrames[frameIndex];
  const resolved = Boolean(frame.resolved);

  return (
    <div className="relative hidden min-h-[580px] overflow-hidden rounded-[2.25rem] border border-white/8 bg-[#030707] px-8 py-9 shadow-[0_30px_120px_-55px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] md:block lg:min-h-[610px] lg:px-12 lg:py-10">
      <motion.div
        className="pointer-events-none absolute -left-28 top-6 h-[34rem] w-[34rem] rounded-full bg-[#00C2CB]/[0.16] blur-[110px]"
        animate={{ opacity: resolved ? 0.18 : 0.28, scale: resolved ? 1.04 : 1 }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-28 bottom-0 h-[34rem] w-[34rem] rounded-full bg-[#7ff5fb]/[0.14] blur-[110px]"
        animate={{ opacity: resolved ? 0.2 : 0.3, scale: resolved ? 1.04 : 1 }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C2CB]/[0.12] blur-[90px]"
        animate={{ opacity: resolved ? 0.52 : 0.12, scale: resolved ? 1.14 : 0.88 }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),transparent_26%),radial-gradient(circle_at_50%_0%,rgba(127,245,251,0.08),transparent_38%)]" />

      <div className="relative grid h-full min-h-[310px] grid-cols-[1fr_9rem_1fr] items-center gap-4 lg:grid-cols-[1fr_10rem_1fr] lg:gap-8">
        <div className="max-w-[31rem] justify-self-start">
          <p className="mb-5 text-xs uppercase tracking-[0.34em] text-[#7ff5fb]/45">Businesses</p>
          <StatementText side="business" resolved={resolved}>{frame.business}</StatementText>
        </div>

        <CenterMark resolved={resolved} />

        <div className="max-w-[31rem] justify-self-end">
          <p className="mb-5 text-right text-xs uppercase tracking-[0.34em] text-[#7ff5fb]/45">Marketers</p>
          <StatementText align="right" side="marketer" resolved={resolved}>{frame.marketer}</StatementText>
        </div>
      </div>

      <motion.div
        className="relative mx-auto mt-2 flex max-w-3xl flex-col items-center text-center"
        animate={{ y: resolved ? -8 : 0 }}
        transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-white/50"
          animate={{ opacity: resolved ? 1 : 0.54 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        >
          Nettmark connects the two sides
        </motion.div>
        <motion.h1
          className="text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.055em] text-white lg:text-6xl"
          animate={{ opacity: resolved ? 1 : 0.18, filter: resolved ? "blur(0px)" : "blur(1px)" }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {finalStatement}
        </motion.h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-white/58">
          Nettmark connects businesses seeking distribution with performance marketers looking for better opportunities.
        </p>
        <div className="mt-6">
          <HeroCtas />
        </div>
      </motion.div>
    </div>
  );
}

function MobileManifesto({ frameIndex, reduced }: { frameIndex: number; reduced: boolean }) {
  const frame = reduced ? manifestoFrames[3] : manifestoFrames[frameIndex];
  const resolved = Boolean(frame.resolved);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#030707] px-5 py-6 shadow-[0_24px_80px_-45px_rgba(0,0,0,0.86),inset_0_1px_0_rgba(255,255,255,0.08)] md:hidden">
      <motion.div
        className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-[#00C2CB]/[0.16] blur-[70px]"
        animate={{ opacity: resolved ? 0.14 : 0.26 }}
        transition={{ duration: 1.5 }}
      />
      <motion.div
        className="pointer-events-none absolute -right-20 top-44 h-56 w-56 rounded-full bg-[#7ff5fb]/[0.14] blur-[70px]"
        animate={{ opacity: resolved ? 0.16 : 0.26 }}
        transition={{ duration: 1.5 }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C2CB]/[0.10] blur-[60px]"
        animate={{ opacity: resolved ? 0.48 : 0.12, scale: resolved ? 1.08 : 0.9 }}
        transition={{ duration: 1.5 }}
      />

      <div className="relative text-center">
        <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-[#7ff5fb]/45">Businesses</p>
        <StatementText align="center" resolved={resolved}>{frame.business}</StatementText>

        <div className="mx-auto my-4 flex w-24 items-center justify-center gap-3">
          <motion.span
            className="h-px flex-1 bg-gradient-to-r from-transparent to-[#7ff5fb]/50"
            animate={{ scaleX: resolved ? 1 : 0.68, opacity: resolved ? 0.8 : 0.42 }}
            transition={{ duration: 1.2 }}
          />
          <motion.span
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/45 text-xs font-bold text-white shadow-[0_0_34px_rgba(0,194,203,0.22)]"
            animate={{ scale: resolved ? 1.04 : 1 }}
            transition={{ duration: 1.2 }}
          >
            N
          </motion.span>
          <motion.span
            className="h-px flex-1 bg-gradient-to-l from-transparent to-[#7ff5fb]/50"
            animate={{ scaleX: resolved ? 1 : 0.68, opacity: resolved ? 0.8 : 0.42 }}
            transition={{ duration: 1.2 }}
          />
        </div>

        <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-[#7ff5fb]/45">Marketers</p>
        <StatementText align="center" resolved={resolved}>{frame.marketer}</StatementText>

        <motion.div
          className="mt-5"
          animate={{ y: resolved ? -4 : 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.h1
            className="text-balance text-[2rem] font-semibold leading-[1.02] tracking-[-0.055em] text-white"
            animate={{ opacity: resolved ? 1 : 0.26 }}
            transition={{ duration: 1.2 }}
          >
            {finalStatement}
          </motion.h1>
          <p className="mx-auto mt-3 max-w-[19rem] text-sm leading-5 text-white/58">
            Connecting businesses seeking distribution with marketers looking for better opportunities.
          </p>
          <div className="mt-5">
            <HeroCtas />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function TwoSidedManifestoHero() {
  const prefersReducedMotion = useReducedMotion();
  const [frameIndex, setFrameIndex] = useState(0);

  const reduced = Boolean(prefersReducedMotion);
  const sequenceLength = useMemo(() => manifestoFrames.length, []);

  useEffect(() => {
    if (reduced) {
      setFrameIndex(sequenceLength - 1);
      return;
    }

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % sequenceLength);
    }, 4300);

    return () => window.clearInterval(interval);
  }, [reduced, sequenceLength]);

  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-12 lg:pb-16 lg:pt-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_32%,rgba(0,194,203,0.10),transparent_32%),radial-gradient(circle_at_78%_36%,rgba(127,245,251,0.09),transparent_34%),linear-gradient(180deg,rgba(3,10,11,0),rgba(0,0,0,0.34))]" />
      <div className="relative mx-auto max-w-7xl">
        <DesktopManifesto frameIndex={frameIndex} reduced={reduced} />
        <MobileManifesto frameIndex={frameIndex} reduced={reduced} />
      </div>
    </section>
  );
}
