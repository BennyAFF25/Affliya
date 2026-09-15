"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MetaSetupStatus = {
  isGrowth: boolean;
  hasMetaConnection: boolean;
  businessId: string | null;
  billingStatus: string;
  currentPeriodEnd: string | null;
};

function formatTrialEnd(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTrialDaysLeft(value: string | null) {
  if (!value) return null;
  const end = new Date(value).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function GrowthMetaSetupPrompt() {
  const [status, setStatus] = useState<MetaSetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isDashboard, setIsDashboard] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

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

  const isTrial = status?.billingStatus === "subscription_trialing";
  const trialEndLabel = useMemo(
    () => formatTrialEnd(status?.currentPeriodEnd || null),
    [status?.currentPeriodEnd],
  );
  const trialDaysLeft = useMemo(
    () => getTrialDaysLeft(status?.currentPeriodEnd || null),
    [status?.currentPeriodEnd],
  );

  if (!isDashboard || !status?.isGrowth) {
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

  const manageTrial = async () => {
    if (!status.businessId || openingPortal) return;

    setOpeningPortal(true);
    try {
      const response = await fetch("/api/business-subscription/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: status.businessId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.url) {
        throw new Error(json?.error || "Could not open billing portal");
      }
      window.location.assign(json.url);
    } catch (error) {
      console.error("[GrowthMetaSetupPrompt] billing portal failed", error);
      setOpeningPortal(false);
    }
  };

  const showMetaPrompt = !status.hasMetaConnection;

  if (!isTrial && !showMetaPrompt) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 px-4 pt-4 sm:px-6 lg:px-10">
      {isTrial && (
        <section className="flex flex-col gap-4 rounded-2xl border border-[#00C2CB]/25 bg-[#00C2CB]/[0.055] px-4 py-4 text-white shadow-[0_10px_35px_rgba(0,0,0,0.12)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#7ff5fb]">Growth trial</span>
              {trialDaysLeft !== null && (
                <span className="rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7ff5fb]">
                  {trialDaysLeft === 0 ? "Ends today" : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-white/65">
              Affiliate-funded ads are enabled during your trial
              {trialEndLabel ? ` through ${trialEndLabel}` : ""}. After that, Growth is $49/month unless cancelled.
            </p>
          </div>
          <button
            type="button"
            onClick={manageTrial}
            disabled={openingPortal}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[#00C2CB]/35 bg-[#00C2CB]/10 px-4 py-2.5 text-sm font-semibold text-[#7ff5fb] transition hover:bg-[#00C2CB]/15 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {openingPortal ? "Opening…" : "Manage trial"}
          </button>
        </section>
      )}

      {showMetaPrompt && dismissed && (
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
      )}

      {showMetaPrompt && !dismissed && (
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
      )}
    </div>
  );
}
