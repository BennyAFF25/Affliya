"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  image: string;
  hotspot: { x: number; y: number };
  cursorStart?: { x: number; y: number };
  accentLabel?: string;
};

type InteractiveTourProps = {
  title?: string;
  subtitle?: string;
  steps: TourStep[];
  autoPlayMs?: number;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export default function InteractiveTour({
  title = "Guided setup tour",
  subtitle = "Watch the exact clicks a business would make.",
  steps,
  autoPlayMs = 2600,
}: InteractiveTourProps) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const total = steps.length;
  const step = steps[index] || null;

  useEffect(() => {
    if (!isPlaying || total <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, autoPlayMs);

    return () => window.clearInterval(timer);
  }, [autoPlayMs, isPlaying, total]);

  const cursorStart = useMemo(() => {
    if (!step) return { x: 16, y: 20 };
    return step.cursorStart || {
      x: clampPercent(step.hotspot.x - 10),
      y: clampPercent(step.hotspot.y - 10),
    };
  }, [step]);

  if (!step || total === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted-foreground)]">
        No tour steps yet. Add your business setup slides and step data to enable the walkthrough.
      </div>
    );
  }

  const imageMissing = !!failedImages[step.id];

  return (
    <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[#06080b] shadow-[0_30px_90px_rgba(0,0,0,0.38)]">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#12081d] via-[#0b0f12] to-[#09060f] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-300">
              Interactive walkthrough
            </p>
            <h3 className="mt-3 text-xl font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-white/65">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsPlaying((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
            >
              {isPlaying ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.55fr)_380px]">
        <div className="relative border-b border-white/10 bg-[#05070a] lg:border-b-0 lg:border-r lg:border-white/10">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.01 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative aspect-[16/10] w-full overflow-hidden"
            >
              {!imageMissing ? (
                <img
                  src={step.image}
                  alt={step.title}
                  className="h-full w-full object-cover object-top"
                  onError={() =>
                    setFailedImages((prev) => ({ ...prev, [step.id]: true }))
                  }
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(217,70,239,0.18),_transparent_55%),linear-gradient(180deg,#0a0d11_0%,#05070a_100%)] p-8 text-center">
                  <div className="max-w-md rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-8">
                    <p className="text-sm font-semibold text-white">
                      Add slide image
                    </p>
                    <p className="mt-2 text-sm text-white/65">
                      Couldn’t find <span className="font-mono text-fuchsia-300">{step.image}</span>.
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      Drop your downloaded setup slide into that path and this step will render automatically.
                    </p>
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-transparent" />

              <motion.div
                key={`${step.id}-cursor`}
                className="pointer-events-none absolute z-20"
                initial={{
                  left: `${cursorStart.x}%`,
                  top: `${cursorStart.y}%`,
                  opacity: 0,
                  scale: 0.92,
                }}
                animate={{
                  left: `${step.hotspot.x}%`,
                  top: `${step.hotspot.y}%`,
                  opacity: [0, 1, 1],
                  scale: [0.92, 1, 1],
                }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                style={{ transform: "translate(-50%, -50%)" }}
              >
                <div className="relative h-16 w-16">
                  <motion.div
                    className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-400/40"
                    animate={{ scale: [0.9, 1.55], opacity: [0.75, 0] }}
                    transition={{ duration: 1.35, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/70 bg-fuchsia-500/20 backdrop-blur-sm"
                    animate={{ scale: [1, 1.18, 1], opacity: [0.9, 1, 0.9] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.95)]" />
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col justify-between bg-[#090c10] p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                Step {index + 1} of {total}
              </span>
              {step.accentLabel ? (
                <span className="rounded-full border border-fuchsia-400/15 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold text-fuchsia-300">
                  {step.accentLabel}
                </span>
              ) : null}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${step.id}-copy`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="mt-5"
              >
                <h4 className="text-2xl font-semibold leading-tight text-white">
                  {step.title}
                </h4>
                <p className="mt-3 text-sm leading-7 text-white/68">
                  {step.body}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 space-y-2">
              {steps.map((item, itemIndex) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIndex(itemIndex);
                    setIsPlaying(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    itemIndex === index
                      ? "border-fuchsia-400/30 bg-fuchsia-500/10"
                      : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      itemIndex === index
                        ? "bg-fuchsia-400 text-black"
                        : "bg-white/8 text-white/70"
                    }`}
                  >
                    {itemIndex + 1}
                  </span>
                  <span className="min-w-0 text-sm font-medium text-white/84">
                    {item.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-4 flex gap-1.5">
              {steps.map((item, itemIndex) => (
                <div
                  key={item.id}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8"
                >
                  <motion.div
                    className="h-full rounded-full bg-fuchsia-400"
                    initial={false}
                    animate={{
                      width: itemIndex < index ? "100%" : itemIndex === index ? "100%" : "0%",
                      opacity: itemIndex === index ? 1 : itemIndex < index ? 0.8 : 0.35,
                    }}
                    transition={{ duration: itemIndex === index ? autoPlayMs / 1000 : 0.2, ease: "linear" }}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setIndex((current) => (current - 1 + total) % total);
                  setIsPlaying(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                Back
              </button>

              <button
                type="button"
                onClick={() => {
                  setIndex((current) => (current + 1) % total);
                  setIsPlaying(false);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Next
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
