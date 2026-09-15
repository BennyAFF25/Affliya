"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MetaSetupStatus = {
  isGrowth: boolean;
  hasMetaConnection: boolean;
  businessId: string | null;
  billingStatus: string;
};

export default function GrowthMetaSetupPrompt() {
  const [status, setStatus] = useState<MetaSetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isDashboard, setIsDashboard] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsDashboard(window.location.pathname === "/business/my-business");
  }, []);

  useEffect(() => {
    if (!isDashboard) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const loadStatus = async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/business/meta-setup-status", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;

        const json = (await response.json()) as MetaSetupStatus;
        if (cancelled) return;

        setStatus(json);

        if (json.businessId) {
          setDismissed(
            window.localStorage.getItem(
              `nettmark_meta_setup_dismissed:${json.businessId}`,
            ) === "true",
          );
        }

        const returnedFromTrial = new URLSearchParams(window.location.search).get("trial") === "started";
        if (returnedFromTrial && !json.isGrowth && attempts < 4) {
          timer = setTimeout(loadStatus, 1200);
        }
      } catch (error) {
        console.warn("[GrowthMetaSetupPrompt] status load failed", error);
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isDashboard]);

  if (!isDashboard || !status?.isGrowth || status.hasMetaConnection) {
    return null;
  }

  const dismiss = () => {
    if (status.businessId) {
      window.localStorage.setItem(
        `nettmark_meta_setup_dismissed:${status.businessId}`,
        "true",
      );
    }
    setDismissed(true);
  };

  if (dismissed) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 pt-4 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-semibold">Meta not connected.</span>{" "}
            Affiliate-funded paid campaigns are unavailable until you connect it.
          </div>
          <Link
            href="/business/my-business/connect-meta"
            className="shrink-0 font-semibold text-[#7ff5fb] hover:text-white"
          >
            Connect Meta →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pt-4 sm:px-6 lg:px-10">
      <section className="rounded-[24px] border border-[#00C2CB]/35 bg-[#101516] p-5 text-white shadow-[0_16px_50px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7ff5fb]">
              Growth setup
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
              Unlock affiliate-funded ads
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Connect your Meta account so affiliates can use their own ad budgets to run ads for your approved offers through your Meta account.
            </p>
            <p className="mt-2 text-sm font-medium text-white/85">
              Without Meta connected, affiliates can still promote organically — paid campaigns won&apos;t be available.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <Link
              href="/business/my-business/connect-meta"
              className="inline-flex items-center justify-center rounded-xl bg-[#00C2CB] px-5 py-3 text-sm font-bold text-black transition hover:bg-[#28d3da]"
            >
              Connect Meta
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center justify-center rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.04] hover:text-white"
            >
              Set up later
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
